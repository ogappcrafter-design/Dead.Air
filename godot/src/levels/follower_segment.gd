class_name FollowerSegment
extends Node3D

## Segment 2C: "The Follower" — third segment of Phase 2 (DEA-119).
##
## The radio suddenly drops to dead air. Signal = 0. Silence.
## Then: a sound behind the player. Not on the radio. In the world.
## Something is there. The player cannot turn around (fixed camera —
## you can hear it but not see it). The radio static increases as the
## thing gets closer. The player must tune away from the dead air to
## restore signal. Signal = directional. Tune toward the Neighborhood.
## The static tells you the thing is behind you.
## The player must reach a house and enter (hide mechanic tutorial).
## Hiding: enter the house, close the door, hide behind the couch.
## Hold breath (hold_breath action). The thing passes outside — shadow
## across the windows. Radio static peaks, then fades.
## Audio: the silence when hiding is total. The player's breathing is
## the only sound. The thing outside is heard through the radio static,
## not directly.
##
## GDD: Phase 2, Segment 2C.

signal segment_started
signal dead_air_started
signal presence_started
signal hunt_started
signal house_entered
signal hiding_started
signal follower_passed
signal segment_completed

## Sequence phases.
enum Phase {
	IDLE,         # before start
	DEAD_AIR,     # radio drops to 0, silence
	PRESENCE,     # sound behind player, thing approaches
	HUNT,         # tune away to restore signal; walk to the house
	HIDING,       # in the house, holding breath
	PASSED,       # follower moved on, static fades
	COMPLETED,    # exit to 2D
}

## --- Tuning ---
const LIVING_BAND_ID := 0
const LIMINAL_BAND_ID := 1

## HUNT target band: LIMINAL is the P2-native band — tuning toward the
## Neighborhood (2D/Phase 3) means leaving LIVING's dead center.
const HUNT_TARGET_BAND := LIMINAL_BAND_ID

## Distance at which the presence sound becomes audible.
const PRESENCE_AUDIBLE_DIST := 18.0
## Distance at which the presence reaches the player's start (catch).
const PRESENCE_CATCH_DIST := 2.0

## Breath hold: 5 s max (GDD), forced exhale after.
const BREATH_MAX_SECONDS := 5.0

## How long the follower takes to pass the house during hiding (seconds).
const PASS_DURATION := 12.0

## Bus muting: total silence while hiding — everything except breathing.
const HIDING_SILENCED_BUSES: Array[StringName] = [
	&"ROOM_TONE",
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"SILENCE",
	&"UI",
	&"TAPE",
	&"RADIO_AMBIENT",
]

## Fixed camera: behind the player, low, so the road ahead is visible and
## the player cannot turn around to see the follower.
const CAMERA_TRACK_OFFSET := Vector3(0, 0, 4.5)
const CAMERA_TRACK_HEIGHT := 2.2
const CAMERA_TRACK_PITCH_DEG := -6.0

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _suit: Suit
var _house_door: Area3D
var _house_interior: Node3D
var _radio_tuner: RadioTuner
var _signal_strength: SignalStrength
var _presence_player: AudioStreamPlayer3D
var _shadow_light: DirectionalLight3D
var _breath_player: AudioStreamPlayer
var _window_materials: Array[StandardMaterial3D] = []

## --- Sequence state ---
var _phase: int = Phase.IDLE
var _started: bool = false
var _house_door_open: bool = false
var _hide_door_open: bool = false
var _breath_held: bool = false
var _breath_timer: float = 0.0
var _pass_timer: float = 0.0
var _catch_fired: bool = false
var _baseline_bus_volumes := {}
var _presence_volume := 0.0
var _shadow_intensity := 0.0
var _radio_restored := false
var _house_entered_fired := false
var _breath_override_for_testing := false

## Presence sound synthesis
var _presence_stream: AudioStreamGeneratorPlayback
const PRESENCE_SR := 44100.0


func _ready() -> void:
	call_deferred("_setup")


func _setup() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_suit = get_node_or_null("Follower") as Suit
	_house_door = get_node_or_null("House/DoorTrigger") as Area3D
	_house_interior = get_node_or_null("House/Interior")
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner") as RadioTuner
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength") as SignalStrength
	_shadow_light = get_node_or_null("House/WindowShadow") as DirectionalLight3D

	if _house_door and not _house_door.body_entered.is_connected(_on_house_door_entered):
		_house_door.body_entered.connect(_on_house_door_entered)

	# Presence audio: world-space, behind the player.
	_presence_player = AudioStreamPlayer3D.new()
	_presence_player.name = "PresenceSound"
	_presence_player.stream = _make_presence_stream()
	_presence_player.bus = "Master"
	_presence_player.unit_size = 6.0
	_presence_player.max_distance = 60.0
	add_child(_presence_player)

	# Breath audio: simple looping noise tied to breath holding.
	_breath_player = AudioStreamPlayer.new()
	_breath_player.stream = _make_breath_stream()
	_breath_player.bus = "Master"
	_breath_player.volume_db = -18.0
	add_child(_breath_player)

	# Collect window materials for the shadow pass effect.
	var house := get_node_or_null("House")
	if house:
		for win in house.find_children("*Window*", "", true, false):
			if win is MeshInstance3D or win is CSGBox3D:
				var mat := StandardMaterial3D.new()
				mat.albedo_color = Color(0.05, 0.06, 0.08)
				mat.emission_enabled = true
				mat.emission = Color(0.02, 0.03, 0.05)
				if win is CSGBox3D:
					win.material = mat
				_window_materials.append(mat)

	if _suit:
		_suit.visible = false
		_suit.set_physics_process(false)

	if _player:
		# Face down the street (away from the follower behind).
		_face_player(Vector3(1.0, 0.0, 0.0))

	# Start the sequence after the static cut.
	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)
	start_segment()


func start_segment() -> void:
	if _started:
		return
	_started = true
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	_enter_phase(Phase.DEAD_AIR)
	segment_started.emit()


## --- Sequence phases ---

func _enter_phase(p: int) -> void:
	_phase = p
	match p:
		Phase.DEAD_AIR:
			# Radio drops to dead air: signal 0, tuner locked on empty.
			dead_air_started.emit()
		Phase.PRESENCE:
			presence_started.emit()
		Phase.HUNT:
			hunt_started.emit()
		Phase.HIDING:
			hiding_started.emit()
		Phase.PASSED:
			follower_passed.emit()
		Phase.COMPLETED:
			segment_completed.emit()


## Advance the sequence: called from _process based on conditions.
func _process(delta: float) -> void:
	if not _started:
		return

	match _phase:
		Phase.DEAD_AIR:
			_process_dead_air(delta)
		Phase.PRESENCE:
			_process_presence(delta)
		Phase.HUNT:
			_process_hunt(delta)
		Phase.HIDING:
			_process_hiding(delta)
		Phase.PASSED:
			_process_passed(delta)

	_update_camera()
	_update_presence_audio()


## DEAD_AIR: radio at 0. Wait for the player to move (or a timer) before
## the presence reveals itself.
func _process_dead_air(delta: float) -> void:
	if _signal_strength:
		_signal_strength.set_signal(0.0)


## PRESENCE: the thing is behind the player. It walks toward them.
func _process_presence(delta: float) -> void:
	if _suit == null or _player == null:
		_advance_to_hunt()
		return
	# Activate the suit: walks toward the player from behind.
	_suit.visible = true
	_suit.set_physics_process(true)
	_suit.force_state(Suit.State.APPROACH)
	# force_state resets per-state timers and detection; APPROACH walks toward
	# _last_known_player_pos, which is Vector3.ZERO until detection runs. Seed
	# it here so the suit walks toward the player, not the world origin.
	_suit._last_known_player_pos = _player.global_position
	var dist := _suit.global_position.distance_to(_player.global_position)
	if dist <= PRESENCE_CATCH_DIST and not _catch_fired:
		# The player must move NOW — enter HUNT (tune away + run to house).
		_catch_fired = true
		_advance_to_hunt()


## HUNT: tune away from dead air to restore signal (LIMINAL = toward the
## Neighborhood), then reach the house.
func _process_hunt(delta: float) -> void:
	# Radio restore check: player must tune off LIVING's dead center onto
	# LIMINAL. The signal returns once the tuner leaves LIVING.
	if not _radio_restored and _radio_tuner:
		if _radio_tuner.current_band_id == HUNT_TARGET_BAND:
			_radio_restored = true
			if _signal_strength:
				_signal_strength.set_signal(55.0)
	# Radio static grows as the suit closes in (via suit's signal drain).
	if _signal_strength and _suit and _radio_restored:
		var dist := _suit.global_position.distance_to(_player.global_position)
		var drain := clampf(1.0 - dist / PRESENCE_AUDIBLE_DIST, 0.0, 1.0)
		# set_signal keeps a floor so the radio never fully dies during HUNT.
		var val := 55.0 - drain * 35.0
		_signal_strength.set_signal(val)


## HIDING: inside the house, holding breath, follower passes outside.
func _process_hiding(delta: float) -> void:
	# Breath hold: read the hold action. _breath_override_for_testing lets
	# tests simulate the held state without an InputManager action.
	var im := get_node_or_null("/root/InputManager")
	var held: bool = _breath_override_for_testing if _breath_override_for_testing else (im and im.is_action_held("hold_breath"))
	if held and not _breath_held:
		_breath_timer = 0.0
	_breath_held = held
	if held:
		_breath_timer += delta
		if _breath_timer >= BREATH_MAX_SECONDS:
			# Forced exhale — composure penalty, detection risk.
			_on_forced_exhale()
			_breath_timer = 0.0

	# Composure drain while detected (GDD: -2/sec if detected while hiding).
	var dc := _get_dread_composure()
	if dc:
		dc.hiding_detected = _suit != null and _suit.get_state() == Suit.State.APPROACH

	# The follower passes the house over PASS_DURATION.
	_pass_timer += delta
	var t := clampf(_pass_timer / PASS_DURATION, 0.0, 1.0)
	# Shadow sweeps across the windows: emission intensity rises then falls.
	_shadow_intensity = sin(t * PI)
	for mat in _window_materials:
		mat.emission = Color(0.02 + 0.30 * _shadow_intensity, 0.03 + 0.32 * _shadow_intensity, 0.05 + 0.35 * _shadow_intensity)
	# Radio static peaks then fades: signal surges mid-pass, then recovers.
	if _signal_strength:
		var surge := 40.0 * _shadow_intensity
		_signal_strength.set_signal(20.0 + surge)
	# When the pass completes, the follower moves on.
	if _pass_timer >= PASS_DURATION:
		_enter_phase(Phase.PASSED)


func _process_passed(delta: float) -> void:
	# Static fades back to a weak but stable signal.
	if _signal_strength:
		var current := _signal_strength.signal_value
		_signal_strength.set_signal(move_toward(current, 45.0, delta * 10.0))
	# Follower walks away.
	if _suit and _player:
		var away := _suit.global_position + Vector3(2.0, 0.0, 0.0) * delta * 3.0
		_suit.global_position = away
	if _pass_timer >= PASS_DURATION + 6.0:
		_enter_phase(Phase.COMPLETED)


func _advance_to_hunt() -> void:
	_enter_phase(Phase.HUNT)


## --- House entry ---

func _on_house_door_entered(body: Node3D) -> void:
	if not _started or _phase != Phase.HUNT:
		return
	if not body.is_in_group("player"):
		return
	if _house_entered_fired:
		return
	_house_entered_fired = true
	house_entered.emit()
	_begin_hiding()


func _begin_hiding() -> void:
	_hide_door_open = false
	_house_door_open = false
	_pass_timer = 0.0
	_breath_timer = 0.0
	_enter_phase(Phase.HIDING)
	# Total silence: mute everything (including radio ambient).
	_mute_for_hiding()
	# Movement disabled via HIDE mode context (player controller reads this).
	if PhaseManager and PhaseManager.has_method("enter_hide_mode"):
		PhaseManager.enter_hide_mode()


func _on_forced_exhale() -> void:
	var dc := _get_dread_composure()
	if dc:
		dc.hiding_detected = true
	# Loud exhale: the follower may notice — brief detection pulse.
	if _suit and _signal_strength:
		var dist := _suit.global_position.distance_to(_player.global_position)
		if dist < 8.0:
			_signal_strength.set_signal(5.0)


## PASSED: unmute, exit HIDE mode.
func _exit_hiding() -> void:
	if PhaseManager and PhaseManager.has_method("exit_hide_mode"):
		PhaseManager.exit_hide_mode()
	_unmute_after_hiding()


## --- Audio helpers ---

func _mute_for_hiding() -> void:
	var abm := get_node_or_null("/root/AudioBusManager")
	if abm == null:
		return
	for name in HIDING_SILENCED_BUSES:
		var idx: int = AudioServer.get_bus_index(name)
		if idx < 0:
			continue
		_baseline_bus_volumes[idx] = AudioServer.get_bus_volume_db(idx)
		abm.set_bus_mute(idx, true)
	# Breathing stays audible: it's on Master.
	_breath_player.play()


func _unmute_after_hiding() -> void:
	var abm := get_node_or_null("/root/AudioBusManager")
	if abm:
		for idx in _baseline_bus_volumes:
			abm.set_bus_mute(idx, false)
			AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
	_breath_player.stop()


func _get_dread_composure() -> DreadComposure:
	if CallManager:
		return CallManager.get_dread_composure() as DreadComposure
	return null


## --- Presence audio: generated low drone with irregular thumps ---
func _make_presence_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = PRESENCE_SR
	gen.buffer_length = 1.0
	return gen


func _make_presence_playback() -> void:
	_presence_player.play()
	_presence_stream = _presence_player.get_stream_playback()


func _update_presence_audio() -> void:
	if _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	if _presence_stream == null:
		_make_presence_playback()
	if _suit and _player:
		_presence_player.global_position = _suit.global_position + Vector3(0, 1.2, 0)
		var dist := _suit.global_position.distance_to(_player.global_position)
		_presence_volume = clampf(1.0 - dist / PRESENCE_AUDIBLE_DIST, 0.0, 1.0)
		_presence_player.volume_db = linear_to_db(maxf(_presence_volume, 0.001))
	_fill_presence_buffer()


func _fill_presence_buffer() -> void:
	if _presence_stream == null or _presence_volume <= 0.001:
		return
	var frames := _presence_stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_presence_phase += 36.0 * TAU / PRESENCE_SR
		# Slow heavy footfall: 0.9 Hz pulse over a low drone.
		var thump := maxf(0.0, sin(_presence_phase * 0.03)) ** 2.0
		var s: float = (sin(_presence_phase) * 0.5 + sin(_presence_phase * 2.7) * 0.2) * thump
		buf[i] = Vector2(s, s) * _presence_volume * 0.8


	_presence_stream.push_buffer(buf)
var _presence_phase := 0.0


func _make_breath_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = PRESENCE_SR
	gen.buffer_length = 0.5
	return gen


var _breath_phase := 0.0


## --- Camera: fixed behind the player (cannot turn around) ---
func _update_camera() -> void:
	if _camera_rig == null or _player == null:
		return
	var target_pos: Vector3 = _player.global_position + CAMERA_TRACK_OFFSET
	target_pos.y = CAMERA_TRACK_HEIGHT
	var basis := Basis.from_euler(Vector3(0.0, 0.0, 0.0))
	basis = basis * Basis.from_euler(Vector3(deg_to_rad(CAMERA_TRACK_PITCH_DEG), 0.0, 0.0))
	_camera_rig.global_transform = Transform3D(basis, target_pos)


func _face_player(direction: Vector3) -> void:
	if _player:
		var pos := _player.global_position
		_player.look_at(pos + direction, Vector3.UP)


## --- Testing helpers ---

func get_phase() -> int:
	return _phase


func get_phase_name() -> String:
	match _phase:
		Phase.IDLE: return "IDLE"
		Phase.DEAD_AIR: return "DEAD_AIR"
		Phase.PRESENCE: return "PRESENCE"
		Phase.HUNT: return "HUNT"
		Phase.HIDING: return "HIDING"
		Phase.PASSED: return "PASSED"
		Phase.COMPLETED: return "COMPLETED"
	return "UNKNOWN"


func is_started() -> bool:
	return _started


func get_player() -> CharacterBody3D:
	return _player


func get_suit() -> Suit:
	return _suit


func get_radio_tuner() -> RadioTuner:
	return _radio_tuner


func get_radio_signal() -> float:
	if _signal_strength == null:
		return -1.0
	return _signal_strength.signal_value


func is_hiding() -> bool:
	return _phase == Phase.HIDING


func is_breath_held() -> bool:
	return _breath_held


func get_breath_timer() -> float:
	return _breath_timer


func get_window_shadow_intensity() -> float:
	return _shadow_intensity


func get_presence_volume() -> float:
	return _presence_volume


func is_radio_restored() -> bool:
	return _radio_restored


func is_silenced_for_hiding() -> bool:
	for idx in _baseline_bus_volumes:
		if AudioServer.is_bus_mute(idx):
			return true
	return false


func force_hunt_phase_for_testing() -> void:
	_catch_fired = true
	_radio_restored = false
	_enter_phase(Phase.HUNT)


func force_house_entry_for_testing() -> void:
	_house_entered_fired = false
	_on_house_door_entered(_player)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_house_entered_fired = false
	_catch_fired = false
	_radio_restored = false
	_breath_held = false
	_breath_timer = 0.0
	_pass_timer = 0.0
	_house_door_open = false
	_hide_door_open = false
	_unmute_after_hiding()
	if PhaseManager:
		if PhaseManager.has_method("exit_hide_mode"):
			PhaseManager.exit_hide_mode()
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)


func _find_player() -> CharacterBody3D:
	var local := get_node_or_null("Player")
	if local is CharacterBody3D:
		return local
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	for c in tree.get_nodes_in_group("player"):
		if c is CharacterBody3D:
			return c
	return null
