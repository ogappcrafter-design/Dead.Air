class_name NeighborhoodSegment
extends Node3D

## Location 1: "The Neighborhood" — first location of Phase 3 (DEA-121).
##
## Witness horror, 15-20 min. Six suburban houses, three accessible.
## Street-level RE-style fixed cameras (CameraZone/CameraAngle system).
## The player is small on the street; wide shots.
##
## Houses:
##   A - Harold's (save room: the garden shed, warm, no radio signal)
##   B - The Collector's (archive of tapes)
##   C - The Wrong Number's (phone booth in the kitchen)
##   D - The Empty Lot (a hole; the 1923 voice calls the player down)
##   E, F - locked facades (wrong houses: entering costs composure)
##
## Radio: field calls begin. LIVING for normal houses, LOST for wrong
## houses, LIMINAL for in-between. Signal pulses stronger toward the
## correct (next) house.
##
## Witness mechanic: evidence items (photos, belongings, diaries) can be
## examined but nothing can be changed. After 3+ pieces of evidence, a low
## cello note joins the background audio - persistent until the segment
## ends. The weather is wrong: rain falls upward, faintly.
##
## GDD: Phase 3, Location 1.

signal segment_started
signal house_entered(house_id: String)
signal evidence_examined(evidence_id: String, house_id: String)
signal grief_started
signal save_performed(tape_id: String)
signal field_call_started(call_id: int)
signal wrong_house_entered(house_id: String)
signal correct_house_reached(house_id: String)
signal hole_reached
signal collectors_tape_collected(tape_id: String)
signal segment_completed

## The Collector's Tape side puzzle (DEA-126): LOST-band reveal in House B,
## garden dig, tape-010. Inactive until the player enters House B.
var collectors_puzzle: CollectorsTapePuzzle = null

enum Phase {
	IDLE,
	EXPLORE,      # main loop: walk the street, visit houses
	SAVED,        # brief banner state after a cassette save
	HOLE,         # at the Empty Lot hole; listening to the 1923 voice
	COMPLETED,
}

## --- Houses ---
const HOUSE_IDS := ["A_harold", "B_collector", "C_wrongnumber", "D_emptylot", "E_locked", "F_locked"]
const ACCESSIBLE_HOUSES := ["A_harold", "B_collector", "C_wrongnumber"]
const CORRECT_HOUSE_SEQUENCE := ["A_harold", "B_collector", "C_wrongnumber"]

## --- Radio bands ---
const LIVING_BAND_ID := 0
const LIMINAL_BAND_ID := 1
const LOST_BAND_ID := 2

## Signal: aligned toward the next correct house = strong; away = weak.
const SIGNAL_ALIGNED := 72.0
const SIGNAL_MISALIGNED := 18.0
const ALIGNMENT_FULL_DEG := 35.0
const ALIGNMENT_FALLOFF_DEG := 130.0
const PULSE_RATE_HZ := 0.25
const PULSE_DEPTH := 6.0

## Wrong-house composure cost (GDD: -10 per wrong house).
const WRONG_HOUSE_COMPOSURE_COST := 10.0

## Evidence: 3+ pieces examined shifts the background audio (cello).
const GRIEF_EVIDENCE_THRESHOLD := 3

## Save room: Harold's shed. Cassette tape id.
const SHED_SAVE_TAPE_ID := "shed_1"

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _dc: Node = null
var _static_sky: StaticSky

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _current_house := ""
var _houses_visited := {}          # house_id -> true
var _correct_index := 0            # index into CORRECT_HOUSE_SEQUENCE
var _wrong_houses_entered := {}    # house_id -> true
var _evidence_examined := {}       # evidence_id -> true
var _evidence_count := 0
var _grief_active := false
var _saved_tapes := {}             # tape_id -> true
var _hole_timer := 0.0
var _hole_reached_fired := false
var _hole_voice_started := false
var _saved_timer := 0.0

## Hole timing: silence first (the loudest silence in the game), then the
## voice, then the fall.
const HOLE_VOICE_DELAY := 4.0
const HOLE_FALL_DELAY := 10.0
var _baseline_bus_volumes := {}
var _kitchen_radio_playing := false
var _collectors_puzzle: CollectorsTapePuzzle = null
var _field_call_queue: Array = []
var _field_call_timer := 0.0
var _field_call_interval := 45.0

## Grief audio layer (cello drone) and wrong-weather layer.
var _cello_player: AudioStreamPlayer
var _weather_player: AudioStreamPlayer
var _kitchen_radio_player: AudioStreamPlayer3D
var _hole_voice_player: AudioStreamPlayer3D
var _cello_phase := 0.0
var _weather_phase := 0.0
var _hole_voice_phase := 0.0
var _kitchen_phase := 0.0
const AUDIO_SR := 44100.0
const CELLO_BASE_HZ := 65.4   # C2, low and mournful
const WEATHER_BASE := 220.0   # thin whistle, falling upward
const HOLE_VOICE_HZ := 110.0  # 1923 voice: formal, male, distant
const KITCHEN_VOICE_HZ := 128.0


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_static_sky = get_node_or_null("StaticSky") as StaticSky
	if _static_sky == null:
		_static_sky = StaticSky.new()
		_static_sky.name = "StaticSky"
		_static_sky.position = Vector3(40, 0, 0)
		add_child(_static_sky)
	_dc = _autoload("CallManager")
	if _dc and _dc.get_dread_composure:
		_dc = _dc.get_dread_composure()

	# The Collector's Tape puzzle (DEA-126) lives in House B; the scene
	# provides its props, the segment provides the logic.
	if _collectors_puzzle == null:
		var scene_puzzle := get_node_or_null("HouseB/CollectorsPuzzle")
		if scene_puzzle is CollectorsTapePuzzle:
			_collectors_puzzle = scene_puzzle
		else:
			_collectors_puzzle = CollectorsTapePuzzle.new()
			_collectors_puzzle.name = "CollectorsPuzzle"
			var house_b := get_node_or_null("HouseB")
			if house_b:
				house_b.add_child(_collectors_puzzle)
			else:
				add_child(_collectors_puzzle)
		if not _collectors_puzzle.tape_dug_up.is_connected(_on_collectors_tape_dug):
			_collectors_puzzle.tape_dug_up.connect(_on_collectors_tape_dug)

	_connect_zones()
	_setup_audio()
	_place_player()
	_setup_camera_system()
	_silence_world()
	_setup_radio()

	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)
	start_segment()


func _connect_zones() -> void:
	for zone_name in ["HouseA/DoorZone", "HouseB/DoorZone", "HouseC/DoorZone",
			"HouseE/DoorZone", "HouseF/DoorZone", "EmptyLot/HoleZone",
			"Shed/ShedZone"]:
		var zone := get_node_or_null(zone_name) as Area3D
		if zone and not zone.body_entered.is_connected(_on_zone_body_entered):
			zone.body_entered.connect(_on_zone_body_entered)


## Zone routing: derive house id from the zone's path.
func _on_zone_body_entered(body: Node3D) -> void:
	if not _started or not body.is_in_group("player"):
		return
	if not body is CharacterBody3D:
		return
	var zone := body.get_parent() as Node
	if zone == null:
		return
	var zone_path := zone.scene_file_path if false else String(zone.get_path())
	if zone_path.contains("HouseA/DoorZone"):
		_enter_house("A_harold")
	elif zone_path.contains("HouseB/DoorZone"):
		_enter_house("B_collector")
	elif zone_path.contains("HouseC/DoorZone"):
		_enter_house("C_wrongnumber")
	elif zone_path.contains("HouseE/DoorZone"):
		_enter_house("E_locked")
	elif zone_path.contains("HouseF/DoorZone"):
		_enter_house("F_locked")
	elif zone_path.contains("EmptyLot/HoleZone"):
		_reach_hole()
	elif zone_path.contains("Shed/ShedZone"):
		_enter_shed()


func _setup_audio() -> void:
	# Grief cello layer: silent until enough evidence is examined.
	_cello_player = AudioStreamPlayer.new()
	_cello_player.name = "GriefCello"
	_cello_player.stream = _make_cello_stream()
	_cello_player.bus = "Master"
	_cello_player.volume_db = -80.0
	add_child(_cello_player)

	# Wrong-weather layer: thin rising whistle, rain that falls upward.
	_weather_player = AudioStreamPlayer.new()
	_weather_player.name = "WrongWeather"
	_weather_player.stream = _make_weather_stream()
	_weather_player.bus = "Master"
	_weather_player.volume_db = -18.0
	add_child(_weather_player)

	# House A kitchen radio: environmental call, not from the portable.
	_kitchen_radio_player = AudioStreamPlayer3D.new()
	_kitchen_radio_player.name = "KitchenRadio"
	_kitchen_radio_player.stream = _make_kitchen_stream()
	_kitchen_radio_player.bus = "Master"
	_kitchen_radio_player.unit_size = 5.0
	_kitchen_radio_player.max_distance = 20.0
	add_child(_kitchen_radio_player)

	# Empty Lot hole voice: the 1923 voice calling the player down.
	_hole_voice_player = AudioStreamPlayer3D.new()
	_hole_voice_player.name = "HoleVoice"
	_hole_voice_player.stream = _make_hole_voice_stream()
	_hole_voice_player.bus = "Master"
	_hole_voice_player.unit_size = 6.0
	_hole_voice_player.max_distance = 30.0
	add_child(_hole_voice_player)


func _place_player() -> void:
	if _player == null:
		return
	_player.global_position = Vector3(0, 0.5, 0)
	_player.look_at(_player.global_position + Vector3(1, 0, 0), Vector3.UP)


## Register camera zones with CameraManager (DEA-108 system).
func _setup_camera_system() -> void:
	var cam_mgr := _autoload("CameraManager")
	if cam_mgr == null:
		return
	cam_mgr.set_rig(_camera_rig)
	cam_mgr.set_player(_player)
	for zone in get_tree().get_nodes_in_group("camera_zone"):
		if zone is CameraZone:
			cam_mgr.register_zone(zone)


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
		_radio_tuner.set_band(LIVING_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
	# Field call queue: 2-3 suburban-themed procedural calls, staged.
	_field_call_queue = build_field_call_schedule()


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.EXPLORE
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	segment_started.emit()


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE:
		return
	match _phase:
		Phase.EXPLORE:
			_process_explore(delta)
		Phase.SAVED:
			_process_saved(delta)
		Phase.HOLE:
			_process_hole(delta)
		Phase.COMPLETED:
			pass
	_update_grief_audio(delta)
	_update_weather_audio(delta)
	_update_kitchen_radio(delta)
	_update_hole_voice(delta)


func _process_explore(delta: float) -> void:
	# Navigation-by-radio: pulse toward the next correct house.
	var signal_val := _compute_house_signal()
	if _signal_strength:
		_signal_strength.set_signal(signal_val)
	# Field calls come in periodically while exploring.
	_field_call_timer += delta
	if _field_call_timer >= _field_call_interval and not _field_call_queue.is_empty():
		_field_call_timer = 0.0
		_fire_field_call()
	# Keep the static sky overhead.
	if _static_sky and _player:
		_static_sky.position.x = _player.global_position.x + 20.0


func _process_saved(delta: float) -> void:
	# Brief banner; composure regenerates in the safe room.
	_saved_timer += delta
	if _saved_timer >= 2.0:
		_saved_timer = 0.0
		_phase = Phase.EXPLORE


func _process_hole(delta: float) -> void:
	# The hole: signal 0, total silence, then the 1923 voice calls you down.
	if _signal_strength:
		_signal_strength.set_signal(0.0)
	_hole_timer += delta
	if _hole_timer >= HOLE_VOICE_DELAY and not _hole_voice_started:
		_hole_voice_started = true
		_hole_voice_player.play()
	if _hole_timer >= HOLE_FALL_DELAY:
		_enter_phase(Phase.COMPLETED)


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()


## --- House entry/exit ---

func _enter_house(house_id: String) -> void:
	if _current_house == house_id:
		return
	var was_in_house := _current_house != ""
	_current_house = house_id
	if not _houses_visited.has(house_id):
		_houses_visited[house_id] = true
		house_entered.emit(house_id)
	if house_id in ACCESSIBLE_HOUSES:
		# Correct-house progression.
		if _correct_index < CORRECT_HOUSE_SEQUENCE.size() and CORRECT_HOUSE_SEQUENCE[_correct_index] == house_id:
			_correct_index += 1
			correct_house_reached.emit(house_id)
		# Harold's kitchen radio: plays only inside House A, portable off.
		if house_id == "A_harold" and not _kitchen_radio_playing:
			_kitchen_radio_playing = true
			_kitchen_radio_player.play()
			field_call_started.emit(3)  # fragment of Call #3, from the kitchen
		# The Collector's Tape puzzle lives in House B (DEA-126).
		if house_id == "B_collector" and _collectors_puzzle:
			_collectors_puzzle.set_house_entered(true)
	elif house_id in ["E_locked", "F_locked"]:
		# Wrong house: composure cost.
		if not _wrong_houses_entered.has(house_id):
			_wrong_houses_entered[house_id] = true
			if _dc and _dc.has_method("add_composure"):
				_dc.add_composure(-WRONG_HOUSE_COMPOSURE_COST)
			wrong_house_entered.emit(house_id)


func _leave_house() -> void:
	if _current_house == "":
		return
	if _current_house == "A_harold" and _kitchen_radio_playing:
		_kitchen_radio_playing = false
		_kitchen_radio_player.stop()
	_current_house = ""


func _enter_shed() -> void:
	# Save room: composure regen, cassette save, no radio signal.
	if _signal_strength:
		_signal_strength.set_signal(0.0)
	if _dc:
		_dc.in_safe_room = true
	var radio_container := get_node_or_null("PortableRadio")
	if radio_container and radio_container is Node3D:
		(radio_container as Node3D).visible = false
	_do_save()


func _do_save() -> void:
	var save_mgr := _autoload("SaveManager")
	var tape_inv := _autoload("TapeInventory")
	if save_mgr == null or tape_inv == null:
		return
	if _saved_tapes.has(SHED_SAVE_TAPE_ID):
		return
	var data := SaveData.new()
	data.phase = 3
	data.shift = 0
	data.composure = _dc.composure if _dc and "composure" in _dc else 100.0
	data.dread = _dc.dread if _dc and "dread" in _dc else 0.0
	if _player:
		data.position_x = _player.global_position.x
		data.position_y = _player.global_position.y
		data.position_z = _player.global_position.z
	var ok: bool = save_mgr.save_game(SHED_SAVE_TAPE_ID, data)
	if ok:
		_saved_tapes[SHED_SAVE_TAPE_ID] = true
		tape_inv.collect_tape(SHED_SAVE_TAPE_ID)
		save_performed.emit(SHED_SAVE_TAPE_ID)
		_enter_phase(Phase.SAVED)


## --- Evidence & grief ---

func _on_evidence_examined(evidence_id: String, house_id: String) -> void:
	if _evidence_examined.has(evidence_id):
		return
	_evidence_examined[evidence_id] = true
	_evidence_count += 1
	evidence_examined.emit(evidence_id, house_id)
	if _evidence_count >= GRIEF_EVIDENCE_THRESHOLD and not _grief_active:
		_grief_active = true
		grief_started.emit()
		_cello_player.volume_db = -12.0


func has_examined_evidence(evidence_id: String) -> bool:
	return _evidence_examined.has(evidence_id)


## --- Empty Lot hole ---

func _reach_hole() -> void:
	if _hole_reached_fired:
		return
	_hole_reached_fired = true
	_hole_timer = 0.0
	_hole_voice_started = false
	_enter_phase(Phase.HOLE)
	hole_reached.emit()


## --- Field calls ---

## Pure: build the field-call schedule. Suburban-themed, three bands.
static func build_field_call_schedule() -> Array:
	return [
		{"id": -1, "band": LIVING_BAND_ID, "callerName": "Suburban Voice",
			"callerId": "23:14", "type": "JUST_LISTEN",
			"lines": ["\"...the sprinklers came on again.\"",
				"\"Third time tonight. Nobody set them.\"",
				"\"...I unplugged them.\""]},
		{"id": -1, "band": LIMINAL_BAND_ID, "callerName": "Wrong Weather",
			"callerId": "02:41", "type": "JUST_LISTEN",
			"lines": ["\"The rain is going up.\"",
				"\"You heard me. It's going up.\"",
				"\"...nobody else looks.\""]},
		{"id": -1, "band": LOST_BAND_ID, "callerName": "Empty Swing",
			"callerId": "03:03", "type": "JUST_LISTEN",
			"lines": ["\"The swing next door still moves.\"",
				"\"There's no kid. There's no kid.\"",
				"\"...I checked.\""]},
	]


func _fire_field_call() -> void:
	if _field_call_queue.is_empty():
		return
	var call: Dictionary = _field_call_queue.pop_front()
	field_call_started.emit(call.get("id", -1))


## --- Signal: navigation by house alignment ---

func _compute_house_signal() -> float:
	var alignment := 0.0
	if _player:
		var target := _get_current_target_position()
		if target != Vector3.INF:
			var to_target := target - _player.global_position
			to_target.y = 0.0
			if to_target.length() > 0.5:
				var facing := -_player.global_transform.basis.z
				facing.y = 0.0
				facing = facing.normalized() if facing.length() > 0.01 else to_target.normalized()
				var dot := facing.dot(to_target.normalized())
				var angle_deg := rad_to_deg(acos(clampf(dot, -1.0, 1.0)))
				if angle_deg <= ALIGNMENT_FULL_DEG:
					alignment = 1.0
				elif angle_deg >= ALIGNMENT_FALLOFF_DEG:
					alignment = 0.0
				else:
					var t := (angle_deg - ALIGNMENT_FULL_DEG) / (ALIGNMENT_FALLOFF_DEG - ALIGNMENT_FULL_DEG)
					alignment = 1.0 - t
	var pulse := sin(Time.get_ticks_msec() * PULSE_RATE_HZ * TAU / 1000.0) * PULSE_DEPTH
	var val := lerpf(SIGNAL_MISALIGNED, SIGNAL_ALIGNED, alignment) + pulse
	return clampf(val, 0.0, 100.0)


## The next correct house's door position; INF when all visited.
func _get_current_target_position() -> Vector3:
	if _correct_index >= CORRECT_HOUSE_SEQUENCE.size():
		return Vector3.INF
	var target_id: String = CORRECT_HOUSE_SEQUENCE[_correct_index]
	var node := get_node_or_null(_house_target_paths.get(target_id, ""))
	if node is Node3D:
		return (node as Node3D).global_position
	return Vector3.INF


const _house_target_paths := {
	"A_harold": "HouseA/DoorTarget",
	"B_collector": "HouseB/DoorTarget",
	"C_wrongnumber": "HouseC/DoorTarget",
}


## --- Audio synthesis ---

func _make_cello_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


func _make_weather_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


func _make_kitchen_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


func _make_hole_voice_stream() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


func _update_grief_audio(delta: float) -> void:
	if not _grief_active:
		return
	if _cello_player and not _cello_player.playing:
		_cello_player.play()
	_fill_cello_buffer(delta)


func _fill_cello_buffer(delta: float) -> void:
	var pb: AudioStreamGeneratorPlayback = _cello_player.get_stream_playback()
	if pb == null:
		return
	var frames := pb.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_cello_phase += CELLO_BASE_HZ * TAU / AUDIO_SR
		# Slow bowing: amplitude swells over ~6s cycle with harmonic fifth.
		var bow := 0.5 + 0.5 * sin(_cello_phase * 0.004)
		var s := (sin(_cello_phase) * 0.6 + sin(_cello_phase * 1.5) * 0.25) * bow * 0.35
		buf[i] = Vector2(s, s)


	pb.push_buffer(buf)
func _update_weather_audio(delta: float) -> void:
	if _weather_player and not _weather_player.playing:
		_weather_player.play()
	_fill_weather_buffer(delta)


func _fill_weather_buffer(delta: float) -> void:
	var pb: AudioStreamGeneratorPlayback = _weather_player.get_stream_playback()
	if pb == null:
		return
	var frames := pb.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# Rising whisper: pitch climbs, thin, wrong. Occasional droplet pips.
		_weather_phase += WEATHER_BASE * (1.0 + 0.4 * sin(_weather_phase * 0.002)) * TAU / AUDIO_SR
		var s := sin(_weather_phase) * 0.02
		if fmod(_weather_phase, TAU * 8.0) < 0.1:
			s += 0.03
		buf[i] = Vector2(s, s)


	pb.push_buffer(buf)
func _update_kitchen_radio(delta: float) -> void:
	if not _kitchen_radio_playing:
		return
	_fill_kitchen_buffer(delta)


func _fill_kitchen_buffer(delta: float) -> void:
	var pb: AudioStreamGeneratorPlayback = _kitchen_radio_player.get_stream_playback()
	if pb == null:
		return
	var frames := pb.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# Tinny radio-filtered voice: narrow, mid, crackling between words.
		_kitchen_phase += KITCHEN_VOICE_HZ * TAU / AUDIO_SR
		var crackle := 0.0
		if fmod(_kitchen_phase, TAU * 3.7) < 0.05:
			crackle = 0.4
		var s := (sin(_kitchen_phase) * 0.15 + sin(_kitchen_phase * 2.3) * 0.08) + crackle * 0.1
		buf[i] = Vector2(s * 0.5, s * 0.5)


	pb.push_buffer(buf)
func _update_hole_voice(delta: float) -> void:
	if not _hole_voice_started:
		return
	_fill_hole_voice_buffer(delta)


func _fill_hole_voice_buffer(delta: float) -> void:
	var pb: AudioStreamGeneratorPlayback = _hole_voice_player.get_stream_playback()
	if pb == null:
		return
	var frames := pb.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# The 1923 voice: formal, distant, reverberant from below.
		_hole_voice_phase += HOLE_VOICE_HZ * TAU / AUDIO_SR
		var s := (sin(_hole_voice_phase) * 0.2 + sin(_hole_voice_phase * 1.8) * 0.1) * 0.5
		buf[i] = Vector2(s, s)


	pb.push_buffer(buf)
## --- Helpers ---

## Point the player's -Z at the given direction (tests / signal checks).
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
		Phase.SAVED: return "SAVED"
		Phase.HOLE: return "HOLE"
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


func get_correct_index() -> int:
	return _correct_index


func get_evidence_count() -> int:
	return _evidence_count


func is_grief_active() -> bool:
	return _grief_active


func get_wrong_houses_entered() -> Array:
	return _wrong_houses_entered.keys()


func has_saved() -> bool:
	return _saved_tapes.has(SHED_SAVE_TAPE_ID)


func get_composure() -> float:
	var dc := _get_dread_composure()
	if dc and "composure" in dc:
		return dc.composure
	return -1.0


func examine_evidence_for_testing(evidence_id: String, house_id: String) -> void:
	_on_evidence_examined(evidence_id, house_id)


func enter_house_for_testing(house_id: String) -> void:
	_enter_house(house_id)


func reach_hole_for_testing() -> void:
	_reach_hole()


func fire_field_call_for_testing() -> Dictionary:
	if _field_call_queue.is_empty():
		return {}
	return _field_call_queue.pop_front()


func get_field_call_queue_size() -> int:
	return _field_call_queue.size()


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_current_house = ""
	_houses_visited.clear()
	_correct_index = 0
	_wrong_houses_entered.clear()
	_evidence_examined.clear()
	_evidence_count = 0
	_grief_active = false
	_saved_tapes.clear()
	_hole_timer = 0.0
	_hole_reached_fired = false
	_hole_voice_started = false
	_kitchen_radio_playing = false
	_field_call_queue.clear()
	_field_call_timer = 0.0
	if _cello_player:
		_cello_player.stop()
		_cello_player.volume_db = -80.0
	if _weather_player:
		_weather_player.stop()
	if _kitchen_radio_player:
		_kitchen_radio_player.stop()
	if _hole_voice_player:
		_hole_voice_player.stop()
	var dc := _get_dread_composure()
	if dc and dc.has_method("reset"):
		dc.reset()
	_restore_world()
	if _signal_strength:
		_signal_strength.reset_signal()
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var save_mgr := _autoload("SaveManager")
	if save_mgr and save_mgr.has_method("delete_save"):
		save_mgr.delete_save(SHED_SAVE_TAPE_ID)


## --- Collector's Tape puzzle (DEA-126) ---

func _on_collectors_tape_dug(tape_id: String) -> void:
	collectors_tape_collected.emit(tape_id)


func get_collectors_puzzle() -> CollectorsTapePuzzle:
	return _collectors_puzzle


func _restore_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for idx in _baseline_bus_volumes:
		abm.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
