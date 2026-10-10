class_name ClearingSegment
extends Node3D

## Location 5 / Phase 4 Step 1: "The Clearing" (DEA-128).
##
## The elevator from the Bunker opens into an open forest clearing. The
## transmission tower stands in the field: wood, brass, and wire — 1920s
## architecture. The sky is 1923: black and white, the stars are wrong.
## The radio plays Call #15 (ORIGIN) automatically.
##
## The three optional fragments (Linear DEA-128 layout):
##   - a rusted machine, silent
##   - a small grave with no headstone
##   - the farmhouse, dark, door open
## Fragments are optional exploration content; finding all three is
## tracked (they deepen the ending choice in Phase 4, future tickets).
##
## Tape #13 is at the tower base in a toolbox (TapePickup, tape-013).
##
## Reaching the tower completes the step (handoff to DEA-129 staircase).
##
## No save (Phase 4 is no-save, per the GDD).

signal segment_started
signal origin_call_started
signal fragment_found(kind: String)
signal tape_collected(tape_id: String)
signal tape_collected_actual(tape_id: String)
signal tower_reached
signal false_call_started(call_data: Dictionary)
signal segment_completed

enum Phase {
	IDLE,
	EXPLORE,       # arrive, explore the clearing
	TOWER,         # at the tower, listening to ORIGIN
	COMPLETED,
}

## --- Tower ---
const TOWER_POS := Vector3(0, 0, -40)
const TOWER_REACH_RADIUS := 8.0

## --- Fragments ---
const FRAGMENT_KINDS := ["machine", "grave", "farmhouse"]

## --- Tape ---
const TAPE_ID := "tape-013"

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _tower: Node3D
var _tape_pickup: TapePickup
var _fragments := {}          # kind -> Node3D
var _fragment_found := {}

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _origin_call_started_flag := false
var _tower_reached_flag := false
var _baseline_bus_volumes := {}

## Audio: the ORIGIN call from the tower (spatialized) + wind.
var _origin_player: AudioStreamPlayer3D
var _origin_phase := 0.0
var _origin_stream: AudioStreamGeneratorPlayback
var _wind_player: AudioStreamPlayer
var _wind_phase := 0.0
var _wind_stream: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0
const ORIGIN_HZ := 105.0      # formal male voice, distant
const WIND_HZ := 400.0


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_tower = get_node_or_null("Tower")
	_tape_pickup = get_node_or_null("TowerBase/TapePickup") as TapePickup
	for kind in FRAGMENT_KINDS:
		var cap: String = kind.capitalize()
		_fragments[kind] = get_node_or_null("Fragments/" + cap)
	_setup_audio()
	_place_player()
	_setup_camera()
	_silence_world()
	_setup_radio()
	_connect_tape_pickup()
	if _tape_pickup and _tape_pickup.tape_picked_up.is_connected(_on_tape_picked_up):
		pass
	var fx := StaticTransition.new()
	fx.name = "StaticCut"
	add_child(fx)
	fx.play(0.75)
	start_segment()


func _connect_tape_pickup() -> void:
	if _tape_pickup and not _tape_pickup.tape_picked_up.is_connected(_on_tape_picked_up):
		_tape_pickup.tape_picked_up.connect(_on_tape_picked_up)


func _setup_audio() -> void:
	# ORIGIN call from the tower: spatialized, formal, distant.
	_origin_player = AudioStreamPlayer3D.new()
	_origin_player.name = "OriginVoice"
	_origin_player.stream = _make_generator()
	_origin_player.bus = "Master"
	_origin_player.unit_size = 8.0
	_origin_player.max_distance = 60.0
	if _tower:
		_origin_player.position = _tower.position + Vector3(0, 8, 0)
	add_child(_origin_player)

	# Wind that is a human voice: smooth vowel-ish drone with formants.
	_wind_player = AudioStreamPlayer.new()
	_wind_player.name = "VoicedWind"
	_wind_player.stream = _make_generator()
	_wind_player.bus = "Master"
	_wind_player.volume_db = -22.0
	add_child(_wind_player)


func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


func _place_player() -> void:
	if _player:
		_player.global_position = Vector3(0, 0.5, 0)
		_face_player(TOWER_POS - Vector3(0, 0.5, 0))


func _setup_camera() -> void:
	if _camera_rig:
		# Wide, ground-level: the tower dominates the frame.
		var pos := Vector3(0, 1.5, 12)
		_camera_rig.look_at_from_position(pos, TOWER_POS + Vector3(0, 10, 0), Vector3.UP)
		_camera_rig.fov = 70.0
		_camera_rig.current = true


func _silence_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	# Phase 4: mute everything except SILENCE and UI (breathing only).
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
# SILENCE and UI stay live: the heartbeat static and breathing must be heard.


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		# All bands dead except ████████ (redacted, id 4).
		_radio_tuner.set_band(4)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		# Constant, strong signal. No calls. Static with a heartbeat.
		_signal_strength.set_signal(85.0)
	var bc := _autoload("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(4)


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.EXPLORE
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	_setup_false_calls()
	segment_started.emit()
	# ORIGIN call begins automatically (GDD: the radio plays Call #15).
	_origin_call_started_flag = true
	origin_call_started.emit()


## --- False calls (DEA-132) ---

## False calls: at composure < 30, the ████████ band carries corrupted
## versions of Shift 1-5 calls. Content is wrong: the caller knows things
## they shouldn't — the player's name, choices made, what the player is
## doing right now. Below composure 10 the calls become the origin
## broadcast: the 1923 voice, constant and overlapping. They cannot be
## recorded, and they drain composure (-5 per call).

const FALSE_CALL_COMPOSURE_THRESHOLD := 30.0
const FALSE_CALL_OVERLAP_THRESHOLD := 10.0
const FALSE_CALL_COMPOSURE_DRAIN := 5.0
const FALSE_CALL_INTERVAL := 18.0

## Corrupted variants of Shift 1-5 calls (source calls by id, retold wrong).
const FALSE_CALL_SOURCES := [
	{ "source_call": 0, "lines": [
		"\"That number. It belongs to you.\"",
		"\"We've been calling every night for three years.\"",
		"\"You will answer. You already did.\""]},
	{ "source_call": 3, "lines": [
		"\"Got my garden in today. Tomatoes, mostly.\"",
		"\"Ruth loves tomatoes. She'll be so pleased you're here.\"",
		"\"...you'll stay. Won't you. You always stay.\""]},
	{ "source_call": 9, "lines": [
		"\"My daughter's been gone three years.\"",
		"\"There was a cassette tape in my mailbox. It's your voice.\"",
		"\"Will you play it on air for me? It's already playing.\""]},
	{ "source_call": 14, "lines": [
		"\"Ninety seconds before I lose signal. You've lost more.\"",
		"\"Forty-seven stations like yours. Yours is the one that's listening back.\"",
		"\"Don't stop taking calls. They're taking you.\""]},
	{ "source_call": 15, "lines": [
		"\"Hello? Is anyone out there? This is the first test of the —\"",
		"\"— frequency. If you can hear this, it worked. It worked on you.\"",
		"\"I can't see you. But I know what you're doing right now.\""]},
]

## Overlap variant at composure < 10: the origin voice, constant.
const OVERLAP_LINES := [
	"\"Hello? Is anyone out there?\"",
	"\"If you can hear this, it worked.\"",
	"\"I can feel you.\"",
]

var _false_call_timer := 0.0
var _false_calls_enabled := false
var _last_false_call_composure := 100.0


func _setup_false_calls() -> void:
	_false_calls_enabled = true
	_false_call_timer = FALSE_CALL_INTERVAL * 0.6


func _process_false_calls(delta: float) -> void:
	if not _false_calls_enabled:
		return
	var composure := _get_current_composure()
	if composure >= FALSE_CALL_COMPOSURE_THRESHOLD:
		return
	_false_call_timer -= delta
	if _false_call_timer <= 0.0:
		_false_call_timer = FALSE_CALL_INTERVAL
		_fire_false_call(composure)


func _get_current_composure() -> float:
	var cm := get_node_or_null("/root/CallManager")
	if cm and cm.has_method("get_dread_composure"):
		var dc: Node = cm.get_dread_composure()
		if dc and "composure" in dc:
			return float(dc.composure)
	return 100.0


## Fire one false call. At composure < 10 they become the origin voice.
func _fire_false_call(composure: float) -> void:
	var call := _build_false_call(composure)
	false_call_started.emit(call)
	# They drain composure further (-5 per call).
	var cm := get_node_or_null("/root/CallManager")
	if cm and cm.has_method("get_dread_composure"):
		var dc: Node = cm.get_dread_composure()
		if dc and dc.has_method("add_composure"):
			dc.add_composure(-FALSE_CALL_COMPOSURE_DRAIN)


## Pure: build a false call dict for the given composure.
func _build_false_call(composure: float) -> Dictionary:
	if composure < FALSE_CALL_OVERLAP_THRESHOLD:
		return {"id": -1, "band": 4, "callerName": "— — — — —",
			"callerId": "APR 14, 1923", "type": "FALSE_ORIGIN",
			"overlap": true, "lines": OVERLAP_LINES.duplicate()}
	var pick: Dictionary = FALSE_CALL_SOURCES[randi() % FALSE_CALL_SOURCES.size()]
	var lines: Array = []
	for line in pick.get("lines", []):
		# Content is wrong: retell with the caller knowing the player.
		lines.append(corrupt_false_line(String(line)))
	return {"id": pick.get("source_call", -1), "band": 4,
		"callerName": "WRONG", "callerId": "— — —", "type": "FALSE_CALL",
		"overlap": false, "lines": lines}


## Pure: corrupt a source line into its false-call form.
static func corrupt_false_line(line: String) -> String:
	# The false calls quote the original, then append the wrong knowledge.
	return line + " ..." + " (we know where you are)"


func _reset_false_calls_for_testing() -> void:
	_false_calls_enabled = false
	_false_call_timer = 0.0


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	match _phase:
		Phase.EXPLORE:
			_process_explore(delta)
		Phase.TOWER:
			_process_tower(delta)
	_update_origin_audio(delta)
	_update_wind_audio(delta)
	_process_false_calls(delta)
	_check_fragment_proximity()
	_check_tower_reach()


func _process_explore(delta: float) -> void:
	if _player and _tower:
		var dist := _player.global_position.distance_to(_tower.global_position)
		if dist <= TOWER_REACH_RADIUS + 2.0:
			_phase = Phase.TOWER


func _process_tower(delta: float) -> void:
	if _player and _tower:
		var dist := _player.global_position.distance_to(_tower.global_position)
		if dist <= TOWER_REACH_RADIUS:
			if not _tower_reached_flag:
				_tower_reached_flag = true
				tower_reached.emit()
				# Brief moment at the open door, then complete (Step 2 next).
				var timer := get_tree().create_timer(1.5)
				timer.timeout.connect(func() -> void:
					if _phase != Phase.COMPLETED:
						_enter_phase(Phase.COMPLETED)
				)


func _check_fragment_proximity() -> void:
	if _player == null:
		return
	for kind in _fragments:
		if _fragment_found.has(kind):
			continue
		var node: Node3D = _fragments[kind]
		if node and _player.global_position.distance_to(node.global_position) <= 4.0:
			_fragment_found[kind] = true
			fragment_found.emit(kind)


func _check_tower_reach() -> void:
	pass  # handled in phase processors


func _on_tape_picked_up(tape_id: String) -> void:
	tape_collected.emit(tape_id)


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()


## --- Audio synthesis ---

func _update_origin_audio(delta: float) -> void:
	if not _origin_call_started_flag or _origin_player == null:
		return
	if _origin_stream == null:
		_origin_player.play()
		_origin_stream = _origin_player.get_stream_playback()
	_fill_origin_buffer(delta)


func _fill_origin_buffer(delta: float) -> void:
	if _origin_stream == null:
		return
	var frames := _origin_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_origin_phase += ORIGIN_HZ * TAU / AUDIO_SR
		# Formal 1923 diction: steady, with slow cadence swells.
		var swell := 0.6 + 0.4 * sin(_origin_phase * 0.01)
		var s := (sin(_origin_phase) * 0.5 + sin(_origin_phase * 2.2) * 0.2) * swell * 0.5
		buf[i] = Vector2(s, s)
	_origin_stream.push_buffer(buf)


func _update_wind_audio(delta: float) -> void:
	if _wind_player == null:
		return
	if _wind_stream == null:
		_wind_player.play()
		_wind_stream = _wind_player.get_stream_playback()
	_fill_wind_buffer(delta)


func _fill_wind_buffer(delta: float) -> void:
	if _wind_stream == null:
		return
	var frames := _wind_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# Wind is a human voice: vowel formants drifting over breath noise.
		_wind_phase += WIND_HZ * TAU / AUDIO_SR
		var f1 := 1.0 + 0.35 * sin(_wind_phase * 0.0013)   # "ah/oo" drift
		var s := sin(_wind_phase) * 0.4 * f1 + sin(_wind_phase * 2.7) * 0.15
		buf[i] = Vector2(s, s) * 0.25
	_wind_stream.push_buffer(buf)


## --- Helpers ---

func _face_player(direction: Vector3) -> void:
	if _player:
		var pos := _player.global_position
		_player.look_at(pos + direction, Vector3.UP)


func _find_player() -> CharacterBody3D:
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
		Phase.EXPLORE: return "EXPLORE"
		Phase.TOWER: return "TOWER"
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


func is_origin_call_started() -> bool:
	return _origin_call_started_flag


func get_fragments_found() -> Array:
	return _fragment_found.keys()


func find_fragment_for_testing(kind: String) -> void:
	_fragment_found[kind] = true
	fragment_found.emit(kind)


func force_tower_reach_for_testing() -> void:
	_tower_reached_flag = true
	tower_reached.emit()
	_enter_phase(Phase.COMPLETED)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_origin_call_started_flag = false
	_tower_reached_flag = false
	_fragment_found.clear()
	_reset_false_calls_for_testing()
	if _origin_player:
		_origin_player.stop()
		_origin_stream = null
	if _wind_player:
		_wind_player.stop()
		_wind_stream = null
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
