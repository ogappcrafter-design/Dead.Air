class_name FirstHouseSegment
extends Node3D

## Segment 2D: "The First House" — final segment of Phase 2 (DEA-120).
##
## The player emerges from hiding. This is Harold's house (Call #3 caller).
## Fixed camera: living room. Normal. Too normal. A garden with tomatoes
## visible through the window. The radio picks up Harold's voice — but it's
## not on the radio. It's in the world, coming from the kitchen. The player
## walks there (fixed camera shift). Harold is not there. But his voice is,
## on a loop: the garden report — except this time it says your name at the
## end (the ORIGIN call #15 pattern).
## Then the radio crackles: the LIMINAL band appears (unlocked). The house
## distorts — the walls breathe. The player must leave.
## Exit through the front door: the street is different now. More houses.
## The Neighborhood has begun — Phase 3.
##
## Audio: the house is "too normal" — a warm living-room tone. The voice is
## spatialized from the kitchen (AudioStreamPlayer3D on Master), not
## radio-filtered. When LIMINAL reveals, the warmth goes wrong: a low
## sub-bass breathing under everything.
##
## GDD: Phase 2, Segment 2D.

signal segment_started
signal voice_started
signal kitchen_entered
signal name_heard
signal liminal_revealed
signal walls_breathing
signal house_exited
signal segment_completed

## Sequence phases.
enum Phase {
	IDLE,       # before start
	ARRIVAL,    # emerge from hiding into the living room
	VOICE,      # Harold's voice starts — from the kitchen, not the radio
	KITCHEN,    # in the kitchen: voice loops, no Harold, name heard
	LIMINAL,    # radio crackles: LIMINAL unlocked, house distorts
	WALLS,      # walls breathe; the player must leave
	EXIT,       # front door open, player walks out — street changed
	COMPLETED,  # handoff to Phase 3
}

## --- Radio bands ---
const LIVING_BAND_ID := 0
const LIMINAL_BAND_ID := 1

## Voice script: Harold's garden report (call #3 lines), character-reversed
## — the same backwards-speech treatment as the 2B fragments. The final slot
## of the loop is the name (ORIGIN call #15 pattern: "He says your name.").
const VOICE_SOURCE_CALL_ID := 3
const VOICE_SOURCE_LINE_IDS := [1, 2, 4, 8]
const VOICE_CHAR_DURATION := 0.14

## New-band whisper: after the LIMINAL reveal the dead air lifts just enough
## for the new frequency to bleed through (AC: dead air, then a whisper).
const WHISPER_SIGNAL := 12.0

## After the name is heard, the radio crackles and reveals LIMINAL.
const LIMINAL_REVEAL_DELAY := 3.0

## Walls breathe LIMINAL_REVEAL_DELAY + WALLS_DELAY after the reveal.
const WALLS_DELAY := 5.0
const WALL_BREATH_AMPLITUDE := 0.04
const WALL_BREATH_RATE_HZ := 0.4

## Fixed cameras (world-space positions and look targets).
const CAM_LIVING_POS := Vector3(-6.5, 2.0, 0.0)
const CAM_LIVING_LOOK := Vector3(0.0, 1.0, 0.1)
const CAM_LIVING_FOV := 55.0
const CAM_KITCHEN_POS := Vector3(-2.0, 2.0, -7.0)
const CAM_KITCHEN_LOOK := Vector3(2.0, 1.0, -2.8)
const CAM_KITCHEN_FOV := 60.0

## The voice always emanates from here (kitchen, spatialized).
const KITCHEN_VOICE_POS := Vector3(3.0, 1.2, -3.5)

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _voice_player: AudioStreamPlayer3D
var _kitchen_zone: Area3D
var _exit_zone: Area3D
var _walls: Array[Node3D] = []
var _wall_originals: Array[Vector3] = []
var _breath_player: AudioStreamPlayer
var _baseline_bus_volumes := {}

## --- Sequence state ---
var _started := false
var _player_start := Vector3.ZERO
var _phase: int = Phase.IDLE
var _voice_on := false
var _arrival_timer := 0.0
var _voice_script: Array = []
var _voice_line_index := 0
var _voice_char_index := 0
var _voice_char_timer := 0.0
var _name_heard := false
var _kitchen_fired := false
var _liminal_fired := false
var _exit_fired := false
var _liminal_timer := 0.0
var _walls_timer := 0.0
var _breath_phase := 0.0
var _voice_phase := 0.0
var _voice_stream: AudioStreamGeneratorPlayback

## Voice synthesis: formant-ish carrier, slightly too slow/warm.
const VOICE_SR := 44100.0
const VOICE_BASE_HZ := 128.0
const VOICE_WOBBLE_HZ := 4.0

func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_resolve_references()
	_place_player()
	_apply_camera(false)
	_silence_world()
	_setup_radio()
	_load_voice_script()
	_connect_zones()
	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)
	start_segment()


func _resolve_references() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_kitchen_zone = get_node_or_null("House/KitchenZone") as Area3D
	_exit_zone = get_node_or_null("FrontDoorZone") as Area3D
	for wall_name in ["House/Walls/North", "House/Walls/South", "House/Walls/Inner"]:
		var wall := get_node_or_null(wall_name)
		if wall:
			_walls.append(wall)
			_wall_originals.append(wall.position)

	# In-world voice: spatialized from the kitchen, on Master (not radio bus).
	_voice_player = AudioStreamPlayer3D.new()
	_voice_player.name = "HaroldVoice"
	_voice_player.stream = _make_voice_stream()
	_voice_player.bus = "Master"
	_voice_player.unit_size = 4.0
	_voice_player.max_distance = 25.0
	_voice_player.position = KITCHEN_VOICE_POS
	add_child(_voice_player)

	# Sub-bass breathing (LIMINAL phase): on Master so it survives muting.
	_breath_player = AudioStreamPlayer.new()
	_breath_player.name = "BreathPlayer"
	_breath_player.stream = _make_breath_stream()
	_breath_player.bus = "Master"
	_breath_player.volume_db = -6.0
	add_child(_breath_player)


func _place_player() -> void:
	if _player == null:
		return
	_player_start = Vector3(0.0, 0.5, 0.0)
	_player.global_position = _player_start
	if _player.has_method("look_at"):
		_player.look_at(_player.global_position + Vector3(1, 0, 0), Vector3.UP)


func _apply_camera(kitchen: bool) -> void:
	if _camera_rig == null:
		return
	var pos := CAM_LIVING_POS if not kitchen else CAM_KITCHEN_POS
	var look := CAM_LIVING_LOOK if not kitchen else CAM_KITCHEN_LOOK
	var fov := CAM_LIVING_FOV if not kitchen else CAM_KITCHEN_FOV
	_camera_rig.look_at_from_position(pos, look, Vector3.UP)
	_camera_rig.fov = fov
	_camera_rig.current = true


func _silence_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for name in SILENCED_BUS_NAMES:
		var idx: int = AudioServer.get_bus_index(name)
		if idx < 0:
			continue
		_baseline_bus_volumes[idx] = AudioServer.get_bus_volume_db(idx)
		abm.set_bus_mute(idx, true)


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(1)
		_radio_tuner.set_band(LIVING_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		_signal_strength.set_signal(0.0)


func _connect_zones() -> void:
	if _kitchen_zone and not _kitchen_zone.body_entered.is_connected(_on_kitchen_entered):
		_kitchen_zone.body_entered.connect(_on_kitchen_entered)
	if _exit_zone and not _exit_zone.body_entered.is_connected(_on_exit_zone_entered):
		_exit_zone.body_entered.connect(_on_exit_zone_entered)


func start_segment() -> void:
	if _started:
		return
	_started = true
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	_enter_phase(Phase.ARRIVAL)
	segment_started.emit()

## --- Phase machinery ---

func _enter_phase(p: int) -> void:
	_phase = p
	match p:
		Phase.ARRIVAL:
			pass
		Phase.VOICE:
			voice_started.emit()
			_voice_on = true
		Phase.KITCHEN:
			kitchen_entered.emit()
			_apply_camera(true)
			var static_fx := StaticTransition.new()
			static_fx.name = "KitchenCut"
			add_child(static_fx)
			static_fx.play(0.5)
		Phase.LIMINAL:
			liminal_revealed.emit()
			_unlock_liminal()
		Phase.WALLS:
			walls_breathing.emit()
			if _breath_player:
				_breath_player.play()
		Phase.EXIT:
			house_exited.emit()
			_open_front_door()
		Phase.COMPLETED:
			segment_completed.emit()
			if PhaseManager:
				PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)


func _process(delta: float) -> void:
	if not _started:
		return
	match _phase:
		Phase.ARRIVAL:
			_process_arrival(delta)
		Phase.VOICE:
			_process_voice(delta)
		Phase.KITCHEN:
			_process_voice(delta)
		Phase.LIMINAL:
			_process_liminal(delta)
		Phase.WALLS:
			_process_walls(delta)
		Phase.EXIT:
			_process_exit(delta)
	_update_voice_audio(delta)
	_update_walls_breathing(delta)


## ARRIVAL: a short beat in the living room, then the voice starts.
func _process_arrival(delta: float) -> void:
	_arrival_timer += delta
	if _arrival_timer >= 3.0:
		_enter_phase(Phase.VOICE)


## VOICE/KITCHEN: the garden report loops from the kitchen, reversed.
## Radio is dead air (0). When the loop reaches the name slot, the name is
## heard; LIMINAL reveals LIMINAL_REVEAL_DELAY later.
func _process_voice(delta: float) -> void:
	# Dead air on the radio while the in-world voice runs.
	if _signal_strength:
		_signal_strength.set_signal(0.0)
	_advance_voice_script(delta)
	if _name_heard and not _liminal_fired:
		_liminal_timer += delta
		if _liminal_timer >= LIMINAL_REVEAL_DELAY:
			_liminal_fired = true
			_enter_phase(Phase.LIMINAL)


## Load Harold's garden-report lines from calls.json, character-reversed —
## the same backwards-speech treatment as the 2B fragments. The final slot
## is the name.
func _load_voice_script() -> void:
	var f := FileAccess.open("res://src/data/calls.json", FileAccess.READ)
	if f == null:
		push_warning("FirstHouseSegment: cannot open calls.json")
		return
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	var calls: Array = []
	if parsed is Dictionary and parsed.has("calls"):
		calls = parsed["calls"]
	elif parsed is Array:
		calls = parsed
	var lines: Array = []
	for c in calls:
		if int(c.get("id", -1)) == VOICE_SOURCE_CALL_ID:
			var source_lines: Array = c.get("lines", [])
			for li in VOICE_SOURCE_LINE_IDS:
				if li < source_lines.size():
					lines.append(str(source_lines[li]))
			break
	for text in lines:
		_voice_script.append({"text": ReversedFragments.reverse_text(text), "name": false})
	_voice_script.append({"text": ReversedFragments.reverse_text("he says your name"), "name": true})


## Advance the reversed-speech schedule; entering the name slot fires
## name_heard.
func _advance_voice_script(delta: float) -> void:
	if _voice_script.is_empty():
		_load_voice_script()
		if _voice_script.is_empty():
			return
	_voice_char_timer += delta
	if _voice_char_timer < VOICE_CHAR_DURATION:
		return
	_voice_char_timer = 0.0
	_voice_char_index += 1
	var text: String = _voice_script[_voice_line_index]["text"]
	if _voice_char_index >= text.length():
		_voice_line_index = (_voice_line_index + 1) % _voice_script.size()
		_voice_char_index = 0
		if _voice_script[_voice_line_index]["name"] and not _name_heard:
			_name_heard = true
			name_heard.emit()


## Syllable-ish burst envelope for one character of reversed speech.
static func _char_envelope(t: float) -> float:
	var x := clampf(t / VOICE_CHAR_DURATION, 0.0, 1.0)
	if x < 0.15:
		return x / 0.15
	if x > 0.8:
		return (1.0 - x) / 0.2
	return 1.0


## LIMINAL: revealed; wait WALLS_DELAY then the walls breathe.
func _process_liminal(delta: float) -> void:
	# The new band bleeds through the dead air as a whisper.
	if _signal_strength:
		_signal_strength.set_signal(WHISPER_SIGNAL)
	_advance_voice_script(delta)
	_walls_timer += delta
	if _walls_timer >= WALLS_DELAY:
		_enter_phase(Phase.WALLS)


## WALLS: walls breathe visually; waiting for the player to reach the exit.
func _process_walls(delta: float) -> void:
	if _signal_strength:
		_signal_strength.set_signal(WHISPER_SIGNAL)
	_advance_voice_script(delta)


## EXIT: player has left the house; static fades into a stable signal.
func _process_exit(delta: float) -> void:
	if _signal_strength:
		var current: float = _signal_strength.signal_value
		_signal_strength.set_signal(move_toward(current, 45.0, delta * 10.0))


## --- Zone triggers ---

func _on_kitchen_entered(body: Node3D) -> void:
	if not _started or _kitchen_fired:
		return
	if not body.is_in_group("player"):
		return
	if _phase != Phase.VOICE and _phase != Phase.LIMINAL and _phase != Phase.WALLS:
		return
	_kitchen_fired = true
	_enter_phase(Phase.KITCHEN)


func _on_exit_zone_entered(body: Node3D) -> void:
	if not _started or _exit_fired:
		return
	if not body.is_in_group("player"):
		return
	# Exit is only real once the house is wrong (WALLS).
	if _phase != Phase.WALLS and _phase != Phase.LIMINAL:
		return
	_exit_fired = true
	_enter_phase(Phase.EXIT)
	# A short static beat on the changed street, then complete.
	var timer := get_tree().create_timer(2.0)
	timer.timeout.connect(func() -> void:
		if _phase == Phase.EXIT:
			_enter_phase(Phase.COMPLETED)
	)


func _unlock_liminal() -> void:
	if _signal_strength:
		_signal_strength.set_signal(0.0)
	var bc := _autoload("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(LIMINAL_BAND_ID)


func _open_front_door() -> void:
	var door := get_node_or_null("House/FrontDoor")
	if door:
		door.visible = false


## --- World muting ---

const SILENCED_BUS_NAMES: Array[StringName] = [
	&"ROOM_TONE",
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"SILENCE",
	&"UI",
	&"TAPE",
	&"RADIO_AMBIENT",
]


func _restore_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for idx in _baseline_bus_volumes:
		abm.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()


## --- Audio synthesis ---

func _make_voice_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = VOICE_SR
	gen.buffer_length = 1.0
	return gen


func _make_breath_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = VOICE_SR
	gen.buffer_length = 1.0
	return gen


func _update_voice_audio(delta: float) -> void:
	if not _voice_on:
		return
	if _voice_stream == null:
		_voice_player.play()
		_voice_stream = _voice_player.get_stream_playback()
	if _voice_player:
		var dist := 0.0
		if _player:
			dist = _player.global_position.distance_to(KITCHEN_VOICE_POS)
		var att := clampf(1.0 - dist / 12.0, 0.15, 1.0)
		_voice_player.volume_db = linear_to_db(att)
	_fill_voice_buffer(delta)


func _fill_voice_buffer(delta: float) -> void:
	if _voice_stream == null:
		return
	var frames := _voice_stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	var speaking := _phase == Phase.VOICE or _phase == Phase.KITCHEN \
		or _phase == Phase.LIMINAL or _phase == Phase.WALLS
	var in_name := false
	if speaking and not _voice_script.is_empty():
		in_name = _voice_script[_voice_line_index]["name"]
	for i in range(frames):
		var s := 0.0
		if speaking:
			# Per-character burst envelope: backwards-speech cadence.
			var env := _char_envelope(_voice_char_timer)
			# Carrier wobble; lower/warmer during the name.
			var wobble := 1.0 + 0.25 * sin(_voice_phase * 0.7)
			var hz := VOICE_BASE_HZ * (0.8 if in_name else 1.0)
			s = (sin(_voice_phase) * 0.14 + sin(_voice_phase * 2.7) * 0.06) * env * wobble
			_voice_phase += hz * TAU / VOICE_SR
		buf[i] = Vector2(s, s)


	_voice_stream.push_buffer(buf)
func _update_walls_breathing(delta: float) -> void:
	if _phase != Phase.WALLS:
		return
	_breath_phase += delta * WALL_BREATH_RATE_HZ * TAU
	var amp := WALL_BREATH_AMPLITUDE * (0.5 + 0.5 * sin(_breath_phase))
	for i in range(_walls.size()):
		_walls[i].position = _wall_originals[i] + Vector3(0, amp, 0)


## --- Helpers ---

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
		Phase.ARRIVAL: return "ARRIVAL"
		Phase.VOICE: return "VOICE"
		Phase.KITCHEN: return "KITCHEN"
		Phase.LIMINAL: return "LIMINAL"
		Phase.WALLS: return "WALLS"
		Phase.EXIT: return "EXIT"
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


func is_voice_on() -> bool:
	return _voice_on


func is_name_heard() -> bool:
	return _name_heard


func get_voice_script() -> Array:
	return _voice_script.duplicate()


func get_voice_line_index() -> int:
	return _voice_line_index


func skip_voice_to_name_for_testing() -> void:
	if _voice_script.is_empty():
		_load_voice_script()
	for i in range(_voice_script.size()):
		if _voice_script[i]["name"]:
			_voice_line_index = i
			_voice_char_index = 0
			_voice_char_timer = 0.0
			_name_heard = true
			name_heard.emit()
			return


func is_liminal_unlocked() -> bool:
	var bc := _autoload("BandController")
	if bc == null:
		return false
	return bc.is_band_unlocked(LIMINAL_BAND_ID)


func get_wall_offset() -> float:
	if _walls.is_empty():
		return 0.0
	return _walls[0].position.y - _wall_originals[0].y


func get_voice_distance_attenuation() -> float:
	if _voice_player == null:
		return 0.0
	return db_to_linear(_voice_player.volume_db)


func is_breath_playing() -> bool:
	return _breath_player and _breath_player.playing


func has_kitchen_fired() -> bool:
	return _kitchen_fired


func has_exit_fired() -> bool:
	return _exit_fired


func force_voice_phase_for_testing() -> void:
	_enter_phase(Phase.VOICE)


func force_kitchen_for_testing() -> void:
	_kitchen_fired = false
	_on_kitchen_entered(_player)


func force_liminal_for_testing() -> void:
	_liminal_fired = false
	_name_heard = true
	_enter_phase(Phase.LIMINAL)


func force_exit_for_testing() -> void:
	_exit_fired = false
	_on_exit_zone_entered(_player)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_voice_on = false
	_arrival_timer = 0.0
	_voice_script = []
	_voice_line_index = 0
	_voice_char_index = 0
	_voice_char_timer = 0.0
	_name_heard = false
	_kitchen_fired = false
	_liminal_fired = false
	_exit_fired = false
	_liminal_timer = 0.0
	_walls_timer = 0.0
	_breath_phase = 0.0
	_voice_phase = 0.0
	if _voice_player:
		_voice_player.stop()
		_voice_stream = null
	if _breath_player:
		_breath_player.stop()
	for i in range(_walls.size()):
		_walls[i].position = _wall_originals[i]
	_restore_world()
	var door := get_node_or_null("House/FrontDoor")
	if door:
		door.visible = true
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
