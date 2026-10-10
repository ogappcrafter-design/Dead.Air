class_name BunkerSegment
extends Node3D

## Location 4: "The Bunker" — fourth location of Phase 3 (DEA-124).
##
## Institutional horror, 20-30 min. Underground 1950s bunker: concrete,
## fluorescent hum (wrong pitch), water dripping, strong room tone.
## RE-style fixed cameras from doorways and corners.
##
## Rooms: entrance corridor, offices (save room — cassette in the desk
## drawer), storage, the central chamber with old radio equipment and the
## numbers-station tape loop, the vault, and the elevator.
##
## Radio: CLASSIFIED band strongest. HISTORICAL band first appears here
## (unlocked on entry).
##
## Numbers Station puzzle:
##   - The central chamber tape loop broadcasts "2-2-1-0-2" repeatedly.
##   - The vault keypad accepts the code 2-2-1-0-2.
##   - Wrong code 3 times -> alarm; all Suits redirect to investigate;
##     alarm resets after 60 s.
##   - The vault holds Tape #15 (The Original Broadcast), a signal-boost
##     radio upgrade, and the map to The Origin Site.
##
## The Suits: 2 patrol the corridors on fixed routes (DEA-125 entity).
## Hiding and timing apply.
##
## Elevator: dead until the vault is opened (power restored). Even then it
## needs the key from The Liminal Space (return trip, future ticket).
## Activating it with the key begins Phase 4.
##
## Save room: the office desk drawer cassette.

signal segment_started
signal historical_unlocked
signal numbers_heard
signal vault_opened
signal alarm_triggered
signal alarm_reset
signal suit_spawned(count: int)
signal player_detected_by_suit
signal elevator_powered
signal office_saved
signal elevator_activated
signal segment_completed

enum Phase {
	IDLE,
	EXPLORE,      # explore the bunker, find the numbers
	ALARM,        # wrong code x3; Suits investigate
	VAULT_OPEN,   # vault opened; elevator powered
	COMPLETED,    # elevator activated
}

## --- Codes and puzzle ---
const VAULT_CODE := "22102"
const MAX_WRONG_ATTEMPTS := 3
const ALARM_DURATION := 60.0

## --- Radio bands ---
const CLASSIFIED_BAND_ID := 3
const HISTORICAL_BAND_ID := 7
const SIGNAL_CLASSIFIED := 75.0
const SIGNAL_OTHER := 20.0

## --- Suits ---
const SUIT_COUNT := 2

## --- Save ---
const OFFICE_SAVE_TAPE := "bunker_office_1"

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _suits: Array[Suit] = []
var _vault_door: Node3D
var _elevator: Node3D
var _alarm_light: OmniLight3D

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _wrong_attempts := 0
var _alarm_timer := 0.0
var _vault_open := false
var _elevator_powered := false
var _saved_here := false
var _numbers_heard_flag := false
var _baseline_bus_volumes := {}

## Field calls (DEA-127): CLASSIFIED flavour, military/numbers-station.
const FIELD_CALL_INTERVAL := 55.0
var field_calls: FieldCalls = null

## Numbers-station tape loop audio: digits as paired tones.
var _numbers_player: AudioStreamPlayer
var _numbers_phase := 0.0
var _numbers_stream: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0
const DIGIT_PATTERN := [2, 2, 1, 0, 2]
const DIGIT_TONE_BASE := 440.0   # Hz per digit: 440 + digit * 110
const DIGIT_DURATION := 0.6
const LOOP_GAP := 2.0
var _loop_time := 0.0

## Fluorescent hum (wrong pitch — slightly sharp).
var _hum_player: AudioStreamPlayer
var _hum_phase := 0.0
var _hum_stream: AudioStreamGeneratorPlayback
const HUM_HZ := 61.0            # wrong: should be 60
const DRIP_INTERVAL := 3.7
var _drip_timer := 0.0


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = _find_camera()
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_vault_door = get_node_or_null("Vault/Door")
	_elevator = get_node_or_null("Elevator")
	_alarm_light = get_node_or_null("AlarmLight") as OmniLight3D
	_setup_audio()
	_place_player()
	_setup_camera()
	_silence_world()
	_setup_radio()
	_spawn_suits()
	var fx := StaticTransition.new()
	fx.name = "StaticCut"
	add_child(fx)
	fx.play(0.75)
	start_segment()


func _find_camera() -> Camera3D:
	var rig := get_node_or_null("CameraRig") as Camera3D
	if rig:
		rig.current = true
	return rig


func _place_player() -> void:
	if _player:
		_player.global_position = Vector3(0, 0.5, 8)
		_face_player(Vector3(0, 0, -1))


func _setup_camera() -> void:
	if _camera_rig:
		# Entrance camera: from inside, looking back down the corridor.
		_camera_rig.look_at_from_position(Vector3(0, 2.5, 12), Vector3(0, 1, 4), Vector3.UP)
		_camera_rig.fov = 60.0


func _setup_audio() -> void:
	_numbers_player = AudioStreamPlayer.new()
	_numbers_player.name = "NumbersLoop"
	_numbers_player.stream = _make_generator()
	_numbers_player.bus = "Master"
	_numbers_player.volume_db = -12.0
	add_child(_numbers_player)

	_hum_player = AudioStreamPlayer.new()
	_hum_player.name = "FluorescentHum"
	_hum_player.stream = _make_generator()
	_hum_player.bus = "Master"
	_hum_player.volume_db = -24.0
	add_child(_hum_player)


func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


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
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"SILENCE",
	&"UI",
	&"TAPE",
]
# Note: ROOM_TONE is NOT muted here — the bunker has strong room tone.


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		_radio_tuner.set_band(CLASSIFIED_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		_signal_strength.set_signal(SIGNAL_CLASSIFIED)
	# HISTORICAL first appears here.
	var bc := _autoload("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(HISTORICAL_BAND_ID)
		historical_unlocked.emit()


func _spawn_suits() -> void:
	var waypoints := [
		[Vector3(-6, 0.5, 0), Vector3(6, 0.5, 0)],
		[Vector3(-6, 0.5, -6), Vector3(6, 0.5, -6)],
	]
	for i in range(SUIT_COUNT):
		var suit := Suit.new()
		suit.name = "Suit%d" % i
		add_child(suit)
		var path: Array = waypoints[i % waypoints.size()]
		suit.global_position = path[0]
		suit.visible = true
		suit.set_physics_process(false)
		_suits.append(suit)
	suit_spawned.emit(SUIT_COUNT)


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.EXPLORE
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	_setup_field_calls()
	segment_started.emit()


## Wire the CLASSIFIED field-call schedule into the unified system.
func _setup_field_calls() -> void:
	if field_calls:
		return
	field_calls = FieldCalls.new()
	field_calls.name = "FieldCalls"
	add_child(field_calls)
	var dc: Node = null
	var cm := get_node_or_null("/root/CallManager")
	if cm and cm.has_method("get_dread_composure"):
		dc = cm.get_dread_composure()
	field_calls.setup(build_classified_field_schedule(), FIELD_CALL_INTERVAL,
		_signal_strength, dc)
	field_calls.start()


## Pure: the CLASSIFIED schedule — military comms, Cold War, numbers stations.
static func build_classified_field_schedule() -> Array:
	return [
		{"id": -1, "band": CLASSIFIED_BAND_ID, "callerName": "COLDWATER",
			"callerId": "MIL-SAT 7", "type": "JUST_LISTEN",
			"lines": ["\"Static check. Confirm reception.\"",
				"\"...sixteen. forty-one. eleven. repeat: eleven.\"",
				"\"Do not acknowledge. This channel never existed.\""]},
		{"id": -1, "band": CLASSIFIED_BAND_ID, "callerName": "NIGHTWATCH",
			"callerId": "GROUNDNET", "type": "JUST_LISTEN",
			"lines": ["\"All stations: winter protocol in effect.\"",
				"\"Previous occupants are accounted for. Most of them.\"",
				"\"Keep the door shut. Whatever knocks, keep it shut.\""]},
		{"id": -1, "band": CLASSIFIED_BAND_ID, "callerName": "— — —",
			"callerId": "0.0-0.0", "type": "JUST_LISTEN",
			"lines": ["\"Nine. Seven. Two. Nine. Seven. Two.\"",
				"\"The count has not changed since 1962.\"",
				"\"...someone has to keep counting.\""]},
	]


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	match _phase:
		Phase.EXPLORE:
			_process_explore(delta)
		Phase.ALARM:
			_process_alarm(delta)
		Phase.VAULT_OPEN:
			_process_vault_open(delta)
	_update_numbers_loop(delta)
	_update_hum(delta)
	_update_alarm_light()


func _process_explore(delta: float) -> void:
	if _signal_strength:
		_signal_strength.set_signal(SIGNAL_CLASSIFIED)
	# Office save.
	_check_office_save()
	# Numbers heard when near the central chamber tape machine.
	if not _numbers_heard_flag and _player:
		var machine := get_node_or_null("CentralChamber/TapeMachine")
		if machine and _player.global_position.distance_to((machine as Node3D).global_position) <= 5.0:
			_numbers_heard_flag = true
			numbers_heard.emit()


func _process_alarm(delta: float) -> void:
	if _signal_strength:
		_signal_strength.set_signal(SIGNAL_CLASSIFIED)
	_alarm_timer += delta
	if _alarm_timer >= ALARM_DURATION:
		_alarm_timer = 0.0
		_phase = Phase.EXPLORE
		alarm_reset.emit()
	_check_office_save()


func _process_vault_open(delta: float) -> void:
	if _signal_strength:
		_signal_strength.set_signal(SIGNAL_CLASSIFIED)
	_check_office_save()


## --- Vault keypad ---

## Returns "ok", "wrong", or "alarm".
func submit_vault_code(code: String) -> String:
	if _vault_open:
		return "ok"
	if code == VAULT_CODE:
		_open_vault()
		return "ok"
	_wrong_attempts += 1
	if _wrong_attempts >= MAX_WRONG_ATTEMPTS:
		_trigger_alarm()
		return "alarm"
	return "wrong"


func _open_vault() -> void:
	_vault_open = true
	_elevator_powered = true
	_wrong_attempts = 0
	if _vault_door:
		(_vault_door as Node3D).visible = false
	vault_opened.emit()
	elevator_powered.emit()


func _trigger_alarm() -> void:
	_phase = Phase.ALARM
	alarm_triggered.emit()


func is_alarm_active() -> bool:
	return _phase == Phase.ALARM


## --- Office save ---

func _check_office_save() -> void:
	if _saved_here or _player == null:
		return
	var desk := get_node_or_null("Office/Desk")
	if desk and _player.global_position.distance_to((desk as Node3D).global_position) <= 3.0:
		_do_save()


func _do_save() -> void:
	var save_mgr := _autoload("SaveManager")
	var tape_inv := _autoload("TapeInventory")
	if save_mgr == null or tape_inv == null:
		return
	if save_mgr.is_tape_used(OFFICE_SAVE_TAPE):
		_saved_here = true
		office_saved.emit()
		return
	var data := SaveData.new()
	data.phase = 3
	if _player:
		data.position_x = _player.global_position.x
		data.position_y = _player.global_position.y
		data.position_z = _player.global_position.z
	var ok: bool = save_mgr.save_game(OFFICE_SAVE_TAPE, data)
	if ok:
		_saved_here = true
		tape_inv.collect_tape(OFFICE_SAVE_TAPE)
		office_saved.emit()


## --- Elevator ---

## Activating the elevator requires vault power + the key (Phase 4 handoff).
func activate_elevator(has_key: bool) -> bool:
	if not _elevator_powered or not has_key:
		return false
	_phase = Phase.COMPLETED
	elevator_activated.emit()
	segment_completed.emit()
	return true


## --- Audio: numbers loop + fluorescent hum ---

func _update_numbers_loop(delta: float) -> void:
	if _numbers_player == null:
		return
	if _numbers_stream == null:
		_numbers_player.play()
		_numbers_stream = _numbers_player.get_stream_playback()
	_fill_numbers_buffer()


func _fill_numbers_buffer() -> void:
	if _numbers_stream == null:
		return
	var frames := _numbers_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_loop_time += 1.0 / AUDIO_SR
		var cycle := LOOP_GAP + DIGIT_DURATION * DIGIT_PATTERN.size()
		var t := fmod(_loop_time, cycle)
		var s := 0.0
		if t < DIGIT_DURATION * DIGIT_PATTERN.size():
			var digit_index := int(t / DIGIT_DURATION)
			var digit: int = DIGIT_PATTERN[digit_index]
			var in_digit := fmod(t, DIGIT_DURATION)
			if in_digit < DIGIT_DURATION * 0.8:
				var freq := DIGIT_TONE_BASE + digit * 110.0
				_numbers_phase += freq * TAU / AUDIO_SR
				s = sin(_numbers_phase) * 0.2
		buf[i] = Vector2(s, s)
	_numbers_stream.push_buffer(buf)


func _update_hum(delta: float) -> void:
	if _hum_player == null:
		return
	if _hum_stream == null:
		_hum_player.play()
		_hum_stream = _hum_player.get_stream_playback()
	_fill_hum_buffer(delta)


func _fill_hum_buffer(delta: float) -> void:
	if _hum_stream == null:
		return
	var frames := _hum_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	_drip_timer += delta
	var drip := 0.0
	if _drip_timer >= DRIP_INTERVAL:
		_drip_timer = 0.0
		drip = 0.3
	for i in range(frames):
		_hum_phase += HUM_HZ * TAU / AUDIO_SR
		var s := sin(_hum_phase) * 0.15 + sin(_hum_phase * 2.0) * 0.05
		if drip > 0.0 and i < 200:
			s += drip * sin(_hum_phase * 8.0)
		buf[i] = Vector2(s, s)
	_hum_stream.push_buffer(buf)


func _update_alarm_light() -> void:
	if _alarm_light:
		if _phase == Phase.ALARM:
			var blink := 1.0 if fmod(Time.get_ticks_msec() / 1000.0, 0.6) < 0.3 else 0.0
			_alarm_light.light_energy = blink * 3.0
		else:
			_alarm_light.light_energy = 0.0


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
		Phase.EXPLORE: return "EXPLORE"
		Phase.ALARM: return "ALARM"
		Phase.VAULT_OPEN: return "VAULT_OPEN"
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


func is_historical_unlocked() -> bool:
	var bc := _autoload("BandController")
	if bc == null:
		return false
	return bc.is_band_unlocked(HISTORICAL_BAND_ID)


func get_suit_count() -> int:
	return _suits.size()


func get_wrong_attempts() -> int:
	return _wrong_attempts


func is_vault_open() -> bool:
	return _vault_open


func is_elevator_powered() -> bool:
	return _elevator_powered


func is_numbers_heard() -> bool:
	return _numbers_heard_flag


func has_saved() -> bool:
	return _saved_here


func place_player_at_desk_for_testing() -> void:
	var desk := get_node_or_null("Office/Desk")
	if desk and _player:
		_player.global_position = (desk as Node3D).global_position


func place_player_at_machine_for_testing() -> void:
	var machine := get_node_or_null("CentralChamber/TapeMachine")
	if machine and _player:
		_player.global_position = (machine as Node3D).global_position


func reset_for_alarm_testing() -> void:
	_alarm_timer = ALARM_DURATION - 0.1


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_wrong_attempts = 0
	_alarm_timer = 0.0
	_vault_open = false
	_elevator_powered = false
	_saved_here = false
	_numbers_heard_flag = false
	_loop_time = 0.0
	if _vault_door:
		_vault_door.visible = true
	if _numbers_player:
		_numbers_player.stop()
		_numbers_stream = null
	if _hum_player:
		_hum_player.stop()
		_hum_stream = null
	var save_mgr := _autoload("SaveManager")
	if save_mgr and save_mgr.has_method("delete_save"):
		save_mgr.delete_save(OFFICE_SAVE_TAPE)
	var bc := _autoload("BandController")
	if bc and bc.has_method("lock_all_bands"):
		bc.lock_all_bands()
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
