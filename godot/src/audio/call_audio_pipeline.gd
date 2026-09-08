## CallAudioPipeline
## Autoload singleton for call voice audio playback with real-time processing.
## Routes all call audio through the CALL_AUDIO bus, which ducks RadioAmbient by -6 dB.
## Reference: DEA-137, GDD §Audio Architecture
##
## Processing chain:
##   Base (dry voice) → Band EQ → Compression → Radio Simulation → Bitcrush → Spatial → Output
##
## Band EQ profiles:
##   LIVING     — warm mid (full-range, slight low-mid boost)
##   LOST       — telephone bandpass (300–3400 Hz)
##   CLASSIFIED — military radio crackle (bandpass + distortion)
##   ████████   — sub-bass + proximity (low-pass + proximity effect)
##
## Signal quality (0–100) controls degradation/distortion level.
## Dread modifier: at dread > 60, apply pitch shift -2 semitones, reverse reverb tail, random gate.
## Phase 4 Corruption: false calls — reversed segments, pitch warping, name insertion.
##
## Integration:
##   - AudioBusManager.duck_for_call() handles bus-level ducking (DEA-134)
##   - AudioBusManager.set_call_distortion() handles bus distortion (DEA-134)
##   - StingerSystem ducking handles stinger → call duck (-6 dB for 2 sec)
##   - CallManager triggers start_call_audio() / stop_call_audio() per call lifecycle
extends Node

# ─── Band enum (matches BandConfig sacred band indices 0-4) ──────────
enum Band {
	LIVING,  ## 0 — warm mid
	LIMINAL,  ## 1 — echoey (uses LIVING profile by default)
	LOST,  ## 2 — telephone bandpass
	CLASSIFIED,  ## 3 — military radio crackle
	REDACTED,  ## 4 — ████████: sub-bass + proximity
}

# ─── Spatial mode ────────────────────────────────────────────────────
enum SpatialMode {
	MONO_CENTER,  ## Station calls — mono, centered
	POSITIONAL,  ## Phase 3 field calls — positional 3D
}

# ─── Processing chain stages ───────────────────────────────────────
enum Stage {
	BASE,  ## Dry voice input
	BAND_EQ,  ## Per-band EQ filter
	COMPRESSION,  ## Dynamic range compression
	RADIO_SIM,  ## Radio simulation (noise, dropout, warble)
	BITCRUSH,  ## Bit-depth reduction
	SPATIAL,  ## Spatial positioning (mono/positional)
	OUTPUT,  ## Final output to CALL_AUDIO bus
}

# ─── Band EQ profile parameters ────────────────────────────────────
## Each profile defines the EQ filter settings for a band's voice audio.
const BAND_EQ_PROFILES: Dictionary = {
	Band.LIVING:
	{
		"label": "LIVING",
		"filter_type": "full",
		"low_shelf_gain_db": 2.0,
		"low_shelf_cutoff_hz": 200.0,
		"high_shelf_gain_db": 0.0,
		"high_shelf_cutoff_hz": 8000.0,
		"bandpass_center_hz": 0.0,  # 0 = no bandpass (full range)
		"bandpass_resonance": 0.0,
		"distortion_drive": 0.0,
	},
	Band.LIMINAL:
	{
		"label": "LIMINAL",
		"filter_type": "full",
		"low_shelf_gain_db": 0.0,
		"low_shelf_cutoff_hz": 200.0,
		"high_shelf_gain_db": -2.0,
		"high_shelf_cutoff_hz": 6000.0,
		"bandpass_center_hz": 0.0,
		"bandpass_resonance": 0.0,
		"distortion_drive": 0.0,
	},
	Band.LOST:
	{
		"label": "LOST",
		"filter_type": "bandpass",
		"low_shelf_gain_db": 0.0,
		"low_shelf_cutoff_hz": 200.0,
		"high_shelf_gain_db": 0.0,
		"high_shelf_cutoff_hz": 8000.0,
		"bandpass_center_hz": 1850.0,  # Center of 300–3400 Hz telephone band
		"bandpass_resonance": 0.6,
		"distortion_drive": 0.1,
	},
	Band.CLASSIFIED:
	{
		"label": "CLASSIFIED",
		"filter_type": "bandpass",
		"low_shelf_gain_db": 0.0,
		"low_shelf_cutoff_hz": 200.0,
		"high_shelf_gain_db": 0.0,
		"high_shelf_cutoff_hz": 8000.0,
		"bandpass_center_hz": 2500.0,  # Military radio: narrower than telephone
		"bandpass_resonance": 0.8,
		"distortion_drive": 0.25,  # Military radio crackle
	},
	Band.REDACTED:
	{
		"label": "████████",
		"filter_type": "lowpass",
		"low_shelf_gain_db": 6.0,  # Sub-bass boost
		"low_shelf_cutoff_hz": 80.0,
		"high_shelf_gain_db": -12.0,  # Cut highs
		"high_shelf_cutoff_hz": 2000.0,
		"bandpass_center_hz": 0.0,
		"bandpass_resonance": 0.0,
		"distortion_drive": 0.15,  # Proximity distortion
	},
}

# ─── Signal quality → audio effect mapping (GDD §Signal Quality) ────
# Signal 0 = extreme distortion, 100 = clean
const SIGNAL_QUALITY_MAX: float = 100.0

# Bitcrush: bit-depth range (clean = 16-bit, extreme = 4-bit)
const BITCRUSH_DEPTH_MAX: int = 16
const BITCRUSH_DEPTH_MIN: int = 4

# Bitcrush sample rate reduction (clean = 1.0, extreme = 0.1)
const BITCRUSH_RATE_MIN: float = 0.1
const BITCRUSH_RATE_MAX: float = 1.0

# Radio simulation noise level (dB): signal 100 = -80 dB (silent), signal 0 = -6 dB (loud)
const RADIO_NOISE_MIN_DB: float = -80.0
const RADIO_NOISE_MAX_DB: float = -6.0

# Dropout frequency: signal 100 = 0/sec, signal 0 = 1/sec
const DROPOUT_MAX_RATE: float = 1.0
const DROPOUT_MIN_RATE: float = 0.0

# Warble depth: signal 100 = 0 Hz, signal 0 = ±8 Hz
const WARBLE_MAX_HZ: float = 8.0
const WARBLE_MIN_HZ: float = 0.0

# Volume: -3 dB base, adjusted by signal quality (signal 0 = -12 dB, signal 100 = -3 dB)
const VOLUME_BASE_DB: float = -3.0
const VOLUME_MIN_DB: float = -12.0

# ─── Dread modifier parameters ─────────────────────────────────────
const DREAD_THRESHOLD: float = 60.0
const DREAD_PITCH_SEMITONES: float = -2.0
const DREAD_PITCH_SCALE: float = 0.8909  # 2^(-2/12) ≈ -2 semitones
const DREAD_REVERB_WET: float = 0.4  # Reverse reverb tail wet level
const DREAD_REVERB_ROOM_SIZE: float = 0.8
const DREAD_GATE_PROBABILITY: float = 0.15  # 15% chance of random gate per sec

# ─── Phase 4 corruption parameters ─────────────────────────────────
const PHASE4_REVERSE_PROBABILITY: float = 0.2
const PHASE4_PITCH_WARP_RANGE: float = 0.3  # ±30% pitch warp
const PHASE4_NAME_INSERTION_PROBABILITY: float = 0.15

# ─── Ducking ────────────────────────────────────────────────────────
const DUCK_CALL_VOLUME_DB: float = -6.0  # Stinger ducks call by -6 dB
const DUCK_DURATION_SEC: float = 2.0

# ─── Recording specs ───────────────────────────────────────────────
const RECORDING_SAMPLE_RATE: int = 44100
const RECORDING_BIT_DEPTH: int = 16
const RECORDING_CHANNELS: int = 1  # Mono

# ─── Computed parameters (testable without AudioServer) ────────────
## Current band EQ profile (0-4)
var current_band: int = Band.LIVING
## Current signal quality (0-100)
var signal_quality: float = SIGNAL_QUALITY_MAX
## Current dread level (0-100)
var dread_level: float = 0.0
## Current spatial mode
var spatial_mode: int = SpatialMode.MONO_CENTER
## Is a call currently active?
var is_active: bool = false
## Is Phase 4 corruption active?
var phase4_corruption: bool = false

# ─── Computed processing chain values (testable) ──────────────────
var band_eq_profile: Dictionary = {}
var bitcrush_depth: int = BITCRUSH_DEPTH_MAX
var bitcrush_rate: float = BITCRUSH_RATE_MAX
var radio_noise_db: float = RADIO_NOISE_MIN_DB
var dropout_rate: float = DROPOUT_MIN_RATE
var warble_hz: float = WARBLE_MIN_HZ
var volume_db: float = VOLUME_BASE_DB
var pitch_scale: float = 1.0
var reverb_wet: float = 0.25  # Default from bus layout
var reverb_room_size: float = 0.3
var gate_active: bool = false
var _gate_muted: bool = false
var distortion_drive: float = 0.0

# ─── Current call metadata ─────────────────────────────────────────
var _call_metadata: Dictionary = {}
var _current_segment_index: int = -1
var _segments: Array[Dictionary] = []

# ─── Audio nodes (only active when in scene tree) ─────────────────
var _voice_player: AudioStreamPlayer = null
var _noise_player: AudioStreamPlayer = null
var _positional_player: AudioStreamPlayer3D = null
var _audio_initialized: bool = false

# ─── Ducking state ─────────────────────────────────────────────────
var _call_ducked: bool = false
var _duck_timer: Timer = null

# ─── Signals ───────────────────────────────────────────────────────
signal call_audio_started(metadata: Dictionary)
signal call_audio_ended(metadata: Dictionary)
signal segment_started(index: int, line_text: String)
signal segment_ended(index: int)
signal band_eq_changed(band: int)
signal signal_quality_changed(quality: float)
signal dread_modified(dread: float)
signal phase4_corruption_triggered
signal duck_started
signal duck_ended

# ─── Lifecycle ────────────────────────────────────────────────────


func _ready() -> void:
	_setup_audio_nodes()
	_setup_duck_timer()


# ─── Audio node setup ──────────────────────────────────────────────


func _setup_audio_nodes() -> void:
	if not is_inside_tree():
		return
	if AudioServer.bus_count == 0:
		return

	_audio_initialized = true

	# Primary voice player on CALL_AUDIO bus
	_voice_player = AudioStreamPlayer.new()
	_voice_player.name = "CallVoicePlayer"
	_voice_player.bus = AudioBusManager.BUS_CALL_AUDIO
	_voice_player.volume_db = VOLUME_BASE_DB
	add_child(_voice_player)

	# Radio simulation noise player
	_noise_player = AudioStreamPlayer.new()
	_noise_player.name = "CallNoisePlayer"
	_noise_player.bus = AudioBusManager.BUS_CALL_AUDIO
	_noise_player.volume_db = RADIO_NOISE_MIN_DB
	add_child(_noise_player)

	# Positional player for Phase 3 field calls
	_positional_player = AudioStreamPlayer3D.new()
	_positional_player.name = "CallPositionalPlayer"
	_positional_player.bus = AudioBusManager.BUS_CALL_AUDIO
	_positional_player.volume_db = VOLUME_BASE_DB
	add_child(_positional_player)


func _setup_duck_timer() -> void:
	if not is_inside_tree():
		return
	_duck_timer = Timer.new()
	_duck_timer.name = "CallDuckTimer"
	_duck_timer.one_shot = true
	_duck_timer.wait_time = DUCK_DURATION_SEC
	_duck_timer.timeout.connect(_on_duck_timer_timeout)
	add_child(_duck_timer)


# ─── Public API: Call lifecycle ────────────────────────────────────


## Start call audio for a given call metadata dictionary.
## metadata keys: callerId, band, type, shift, lines (Array of line text)
## Optionally provide audio segments (Array of AudioStream).
func start_call_audio(metadata: Dictionary, segments: Array = []) -> void:
	_call_metadata = metadata.duplicate(true)
	current_band = int(metadata.get("band", Band.LIVING))
	signal_quality = float(metadata.get("signal", SIGNAL_QUALITY_MAX))
	if signal_quality > SIGNAL_QUALITY_MAX:
		signal_quality = SIGNAL_QUALITY_MAX
	spatial_mode = SpatialMode.MONO_CENTER  # Default; Phase 3 sets positional
	is_active = true
	phase4_corruption = false

	# Build segment list from metadata lines
	_segments.clear()
	_current_segment_index = -1
	var lines: Array = metadata.get("lines", [])
	for i in range(lines.size()):
		var seg: Dictionary = {
			"index": i,
			"line_text": str(lines[i]),
			"stream": segments[i] if i < segments.size() else null,
			"caller_id": metadata.get("callerId", ""),
			"band": current_band,
			"call_type": metadata.get("type", ""),
			"shift": metadata.get("shift", 0),
		}
		_segments.append(seg)

	# Apply processing chain
	_apply_band_eq(current_band)
	_apply_signal_quality(signal_quality)
	_apply_dread_modifier(dread_level)

	# Activate call ducking (RadioAmbient -6 dB)
	if AudioBusManager:
		AudioBusManager.duck_for_call(true)

	call_audio_started.emit(_call_metadata)


## Stop call audio and clean up.
func stop_call_audio() -> void:
	if not is_active:
		return
	var meta = _call_metadata.duplicate(true)
	is_active = false
	_segments.clear()
	_current_segment_index = -1
	_call_metadata.clear()

	# Stop playback
	if _voice_player and _voice_player.playing:
		_voice_player.stop()
	if _noise_player and _noise_player.playing:
		_noise_player.stop()
	if _positional_player and _positional_player.playing:
		_positional_player.stop()

	# Release call ducking
	if AudioBusManager:
		AudioBusManager.duck_for_call(false)

	# End any active stinger duck on call
	if _call_ducked:
		_end_call_duck()

	call_audio_ended.emit(meta)


## Play a specific segment by index.
func play_segment(index: int) -> void:
	if not is_active or index < 0 or index >= _segments.size():
		push_warning("CallAudioPipeline: Invalid segment index %d" % index)
		return
	_current_segment_index = index
	var seg: Dictionary = _segments[index]

	# Apply Phase 4 corruption if active
	var stream = seg.get("stream", null)
	if phase4_corruption:
		stream = _apply_phase4_corruption_to_segment(seg)

	if stream is AudioStream:
		_play_stream(stream, seg)
	elif stream == null:
		# No audio stream — this is a text-only call, just emit the signal
		pass

	segment_started.emit(index, seg.get("line_text", ""))


## Advance to the next segment.
func next_segment() -> void:
	if _current_segment_index >= 0 and _current_segment_index < _segments.size():
		segment_ended.emit(_current_segment_index)
	play_segment(_current_segment_index + 1)


## Get the current segment metadata.
func get_current_segment() -> Dictionary:
	if _current_segment_index >= 0 and _current_segment_index < _segments.size():
		return _segments[_current_segment_index]
	return {}


## Get all segments for the current call.
func get_segments() -> Array[Dictionary]:
	return _segments


## Get call metadata.
func get_call_metadata() -> Dictionary:
	return _call_metadata


# ─── Public API: Processing control ───────────────────────────────


## Set the band EQ profile (0-4).
func set_band(band: int) -> void:
	current_band = clampi(band, Band.LIVING, Band.REDACTED)
	_apply_band_eq(current_band)
	band_eq_changed.emit(current_band)


## Set signal quality (0-100, 100 = clean).
func set_signal_quality(quality: float) -> void:
	signal_quality = clampf(quality, 0.0, SIGNAL_QUALITY_MAX)
	_apply_signal_quality(signal_quality)
	signal_quality_changed.emit(signal_quality)


## Set dread level (0-100).
func set_dread_level(dread: float) -> void:
	dread_level = clampf(dread, 0.0, 100.0)
	_apply_dread_modifier(dread_level)
	dread_modified.emit(dread_level)


## Set spatial mode (mono center for station, positional for Phase 3 field calls).
func set_spatial_mode(mode: int) -> void:
	spatial_mode = mode


## Enable or disable Phase 4 corruption.
func set_phase4_corruption(enabled: bool) -> void:
	phase4_corruption = enabled
	if enabled:
		phase4_corruption_triggered.emit()


# ─── Public API: Ducking ───────────────────────────────────────────


## Duck the call audio by -6 dB for 2 seconds (triggered by stinger bus).
func duck_for_stinger() -> void:
	if not is_active:
		return
	_start_call_duck()


## Check if the call is currently ducked.
func is_call_ducked() -> bool:
	return _call_ducked


# ─── Processing chain computation (testable without AudioServer) ──


## Apply band EQ profile to computed parameters.
func _apply_band_eq(band: int) -> void:
	if BAND_EQ_PROFILES.has(band):
		band_eq_profile = BAND_EQ_PROFILES[band].duplicate(true)
		distortion_drive = float(band_eq_profile.get("distortion_drive", 0.0))
	else:
		band_eq_profile = BAND_EQ_PROFILES[Band.LIVING].duplicate(true)
		distortion_drive = 0.0


## Apply signal quality degradation to computed parameters.
## signal_quality: 0 = extreme distortion, 100 = clean
func _apply_signal_quality(quality: float) -> void:
	var t: float = clampf(quality / SIGNAL_QUALITY_MAX, 0.0, 1.0)
	# t=1 (clean), t=0 (extreme)

	# Bitcrush: clean = 16-bit/full rate, extreme = 4-bit/0.1x rate
	bitcrush_depth = int(lerpf(float(BITCRUSH_DEPTH_MIN), float(BITCRUSH_DEPTH_MAX), t))
	bitcrush_rate = lerpf(BITCRUSH_RATE_MIN, BITCRUSH_RATE_MAX, t)

	# Radio noise: clean = -80 dB, extreme = -6 dB
	radio_noise_db = lerpf(RADIO_NOISE_MAX_DB, RADIO_NOISE_MIN_DB, t)

	# Dropout rate: clean = 0/sec, extreme = 1/sec
	dropout_rate = lerpf(DROPOUT_MAX_RATE, DROPOUT_MIN_RATE, t)

	# Warble: clean = 0 Hz, extreme = ±8 Hz
	warble_hz = lerpf(WARBLE_MAX_HZ, WARBLE_MIN_HZ, t)

	# Volume: clean = -3 dB, extreme = -12 dB
	volume_db = lerpf(VOLUME_MIN_DB, VOLUME_BASE_DB, t)


## Apply dread modifier to computed parameters.
## dread > 60: pitch shift -2 semitones, reverse reverb tail, random gate.
func _apply_dread_modifier(dread: float) -> void:
	if dread > DREAD_THRESHOLD:
		# Pitch shift -2 semitones
		pitch_scale = DREAD_PITCH_SCALE
		# Reverse reverb tail
		reverb_wet = DREAD_REVERB_WET
		reverb_room_size = DREAD_REVERB_ROOM_SIZE
		# Random gate is probabilistic — set flag for _process
		gate_active = true
	else:
		pitch_scale = 1.0
		reverb_wet = 0.25  # Default from bus layout
		reverb_room_size = 0.3
		gate_active = false


# ─── Phase 4 corruption ────────────────────────────────────────────


## Apply Phase 4 corruption to a segment.
## Returns the (potentially modified) AudioStream or null.
func _apply_phase4_corruption_to_segment(seg: Dictionary) -> AudioStream:
	var stream = seg.get("stream", null)
	if stream == null:
		return null

	seg.erase("reversed")
	seg.erase("pitch_warp")
	seg.erase("name_inserted")

	# Reversed segments: 20% chance
	if randf() < PHASE4_REVERSE_PROBABILITY:
		# Note: Godot AudioStreamWAV doesn't support reverse at runtime;
		# in production, pre-reversed assets would be loaded.
		# For now, we mark the segment as reversed in metadata.
		seg["reversed"] = true

	# Pitch warping: ±30%
	if randf() < 0.5:
		seg["pitch_warp"] = lerpf(
			1.0 - PHASE4_PITCH_WARP_RANGE, 1.0 + PHASE4_PITCH_WARP_RANGE, randf()
		)

	# Name insertion: 15% chance (marked for the text system to handle)
	if randf() < PHASE4_NAME_INSERTION_PROBABILITY:
		seg["name_inserted"] = true

	return stream


# ─── Internal: Playback ────────────────────────────────────────────


func _play_stream(stream: AudioStream, seg: Dictionary) -> void:
	if not _audio_initialized:
		return

	if spatial_mode == SpatialMode.POSITIONAL and _positional_player:
		_positional_player.stream = stream
		_positional_player.volume_db = volume_db
		_positional_player.pitch_scale = pitch_scale
		if seg.has("pitch_warp"):
			_positional_player.pitch_scale *= float(seg["pitch_warp"])
		_positional_player.play()
	else:
		if _voice_player:
			_voice_player.stream = stream
			_voice_player.volume_db = volume_db
			_voice_player.pitch_scale = pitch_scale
			if seg.has("pitch_warp"):
				_voice_player.pitch_scale *= float(seg["pitch_warp"])
			_voice_player.play()

	# Apply radio simulation noise
	if _noise_player and radio_noise_db > RADIO_NOISE_MIN_DB + 1.0:
		_noise_player.stream = _generate_radio_noise()
		_noise_player.volume_db = radio_noise_db
		_noise_player.play()


# ─── Internal: Radio simulation noise generation ──────────────────


func _generate_radio_noise() -> AudioStreamWAV:
	var sample_rate := RECORDING_SAMPLE_RATE
	var duration_sec := 2.0
	var num_samples := int(sample_rate * duration_sec)
	var data := PackedByteArray()
	data.resize(num_samples * 2)

	var prev: float = 0.0
	var filter_coef: float = 0.95
	for i in num_samples:
		var noise_val := (randf() * 2.0 - 1.0) * 0.15
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


# ─── Internal: Ducking ────────────────────────────────────────────


func _start_call_duck() -> void:
	_call_ducked = true
	if _voice_player:
		_voice_player.volume_db = volume_db + DUCK_CALL_VOLUME_DB
	if _positional_player:
		_positional_player.volume_db = volume_db + DUCK_CALL_VOLUME_DB
	if _duck_timer:
		_duck_timer.start()
	duck_started.emit()


func _end_call_duck() -> void:
	_call_ducked = false
	if _voice_player:
		_voice_player.volume_db = volume_db
	if _positional_player:
		_positional_player.volume_db = volume_db
	duck_ended.emit()


func _on_duck_timer_timeout() -> void:
	_end_call_duck()


# ─── Internal: Random gate (dread > 60) ───────────────────────────


func _process(delta: float) -> void:
	if not is_active or not gate_active:
		return
	# Random gate: probability per second
	if randf() < DREAD_GATE_PROBABILITY * delta:
		# Brief gate (100ms) — mute the voice player momentarily
		if _voice_player and _voice_player.playing and not _gate_muted:
			_gate_muted = true
			var orig_vol = _voice_player.volume_db
			_voice_player.volume_db = -80.0
			# Restore after brief gate using a one-shot timer
			get_tree().create_timer(0.1).timeout.connect(
				func():
					_voice_player.volume_db = orig_vol
					_gate_muted = false
			)


# ─── Reset (for testing) ──────────────────────────────────────────


func reset() -> void:
	is_active = false
	phase4_corruption = false
	current_band = Band.LIVING
	signal_quality = SIGNAL_QUALITY_MAX
	dread_level = 0.0
	spatial_mode = SpatialMode.MONO_CENTER
	_segments.clear()
	_current_segment_index = -1
	_call_metadata.clear()
	band_eq_profile = {}
	bitcrush_depth = BITCRUSH_DEPTH_MAX
	bitcrush_rate = BITCRUSH_RATE_MAX
	radio_noise_db = RADIO_NOISE_MIN_DB
	dropout_rate = DROPOUT_MIN_RATE
	warble_hz = WARBLE_MIN_HZ
	volume_db = VOLUME_BASE_DB
	pitch_scale = 1.0
	reverb_wet = 0.25
	reverb_room_size = 0.3
	gate_active = false
	_gate_muted = false
	distortion_drive = 0.0
	_call_ducked = false
