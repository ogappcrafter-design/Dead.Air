## DreadAudioLayer
## Audio layer that scales with the dread meter. Generates cello drone, heartbeat,
## whisper, and sub-bass rumble, routing all through the DREAD_LAYER bus.
## Reference: DEA-103, GDD §Audio Architecture (lines 1277-1310, 1293-1340)
##
## Integration:
##   - Connect to DreadComposure.dread_changed signal (call connect_to_dread_composure)
##   - AudioBusManager.set_dread_level() handles bus-level volume/lowpass (DEA-134)
##   - DreadAudioLayer handles component-level audio generation and volume
class_name DreadAudioLayer
extends Node

# ─── Location modifiers ─────────────────────────────────────────────
enum Location {
	NORMAL,  # No modifier
	BUNKER,  # +3 dB (institutional amplification)
	LIMINAL,  # +6 dB (no room tone to mask it)
	CHAMBER,  # Heartbeat-only (origin heartbeat)
}

# ─── Component frequency constants (Hz) ──────────────────────────────
const CELLO_DRONE_FREQ := 55.0  # Primary drone (C0-ish per GDD)
const SECONDARY_DRONE_FREQ := 82.0  # Dissonant secondary drone
const TERTIARY_DRONE_FREQ := 110.0  # Tertiary drone
const SUB_BASS_FREQ := 20.0  # Subsonic rumble
const BREAK_TONE_FREQ := 440.0  # Break sustained tone

# ─── Heartbeat BPM range ──────────────────────────────────────────────
const HEARTBEAT_BASE_BPM := 60.0
const HEARTBEAT_MAX_BPM := 120.0

# ─── Component appearance thresholds (dread level) ───────────────────
const CELLO_THRESHOLD := 20.0
const HEARTBEAT_THRESHOLD := 40.0
const WHISPER_THRESHOLD := 60.0
const RUMBLE_THRESHOLD := 0.0  # Always present at dread > 0
const SECONDARY_DRONE_THRESHOLD := 50.0
const TERTIARY_DRONE_THRESHOLD := 75.0

# ─── LFO parameters ───────────────────────────────────────────────────
const LFO_BASE_RATE := 0.5  # Hz at dread 50-75
const LFO_HIGH_RATE := 1.5  # Hz at dread 75-100
const LFO_DEPTH := 2.0  # ±2 Hz pitch modulation
const LFO_THRESHOLD := 50.0  # LFO active at dread >= 50

# ─── Radio pulse parameters ──────────────────────────────────────────
const RADIO_PULSE_BASE_RATE := 1.0  # Hz at dread 50-75
const RADIO_PULSE_HIGH_RATE := 2.0  # Hz at dread 75-100
const RADIO_PULSE_THRESHOLD := 50.0

# ─── Call distortion parameters ──────────────────────────────────────
const CALL_DISTORTION_THRESHOLD := 75.0
const CALL_DISTORTION_MAX := 0.3  # amount = (dread-75)/25 * 0.3

# ─── Break event durations (seconds) ────────────────────────────────
const BREAK_PEAK_DURATION := 2.0
const BREAK_TONE_DURATION := 3.0
const BREAK_RESET_DREAD := 75.0
const BREAK_RESET_DRONE_VOL := -9.0

# ─── Bus volume range (per issue: -80 dB at dread 0, -3 dB at dread 100)
const BUS_VOL_MIN := -80.0
const BUS_VOL_MAX := -3.0

const BUNKER_BOOST_DB := 3.0
const LIMINAL_BOOST_DB := 6.0
const HIDING_BOOST_DB := 6.0

# ─── Volume smoothing ───────────────────────────────────────────────
const SMOOTH_RATE := 12.0  # dB per second for volume ramps (prevents clicks/pops)

# ─── Silent volume ──────────────────────────────────────────────────
const SILENT_DB := -80.0

# ─── Computed values (testable without audio server) ────────────────
# Component target volumes (dB, -80 = silent)
var cello_volume_db: float = SILENT_DB
var heartbeat_volume_db: float = SILENT_DB
var whisper_volume_db: float = SILENT_DB
var rumble_volume_db: float = SILENT_DB
var secondary_drone_volume_db: float = SILENT_DB
var tertiary_drone_volume_db: float = SILENT_DB
var break_tone_volume_db: float = SILENT_DB

# Component parameters
var heartbeat_bpm: float = HEARTBEAT_BASE_BPM
var lfo_rate: float = 0.0
var lfo_depth: float = 0.0
var secondary_drone_active: bool = false
var tertiary_drone_active: bool = false
var call_distortion_amount: float = 0.0
var radio_pulse_rate: float = 0.0
var bus_volume_db: float = BUS_VOL_MIN
var location_modifier_db: float = 0.0

# Reference to DreadComposure (set externally or via connect_to_dread_composure).
# Untyped because class_name cross-file resolution isn't available to the LSP.
var dread_composure

# ─── State ───────────────────────────────────────────────────────────
var _dread: float = 0.0
var _location: int = Location.NORMAL
var _hiding: bool = false

# Break event state
var _in_break: bool = false
var _break_timer: float = 0.0
var _break_phase: int = 0  # 0=none, 1=peak (drones at 0 dB), 2=sustained 440 Hz tone

# ─── Current (smoothed) volumes — lerped toward targets in _process ─
var _cello_vol_cur: float = SILENT_DB
var _heartbeat_vol_cur: float = SILENT_DB
var _whisper_vol_cur: float = SILENT_DB
var _rumble_vol_cur: float = SILENT_DB
var _secondary_vol_cur: float = SILENT_DB
var _tertiary_vol_cur: float = SILENT_DB
var _break_tone_vol_cur: float = SILENT_DB

# ─── Audio nodes (only active when in scene tree) ───────────────────
var _cello_player: AudioStreamPlayer
var _secondary_player: AudioStreamPlayer
var _tertiary_player: AudioStreamPlayer
var _rumble_player: AudioStreamPlayer
var _break_tone_player: AudioStreamPlayer
var _whisper_players: Array = []
var _heartbeat_player: AudioStreamPlayer
var _heartbeat_timer: Timer
var _lfo_phase: float = 0.0
var _audio_initialized: bool = false

# ─── Lifecycle ──────────────────────────────────────────────────────


func _ready() -> void:
	_setup_audio_nodes()


func _process(delta: float) -> void:
	if _in_break:
		_process_break(delta)

	# Update LFO phase
	if lfo_rate > 0.0:
		_lfo_phase += delta * lfo_rate
		_lfo_phase = fmod(_lfo_phase, TAU)

	# Smooth volume ramps toward targets (prevents clicks/pops)
	var step: float = SMOOTH_RATE * delta
	_cello_vol_cur = _move_toward_db(_cello_vol_cur, cello_volume_db, step)
	_heartbeat_vol_cur = _move_toward_db(_heartbeat_vol_cur, heartbeat_volume_db, step)
	_whisper_vol_cur = _move_toward_db(_whisper_vol_cur, whisper_volume_db, step)
	_rumble_vol_cur = _move_toward_db(_rumble_vol_cur, rumble_volume_db, step)
	_secondary_vol_cur = _move_toward_db(_secondary_vol_cur, secondary_drone_volume_db, step)
	_tertiary_vol_cur = _move_toward_db(_tertiary_vol_cur, tertiary_drone_volume_db, step)
	_break_tone_vol_cur = _move_toward_db(_break_tone_vol_cur, break_tone_volume_db, step)

	# Apply LFO to tertiary drone pitch (110 Hz) per spec
	if _tertiary_player and _tertiary_vol_cur > SILENT_DB + 1.0 and lfo_depth > 0.0:
		var lfo_offset: float = sin(_lfo_phase) * lfo_depth
		_tertiary_player.pitch_scale = 1.0 + (lfo_offset / TERTIARY_DRONE_FREQ)

	_apply_audio_params()


# ─── Public API ─────────────────────────────────────────────────────


## Connect to a DreadComposure instance and listen for dread changes.
func connect_to_dread_composure(dc) -> void:
	dread_composure = dc
	if dc != null:
		dc.dread_changed.connect(_on_dread_changed)
		# Initialize with current dread value
		update_dread(dc.dread)


## Update all computed audio parameters based on dread level.
## This is the main computation function — callable without an audio server.
func update_dread(dread: float) -> void:
	_dread = clampf(dread, 0.0, 100.0)

	if _in_break:
		# During break, parameters are controlled by _process_break
		return

	# ── Cello drone (55 Hz): volume = dread/100 * -3 dB, appears at dread > 20
	if _dread > CELLO_THRESHOLD:
		cello_volume_db = (_dread / 100.0) * -3.0
	else:
		cello_volume_db = SILENT_DB

	# ── Heartbeat: 60 BPM (dread 0) → 120 BPM (dread 100), volume = dread/100 * -6 dB
	if _dread > HEARTBEAT_THRESHOLD:
		heartbeat_volume_db = (_dread / 100.0) * -6.0
		var t_bpm: float = _dread / 100.0
		heartbeat_bpm = lerpf(HEARTBEAT_BASE_BPM, HEARTBEAT_MAX_BPM, t_bpm)
	else:
		heartbeat_volume_db = SILENT_DB
		heartbeat_bpm = HEARTBEAT_BASE_BPM

	# ── Whisper: volume = (dread-60)/40 * -12 dB, appears at dread > 60
	if _dread > WHISPER_THRESHOLD:
		whisper_volume_db = ((_dread - WHISPER_THRESHOLD) / 40.0) * -12.0
	else:
		whisper_volume_db = SILENT_DB

	# ── Sub-bass rumble (20 Hz): volume = dread/100 * -12 dB, appears at dread > 0
	if _dread > RUMBLE_THRESHOLD:
		rumble_volume_db = (_dread / 100.0) * -12.0
	else:
		rumble_volume_db = SILENT_DB

	# ── Secondary drone (82 Hz): active at dread >= 50 (GDD spec)
	secondary_drone_active = _dread >= SECONDARY_DRONE_THRESHOLD
	if secondary_drone_active:
		secondary_drone_volume_db = (_dread / 100.0) * -3.0
	else:
		secondary_drone_volume_db = SILENT_DB

	# ── Tertiary drone (110 Hz): active at dread >= 75 (GDD spec)
	tertiary_drone_active = _dread >= TERTIARY_DRONE_THRESHOLD
	if tertiary_drone_active:
		tertiary_drone_volume_db = (_dread / 100.0) * -3.0
	else:
		tertiary_drone_volume_db = SILENT_DB

	# ── LFO: active at dread >= 50, rate 0.5 Hz (50-75) → 1.5 Hz (75-100)
	if _dread >= LFO_THRESHOLD:
		if _dread < TERTIARY_DRONE_THRESHOLD:
			lfo_rate = LFO_BASE_RATE
		else:
			lfo_rate = LFO_HIGH_RATE
		lfo_depth = LFO_DEPTH
	else:
		lfo_rate = 0.0
		lfo_depth = 0.0

	# ── Radio pulse: active at dread >= 50, rate 1 Hz (50-75) → 2 Hz (75-100)
	if _dread >= RADIO_PULSE_THRESHOLD:
		if _dread < TERTIARY_DRONE_THRESHOLD:
			radio_pulse_rate = RADIO_PULSE_BASE_RATE
		else:
			radio_pulse_rate = RADIO_PULSE_HIGH_RATE
	else:
		radio_pulse_rate = 0.0

	# ── Call distortion: amount = (dread-75)/25 * 0.3, active at dread >= 75
	if _dread >= CALL_DISTORTION_THRESHOLD:
		call_distortion_amount = (_dread - CALL_DISTORTION_THRESHOLD) / 25.0 * CALL_DISTORTION_MAX
	else:
		call_distortion_amount = 0.0

	# ── Bus volume: -80 dB at dread 0, -3 dB at dread 100 (linear)
	bus_volume_db = lerpf(BUS_VOL_MIN, BUS_VOL_MAX, _dread / 100.0)

	# ── Location modifier
	_location = _location  # no-op, location set via set_location
	_update_location_modifier()

	# ── Chamber: heartbeat-only (replace all other dread audio)
	if _location == Location.CHAMBER:
		cello_volume_db = SILENT_DB
		whisper_volume_db = SILENT_DB
		rumble_volume_db = SILENT_DB
		secondary_drone_volume_db = SILENT_DB
		tertiary_drone_volume_db = SILENT_DB
		# Heartbeat stays active if dread is high enough
		if _dread > HEARTBEAT_THRESHOLD:
			heartbeat_volume_db = (_dread / 100.0) * -6.0
			heartbeat_bpm = lerpf(HEARTBEAT_BASE_BPM, HEARTBEAT_MAX_BPM, _dread / 100.0)

	# ── Propagate to AudioBusManager for bus-level effects
	if _audio_initialized:
		var abm = _get_audio_bus_manager()
		if abm != null:
			abm.set_dread_level(_dread)
			abm.set_call_distortion(call_distortion_amount)


## Set the location modifier (affects dread audio volume/behavior).
func set_location(loc: int) -> void:
	_location = loc
	_update_location_modifier()
	# Recompute volumes with new modifier
	update_dread(_dread)


## Set hiding state (when hiding, dread bus boosts by +6 dB).
func set_hiding(hiding: bool) -> void:
	_hiding = hiding
	_apply_audio_params()


## Trigger the BREAK event at dread 100.
## All drones peak at 0 dB for 2 sec, then sustained 440 Hz tone for 3 sec,
## then reset dread to 75.
func trigger_break() -> void:
	_in_break = true
	_break_timer = BREAK_PEAK_DURATION
	_break_phase = 1  # Peak phase

	# All drones peak at 0 dB
	cello_volume_db = 0.0
	secondary_drone_volume_db = 0.0
	tertiary_drone_volume_db = 0.0
	rumble_volume_db = 0.0
	break_tone_volume_db = SILENT_DB


## Check if a BREAK event is currently in progress.
func is_in_break() -> bool:
	return _in_break


## Get the current break phase (0=none, 1=peak, 2=sustained tone).
func get_break_phase() -> int:
	return _break_phase


## Reset to initial state (for testing or new game).
func reset() -> void:
	_in_break = false
	_break_timer = 0.0
	_break_phase = 0
	_dread = 0.0
	_hiding = false
	_location = Location.NORMAL
	cello_volume_db = SILENT_DB
	heartbeat_volume_db = SILENT_DB
	whisper_volume_db = SILENT_DB
	rumble_volume_db = SILENT_DB
	secondary_drone_volume_db = SILENT_DB
	tertiary_drone_volume_db = SILENT_DB
	break_tone_volume_db = SILENT_DB
	_cello_vol_cur = SILENT_DB
	_heartbeat_vol_cur = SILENT_DB
	_whisper_vol_cur = SILENT_DB
	_rumble_vol_cur = SILENT_DB
	_secondary_vol_cur = SILENT_DB
	_tertiary_vol_cur = SILENT_DB
	_break_tone_vol_cur = SILENT_DB
	heartbeat_bpm = HEARTBEAT_BASE_BPM
	lfo_rate = 0.0
	lfo_depth = 0.0
	secondary_drone_active = false
	tertiary_drone_active = false
	call_distortion_amount = 0.0
	radio_pulse_rate = 0.0
	bus_volume_db = BUS_VOL_MIN
	location_modifier_db = 0.0


# ─── Internal: Signal handlers ─────────────────────────────────────


func _on_dread_changed(dread: float) -> void:
	update_dread(dread)
	# Check for BREAK trigger at dread 100
	if dread >= 100.0 and not _in_break:
		trigger_break()


# ─── Internal: Break event state machine ────────────────────────────


func _process_break(delta: float) -> void:
	_break_timer -= delta

	if _break_timer <= 0.0:
		if _break_phase == 1:
			# Transition to sustained tone phase
			_break_phase = 2
			_break_timer = BREAK_TONE_DURATION
			# Drones go silent, break tone activates
			cello_volume_db = SILENT_DB
			secondary_drone_volume_db = SILENT_DB
			tertiary_drone_volume_db = SILENT_DB
			rumble_volume_db = SILENT_DB
			break_tone_volume_db = 0.0
		elif _break_phase == 2:
			# Break complete: reset dread to 75
			_in_break = false
			_break_phase = 0
			break_tone_volume_db = SILENT_DB
			# Reset dread via DreadComposure if connected
			if dread_composure != null:
				dread_composure.set_dread(BREAK_RESET_DREAD)
			else:
				update_dread(BREAK_RESET_DREAD)
			# Override drone volume to -9 dB as per spec
			if _dread > CELLO_THRESHOLD:
				cello_volume_db = BREAK_RESET_DRONE_VOL


# ─── Internal: Location modifier ───────────────────────────────────


func _update_location_modifier() -> void:
	match _location:
		Location.BUNKER:
			location_modifier_db = BUNKER_BOOST_DB
		Location.LIMINAL:
			location_modifier_db = LIMINAL_BOOST_DB
		Location.CHAMBER:
			location_modifier_db = 0.0  # Chamber replaces audio, no boost
		_:
			location_modifier_db = 0.0


# ─── Internal: Audio node setup ────────────────────────────────────


func _setup_audio_nodes() -> void:
	if not is_inside_tree():
		return

	# Check if AudioServer is available (buses are set up)
	if AudioServer.bus_count == 0:
		return

	_audio_initialized = true

	# Create AudioStreamPlayers for each component
	_cello_player = _create_sine_player(CELLO_DRONE_FREQ)
	_secondary_player = _create_sine_player(SECONDARY_DRONE_FREQ)
	_tertiary_player = _create_sine_player(TERTIARY_DRONE_FREQ)
	_rumble_player = _create_sine_player(SUB_BASS_FREQ)
	_break_tone_player = _create_sine_player(BREAK_TONE_FREQ)
	_whisper_players = [
		_create_noise_player(0.97),
		_create_noise_player(0.94),
		_create_noise_player(0.88),
	]
	_heartbeat_player = _create_heartbeat_player()

	var all_players: Array = [
		_cello_player,
		_secondary_player,
		_tertiary_player,
		_rumble_player,
		_break_tone_player,
		_heartbeat_player
	]
	all_players.append_array(_whisper_players)
	for player in all_players:
		player.bus = &"DREAD_LAYER"
		player.volume_db = SILENT_DB
		add_child(player)

	# Heartbeat timer (triggers heartbeat sounds at BPM rate)
	_heartbeat_timer = Timer.new()
	_heartbeat_timer.one_shot = false
	_heartbeat_timer.wait_time = 1.0  # Will be updated based on BPM
	add_child(_heartbeat_timer)
	_heartbeat_timer.timeout.connect(_on_heartbeat_tick)
	_heartbeat_timer.start()


func _create_sine_player(freq: float) -> AudioStreamPlayer:
	var player = AudioStreamPlayer.new()
	player.stream = _generate_sine_wave(freq)
	player.volume_db = SILENT_DB
	return player


func _create_noise_player(filter_coef: float = 0.95) -> AudioStreamPlayer:
	var player = AudioStreamPlayer.new()
	player.stream = _generate_noise(filter_coef)
	player.volume_db = SILENT_DB
	return player


func _create_heartbeat_player() -> AudioStreamPlayer:
	var player = AudioStreamPlayer.new()
	player.stream = _generate_heartbeat_pulse()
	player.volume_db = SILENT_DB
	return player


# ─── Internal: Audio generation ─────────────────────────────────────


## Generate a loopable sine wave AudioStreamWAV at the given frequency.
func _generate_sine_wave(freq: float) -> AudioStreamWAV:
	var sample_rate := 44100
	# Duration: enough for clean looping (at least 1 full cycle, use 2 seconds)
	var duration_sec := 2.0
	var num_samples := int(sample_rate * duration_sec)
	var data := PackedByteArray()
	data.resize(num_samples * 2)  # 16-bit mono

	for i in num_samples:
		var t := float(i) / float(sample_rate)
		var sample := sin(t * freq * TAU)
		var int_sample := int(sample * 32767)
		int_sample = clampi(int_sample, -32768, 32767)
		# Encode as little-endian 16-bit
		data[i * 2] = int_sample & 0xFF
		data[i * 2 + 1] = (int_sample >> 8) & 0xFF

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = sample_rate
	wav.stereo = false
	wav.loop = true
	wav.data = data
	return wav


## Generate loopable noise for whisper layer (filtered to be subtle).
func _generate_noise(filter_coef: float = 0.95) -> AudioStreamWAV:
	var sample_rate := 44100
	var duration_sec := 2.0
	var num_samples := int(sample_rate * duration_sec)
	var data := PackedByteArray()
	data.resize(num_samples * 2)

	# Simple one-pole low-pass filtered noise for murmur effect
	# filter_coef controls cutoff: higher = darker/deeper, lower = brighter/sibilant
	var prev: float = 0.0
	for i in num_samples:
		var noise_val := (randf() * 2.0 - 1.0) * 0.1
		prev = prev * filter_coef + noise_val * (1.0 - filter_coef)
		var int_sample := int(prev * 32767)
		int_sample = clampi(int_sample, -32768, 32767)
		data[i * 2] = int_sample & 0xFF
		data[i * 2 + 1] = (int_sample >> 8) & 0xFF

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = sample_rate
	wav.stereo = false
	wav.loop = true
	wav.data = data
	return wav


## Generate a short percussive heartbeat pulse (low-freq sine with decay envelope).
func _generate_heartbeat_pulse() -> AudioStreamWAV:
	var sample_rate := 44100
	var duration_sec := 0.15
	var num_samples := int(sample_rate * duration_sec)
	var data := PackedByteArray()
	data.resize(num_samples * 2)

	var freq := 60.0
	for i in num_samples:
		var t := float(i) / float(sample_rate)
		var envelope := exp(-t * 15.0)
		var sample := sin(t * freq * TAU) * envelope * 0.8
		var int_sample := int(sample * 32767)
		int_sample = clampi(int_sample, -32768, 32767)
		data[i * 2] = int_sample & 0xFF
		data[i * 2 + 1] = (int_sample >> 8) & 0xFF

	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = sample_rate
	wav.stereo = false
	wav.loop = false
	wav.data = data
	return wav


# ─── Internal: Apply computed params to audio nodes ────────────────


func _apply_audio_params() -> void:
	if not _audio_initialized:
		return

	var hiding_boost: float = HIDING_BOOST_DB if _hiding else 0.0
	var loc_mod: float = location_modifier_db

	# Apply smoothed volumes + modifiers to players
	if _cello_player:
		_cello_player.volume_db = _cello_vol_cur + loc_mod + hiding_boost
		_update_playback(_cello_player)

	if _secondary_player:
		_secondary_player.volume_db = _secondary_vol_cur + loc_mod + hiding_boost
		_update_playback(_secondary_player)

	if _tertiary_player:
		_tertiary_player.volume_db = _tertiary_vol_cur + loc_mod + hiding_boost
		_update_playback(_tertiary_player)

	if _rumble_player:
		_rumble_player.volume_db = _rumble_vol_cur + loc_mod + hiding_boost
		_update_playback(_rumble_player)

	if _whisper_players:
		for whisper_player in _whisper_players:
			if whisper_player:
				whisper_player.volume_db = _whisper_vol_cur + loc_mod + hiding_boost
				_update_playback(whisper_player)

	if _break_tone_player:
		_break_tone_player.volume_db = _break_tone_vol_cur + hiding_boost
		_update_playback(_break_tone_player)

	if _heartbeat_player:
		_heartbeat_player.volume_db = _heartbeat_vol_cur + loc_mod + hiding_boost

	# Update heartbeat timer rate
	if _heartbeat_timer and _heartbeat_timer.is_inside_tree():
		if heartbeat_bpm > 0.0:
			var beat_interval := 60.0 / heartbeat_bpm
			_heartbeat_timer.wait_time = beat_interval
			if _heartbeat_vol_cur > SILENT_DB + 1.0 and not _heartbeat_timer.is_stopped():
				_heartbeat_timer.start()
			elif _heartbeat_vol_cur <= SILENT_DB + 1.0 and _heartbeat_timer.is_stopped():
				pass  # Already stopped
		else:
			_heartbeat_timer.stop()


func _update_playback(player: AudioStreamPlayer) -> void:
	# Start/stop playback based on volume (avoid playing silent streams)
	if player.volume_db <= SILENT_DB + 0.5 and player.playing:
		player.stop()
	elif player.volume_db > SILENT_DB + 0.5 and not player.playing:
		player.play()


func _on_heartbeat_tick() -> void:
	# Heartbeat player plays a short burst on each timer tick
	if _heartbeat_player and _heartbeat_vol_cur > SILENT_DB:
		_heartbeat_player.play()


# ─── Internal: Helpers ─────────────────────────────────────────────


## Move a dB value toward a target at a fixed rate (for smooth ramps).
func _move_toward_db(current: float, target: float, max_step: float) -> float:
	if abs(current - target) <= max_step:
		return target
	return current + sign(target - current) * max_step


## Get the AudioBusManager autoload (null if not available).
func _get_audio_bus_manager() -> Node:
	var tree = get_tree()
	if tree == null:
		return null
	var root = tree.root
	if root == null:
		return null
	return root.get_node_or_null("AudioBusManager")
