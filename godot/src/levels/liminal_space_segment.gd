class_name LiminalSpaceSegment
extends Node3D

## Location 3: "The Liminal Space" — third location of Phase 3 (DEA-123).
##
## A 30-40 minute hub. Open area with doors that float in space — doors to
## nowhere, and doors that lead somewhere. Fixed cameras at impossible
## angles (ceiling, floor, through walls).
##
## Radio: LIMINAL dominant and stable. LIVING and LOST flicker — their
## signal decays over time unless re-tuned, teaching that only LIMINAL
## holds here.
##
## Liminal navigation puzzle: find 3 doors using the bands.
##   LIVING  -> the Neighborhood door (locked; Shift 1 calls play behind it)
##   LOST    -> the Bunker door (progression)
##   LIMINAL -> the safe room door (rest + save)
##
## The Suits (first enemy encounter, DEA-125): they walk between doors.
## The player hears them through radio static (radio static surges as a
## Suit nears — not world audio). If detected: composure -30 and the
## player is teleported to a random door. Hiding (HIDE mode) breaks the
## detection.
##
## Safe room: small room with a cassette player; station calls play on
## loop, comforting but wrong. Room tone exists here (station booth) —
## the only place in the Liminal Space with it.
##
## Audio: no room tone anywhere else. Just radio.

signal segment_started
signal door_found(door_id: String)
signal puzzle_completed
signal suit_detected_player
signal player_relocated_by_suit
signal entered_safe_room
signal saved_in_safe_room
signal bunker_door_entered
signal segment_completed

enum Phase {
	IDLE,
	EXPLORE,     # find the three doors
	HUNTED,      # a Suit is active and patrolling
	SAFE_ROOM,   # inside the safe room
	DEPARTED,    # bunker door used; leaving
	COMPLETED,
}

## --- Doors ---
## Each door opens only while its band is tuned. Positions spread across
## the floating space.
const DOOR_BANDS := {
	"neighborhood": 0,  # LIVING
	"bunker": 2,        # LOST
	"safe": 1,          # LIMINAL
}
const DOOR_UNLOCK_DISTANCE := 3.0

## Detection: composure hit on being seen (GDD: -30).
const DETECTED_COMPOSURE_HIT := 30.0

## Flicker: LIVING/LOST signals decay each second; LIMINAL holds.
const SIGNAL_LIMINAL_BASE := 70.0
const SIGNAL_FLICKER_BASE := 55.0
const FLICKER_DECAY_PER_SEC := 6.0
const FLICKER_FLOOR := 8.0

## Suit timing: first Suit spawns after 40s of exploration; subsequent
## hunts every 75s.
const FIRST_SUIT_DELAY := 40.0
const SUIT_INTERVAL := 75.0

## Safe room: cassette save.
const SAFE_ROOM_SAVE_TAPE := "liminal_safe_1"

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _doors := {}               # door_id -> Node3D
var _suits: Array[Suit] = []
var _safe_room: Node3D
var _static_sky: StaticSky

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _doors_found := {}         # door_id -> true
var _flicker_timer := 0.0
var _suit_timer := 0.0
var _suits_spawned := 0
var _active_suit: Suit = null
var _detected_flag := false
var _in_safe_room := false
var _saved_here := false
var _baseline_bus_volumes := {}
var _door_signal_timer := 0.0

## Audio synthesis (static surge on Suit proximity).
var _static_player: AudioStreamPlayer
var _static_phase := 0.0
var _static_stream_playback: AudioStreamGeneratorPlayback
var _safe_tone_player: AudioStreamPlayer
var _safe_phase := 0.0
var _safe_stream_playback: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_safe_room = get_node_or_null("SafeRoom")
	for door_id in DOOR_BANDS:
		_doors[door_id] = get_node_or_null("Doors/" + door_id.capitalize() + "Door")
	_setup_static_sky()
	_setup_audio()
	_place_player()
	_setup_door_areas()
	_silence_world()
	_setup_radio()
	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)
	start_segment()


func _setup_static_sky() -> void:
	_static_sky = get_node_or_null("StaticSky") as StaticSky
	if _static_sky == null:
		_static_sky = StaticSky.new()
		_static_sky.name = "StaticSky"
		_static_sky.position = Vector3(0, 0, -20)
		add_child(_static_sky)


func _setup_audio() -> void:
	# Radio static layer: surges with Suit proximity (heard through radio,
	# not world audio).
	_static_player = AudioStreamPlayer.new()
	_static_player.name = "HuntStatic"
	_static_player.stream = _make_generator()
	_static_player.bus = "RADIO_AMBIENT"
	_static_player.volume_db = -40.0
	add_child(_static_player)

	# Safe room tone: station booth hum.
	_safe_tone_player = AudioStreamPlayer.new()
	_safe_tone_player.name = "SafeTone"
	_safe_tone_player.stream = _make_generator()
	_safe_tone_player.bus = "Master"
	_safe_tone_player.volume_db = -30.0
	add_child(_safe_tone_player)


func _make_generator() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


func _place_player() -> void:
	if _player:
		_player.global_position = Vector3(0, 0.5, 4)
		_face_player(Vector3(0, 0, -1))


func _setup_door_areas() -> void:
	for door_id in _doors:
		var door: Node3D = _doors[door_id]
		if door == null:
			continue
		var area := door.get_node_or_null("Area") as Area3D
		if area and not area.body_entered.is_connected(_on_door_area_entered):
			area.body_entered.connect(_on_door_area_entered.bind(door_id))


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
	&"SILENCE",
	&"UI",
	&"TAPE",
]


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		_radio_tuner.set_band(LIMINAL_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
	if _signal_strength:
		_signal_strength.set_signal(SIGNAL_LIMINAL_BASE)


## Bands used in this location.
const LIVING_BAND_ID := 0
const LIMINAL_BAND_ID := 1
const LOST_BAND_ID := 2

## Field calls (DEA-127): abstract, fragmentary, words without sentences.
const FIELD_CALL_INTERVAL := 50.0

## Unified field-call system.
var field_calls: FieldCalls = null


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.EXPLORE
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	_setup_field_calls()
	segment_started.emit()


## Wire the LIMINAL field-call schedule into the unified system.
func _setup_field_calls() -> void:
	if field_calls:
		return
	field_calls = FieldCalls.new()
	field_calls.name = "FieldCalls"
	add_child(field_calls)
	field_calls.setup(build_liminal_field_schedule(), FIELD_CALL_INTERVAL,
		_signal_strength, _get_dread_composure())
	field_calls.start()


## Pure: the LIMINAL schedule — abstract, fragmentary, decontextualized.
static func build_liminal_field_schedule() -> Array:
	return [
		{"id": -1, "band": LIMINAL_BAND_ID, "callerName": "— — —",
			"callerId": "no time", "type": "JUST_LISTEN",
			"lines": ["\"...already. Already. Already...\"",
				"\"words without the sentence.\"",
				"\"the between. only the between.\""]},
		{"id": -1, "band": LIMINAL_BAND_ID, "callerName": "— — —",
			"callerId": "??:??", "type": "JUST_LISTEN",
			"lines": ["\"seven. seven without the context.\"",
				"\"counting is a kind of prayer here.\"",
				"\"...stop counting. it notices.\""]},
		{"id": -1, "band": LIMINAL_BAND_ID, "callerName": "— — —",
			"callerId": "—", "type": "JUST_LISTEN",
			"lines": ["\"this room was a hallway.\"",
				"\"the hallway remembers being a room.\"",
				"\"...you remember being either.\""]},
	]


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	match _phase:
		Phase.EXPLORE:
			_process_explore(delta)
		Phase.HUNTED:
			_process_hunted(delta)
		Phase.SAFE_ROOM:
			_process_safe_room(delta)
		Phase.DEPARTED:
			_process_departed(delta)
	_update_flicker(delta)
	_update_hunt_static(delta)
	_update_safe_tone(delta)


## EXPLORE: signal logic, suit timer, door proximity discovery.
func _process_explore(delta: float) -> void:
	_suit_timer += delta
	if _suit_timer >= FIRST_SUIT_DELAY and _suits_spawned == 0:
		_spawn_suit()
	_update_door_discovery()
	_check_safe_room_entry()


## HUNTED: same as explore but a Suit patrols.
func _process_hunted(delta: float) -> void:
	_suit_timer += delta
	if _suit_timer >= SUIT_INTERVAL:
		_suit_timer = 0.0
		_spawn_suit()
	_update_door_discovery()
	_check_safe_room_entry()
	_check_suit_detection()


## Door discovery: stand near a door with its band tuned.
func _update_door_discovery() -> void:
	if _player == null:
		return
	var current_band: int = _radio_tuner.get("current_band_id") if _radio_tuner else -1
	for door_id in _doors:
		if _doors_found.has(door_id):
			continue
		var door: Node3D = _doors[door_id]
		if door == null:
			continue
		var dist := _player.global_position.distance_to(door.global_position)
		if dist <= DOOR_UNLOCK_DISTANCE and current_band == DOOR_BANDS[door_id]:
			_doors_found[door_id] = true
			door_found.emit(door_id)
			_open_door_visual(door_id)
	if _doors_found.has("neighborhood") and _doors_found.has("bunker") and _doors_found.has("safe"):
		puzzle_completed.emit()


func _open_door_visual(door_id: String) -> void:
	var door: Node3D = _doors[door_id]
	if door:
		var panel := door.get_node_or_null("Panel") as Node3D
		if panel:
			panel.visible = false


## Safe room entry.
func _check_safe_room_entry() -> void:
	if _in_safe_room or _safe_room == null:
		return
	var zone := _safe_room.get_node_or_null("Zone") as Area3D
	if zone == null:
		return
	# Distance check (areas need physics; distance is deterministic).
	var dist := _player.global_position.distance_to(_safe_room.global_position)
	if dist <= 3.0:
		_enter_safe_room()


func _enter_safe_room() -> void:
	_in_safe_room = true
	_phase = Phase.SAFE_ROOM
	entered_safe_room.emit()
	if _signal_strength:
		_signal_strength.set_signal(SIGNAL_FLICKER_BASE)
	if not _saved_here:
		_do_save()
	# Leave safe room by walking out (checked in _process_safe_room).


func _process_safe_room(delta: float) -> void:
	# Room tone plays; leaving exits back to explore.
	if _safe_room and _player:
		var dist := _player.global_position.distance_to(_safe_room.global_position)
		if dist > 4.0:
			_in_safe_room = false
			_phase = Phase.EXPLORE if _active_suit == null else Phase.HUNTED


func _do_save() -> void:
	var save_mgr := _autoload("SaveManager")
	var tape_inv := _autoload("TapeInventory")
	if save_mgr == null or tape_inv == null:
		return
	if save_mgr.is_tape_used(SAFE_ROOM_SAVE_TAPE):
		_saved_here = true
		saved_in_safe_room.emit()
		return
	var data := SaveData.new()
	data.phase = 3
	if _player:
		data.position_x = _player.global_position.x
		data.position_y = _player.global_position.y
		data.position_z = _player.global_position.z
	var ok: bool = save_mgr.save_game(SAFE_ROOM_SAVE_TAPE, data)
	if ok:
		_saved_here = true
		tape_inv.collect_tape(SAFE_ROOM_SAVE_TAPE)
		saved_in_safe_room.emit()


## --- Suits ---

func _spawn_suit() -> void:
	var suit: Suit = Suit.new()
	suit.name = "Suit%d" % _suits_spawned
	add_child(suit)
	# Place at a random door, away from the player.
	var door_positions: Array = []
	for door_id in _doors:
		if _doors[door_id]:
			door_positions.append(_doors[door_id].global_position)
	if door_positions.is_empty():
		door_positions.append(Vector3(0, 0.5, -8))
	var spawn: Vector3 = door_positions[randi() % door_positions.size()]
	suit.global_position = spawn
	_suits.append(suit)
	_suits_spawned += 1
	_active_suit = suit
	if _phase == Phase.EXPLORE:
		_phase = Phase.HUNTED
	suit.player_detected.connect(_on_suit_detected)
	suit.player_relocated.connect(_on_suit_relocated)


func _check_suit_detection() -> void:
	if _active_suit == null or _player == null:
		return
	var dist := _active_suit.global_position.distance_to(_player.global_position)
	if dist <= 2.0:
		_on_suit_detected(_active_suit)


func _on_suit_detected(suit: Suit) -> void:
	if _detected_flag:
		return
	_detected_flag = true
	suit_detected_player.emit()
	_relocate_player()


func _relocate_player() -> void:
	var dc := _get_dread_composure()
	if dc:
		dc.add_composure(-DETECTED_COMPOSURE_HIT)
	# Teleport to a random door.
	var door_positions: Array = []
	for door_id in _doors:
		if _doors[door_id]:
			door_positions.append(_doors[door_id].global_position + Vector3(0, 0, 2))
	if _player and not door_positions.is_empty():
		_player.global_position = door_positions[randi() % door_positions.size()]
	player_relocated_by_suit.emit()
	# Reset the flag after a cooldown so future detections can fire.
	var timer := get_tree().create_timer(3.0)
	timer.timeout.connect(func() -> void: _detected_flag = false)


func _on_suit_relocated(_suit: Suit) -> void:
	_relocate_player()


## --- Flicker: LIVING/LOST decay unless re-tuned; LIMINAL holds ---

func _update_flicker(delta: float) -> void:
	if _signal_strength == null or _radio_tuner == null:
		return
	var band_id: int = _radio_tuner.get("current_band_id")
	if band_id == LIMINAL_BAND_ID:
		_signal_strength.set_signal(SIGNAL_LIMINAL_BASE)
	else:
		# Flicker: decay to the floor, with random jitter.
		_flicker_timer += delta
		var current: float = _signal_strength.signal_value
		var decayed := maxf(current - FLICKER_DECAY_PER_SEC * delta, FLICKER_FLOOR)
		var jitter := randf_range(-3.0, 3.0)
		_signal_strength.set_signal(clampf(decayed + jitter, 0.0, 100.0))


## --- Audio: static surge with Suit proximity; safe room tone ---

func _update_hunt_static(delta: float) -> void:
	if _static_player == null:
		return
	if _static_stream_playback == null:
		_static_player.play()
		_static_stream_playback = _static_player.get_stream_playback()
	var volume := -40.0
	if _active_suit and _player:
		var dist := _active_suit.global_position.distance_to(_player.global_position)
		var closeness := clampf(1.0 - dist / 25.0, 0.0, 1.0)
		volume = lerpf(-40.0, -8.0, closeness)
	_static_player.volume_db = volume
	_fill_static_buffer(delta)


func _fill_static_buffer(delta: float) -> void:
	if _static_stream_playback == null:
		return
	var frames := _static_stream_playback.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# White noise static.
		var s := randf_range(-1.0, 1.0) * 0.4
		buf[i] = Vector2(s, s)
	_static_stream_playback.push_buffer(buf)


func _update_safe_tone(delta: float) -> void:
	if not _in_safe_room:
		return
	if _safe_tone_player and _safe_stream_playback == null:
		_safe_tone_player.play()
		_safe_stream_playback = _safe_tone_player.get_stream_playback()
	_fill_safe_tone_buffer(delta)


func _fill_safe_tone_buffer(delta: float) -> void:
	if _safe_stream_playback == null:
		return
	var frames := _safe_stream_playback.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# Station booth hum: 60 Hz fluorescent + warm low drone.
		_safe_phase += 60.0 * TAU / AUDIO_SR
		var s := sin(_safe_phase) * 0.2 + sin(_safe_phase * 0.5) * 0.1
		buf[i] = Vector2(s, s) * 0.4
	_safe_stream_playback.push_buffer(buf)


## --- Departure ---

func _process_departed(delta: float) -> void:
	if not _completed_fired:
		_completed_fired = true
		_enter_phase(Phase.COMPLETED)


func _on_door_area_entered(body: Node3D, door_id: String) -> void:
	if not _started or not body.is_in_group("player"):
		return
	# Entering the bunker door progresses; others just emit.
	if door_id == "bunker" and _doors_found.has("bunker"):
		_phase = Phase.DEPARTED
		bunker_door_entered.emit()


var _completed_fired := false


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()


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


func _get_dread_composure() -> Node:
	var cm := _autoload("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		return cm.get_dread_composure()
	return null


## --- Testing helpers ---

func get_phase() -> int:
	return _phase


func get_phase_name() -> String:
	match _phase:
		Phase.IDLE: return "IDLE"
		Phase.EXPLORE: return "EXPLORE"
		Phase.HUNTED: return "HUNTED"
		Phase.SAFE_ROOM: return "SAFE_ROOM"
		Phase.DEPARTED: return "DEPARTED"
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


func get_doors_found() -> Array:
	return _doors_found.keys()


func is_door_found(door_id: String) -> bool:
	return _doors_found.has(door_id)


func get_suits_spawned() -> int:
	return _suits_spawned


func get_active_suit() -> Suit:
	return _active_suit


func get_composure() -> float:
	var dc := _get_dread_composure()
	if dc and "composure" in dc:
		return dc.composure
	return -1.0


func spawn_suit_for_testing() -> Suit:
	_suit_timer = 0.0
	_spawn_suit()
	return _active_suit


func place_player_at_door_for_testing(door_id: String) -> void:
	var door: Node3D = _doors.get(door_id)
	if door and _player:
		_player.global_position = door.global_position


func tune_for_testing(band_id: int) -> void:
	if _radio_tuner:
		_radio_tuner.set_band(band_id)


func force_safe_room_for_testing() -> void:
	_enter_safe_room()


func force_detection_for_testing() -> void:
	_on_suit_detected(_active_suit)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_doors_found.clear()
	_flicker_timer = 0.0
	_suit_timer = 0.0
	_suits_spawned = 0
	_detected_flag = false
	_in_safe_room = false
	_saved_here = false
	_completed_fired = false
	for suit in _suits:
		suit.queue_free()
	_suits.clear()
	_active_suit = null
	if _static_player:
		_static_player.stop()
		_static_player.volume_db = -40.0
		_static_stream_playback = null
	if _safe_tone_player:
		_safe_tone_player.stop()
		_safe_stream_playback = null
	var save_mgr := _autoload("SaveManager")
	if save_mgr and save_mgr.has_method("delete_save"):
		save_mgr.delete_save(SAFE_ROOM_SAVE_TAPE)
	if field_calls:
		field_calls.stop()
	_restore_world()
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)


func get_field_calls() -> FieldCalls:
	return field_calls


func _restore_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for idx in _baseline_bus_volumes:
		abm.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
