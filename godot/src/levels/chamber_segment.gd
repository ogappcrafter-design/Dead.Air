class_name ChamberSegment
extends Node3D

## Phase 4 Step 3: "The Chamber" (DEA-130) — the moral choice.
##
## At the bottom of the staircase: a circular chamber with earth walls.
## A central dais holds the original 1920s transmitter. The camera is a
## single fixed shot: dais centered, no movement, ever.
##
## Radio: ████████ only. Signal 100. No static. For the first time in the
## game, the radio is perfectly clear.
##
## The Origin Broadcast plays: a voice from 1923. The first voice ever
## transmitted. It tells the truth — the station was built to reach the
## dead. The radio is a bridge. The dead are not gone.
##
## Then the voice speaks to the player and offers the choice, presented
## as four radio frequencies (tune to select, per the Linear spec):
##   A (640) "I wanted to hear them."  → THE SIGNAL
##   B (770) "I can carry it."         → THE RELAY
##   C (880) "Stop."                   → DEAD AIR
##   D (990) "I heard you. I'm sorry." → THE WITNESS (hidden)
##
## Choice D is only offered when composure > 80 AND tapes collected >= 15.
##
## No enemies. No timer. Just the voice and the choice.

signal segment_started
signal broadcast_started
signal choice_offered(available: Array)
signal ending_chosen(ending_id: String)
signal segment_completed

enum Phase {
	IDLE,
	BROADCAST,    # the origin broadcast plays
	CHOICE,       # the four frequencies are offered
	ENDING,       # an ending was chosen; short coda
	COMPLETED,
}

## --- Ending frequencies (kHz on the dial) ---
const CHOICE_FREQUENCIES := {
	"A": 640.0,
	"B": 770.0,
	"C": 880.0,
	"D": 990.0,
}
const ENDING_IDS := {
	"A": "THE_SIGNAL",
	"B": "THE_RELAY",
	"C": "DEAD_AIR",
	"D": "THE_WITNESS",
}

## Choice D availability (GDD): composure > 80 and 15+ tapes.
const WITNESS_COMPOSURE_MIN := 80.0
const WITNESS_TAPES_MIN := 15

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _dais: Node3D

## --- State ---
var _phase: int = Phase.IDLE
var _started := false
var _broadcast_timer := 0.0
const BROADCAST_DURATION := 12.0
var _choice_offered_flag := false
var _chosen := ""
var _baseline_bus_volumes := {}

## Audio: the origin voice, perfectly clear; heartbeat underneath.
var _voice_player: AudioStreamPlayer
var _voice_phase := 0.0
var _voice_stream: AudioStreamGeneratorPlayback
var _heart_player: AudioStreamPlayer
var _heart_phase := 0.0
var _heart_stream: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0
const VOICE_HZ := 110.0
const HEART_BPM := 72.0


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_dais = get_node_or_null("Dais")
	_setup_audio()
	_place_player()
	_setup_camera()
	_silence_all_but_heart()
	_setup_radio()
	var fx := StaticTransition.new()
	fx.name = "StaticCut"
	add_child(fx)
	fx.play(0.75)
	start_segment()


func _setup_audio() -> void:
	# The origin voice: perfectly clear, no static, no filter.
	_voice_player = AudioStreamPlayer.new()
	_voice_player.name = "OriginVoice"
	_voice_player.stream = _make_generator()
	_voice_player.bus = "Master"
	_voice_player.volume_db = -10.0
	add_child(_voice_player)

	# The player's heartbeat: the only other sound.
	_heart_player = AudioStreamPlayer.new()
	_heart_player.name = "PlayerHeart"
	_heart_player.stream = _make_generator()
	_heart_player.bus = "Master"
	_heart_player.volume_db = -18.0
	add_child(_heart_player)


func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


func _place_player() -> void:
	if _player:
		# Enters from the right of the frame.
		_player.global_position = Vector3(6, -200.5, 4)
		_face_player(Vector3(-1, 0, -0.5))


func _setup_camera() -> void:
	if _camera_rig:
		# Single fixed shot: dais center, no movement.
		_camera_rig.look_at_from_position(Vector3(0, -197, 10), Vector3(0, -200, 0), Vector3.UP)
		_camera_rig.fov = 55.0
		_camera_rig.current = true


## Everything mutes except Master (voice + heartbeat live there).
func _silence_all_but_heart() -> void:
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
	&"RADIO_AMBIENT",
]


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		_radio_tuner.set_band(4)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		# Signal 100. No static. Perfectly clear, for the first time.
		_signal_strength.set_signal(100.0)
	var bc := _autoload("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(4)


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.BROADCAST
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	segment_started.emit()
	broadcast_started.emit()


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	match _phase:
		Phase.BROADCAST:
			_process_broadcast(delta)
		Phase.CHOICE:
			_process_choice(delta)
		Phase.ENDING:
			pass
	_update_voice_audio(delta)
	_update_heart_audio(delta)


## The broadcast plays; then the choice is offered.
func _process_broadcast(delta: float) -> void:
	_broadcast_timer += delta
	if _broadcast_timer >= BROADCAST_DURATION and not _choice_offered_flag:
		_offer_choice()


func _offer_choice() -> void:
	_choice_offered_flag = true
	_phase = Phase.CHOICE
	var available := _get_available_choices()
	choice_offered.emit(available)


## Choice D availability: composure > 80 AND tapes >= 15.
func _get_available_choices() -> Array:
	var available: Array = ["A", "B", "C"]
	var dc: Node = null
	var cm := _autoload("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		dc = cm.get_dread_composure()
	var composure := -1.0
	if dc and "composure" in dc:
		composure = dc.composure
	var tape_inv := _autoload("TapeInventory")
	var tapes := 0
	if tape_inv and tape_inv.has_method("get_collected_count"):
		tapes = tape_inv.get_collected_count()
	if composure > WITNESS_COMPOSURE_MIN and tapes >= WITNESS_TAPES_MIN:
		available.append("D")
	return available


## Tuning to a choice frequency selects that ending.
func _process_choice(delta: float) -> void:
	if _radio_tuner == null or _chosen != "":
		return
	var freq: float = _radio_tuner.get("current_frequency") if _radio_tuner.get("current_frequency") != null else 0.0
	for choice_id in CHOICE_FREQUENCIES:
		if absf(freq - CHOICE_FREQUENCIES[choice_id]) <= 1.0:
			choose_ending(choice_id)
			return


## Public: choose an ending directly (also used by tests).
func choose_ending(choice_id: String) -> void:
	if _chosen != "":
		return
	_chosen = choice_id
	_phase = Phase.ENDING
	ending_chosen.emit(choice_id)
	# Short coda, then complete (endings themselves are DEA-131).
	var timer := get_tree().create_timer(2.0)
	timer.timeout.connect(func() -> void:
		if _phase != Phase.COMPLETED:
			_enter_phase(Phase.COMPLETED)
	)


func get_chosen() -> String:
	return _chosen


func get_ending_id() -> String:
	return ENDING_IDS.get(_chosen, "")


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()
		# Hand off to the ending sequences with the chosen ending.
		var endings := EndingSequences.new()
		endings.name = "EndingSequences"
		endings.return_to_menu = true
		add_child(endings)
		if _chosen != "":
			endings.play_choice(_chosen)


## --- Audio synthesis ---

func _update_voice_audio(delta: float) -> void:
	if _voice_player == null:
		return
	if _voice_stream == null:
		_voice_player.play()
		_voice_stream = _voice_player.get_stream_playback()
	_fill_voice_buffer(delta)


func _fill_voice_buffer(delta: float) -> void:
	if _voice_stream == null:
		return
	var frames := _voice_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_voice_phase += VOICE_HZ * TAU / AUDIO_SR
		# 1923 voice: formal, clear, no static. Slow cadence swells.
		var swell := 0.7 + 0.3 * sin(_voice_phase * 0.012)
		var s := (sin(_voice_phase) * 0.5 + sin(_voice_phase * 2.0) * 0.2) * swell * 0.55
		buf[i] = Vector2(s, s)
	_voice_stream.push_buffer(buf)


func _update_heart_audio(delta: float) -> void:
	if _heart_player == null:
		return
	if _heart_stream == null:
		_heart_player.play()
		_heart_stream = _heart_player.get_stream_playback()
	_fill_heart_buffer(delta)


func _fill_heart_buffer(delta: float) -> void:
	if _heart_stream == null:
		return
	var frames := _heart_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	var beat_interval := 60.0 / HEART_BPM
	for i in range(frames):
		_heart_phase += 1.0 / AUDIO_SR
		var s := 0.0
		var beat_t: float = fmod(_heart_phase, beat_interval)
		if beat_t < 0.1:
			s = sin(beat_t * PI / 0.1) * 0.25
		buf[i] = Vector2(s, s)
	_heart_stream.push_buffer(buf)


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
		Phase.BROADCAST: return "BROADCAST"
		Phase.CHOICE: return "CHOICE"
		Phase.ENDING: return "ENDING"
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


func is_broadcast_playing() -> bool:
	return _phase == Phase.BROADCAST or _phase == Phase.CHOICE


func is_choice_offered() -> bool:
	return _choice_offered_flag


func force_choice_for_testing() -> void:
	_broadcast_timer = BROADCAST_DURATION
	_process_broadcast(0.016)


func skip_broadcast_for_testing() -> void:
	_offer_choice()


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_broadcast_timer = 0.0
	_choice_offered_flag = false
	_chosen = ""
	if _voice_player:
		_voice_player.stop()
		_voice_stream = null
	if _heart_player:
		_heart_player.stop()
		_heart_stream = null
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
