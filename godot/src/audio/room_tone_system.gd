extends Node

## RoomToneSystem — location-specific ambient room tone audio (DEA-135).
## Generates procedural room tones for Booth, Hallway, and Bathroom.
## Crossfades on room transitions via CameraManager.camera_transition_started.
## Ducks under CALL_AUDIO via AudioBusManager bus-level ducking.
## All audio routed to ROOM_TONE bus (has Reverb effect for spatial ambience).
## Reference: GDD §Audio Architecture, DEA-134 bus layout.

# ─── Constants ─────────────────────────────────────────────────────────

const ROOM_TONE_BUS: StringName = &"ROOM_TONE"
const MIX_RATE := 44100.0
const BUFFER_LENGTH := 1.0

# Crossfade
const CROSSFADE_DURATION := 1.5  # seconds
const SILENT_DB := -80.0
const ACTIVE_DB := 0.0

# Room IDs — internal identifiers for each room tone
const ROOM_BOOTH := "booth"
const ROOM_HALLWAY := "hallway"
const ROOM_BATHROOM := "bathroom"

# Mapping from camera_angle.angle_id (scene files) to internal room IDs.
# Booth has two camera angles (BT1, BT2) that share the same room tone.
const _ANGLE_TO_ROOM: Dictionary = {
	"BT1": ROOM_BOOTH,
	"BT2": ROOM_BOOTH,
	"H1": ROOM_HALLWAY,
	"BR1": ROOM_BATHROOM,
}

# Known rooms for validation
const KNOWN_ROOMS: Array[String] = [ROOM_BOOTH, ROOM_HALLWAY, ROOM_BATHROOM]

# ─── State ─────────────────────────────────────────────────────────────

var _players: Dictionary = {}  # room_id → AudioStreamPlayer
var _playbacks: Dictionary = {}  # room_id → AudioStreamGeneratorPlayback
var _current_room: String = ""
var _fade_tween: Tween

# Per-room synthesis state (phase accumulators, filter states, timers)
var _synth_state: Dictionary = {}  # room_id → Dictionary

# ─── Lifecycle ─────────────────────────────────────────────────────────


func _ready() -> void:
	_setup_room(ROOM_BOOTH)
	_setup_room(ROOM_HALLWAY)
	_setup_room(ROOM_BATHROOM)
	_connect_camera_manager()


# ─── Audio Setup ───────────────────────────────────────────────────────


func _setup_room(room_id: String) -> void:
	var player := AudioStreamPlayer.new()
	player.name = "RoomTone_" + room_id
	player.bus = ROOM_TONE_BUS

	var stream := AudioStreamGenerator.new()
	stream.mix_rate = MIX_RATE
	stream.buffer_length = BUFFER_LENGTH
	player.stream = stream

	add_child(player)
	player.volume_db = SILENT_DB
	player.play()

	_players[room_id] = player
	_playbacks[room_id] = player.get_stream_playback()
	_init_synth_state(room_id)


func _init_synth_state(room_id: String) -> void:
	_synth_state[room_id] = {
		"hum_phase": 0.0,  # 60 Hz sine phase
		"buzz_phase": 0.0,  # 120 Hz sawtooth phase
		"rumble_phase": 0.0,  # low freq sine phase
		"fan_phase": 0.0,  # ventilation fan sine phase
		"lp_val": 0.0,  # one-pole lowpass filter state
		"drip_timer": 0.0,  # time since last drip trigger
		"drip_interval": 2.5,  # seconds between drips
		"drip_elapsed": 0.0,  # time since current drip started
		"drip_active": false,
		"pipe_timer": 0.0,  # time since last pipe clink
		"pipe_interval": 5.0,  # seconds between pipe sounds
		"pipe_elapsed": 0.0,  # time since current pipe started
		"pipe_active": false,
		"pipe_freq": 0.0,  # randomised clink frequency
	}


# ─── Camera Integration ────────────────────────────────────────────────


## Map a camera angle_id (from scene files) to an internal room ID.
## Returns "" for unknown angles so callers can skip the transition.
func _angle_to_room(angle_id: String) -> String:
	return _ANGLE_TO_ROOM.get(angle_id, "")


func _connect_camera_manager() -> void:
	var cam := get_tree().root.get_node_or_null("/root/CameraManager")
	if cam == null:
		push_warning("RoomToneSystem: CameraManager not found, room tones inactive")
		return
	if cam.has_signal("camera_transition_started"):
		cam.camera_transition_started.connect(_on_camera_transition_started)
		# Set initial room from current camera angle
		_current_room = _angle_to_room(cam.get_active_angle_id())
		_set_room_immediate(_current_room)
	else:
		push_warning("RoomToneSystem: CameraManager missing camera_transition_started signal")


func _on_camera_transition_started(new_id: String, _old_id: String) -> void:
	_crossfade_to(_angle_to_room(new_id))


# ─── Room Switching ────────────────────────────────────────────────────


func _set_room_immediate(room_id: String) -> void:
	for room in _players:
		_players[room].volume_db = SILENT_DB
	if _players.has(room_id):
		_players[room_id].volume_db = ACTIVE_DB
	_current_room = room_id


func _crossfade_to(new_room: String) -> void:
	if new_room == _current_room:
		return

	if _fade_tween and _fade_tween.is_valid():
		_fade_tween.kill()

	_fade_tween = create_tween()
	_fade_tween.set_parallel(true)

	# Fade out old room
	if _current_room != "" and _players.has(_current_room):
		_fade_tween.tween_property(
			_players[_current_room], "volume_db", SILENT_DB, CROSSFADE_DURATION
		)

	# Fade in new room
	if _players.has(new_room):
		_fade_tween.tween_property(_players[new_room], "volume_db", ACTIVE_DB, CROSSFADE_DURATION)

	_current_room = new_room


# ─── Public API ────────────────────────────────────────────────────────


## Crossfade to a room manually (e.g. from GameDirector or tests).
func transition_to(room_id: String) -> void:
	_crossfade_to(room_id)


## Set room immediately without crossfade (for testing or instant cuts).
func set_room(room_id: String) -> void:
	_set_room_immediate(room_id)


## Set room tone volume via AudioBusManager (accessibility volume control).
func set_volume(volume_db: float) -> void:
	var abm := get_tree().root.get_node_or_null("/root/AudioBusManager")
	if abm:
		abm.set_bus_volume(abm.IDX_ROOM_TONE, volume_db)


## Get the currently active room ID.
func get_current_room() -> String:
	return _current_room


# ─── Audio Generation ─────────────────────────────────────────────────


func _process(delta: float) -> void:
	# Fill all room buffers every frame — even silent rooms need data
	# so they're ready when crossfading in.
	for room_id in _playbacks:
		_fill_buffer(room_id, delta)


func _fill_buffer(room_id: String, delta: float) -> void:
	var playback := _playbacks[room_id] as AudioStreamGeneratorPlayback
	if playback == null:
		return
	var frames := playback.get_frames_available()
	if frames <= 0:
		return
	# Godot 4.7: AudioStreamGeneratorPlayback has no get_buffer().
	# Create a local buffer, fill it, then push_buffer().
	var buf := PackedVector2Array()
	buf.resize(frames)

	match room_id:
		ROOM_BOOTH:
			_fill_booth(buf, frames)
		ROOM_HALLWAY:
			_fill_hallway(buf, frames, delta)
		ROOM_BATHROOM:
			_fill_bathroom(buf, frames, delta)
		_:
			for i in range(frames):
				buf[i] = Vector2.ZERO

	playback.push_buffer(buf)


# ─── Booth: equipment hum + electrical buzz + AC rumble ────────────────


func _fill_booth(buf: PackedVector2Array, frames: int) -> void:
	var s: Dictionary = _synth_state[ROOM_BOOTH]
	for i in range(frames):
		# Equipment hum (60 Hz sine)
		var hum := sin(s.hum_phase) * 0.15
		s.hum_phase += TAU * 60.0 / MIX_RATE
		if s.hum_phase >= TAU:
			s.hum_phase -= TAU

		# Electrical buzz (120 Hz sawtooth)
		var buzz := _sawtooth(s.buzz_phase) * 0.06
		s.buzz_phase += TAU * 120.0 / MIX_RATE
		if s.buzz_phase >= TAU:
			s.buzz_phase -= TAU

		# AC rumble (one-pole lowpass filtered white noise)
		var raw_noise := randf_range(-1.0, 1.0) * 0.3
		s.lp_val = s.lp_val * 0.97 + raw_noise * 0.03
		var ac: float = s.lp_val * 0.5

		var sample := clampf(hum + buzz + ac, -1.0, 1.0)
		buf[i] = Vector2(sample, sample)


# ─── Hallway: fluorescent hum + distant pipes + corridor ambience ─────


func _fill_hallway(buf: PackedVector2Array, frames: int, delta: float) -> void:
	var s: Dictionary = _synth_state[ROOM_HALLWAY]

	# Trigger pipe clink (per-frame check using process delta)
	s.pipe_timer += delta
	if not s.pipe_active and s.pipe_timer >= s.pipe_interval:
		s.pipe_active = true
		s.pipe_elapsed = 0.0
		s.pipe_timer = 0.0
		s.pipe_interval = randf_range(4.0, 9.0)
		s.pipe_freq = randf_range(300.0, 600.0)

	for i in range(frames):
		# Fluorescent hum (60 Hz sine, quiet)
		var hum := sin(s.hum_phase) * 0.05
		s.hum_phase += TAU * 60.0 / MIX_RATE
		if s.hum_phase >= TAU:
			s.hum_phase -= TAU

		# Corridor ambience (lowpass-filtered noise)
		var raw_noise := randf_range(-1.0, 1.0) * 0.1
		s.lp_val = s.lp_val * 0.95 + raw_noise * 0.05
		var ambience: float = s.lp_val * 0.3

		# Distant pipe clink (decaying sine, randomly triggered)
		var pipe := 0.0
		if s.pipe_active:
			s.pipe_elapsed += 1.0 / MIX_RATE
			if s.pipe_elapsed > 0.3:
				s.pipe_active = false
			else:
				var env := exp(-s.pipe_elapsed * 15.0)
				pipe = sin(s.pipe_elapsed * TAU * s.pipe_freq) * env * 0.1

		var sample := clampf(hum + ambience + pipe, -1.0, 1.0)
		buf[i] = Vector2(sample, sample)


# ─── Bathroom: ventilation fan + dripping water + tiled ambience ──────


func _fill_bathroom(buf: PackedVector2Array, frames: int, delta: float) -> void:
	var s: Dictionary = _synth_state[ROOM_BATHROOM]

	# Trigger drip (per-frame check using process delta)
	s.drip_timer += delta
	if not s.drip_active and s.drip_timer >= s.drip_interval:
		s.drip_active = true
		s.drip_elapsed = 0.0
		s.drip_timer = 0.0
		s.drip_interval = randf_range(1.8, 3.5)

	for i in range(frames):
		# Ventilation fan (40 Hz sine + lowpass noise)
		var fan_tone := sin(s.fan_phase) * 0.04
		s.fan_phase += TAU * 40.0 / MIX_RATE
		if s.fan_phase >= TAU:
			s.fan_phase -= TAU

		var raw_noise := randf_range(-1.0, 1.0) * 0.15
		s.lp_val = s.lp_val * 0.96 + raw_noise * 0.04
		var fan_noise: float = s.lp_val * 0.3

		# Dripping water (decaying sine ~800 Hz, periodically triggered)
		var drip := 0.0
		if s.drip_active:
			s.drip_elapsed += 1.0 / MIX_RATE
			if s.drip_elapsed > 0.15:
				s.drip_active = false
			else:
				var env := exp(-s.drip_elapsed * 25.0)
				drip = sin(s.drip_elapsed * TAU * 800.0) * env * 0.15

		# Tiled ambience (low-level noise — reverb from bus adds spatial character)
		var tile := randf_range(-1.0, 1.0) * 0.02

		var sample := clampf(fan_tone + fan_noise + drip + tile, -1.0, 1.0)
		buf[i] = Vector2(sample, sample)


# ─── Helpers ──────────────────────────────────────────────────────────


## Normalised sawtooth: phase 0→TAU maps to -1→1.
static func _sawtooth(phase: float) -> float:
	return (phase / TAU) * 2.0 - 1.0
