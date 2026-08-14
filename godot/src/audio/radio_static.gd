class_name RadioStatic
extends Node
## RadioStatic — manages 4 procedural audio layers for radio ambient sound.
## Layers: static bed (band-specific looping), interference (sporadic crackles),
##         whisper (dread > 60), heartbeat (████████ band only).
## All audio routed to the RADIO_AMBIENT bus (from DEA-134 bus layout).

# ─── Enums ───────────────────────────────────────────────────────────

enum SignalTier {
	DEAD_AIR,    # signal 0-19  — near-silence, total silence only at 0
	FRAGMENTS,   # signal 20-49 — mostly static, voice fragments
	GARBLED,     # signal 50-79 — increased static, garbled voice
	CLEAR,       # signal 80+   — minimal static, clear signal
}

# ─── Constants ────────────────────────────────────────────────────────

const RADIO_AMBIENT_BUS := "RADIO_AMBIENT"
const SAMPLE_RATE := 44100.0

# Volume mapping: signal 0 → -80 dB, signal 100 → 0 dB
const VOLUME_MIN_DB := -80.0
const VOLUME_MAX_DB := 0.0

# Filter cutoff range multiplier: low signal → narrow, high signal → wide
const FILTER_MIN_MULT := 0.2
const FILTER_MAX_MULT := 1.0

# Interference timing: low signal → frequent (0.5s), high signal → rare (8.0s)
const INTERFERENCE_MIN_INTERVAL := 0.5
const INTERFERENCE_MAX_INTERVAL := 8.0

# Whisper threshold: dread must exceed this for whisper layer
const WHISPER_DREAD_THRESHOLD := 60.0

# ████████ band ID (index 4 in BandConfig)
const HEARTBEAT_BAND_ID := 4

# Band character parameters: filter_cutoff_hz, filter_resonance, noise_gain
const BAND_CHARACTERS: Dictionary = {
	0: {  # LIVING — warm white noise
		"label": "LIVING",
		"filter_cutoff_hz": 8000.0,
		"filter_resonance": 0.5,
		"noise_gain": 0.6,
	},
	1: {  # LIMINAL — hollow / echoing
		"label": "LIMINAL",
		"filter_cutoff_hz": 3500.0,
		"filter_resonance": 0.9,
		"noise_gain": 0.5,
	},
	2: {  # LOST — cold / thin / metallic
		"label": "LOST",
		"filter_cutoff_hz": 6000.0,
		"filter_resonance": 0.7,
		"noise_gain": 0.45,
	},
	3: {  # CLASSIFIED — harsh / metallic / industrial
		"label": "CLASSIFIED",
		"filter_cutoff_hz": 5000.0,
		"filter_resonance": 0.8,
		"noise_gain": 0.7,
	},
	4: {  # ████████ — deep rumble + heartbeat
		"label": "████████",
		"filter_cutoff_hz": 800.0,
		"filter_resonance": 0.3,
		"noise_gain": 0.8,
	},
	5: {  # WEATHER — clean / minimal
		"label": "WEATHER",
		"filter_cutoff_hz": 10000.0,
		"filter_resonance": 0.3,
		"noise_gain": 0.25,
	},
	6: {  # PIRATE — noisy / unstable / crackling
		"label": "PIRATE",
		"filter_cutoff_hz": 4500.0,
		"filter_resonance": 0.6,
		"noise_gain": 0.65,
	},
	7: {  # HISTORICAL — AM-style crackle / vintage
		"label": "HISTORICAL",
		"filter_cutoff_hz": 4000.0,
		"filter_resonance": 0.7,
		"noise_gain": 0.55,
	},
}

# Static intensity per signal tier (0.0-1.0 scale)
const STATIC_INTENSITY: Dictionary = {
	SignalTier.CLEAR: 0.15,
	SignalTier.GARBLED: 0.45,
	SignalTier.FRAGMENTS: 0.80,
	SignalTier.DEAD_AIR: 0.95,
}

# ─── Exports ──────────────────────────────────────────────────────────

@export var radio_tuner: RadioTuner
@export var signal_strength: SignalStrength

# ─── Internal State ────────────────────────────────────────────────────

var _static_player: AudioStreamPlayer
var _interference_player: AudioStreamPlayer
var _whisper_player: AudioStreamPlayer
var _heartbeat_player: AudioStreamPlayer

var _static_gen: AudioStreamGenerator
var _interference_gen: AudioStreamGenerator
var _whisper_gen: AudioStreamGenerator
var _heartbeat_gen: AudioStreamGenerator

var _static_stream: AudioStreamGeneratorPlayback
var _interference_stream: AudioStreamGeneratorPlayback
var _whisper_stream: AudioStreamGeneratorPlayback
var _heartbeat_stream: AudioStreamGeneratorPlayback

var _interference_timer: float = 0.0
var _interference_interval: float = 4.0
var _interference_active: bool = false
var _interference_duration: float = 0.0
var _interference_elapsed: float = 0.0

var _heartbeat_interval: float = 1.2  # ~50 BPM
var _heartbeat_timer: float = 0.0
var _heartbeat_active: bool = false
var _heartbeat_duration: float = 0.15
var _heartbeat_elapsed: float = 0.0

var _whisper_active: bool = false

var _current_band_id: int = 0
var _current_signal: float = 0.0
var _current_dread: float = 0.0

var _low_pass_filter: AudioEffectLowPassFilter
var _low_pass_idx: int = -1

# ─── Pure Logic Functions (testable without audio) ───────────────────

## Returns the signal tier for a given signal value (0-100).
static func get_signal_tier(signal_value: float) -> SignalTier:
	if signal_value > 80.0:
		return SignalTier.CLEAR
	if signal_value > 50.0:
		return SignalTier.GARBLED
	if signal_value > 20.0:
		return SignalTier.FRAGMENTS
	return SignalTier.DEAD_AIR


## Maps signal (0-100) to volume in dB (-80 to 0).
static func signal_to_volume_db(signal_value: float) -> float:
	var clamped := clampf(signal_value, 0.0, 100.0)
	return lerpf(VOLUME_MIN_DB, VOLUME_MAX_DB, clamped / 100.0)


## Maps signal (0-100) to low-pass filter cutoff frequency.
## Higher signal → wider frequency response.
static func signal_to_filter_cutoff(signal_value: float, band_cutoff_hz: float) -> float:
	var clamped := clampf(signal_value, 0.0, 100.0)
	var mult := lerpf(FILTER_MIN_MULT, FILTER_MAX_MULT, clamped / 100.0)
	return band_cutoff_hz * mult


## Returns interference interval in seconds. Lower signal → more frequent.
static func get_interference_interval(signal_value: float) -> float:
	var clamped := clampf(signal_value, 0.0, 100.0)
	# High signal (100) → max interval (rare), low signal (0) → min interval (frequent)
	return lerpf(INTERFERENCE_MIN_INTERVAL, INTERFERENCE_MAX_INTERVAL, clamped / 100.0)


## Returns true if the whisper layer should be audible (dread > 60).
static func should_play_whisper(dread_level: float) -> bool:
	return dread_level > WHISPER_DREAD_THRESHOLD


## Returns true if the heartbeat layer should play (████████ band only, id == 4).
static func should_play_heartbeat(band_id: int) -> bool:
	return band_id == HEARTBEAT_BAND_ID


## Returns the band character dictionary for a given band id.
static func get_band_character(band_id: int) -> Dictionary:
	return BAND_CHARACTERS.get(band_id, BAND_CHARACTERS[0])


## Returns static intensity (0.0-1.0) for a given signal tier.
static func get_static_intensity(tier: SignalTier) -> float:
	return STATIC_INTENSITY.get(tier, 0.5)

# ─── Lifecycle ────────────────────────────────────────────────────────

func _ready() -> void:
	_setup_audio()
	_connect_signals()


func _process(delta: float) -> void:
	_update_state()
	_fill_static_buffer()
	_fill_interference_buffer(delta)
	_fill_whisper_buffer()
	_fill_heartbeat_buffer(delta)
	_apply_filter()

# ─── Audio Setup ─────────────────────────────────────────────────────

func _setup_audio() -> void:
	var bus_idx := AudioServer.get_bus_index(RADIO_AMBIENT_BUS)
	if bus_idx < 0:
		push_warning("RadioStatic: RADIO_AMBIENT bus not found, using Master")
		bus_idx = 0

	# Static bed (looping)
	_static_gen = AudioStreamGenerator.new()
	_static_gen.mix_rate = SAMPLE_RATE
	_static_gen.buffer_length = 1.0
	_static_player = AudioStreamPlayer.new()
	_static_player.stream = _static_gen
	_static_player.bus = RADIO_AMBIENT_BUS if AudioServer.get_bus_index(RADIO_AMBIENT_BUS) >= 0 else "Master"
	add_child(_static_player)

	# Interference (sporadic)
	_interference_gen = AudioStreamGenerator.new()
	_interference_gen.mix_rate = SAMPLE_RATE
	_interference_gen.buffer_length = 0.5
	_interference_player = AudioStreamPlayer.new()
	_interference_player.stream = _interference_gen
	_interference_player.bus = _static_player.bus
	add_child(_interference_player)

	# Whisper (dread layer)
	_whisper_gen = AudioStreamGenerator.new()
	_whisper_gen.mix_rate = SAMPLE_RATE
	_whisper_gen.buffer_length = 1.0
	_whisper_player = AudioStreamPlayer.new()
	_whisper_player.stream = _whisper_gen
	_whisper_player.bus = _static_player.bus
	add_child(_whisper_player)

	# Heartbeat (████████ band)
	_heartbeat_gen = AudioStreamGenerator.new()
	_heartbeat_gen.mix_rate = SAMPLE_RATE
	_heartbeat_gen.buffer_length = 0.5
	_heartbeat_player = AudioStreamPlayer.new()
	_heartbeat_player.stream = _heartbeat_gen
	_heartbeat_player.bus = _static_player.bus
	add_child(_heartbeat_player)

	# Start playback
	_static_player.play()
	_interference_player.play()
	_whisper_player.play()
	_heartbeat_player.play()

	_static_stream = _static_player.get_stream_playback()
	_interference_stream = _interference_player.get_stream_playback()
	_whisper_stream = _whisper_player.get_stream_playback()
	_heartbeat_stream = _heartbeat_player.get_stream_playback()

	# Add low-pass filter to RADIO_AMBIENT bus for clarity control
	_add_bus_filter(bus_idx)


func _add_bus_filter(bus_idx: int) -> void:
	if bus_idx < 0:
		return
	_low_pass_filter = AudioEffectLowPassFilter.new()
	_low_pass_filter.cutoff_hz = 8000.0
	_low_pass_filter.resonance = 0.5
	_low_pass_idx = AudioServer.get_bus_effect_count(bus_idx)
	AudioServer.add_bus_effect(bus_idx, _low_pass_filter, _low_pass_idx)


func _connect_signals() -> void:
	if radio_tuner:
		radio_tuner.signal_changed.connect(_on_signal_changed)
		radio_tuner.band_changed.connect(_on_band_changed)
	if signal_strength:
		signal_strength.signal_changed.connect(_on_effective_signal_changed)


func _on_signal_changed(_s: float) -> void:
	_update_state()


func _on_band_changed(_b: int) -> void:
	_update_state()


func _on_effective_signal_changed(_s: float) -> void:
	_update_state()

# ─── State Update ────────────────────────────────────────────────────

func _update_state() -> void:
	if radio_tuner and radio_tuner.band_config:
		_current_band_id = radio_tuner.current_band_id

	if signal_strength:
		_current_signal = signal_strength.signal_value
		_current_dread = signal_strength.dread_level
	elif radio_tuner:
		_current_signal = radio_tuner.get_signal()
		_current_signal *= BandController.get_cross_pollination_multiplier(
			radio_tuner.current_band_id, radio_tuner.current_phase)

	_interference_interval = get_interference_interval(_current_signal)
	_whisper_active = should_play_whisper(_current_dread)
	_heartbeat_active = should_play_heartbeat(_current_band_id)

	# Set volume on static player
	if _static_player:
		_static_player.volume_db = signal_to_volume_db(_current_signal)

# ─── Buffer Filling ──────────────────────────────────────────────────

func _fill_static_buffer() -> void:
	if not _static_stream:
		return
	var frames_to_fill := _static_stream.get_frames_available()
	if frames_to_fill <= 0:
		return
	var buf: PackedVector2Array = _static_stream.get_buffer()
	var char_data := get_band_character(_current_band_id)
	var noise_gain: float = char_data.get("noise_gain", 0.5)
	var tier := get_signal_tier(_current_signal)
	var intensity := get_static_intensity(tier)
	# At signal 0, produce near-silence (not total silence)
	if _current_signal < 1.0:
		intensity *= 0.05

	for i in range(frames_to_fill):
		var sample: float = randf_range(-1.0, 1.0) * noise_gain * intensity
		buf[i] = Vector2(sample, sample)


func _fill_interference_buffer(delta: float) -> void:
	if not _interference_stream:
		return

	_interference_timer += delta
	if not _interference_active and _interference_timer >= _interference_interval:
		_interference_active = true
		_interference_duration = randf_range(0.05, 0.2)
		_interference_elapsed = 0.0
		_interference_timer = 0.0

	if _interference_active:
		_interference_elapsed += delta
		if _interference_elapsed >= _interference_duration:
			_interference_active = false

	var frames_to_fill := _interference_stream.get_frames_available()
	if frames_to_fill <= 0:
		return
	var buf: PackedVector2Array = _interference_stream.get_buffer()
	# Interference louder at low signal
	var crackle_amp := lerpf(0.3, 0.8, 1.0 - _current_signal / 100.0)

	for i in range(frames_to_fill):
		var sample: float = 0.0
		if _interference_active:
			sample = randf_range(-1.0, 1.0) * crackle_amp
		buf[i] = Vector2(sample, sample)


func _fill_whisper_buffer() -> void:
	if not _whisper_stream:
		return
	var frames_to_fill := _whisper_stream.get_frames_available()
	if frames_to_fill <= 0:
		return
	var buf: PackedVector2Array = _whisper_stream.get_buffer()

	for i in range(frames_to_fill):
		var sample: float = 0.0
		if _whisper_active:
			# Soft filtered noise for whisper texture
			sample = randf_range(-0.15, 0.15) * (_current_dread / 100.0)
		buf[i] = Vector2(sample, sample)


func _fill_heartbeat_buffer(delta: float) -> void:
	if not _heartbeat_stream:
		return

	_heartbeat_timer += delta
	if not _heartbeat_active:
		_heartbeat_timer = 0.0
		_heartbeat_elapsed = 0.0
		return

	if _heartbeat_timer >= _heartbeat_interval:
		_heartbeat_timer = 0.0
		_heartbeat_elapsed = 0.0

	var frames_to_fill := _heartbeat_stream.get_frames_available()
	if frames_to_fill <= 0:
		return
	var buf: PackedVector2Array = _heartbeat_stream.get_buffer()

	# Low-frequency thump envelope
	for i in range(frames_to_fill):
		var sample: float = 0.0
		if _heartbeat_active and _heartbeat_elapsed < _heartbeat_duration:
			# Sine-ish thump via triangle envelope
			var env: float = 1.0 - (_heartbeat_elapsed / _heartbeat_duration)
			sample = sin(_heartbeat_elapsed * 60.0) * env * 0.6
			_heartbeat_elapsed += 1.0 / SAMPLE_RATE
		buf[i] = Vector2(sample, sample)


func _apply_filter() -> void:
	if not _low_pass_filter or _low_pass_idx < 0:
		return
	var char_data := get_band_character(_current_band_id)
	var band_cutoff: float = char_data.get("filter_cutoff_hz", 8000.0)
	var target_cutoff := signal_to_filter_cutoff(_current_signal, band_cutoff)
	_low_pass_filter.cutoff_hz = target_cutoff
	_low_pass_filter.resonance = char_data.get("filter_resonance", 0.5)
