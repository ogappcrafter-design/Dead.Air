class_name StaircaseSegment
extends Node3D

## Phase 4 Step 2: "The Staircase" (DEA-129).
##
## Inside the tower: a single spiral staircase going down. Narrow. The
## fixed camera looks straight down from above, following the player.
##
## The staircase is longer than physically possible: the tower was 30 m
## tall, but the descent is 200+ m. It's not real space.
##
## At intervals the walls change era: 1920s concrete → 1950s institutional
## → 1970s paneling → bare earth. The player is descending through time.
##
## Every step plays a fragment of a different call (GDD): Call #0 at the
## top, Call #17 at the bottom, audio degrading from 1920s quality to raw
## static as the player descends.
##
## Radio: ████████ only. Static increases with depth; the heartbeat
## underneath speeds up.
##
## Audio: the player's footsteps echo but arrive one second late.
## Whispers in a language that isn't a language.
##
## Reaching the bottom completes the step (handoff to DEA-130 chamber).
## No tapes. No save.

signal segment_started
signal wall_era_changed(era_index: int)
signal call_fragment_played(call_id: int)
signal heartbeat_rate_changed(bpm: float)
signal bottom_reached
signal segment_completed

enum Phase {
	IDLE,
	DESCENT,       # walking down
	COMPLETED,
}

## --- Geometry ---
## Descent runs along -Y from y=0 to y=-BOTTOM_DEPTH.
const BOTTOM_DEPTH := 200.0
## The tower was 30 m tall — the descent is impossible.
const TOWER_HEIGHT := 30.0

## Wall eras by depth band (fractions of the total depth).
const ERA_BOUNDS := [0.0, 0.25, 0.5, 0.75]
const ERA_NAMES := ["1920s concrete", "1950s institutional", "1970s paneling", "bare earth"]

## Call fragments: Call #0 at top → #17 at bottom, one per segment.
const CALL_IDS := [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17]
## Last 17 segments each play one call (skipping #13, redacted only).

## --- Radio ---
const REDACTED_BAND_ID := 4
const SIGNAL_START := 60.0
const SIGNAL_END := 100.0

## --- Heartbeat ---
const HEARTBEAT_START_BPM := 60.0
const HEARTBEAT_END_BPM := 140.0

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _era_walls: Array[Node3D] = []
var _era_materials: Array[StandardMaterial3D] = []

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _descent_fraction := 0.0
var _era_index := -1
var _last_call_fragment := -1
var _bottom_flag := false
var _baseline_bus_volumes := {}

## Audio: heartbeat embedded in static; delayed footsteps; whispers.
var _static_player: AudioStreamPlayer
var _static_phase := 0.0
var _static_stream: AudioStreamGeneratorPlayback
var _static_beat_phase := 0.0
var _footstep_player: AudioStreamPlayer
var _footstep_phase := 0.0
var _footstep_stream: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0
const FOOTSTEP_DELAY := 1.0
var _footstep_ring_buffer: Array = []


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_collect_era_walls()
	_setup_audio()
	_place_player()
	_setup_camera()
	_silence_world()
	_setup_radio()
	var fx := StaticTransition.new()
	fx.name = "StaticCut"
	add_child(fx)
	fx.play(0.75)
	start_segment()


func _collect_era_walls() -> void:
	for i in range(4):
		var wall := get_node_or_null("Shaft/Era%d" % i)
		if wall:
			_era_walls.append(wall)


func _setup_audio() -> void:
	# Static with an embedded heartbeat: rate rises with depth.
	_static_player = AudioStreamPlayer.new()
	_static_player.name = "DescentStatic"
	_static_player.stream = _make_generator()
	_static_player.bus = "Master"
	_static_player.volume_db = -14.0
	add_child(_static_player)

	# Footsteps that arrive late (echo from a second ago).
	_footstep_player = AudioStreamPlayer.new()
	_footstep_player.name = "LateFootsteps"
	_footstep_player.stream = _make_generator()
	_footstep_player.bus = "Master"
	_footstep_player.volume_db = -20.0
	add_child(_footstep_player)


func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


func _place_player() -> void:
	if _player:
		_player.global_position = Vector3(0, -1, 0)
		_face_player(Vector3(0, 0, -1))


func _setup_camera() -> void:
	if _camera_rig:
		# Top-down: looking straight down, following the player.
		_update_camera()


func _update_camera() -> void:
	if _camera_rig and _player:
		var pos: Vector3 = _player.global_position + Vector3(0, 8, 0.001)
		_camera_rig.look_at_from_position(pos, _player.global_position, Vector3.FORWARD)
		_camera_rig.fov = 60.0
		_camera_rig.current = true


func _silence_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for bus_name in SILENCED_BUS_NAMES:
		var idx: int = AudioServer.get_bus_index(bus_name)
		if idx < 0:
			continue
		_baseline_bus_volumes[idx] = AudioServer.get_bus_volume_db(idx)
		abm.set_bus_mute(idx, true)


const SILENCED_BUS_NAMES: Array[StringName] = [
	&"ROOM_TONE",
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"TAPE",
]


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		_radio_tuner.set_band(REDACTED_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		_signal_strength.set_signal(SIGNAL_START)
	var bc := _autoload("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(REDACTED_BAND_ID)


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.DESCENT
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	segment_started.emit()


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	if _player:
		var depth: float = clampf(-_player.global_position.y / BOTTOM_DEPTH, 0.0, 1.0)
		_descent_fraction = depth
		_update_descent_state()
	_check_bottom()
	_update_static_audio(delta)
	_update_footstep_audio(delta)
	_update_camera()


## Static rises with depth; heartbeat speeds up; walls change era; calls fire.
func _update_descent_state() -> void:
	# Signal: rises from SIGNAL_START to SIGNAL_END (static increases).
	if _signal_strength:
		var sig: float = lerpf(SIGNAL_START, SIGNAL_END, _descent_fraction)
		_signal_strength.set_signal(sig)
	# Heartbeat BPM: 60 → 140.
	var bpm: float = lerpf(HEARTBEAT_START_BPM, HEARTBEAT_END_BPM, _descent_fraction)
	_static_beat_phase = bpm
	heartbeat_rate_changed.emit(bpm)
	# Wall era changes.
	var era := 0
	for i in range(ERA_BOUNDS.size()):
		if _descent_fraction >= ERA_BOUNDS[i]:
			era = i
	if era != _era_index:
		_era_index = era
		_apply_era_material(era)
		wall_era_changed.emit(era)
	# Call fragment: one per 1/17 of the descent.
	var fragment_index := int(_descent_fraction * CALL_IDS.size())
	fragment_index = clampi(fragment_index, 0, CALL_IDS.size() - 1)
	if fragment_index != _last_call_fragment:
		_last_call_fragment = fragment_index
		call_fragment_played.emit(CALL_IDS[fragment_index])


func _apply_era_material(era: int) -> void:
	# Walls change era visually: tint shifts concrete → institutional →
	# paneling → earth.
	var tints := [
		Color(0.55, 0.55, 0.52),   # 1920s concrete
		Color(0.45, 0.47, 0.50),   # 1950s institutional (bluish)
		Color(0.48, 0.38, 0.28),   # 1970s paneling (brown)
		Color(0.35, 0.28, 0.20),   # bare earth
	]
	if era >= tints.size():
		return
	for wall in _era_walls:
		var mesh := wall as MeshInstance3D
		if mesh and mesh.mesh:
			var mat := StandardMaterial3D.new()
			mat.albedo_color = tints[era]
			mesh.material_override = mat


## Bottom reached: y <= -BOTTOM_DEPTH.
func _check_bottom() -> void:
	if _bottom_flag or _player == null:
		return
	if _player.global_position.y <= -BOTTOM_DEPTH:
		_bottom_flag = true
		bottom_reached.emit()
		_enter_phase(Phase.COMPLETED)


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()


## --- Audio synthesis ---

func _update_static_audio(delta: float) -> void:
	if _static_player == null:
		return
	if _static_stream == null:
		_static_player.play()
		_static_stream = _static_player.get_stream_playback()
	_fill_static_buffer(delta)


func _fill_static_buffer(delta: float) -> void:
	if _static_stream == null:
		return
	var frames := _static_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	var beat_interval := 60.0 / _static_beat_phase if _static_beat_phase > 0 else 1.0
	for i in range(frames):
		_static_phase += 1.0 / AUDIO_SR
		# White static bed.
		var s := randf_range(-1.0, 1.0) * 0.3
		# Heartbeat: low thump on each beat, louder with depth.
		var beat_t: float = fmod(_static_phase, beat_interval)
		if beat_t < 0.12:
			var thump := sin(beat_t * PI / 0.12)
			s += thump * 0.5 * (0.4 + 0.6 * _descent_fraction)
		buf[i] = Vector2(s, s)
	_static_stream.push_buffer(buf)


func _update_footstep_audio(delta: float) -> void:
	if _footstep_player == null:
		return
	if _footstep_stream == null:
		_footstep_player.play()
		_footstep_stream = _footstep_player.get_stream_playback()
	_fill_footstep_buffer(delta)


func _fill_footstep_buffer(delta: float) -> void:
	if _footstep_stream == null:
		return
	var frames := _footstep_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_footstep_phase += 1.0 / AUDIO_SR
		# Ring buffer of recent player movement; footsteps play 1 s late.
		_footstep_ring_buffer.append(_player.global_position.y if _player else 0.0)
		if _footstep_ring_buffer.size() > int(FOOTSTEP_DELAY * AUDIO_SR) + 1:
			_footstep_ring_buffer.pop_front()
		var s := 0.0
		# Footstep thud when the delayed position crosses a step boundary.
		if _footstep_ring_buffer.size() > 1:
			var delayed_y: float = _footstep_ring_buffer[0]
			if fmod(-delayed_y, 0.5) < 0.02:
				s = sin(_footstep_phase * 40.0) * 0.2
		buf[i] = Vector2(s, s)
	_footstep_stream.push_buffer(buf)


## --- Helpers ---

func _face_player(direction: Vector3) -> void:
	if _player:
		var pos := _player.global_position
		_player.look_at(pos + direction, Vector3.UP)


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


func _autoload(name: String) -> Node:
	return get_node_or_null("/root/" + name)


## --- Testing helpers ---

func get_phase() -> int:
	return _phase


func get_phase_name() -> String:
	match _phase:
		Phase.IDLE: return "IDLE"
		Phase.DESCENT: return "DESCENT"
		Phase.COMPLETED: return "COMPLETED"
	return "UNKNOWN"


func is_started() -> bool:
	return _started


func get_player() -> CharacterBody3D:
	return _player


func get_radio_signal() -> float:
	if _signal_strength == null:
		return -1.0
	return _signal_strength.get("signal_value")


func get_radio_band_id() -> int:
	if _radio_tuner == null:
		return -1
	return _radio_tuner.get("current_band_id")


func get_descent_fraction() -> float:
	return _descent_fraction


func get_era_index() -> int:
	return _era_index


func get_era_name() -> String:
	return ERA_NAMES[_era_index] if _era_index >= 0 and _era_index < ERA_NAMES.size() else ""


func get_last_call_fragment() -> int:
	return _last_call_fragment


func get_heartbeat_bpm() -> float:
	return _static_beat_phase


func descend_to_for_testing(fraction: float) -> void:
	if _player:
		_player.global_position.y = -BOTTOM_DEPTH * fraction
		_process(0.016)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_descent_fraction = 0.0
	_era_index = -1
	_last_call_fragment = -1
	_bottom_flag = false
	_static_beat_phase = HEARTBEAT_START_BPM
	_footstep_ring_buffer.clear()
	if _static_player:
		_static_player.stop()
		_static_stream = null
	if _footstep_player:
		_footstep_player.stop()
		_footstep_stream = null
	if _player:
		_player.global_position = Vector3(0, -1, 0)
	_restore_world()
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var bc := _autoload("BandController")
	if bc and bc.has_method("lock_all_bands"):
		bc.lock_all_bands()


func _restore_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for idx in _baseline_bus_volumes:
		abm.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
