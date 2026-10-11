class_name HighwaySegment
extends Node3D

## Location 2: "The Highway" — second location of Phase 3 (DEA-122).
##
## Liminal horror, 10-15 min. A single road that doesn't end. Fog.
## Streetlights at wrong intervals — some 10m apart, some 500m. Fixed
## cameras: long shots down the road; the player walks toward the camera,
## which snaps to the next position (StaticTransition between shots).
##
## Radio: WEATHER band strongest. Highway calls = road conditions and
## travel advisories — for roads that don't exist. The dirt road is only
## named in the third advisory.
##
## Liminal mechanics:
##   - Road loops: after LOOP_DISTANCE meters of walking, the player is
##     teleported back to the start. They don't realize until they pass
##     the same sign. The sign's text degrades each loop.
##   - Navigation: WEATHER advisories (radio) + LIMINAL gradient. When the
##     player is tuned to LIMINAL, the signal points toward the side road.
##     The dirt road only becomes visible while tuned to LIMINAL (and
##     only after advisory 3 has played). Walking to it exits the highway.
##
## Audio: car engine sound that never gets closer; wind through open
## windows; distant radio tower lights blinking (visual + faint pulse).
##
## No save room.
##
## Source: Linear DEA-122 (GDD has no Highway section; Linear description
## is authoritative).

signal segment_started
signal loop_completed(loop_number: int)
signal advisory_played(index: int, text: String)
signal dirt_road_visible
signal dirt_road_entered
signal segment_completed

enum Phase {
	IDLE,
	DRIVE,       # walking the endless road, loops accumulating
	FOUND_ROAD,  # dirt road found; walking to it
	COMPLETED,
}

## --- Road layout ---
## Road runs along +X. Player walks east. Loop teleports back to start.
const ROAD_START_X := 0.0
const LOOP_DISTANCE := 120.0
const SIGN_X := 15.0

## Streetlights at wrong intervals (GDD: 10m apart, some 500m).
const LIGHT_INTERVALS := [8.0, 45.0, 12.0, 90.0, 300.0, 15.0, 200.0, 30.0, 60.0, 110.0]

## --- Bands ---
const WEATHER_BAND_ID := 5
const LIMINAL_BAND_ID := 1

## Signal levels: WEATHER strongest on the highway.
const SIGNAL_WEATHER := 75.0
const SIGNAL_OTHER := 20.0
## LIMINAL gradient: signal rises as the player faces the side road.
const SIGNAL_LIMINAL_ALIGNED := 80.0
const SIGNAL_LIMINAL_ALIGNED_DIRTY := 40.0

## Dirt road visibility: needs advisory 3 played + LIMINAL tuned.
const DIRT_ROAD_ADVISORY_INDEX := 2

## Dirt road position: off the south side, reached around x=60.
const DIRT_ROAD_X := 60.0
const DIRT_ROAD_Z := 7.0
const DIRT_ROAD_ENTER_RADIUS := 4.0

## --- Advisories (WEATHER band, roads that don't exist) ---
const ADVISORIES: Array[String] = [
	"Road conditions: Route 9 closed between mile 12 and mile 40. No detour available. The road was never built.",
	"Travel advisory: County Road 6 has disappeared. If you are on County Road 6, you are not on County Road 6.",
	"Travel advisory: Unmarked dirt road, eastbound, past the water tower. Not on any map. If you find it, that's the way.",
]

## --- Node refs ---
var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _sign_label: Label3D
var _dirt_road: Node3D
var _engine_player: AudioStreamPlayer
var _wind_player: AudioStreamPlayer
var _advisory_player: AudioStreamPlayer
var _tower_pulse_light: OmniLight3D

## --- State ---
var _started := false
var _phase: int = Phase.IDLE
var _loop_distance_walked := 0.0
var _loop_number := 0
var _player_last_x := 0.0
var _advisory_index := -1
var _advisory_timer := 0.0
const ADVISORY_INTERVAL := 25.0
var _dirt_road_shown := false
var _completed_fired := false
var _baseline_bus_volumes := {}

## Audio synthesis
const AUDIO_SR := 44100.0
const ENGINE_HZ := 55.0
const WIND_HZ := 420.0
var _engine_phase := 0.0
var _wind_phase := 0.0
var _advisory_phase := 0.0
var _engine_stream_playback: AudioStreamGeneratorPlayback
var _wind_stream_playback: AudioStreamGeneratorPlayback
var _advisory_stream_playback: AudioStreamGeneratorPlayback

## Camera long-shot positions (walk toward camera, snap to next).
const CAMERA_POSITIONS: Array[Vector3] = [
	Vector3(30, 6, 12),
	Vector3(70, 6, 12),
	Vector3(110, 6, 12),
]
var _camera_index := 0

## Loop sign texts (degrade each loop).
const SIGN_TEXTS: Array[String] = [
	"WELCOME TO ROUTE 9",
	"WELCOM TO ROUTE 9",
	"W LCOME TO ROUTE 9",
	"WE CO E TO ROUTE 9",
	"W  COME TO RO TE 9",
	"W  C ME TO RO TE9",
]


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_sign_label = get_node_or_null("RouteSign/SignText") as Label3D
	_dirt_road = get_node_or_null("DirtRoad")
	_tower_pulse_light = get_node_or_null("RadioTower/TowerLight") as OmniLight3D
	_setup_audio()
	_place_player()
	_apply_camera_position(0)
	_silence_world()
	_setup_radio()

	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)
	start_segment()


func _place_player() -> void:
	if _player:
		_player.global_position = Vector3(ROAD_START_X, 0.5, 0)
		_face_player(Vector3(1, 0, 0))


func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(2)
		_radio_tuner.set_band(WEATHER_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)


func _setup_audio() -> void:
	# Car engine that never gets closer: constant volume, on Master.
	_engine_player = AudioStreamPlayer.new()
	_engine_player.name = "CarEngine"
	_engine_player.stream = _make_generator()
	_engine_player.bus = "Master"
	_engine_player.volume_db = -22.0
	add_child(_engine_player)

	# Wind through open windows.
	_wind_player = AudioStreamPlayer.new()
	_wind_player.name = "HighwayWind"
	_wind_player.stream = _make_generator()
	_wind_player.bus = "Master"
	_wind_player.volume_db = -20.0
	add_child(_wind_player)

	# Advisory voice on the WEATHER band.
	_advisory_player = AudioStreamPlayer.new()
	_advisory_player.name = "AdvisoryVoice"
	_advisory_player.stream = _make_generator()
	_advisory_player.bus = "Master"
	_advisory_player.volume_db = -14.0
	add_child(_advisory_player)


func _make_generator() -> AudioStreamGenerator:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = AUDIO_SR
	gen.buffer_length = 1.0
	return gen


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


func start_segment() -> void:
	if _started:
		return
	_started = true
	_phase = Phase.DRIVE
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	segment_started.emit()


## --- Main loop ---

func _process(delta: float) -> void:
	if not _started or _phase == Phase.IDLE or _phase == Phase.COMPLETED:
		return
	match _phase:
		Phase.DRIVE:
			_process_drive(delta)
		Phase.FOUND_ROAD:
			_process_found_road(delta)
	_update_engine_audio(delta)
	_update_wind_audio(delta)
	_update_advisory_audio(delta)
	_update_tower_pulse(delta)


func _process_drive(delta: float) -> void:
	# Signal: WEATHER strongest on the highway; other bands weak.
	_update_band_signal()
	# Track walking distance toward the loop.
	if _player:
		var dx: float = absf(_player.global_position.x - _player_last_x)
		_loop_distance_walked += dx
		_player_last_x = _player.global_position.x
		if _loop_distance_walked >= LOOP_DISTANCE:
			_loop_distance_walked = 0.0
			_do_loop()
	# Camera snap: when the player passes the next camera position, snap.
	_update_camera_snap()
	# Advisories play on a timer.
	_advisory_timer += delta
	if _advisory_timer >= ADVISORY_INTERVAL and _advisory_index < ADVISORIES.size() - 1:
		_advisory_timer = 0.0
		_play_next_advisory()
	# Dirt road becomes visible: advisory 3 played + LIMINAL tuned.
	_check_dirt_road_visibility()
	# Entering the dirt road ends the highway.
	_check_dirt_road_entry()


func _process_found_road(delta: float) -> void:
	_update_band_signal()
	_check_dirt_road_entry()


## Signal follows the tuned band.
func _update_band_signal() -> void:
	if _signal_strength == null:
		return
	var band_id: int = _radio_tuner.get("current_band_id") if _radio_tuner else 0
	if band_id == WEATHER_BAND_ID:
		_signal_strength.set_signal(SIGNAL_WEATHER)
	elif band_id == LIMINAL_BAND_ID:
		# LIMINAL gradient: aligned toward the side road = strong.
		_signal_strength.set_signal(_compute_liminal_signal())
	else:
		_signal_strength.set_signal(SIGNAL_OTHER)


func _compute_liminal_signal() -> float:
	var alignment := 0.0
	if _player:
		var target := Vector3(DIRT_ROAD_X, 0, DIRT_ROAD_Z)
		var to_target := target - _player.global_position
		to_target.y = 0.0
		if to_target.length() > 0.5:
			var facing := -_player.global_transform.basis.z
			facing.y = 0.0
			facing = facing.normalized() if facing.length() > 0.01 else to_target.normalized()
			var dot := facing.dot(to_target.normalized())
			var angle_deg := rad_to_deg(acos(clampf(dot, -1.0, 1.0)))
			# 0 deg -> aligned; 90 deg -> half; 180 deg -> dirty.
			alignment = 1.0 - clampf(angle_deg / 180.0, 0.0, 1.0)
	return lerpf(SIGNAL_LIMINAL_ALIGNED_DIRTY, SIGNAL_LIMINAL_ALIGNED, alignment)


## The road loops: teleport back, degrade the sign, count the loop.
func _do_loop() -> void:
	_loop_number += 1
	if _player:
		_player.global_position = Vector3(ROAD_START_X, 0.5, 0)
		_player_last_x = ROAD_START_X
	_update_sign_text()
	var static_fx := StaticTransition.new()
	static_fx.name = "LoopCut"
	add_child(static_fx)
	static_fx.play(0.6)
	loop_completed.emit(_loop_number)


func _update_sign_text() -> void:
	if _sign_label:
		var text_index: int = mini(_loop_number, SIGN_TEXTS.size() - 1)
		_sign_label.text = SIGN_TEXTS[text_index]


## Camera: long shot; snap to the next position as the player advances.
func _update_camera_snap() -> void:
	if _player == null or _camera_rig == null:
		return
	if _camera_index < CAMERA_POSITIONS.size() - 1:
		var next: Vector3 = CAMERA_POSITIONS[_camera_index + 1]
		if _player.global_position.x > next.x - 25.0:
			_camera_index += 1
			_apply_camera_position(_camera_index)


func _apply_camera_position(index: int) -> void:
	if _camera_rig == null or index >= CAMERA_POSITIONS.size():
		return
	var pos: Vector3 = CAMERA_POSITIONS[index]
	_camera_rig.look_at_from_position(pos, Vector3(pos.x - 30.0, 0.5, 0.0), Vector3.UP)
	_camera_rig.current = true


## --- Advisories ---

func _play_next_advisory() -> void:
	_advisory_index += 1
	if _advisory_index >= ADVISORIES.size():
		return
	advisory_played.emit(_advisory_index, ADVISORIES[_advisory_index])


func _check_dirt_road_visibility() -> void:
	if _dirt_road_shown:
		return
	if _advisory_index >= DIRT_ROAD_ADVISORY_INDEX and _is_liminal_tuned():
		_dirt_road_shown = true
		if _dirt_road:
			_dirt_road.visible = true
		dirt_road_visible.emit()


func _is_liminal_tuned() -> bool:
	if _radio_tuner == null:
		return false
	return _radio_tuner.get("current_band_id") == LIMINAL_BAND_ID


func _check_dirt_road_entry() -> void:
	if _phase == Phase.COMPLETED or _phase == Phase.FOUND_ROAD:
		if _phase == Phase.FOUND_ROAD:
			pass
	if _player == null:
		return
	var dist: float = Vector2(
		_player.global_position.x - DIRT_ROAD_X,
		_player.global_position.z - DIRT_ROAD_Z
	).length()
	if dist <= DIRT_ROAD_ENTER_RADIUS and _dirt_road_shown:
		if _phase != Phase.FOUND_ROAD:
			_phase = Phase.FOUND_ROAD
			dirt_road_entered.emit()
			return
		if dist <= DIRT_ROAD_ENTER_RADIUS * 0.5 and not _completed_fired:
			_completed_fired = true
			_enter_phase(Phase.COMPLETED)


func _enter_phase(p: int) -> void:
	_phase = p
	if p == Phase.COMPLETED:
		segment_completed.emit()


## --- Audio synthesis ---

func _update_engine_audio(delta: float) -> void:
	if _engine_player == null:
		return
	if _engine_stream_playback == null:
		_engine_player.play()
		_engine_stream_playback = _engine_player.get_stream_playback()
	_fill_engine_buffer(delta)


func _fill_engine_buffer(delta: float) -> void:
	if _engine_stream_playback == null:
		return
	var frames := _engine_stream_playback.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_engine_phase += ENGINE_HZ * TAU / AUDIO_SR
		# Low rumble with a slow off-kilter pulse (idle that won't settle).
		var s := sin(_engine_phase) * 0.4 + sin(_engine_phase * 0.53) * 0.2
		buf[i] = Vector2(s, s) * 0.5
	_engine_stream_playback.push_buffer(buf)


func _update_wind_audio(delta: float) -> void:
	if _wind_player == null:
		return
	if _wind_stream_playback == null:
		_wind_player.play()
		_wind_stream_playback = _wind_player.get_stream_playback()
	_fill_wind_buffer(delta)


func _fill_wind_buffer(delta: float) -> void:
	if _wind_stream_playback == null:
		return
	var frames := _wind_stream_playback.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_wind_phase += WIND_HZ * TAU / AUDIO_SR
		# Slightly flat wind (the GDD's wrong-pitch wind carries over).
		var s := sin(_wind_phase * 0.98) * 0.3 + sin(_wind_phase * 2.1) * 0.1
		buf[i] = Vector2(s, s) * 0.3
	_wind_stream_playback.push_buffer(buf)


func _update_advisory_audio(delta: float) -> void:
	if _advisory_index < 0:
		return
	if _advisory_stream_playback == null:
		_advisory_player.play()
		_advisory_stream_playback = _advisory_player.get_stream_playback()
	_fill_advisory_buffer(delta)


func _fill_advisory_buffer(delta: float) -> void:
	if _advisory_stream_playback == null:
		return
	var frames := _advisory_stream_playback.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		_advisory_phase += 160.0 * TAU / AUDIO_SR
		# Flat automated voice, gated per syllable-ish burst.
		var gate := 0.6 + 0.4 * sin(_advisory_phase * 0.8)
		var s := sin(_advisory_phase) * 0.2 * gate
		buf[i] = Vector2(s, s) * 0.5
	_advisory_stream_playback.push_buffer(buf)


func _update_tower_pulse(delta: float) -> void:
	if _tower_pulse_light:
		# Blinking radio tower light in the distance.
		var blink := 1.0 if fmod(Time.get_ticks_msec() / 1000.0, 2.0) < 0.1 else 0.0
		_tower_pulse_light.light_energy = blink * 2.0


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
		Phase.DRIVE: return "DRIVE"
		Phase.FOUND_ROAD: return "FOUND_ROAD"
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


func get_loop_number() -> int:
	return _loop_number


func get_sign_text() -> String:
	return _sign_label.text if _sign_label else ""


func get_advisory_index() -> int:
	return _advisory_index


func is_dirt_road_visible() -> bool:
	return _dirt_road_shown


func get_camera_index() -> int:
	return _camera_index


func walk_for_testing(distance: float) -> void:
	if _player == null:
		return
	_player_last_x = _player.global_position.x
	_player.global_position.x += distance
	var dx: float = absf(_player.global_position.x - _player_last_x)
	# Set directly to exercise the loop logic without ambiguity.
	_loop_distance_walked += dx


func play_advisories_for_testing(count: int) -> void:
	for i in range(count):
		_play_next_advisory()


func tune_for_testing(band_id: int) -> void:
	if _radio_tuner:
		_radio_tuner.set_band(band_id)


func _reset_for_testing() -> void:
	_phase = Phase.IDLE
	_started = false
	_loop_distance_walked = 0.0
	_loop_number = 0
	_player_last_x = 0.0
	_advisory_index = -1
	_advisory_timer = 0.0
	_dirt_road_shown = false
	_completed_fired = false
	_camera_index = 0
	_restore_world()
	if _dirt_road:
		_dirt_road.visible = false
	if _engine_player:
		_engine_player.stop()
		_engine_stream_playback = null
	if _wind_player:
		_wind_player.stop()
		_wind_stream_playback = null
	if _advisory_player:
		_advisory_player.stop()
		_advisory_stream_playback = null
	if _sign_label:
		_sign_label.text = SIGN_TEXTS[0]
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)


func _restore_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for idx in _baseline_bus_volumes:
		abm.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
