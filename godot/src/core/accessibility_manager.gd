## AccessibilityManager
## Autoload singleton managing accessibility settings for DEA-141 (audio) and
## DEA-146 (visual). Audio: volume sliders, subtitles, visual audio cues, colorblind
## audio patterns, reduce-audio-horror mode, hold-breath toggle, pause-anywhere
## override. Visual: camera shake reduction, high contrast, text size, screen flash
## reduction, static reduction, vignette reduction, CRT toggle, difficulty presets.
## Persists settings via ConfigFile at user://accessibility.cfg (audio, controls,
## visual sections).
## Reference: DEA-141, DEA-146, GDD §Accessibility (docs/plans/redesign-gdd.md)
extends Node

# ─── Signals ───────────────────────────────────────────────────────────
signal subtitles_toggled(enabled: bool)
signal subtitle_bg_toggled(enabled: bool)
signal visual_cues_toggled(enabled: bool)
signal colorblind_patterns_toggled(enabled: bool)
signal hearing_impaired_toggled(enabled: bool)
signal reduce_horror_toggled(enabled: bool)
signal hold_breath_mode_toggled(toggle_mode: bool)
signal pause_override_toggled(enabled: bool)
signal volume_changed(bus_key: String, percent: float)
signal dead_air_indicator_changed(active: bool)
signal dread_vignette_changed(intensity: float)
signal heartbeat_pulse_changed(intensity: float)
signal scanline_intensity_changed(intensity: float)

# ─── DEA-146: Visual accessibility signals ────────────────────────────
signal camera_shake_reduction_changed(reduction: int)
signal high_contrast_toggled(enabled: bool)
signal text_size_changed(size: int)
signal screen_flash_reduction_toggled(enabled: bool)
signal static_reduction_toggled(enabled: bool)
signal vignette_reduction_toggled(enabled: bool)
signal crt_toggled(enabled: bool)
signal difficulty_preset_changed(preset: int)

# ─── Noise types for colorblind audio patterns ───────────────────────
enum NoiseType {
	DEFAULT,  # Use band's existing character
	BROWN,  # Low rumble — LIVING
	PINK,  # Even energy — LOST
	WHITE,  # Harsh/bright — CLASSIFIED
}

# ─── DEA-146: Text size options ───────────────────────────────────────
enum TextSize {
	SMALL,  # Default (1.0×)
	MEDIUM,  # +25% (1.25×)
	LARGE,  # +50% (1.5×)
	EXTRA_LARGE,  # +100% (2.0×)
}

# ─── DEA-146: Difficulty presets ─────────────────────────────────────
enum DifficultyPreset {
	EASY,  # Composure decays 50% slower, lower starting dread, more frequent saves
	NORMAL,  # Defaults
	HARD,  # Composure 25% faster, higher dread, fewer saves
	DEAD_AIR,  # No saves, one life, composure starts at 50
}

## Text size scale factors indexed by TextSize enum.
const TEXT_SIZE_SCALES: Array[float] = [1.0, 1.25, 1.5, 2.0]

## Difficulty preset parameters (see DIFFICULTY_PRESETS dict below).
const DIFFICULTY_PRESETS: Dictionary = {
	DifficultyPreset.EASY:
	{
		"composure_decay_mult": 0.5,
		"starting_dread": 20.0,
		"save_freq_mult": 1.5,
		"composure_start": 100.0,
		"one_life": false,
		"no_saves": false,
	},
	DifficultyPreset.NORMAL:
	{
		"composure_decay_mult": 1.0,
		"starting_dread": 40.0,
		"save_freq_mult": 1.0,
		"composure_start": 100.0,
		"one_life": false,
		"no_saves": false,
	},
	DifficultyPreset.HARD:
	{
		"composure_decay_mult": 1.25,
		"starting_dread": 55.0,
		"save_freq_mult": 0.7,
		"composure_start": 100.0,
		"one_life": false,
		"no_saves": false,
	},
	DifficultyPreset.DEAD_AIR:
	{
		"composure_decay_mult": 1.0,
		"starting_dread": 70.0,
		"save_freq_mult": 0.0,
		"composure_start": 50.0,
		"one_life": true,
		"no_saves": true,
	},
}

## Valid camera shake reduction levels (percent).
const CAMERA_SHAKE_LEVELS: Array[int] = [0, 50, 100]

# ─── Volume bus keys ──────────────────────────────────────────────────
const VOL_MASTER := "master"
const VOL_ROOM := "room"
const VOL_RADIO := "radio"
const VOL_CALL := "call"
const VOL_DREAD := "dread"
const VOL_STINGER := "stinger"

## All volume bus keys in order.
const VOLUME_KEYS: Array[String] = [
	VOL_MASTER,
	VOL_ROOM,
	VOL_RADIO,
	VOL_CALL,
	VOL_DREAD,
	VOL_STINGER,
]

## Default volume percentages per GDD spec.
## Master 100, Radio 80, Call 90, Room 60, Dread 50, Stinger 70.
const DEFAULT_VOLUMES: Dictionary = {
	VOL_MASTER: 100.0,
	VOL_ROOM: 60.0,
	VOL_RADIO: 80.0,
	VOL_CALL: 90.0,
	VOL_DREAD: 50.0,
	VOL_STINGER: 70.0,
}

## Maps volume keys to AudioBusManager bus indices.
const VOLUME_TO_BUS_IDX: Dictionary = {
	VOL_MASTER: 0,  # IDX_MASTER
	VOL_ROOM: 1,  # IDX_ROOM_TONE
	VOL_RADIO: 2,  # IDX_RADIO_AMBIENT
	VOL_CALL: 3,  # IDX_CALL_AUDIO
	VOL_DREAD: 4,  # IDX_DREAD_LAYER
	VOL_STINGER: 5,  # IDX_STINGER
}

# ─── dB conversion ──────────────────────────────────────────────────
const VOLUME_MIN_DB := -80.0
const VOLUME_MAX_DB := 0.0

## Reduce-audio-horror offsets (dB applied on top of volume).
const REDUCE_HORROR_DREAD_OFFSET := -12.0
const REDUCE_HORROR_STINGER_OFFSET := -12.0

## High-pass filter cutoff for sub-bass removal (Hz).
const SUB_BASS_HPF_CUTOFF := 80.0

## Band → noise type mapping for colorblind mode.
const COLORBLIND_NOISE_MAP: Dictionary = {
	0: NoiseType.BROWN,  # LIVING
	2: NoiseType.PINK,  # LOST
	3: NoiseType.WHITE,  # CLASSIFIED
}

## Colorblind band character overrides: filter_cutoff_hz, filter_resonance, noise_gain.
const COLORBLIND_CHARACTERS: Dictionary = {
	0:
	{  # LIVING — brown noise (deep, rumbling)
		"filter_cutoff_hz": 600.0,
		"filter_resonance": 0.3,
		"noise_gain": 0.55,
	},
	2:
	{  # LOST — pink noise (steady, even)
		"filter_cutoff_hz": 4000.0,
		"filter_resonance": 0.5,
		"noise_gain": 0.50,
	},
	3:
	{  # CLASSIFIED — white noise (harsh, bright)
		"filter_cutoff_hz": 12000.0,
		"filter_resonance": 0.2,
		"noise_gain": 0.75,
	},
}

# ─── Persistence ─────────────────────────────────────────────────────
const SETTINGS_PATH := "user://accessibility.cfg"
const SECTION_AUDIO := "audio"
const SECTION_CONTROLS := "controls"
const SECTION_VISUAL := "visual"  # DEA-146: visual accessibility

# ─── Settings state ──────────────────────────────────────────────────
var subtitles_enabled: bool = true
var subtitle_bg_enabled: bool = false
var visual_cues_enabled: bool = false
var colorblind_patterns: bool = false
var hearing_impaired_mode: bool = false
var reduce_audio_horror: bool = false
var hold_breath_toggle_mode: bool = false
var pause_anywhere: bool = false

# ─── DEA-146: Visual accessibility state ─────────────────────────────
var camera_shake_reduction: int = 0  # 0, 50, or 100 percent
var high_contrast_mode: bool = false
var text_size: TextSize = TextSize.SMALL
var screen_flash_reduction: bool = false
var static_reduction: bool = false
var vignette_reduction: bool = false
var crt_enabled: bool = true
var difficulty_preset: DifficultyPreset = DifficultyPreset.NORMAL

## Volume percentages (0-100) per bus key.
var _volume_percents: Dictionary = {}

# ─── Visual cue state (updated by connected systems) ────────────────
var _dead_air_active: bool = false
var _signal_strength: float = 80.0
var _dread_level: float = 0.0
var _heartbeat_bpm: float = 60.0

# ─── Runtime: high-pass filter for sub-bass removal ──────────────────
var _dread_hpf: AudioEffectHighPassFilter = null
var _dread_hpf_idx: int = -1

# ─── Lifecycle ────────────────────────────────────────────────────────


func _ready() -> void:
	_init_default_volumes()
	_load_settings()
	_apply_all_volumes()
	_apply_sub_bass_filter()
	_connect_signals()
	_create_ui_overlays()


func _create_ui_overlays() -> void:
	# Create SubtitleDisplay and VisualAudioCues as child Controls
	var subtitle_script = load("res://src/ui/subtitle_display.gd")
	if subtitle_script:
		var subtitle_display = subtitle_script.new()
		subtitle_display.name = "SubtitleDisplay"
		add_child(subtitle_display)

	var cues_script = load("res://src/ui/visual_audio_cues.gd")
	if cues_script:
		var visual_cues = cues_script.new()
		visual_cues.name = "VisualAudioCues"
		add_child(visual_cues)

	# DEA-146: Visual accessibility controller (CRT shader parameter modifiers)
	var va_script = load("res://src/visual/visual_accessibility_controller.gd")
	if va_script:
		var va_controller = va_script.new()
		va_controller.name = "VisualAccessibilityController"
		add_child(va_controller)

	# DEA-146: High contrast manager (UI borders + text size scaling)
	var hc_script = load("res://src/ui/high_contrast_manager.gd")
	if hc_script:
		var hc_manager = hc_script.new()
		hc_manager.name = "HighContrastManager"
		add_child(hc_manager)


# ─── Persistence ─────────────────────────────────────────────────────


func _init_default_volumes() -> void:
	_volume_percents.clear()
	for key in DEFAULT_VOLUMES:
		_volume_percents[key] = DEFAULT_VOLUMES[key]


func _load_settings() -> void:
	var config := ConfigFile.new()
	var err := config.load(SETTINGS_PATH)
	if err != OK:
		# No saved settings — use defaults
		return

	# Audio section
	subtitles_enabled = config.get_value(SECTION_AUDIO, "subtitles_enabled", true)
	subtitle_bg_enabled = config.get_value(SECTION_AUDIO, "subtitle_bg_enabled", false)
	visual_cues_enabled = config.get_value(SECTION_AUDIO, "visual_cues_enabled", false)
	colorblind_patterns = config.get_value(SECTION_AUDIO, "colorblind_patterns", false)
	hearing_impaired_mode = config.get_value(SECTION_AUDIO, "hearing_impaired_mode", false)
	reduce_audio_horror = config.get_value(SECTION_AUDIO, "reduce_audio_horror", false)

	for key in VOLUME_KEYS:
		_volume_percents[key] = config.get_value(SECTION_AUDIO, "vol_" + key, DEFAULT_VOLUMES[key])

	# Controls section
	hold_breath_toggle_mode = config.get_value(SECTION_CONTROLS, "hold_breath_toggle_mode", false)
	pause_anywhere = config.get_value(SECTION_CONTROLS, "pause_anywhere", false)

	# DEA-146: Visual section
	camera_shake_reduction = int(config.get_value(SECTION_VISUAL, "camera_shake_reduction", 0))
	high_contrast_mode = config.get_value(SECTION_VISUAL, "high_contrast_mode", false)
	text_size = int(config.get_value(SECTION_VISUAL, "text_size", TextSize.SMALL))
	screen_flash_reduction = config.get_value(SECTION_VISUAL, "screen_flash_reduction", false)
	static_reduction = config.get_value(SECTION_VISUAL, "static_reduction", false)
	vignette_reduction = config.get_value(SECTION_VISUAL, "vignette_reduction", false)
	crt_enabled = config.get_value(SECTION_VISUAL, "crt_enabled", true)
	difficulty_preset = int(
		config.get_value(SECTION_VISUAL, "difficulty_preset", DifficultyPreset.NORMAL)
	)


func save_settings() -> void:
	var config := ConfigFile.new()

	# Audio section
	config.set_value(SECTION_AUDIO, "subtitles_enabled", subtitles_enabled)
	config.set_value(SECTION_AUDIO, "subtitle_bg_enabled", subtitle_bg_enabled)
	config.set_value(SECTION_AUDIO, "visual_cues_enabled", visual_cues_enabled)
	config.set_value(SECTION_AUDIO, "colorblind_patterns", colorblind_patterns)
	config.set_value(SECTION_AUDIO, "hearing_impaired_mode", hearing_impaired_mode)
	config.set_value(SECTION_AUDIO, "reduce_audio_horror", reduce_audio_horror)

	for key in VOLUME_KEYS:
		config.set_value(
			SECTION_AUDIO, "vol_" + key, _volume_percents.get(key, DEFAULT_VOLUMES[key])
		)

	# Controls section
	config.set_value(SECTION_CONTROLS, "hold_breath_toggle_mode", hold_breath_toggle_mode)
	config.set_value(SECTION_CONTROLS, "pause_anywhere", pause_anywhere)

	# DEA-146: Visual section
	config.set_value(SECTION_VISUAL, "camera_shake_reduction", camera_shake_reduction)
	config.set_value(SECTION_VISUAL, "high_contrast_mode", high_contrast_mode)
	config.set_value(SECTION_VISUAL, "text_size", text_size)
	config.set_value(SECTION_VISUAL, "screen_flash_reduction", screen_flash_reduction)
	config.set_value(SECTION_VISUAL, "static_reduction", static_reduction)
	config.set_value(SECTION_VISUAL, "vignette_reduction", vignette_reduction)
	config.set_value(SECTION_VISUAL, "crt_enabled", crt_enabled)
	config.set_value(SECTION_VISUAL, "difficulty_preset", difficulty_preset)

	config.save(SETTINGS_PATH)


# ─── Signal connections ───────────────────────────────────────────────


func _connect_signals() -> void:
	# Connect to CallPlayer for subtitles
	if CallPlayer and CallPlayer.has_signal("line_displayed"):
		CallPlayer.line_displayed.connect(_on_call_line_displayed)

	# Connect to SilenceSystem for dead air indicator
	if SilenceSystem:
		SilenceSystem.dead_air_started.connect(_on_dead_air_started)
		SilenceSystem.dead_air_ended.connect(_on_dead_air_ended)

	# Connect to CallManager's SignalStrength child for signal meter
	if CallManager:
		var ss := CallManager.get_signal_strength()
		if ss and ss.has_signal("signal_changed"):
			ss.signal_changed.connect(_on_signal_changed)
		var dc := CallManager.get_dread_composure()
		if dc and dc.has_signal("dread_changed"):
			dc.dread_changed.connect(_on_dread_changed)


# ─── Volume control API ───────────────────────────────────────────────


## Convert a volume percentage (0-100) to dB.
static func percent_to_db(percent: float) -> float:
	var clamped := clampf(percent, 0.0, 100.0)
	return lerpf(VOLUME_MIN_DB, VOLUME_MAX_DB, clamped / 100.0)


## Convert dB to a volume percentage (0-100).
static func db_to_percent(db: float) -> float:
	if db <= VOLUME_MIN_DB:
		return 0.0
	if db >= VOLUME_MAX_DB:
		return 100.0
	return (db - VOLUME_MIN_DB) / (VOLUME_MAX_DB - VOLUME_MIN_DB) * 100.0


## Set the volume for a bus key (e.g., "master", "radio") as a percentage 0-100.
func set_volume(bus_key: String, percent: float) -> void:
	_volume_percents[bus_key] = clampf(percent, 0.0, 100.0)
	_apply_volume(bus_key)
	volume_changed.emit(bus_key, _volume_percents[bus_key])


## Get the current volume percentage for a bus key.
func get_volume(bus_key: String) -> float:
	return _volume_percents.get(bus_key, DEFAULT_VOLUMES.get(bus_key, 100.0))


## Apply a single bus volume to the AudioBusManager.
func _apply_volume(bus_key: String) -> void:
	if not VOLUME_TO_BUS_IDX.has(bus_key):
		return
	var bus_idx: int = VOLUME_TO_BUS_IDX[bus_key]
	var base_db := percent_to_db(_volume_percents.get(bus_key, 100.0))

	# Apply reduce-horror offset for dread and stinger
	if reduce_audio_horror:
		if bus_key == VOL_DREAD:
			base_db += REDUCE_HORROR_DREAD_OFFSET
		elif bus_key == VOL_STINGER:
			base_db += REDUCE_HORROR_STINGER_OFFSET

	if AudioBusManager:
		AudioBusManager.set_bus_volume(bus_idx, base_db)


## Apply all volume settings to the AudioBusManager.
func _apply_all_volumes() -> void:
	for key in VOLUME_KEYS:
		_apply_volume(key)


# ─── Reduce audio horror ──────────────────────────────────────────────


## Toggle reduce-audio-horror mode on/off.
func set_reduce_audio_horror(enabled: bool) -> void:
	if reduce_audio_horror == enabled:
		return
	reduce_audio_horror = enabled
	_apply_all_volumes()
	_apply_sub_bass_filter()
	reduce_horror_toggled.emit(enabled)


## Apply or remove the high-pass filter on DREAD_LAYER for sub-bass removal.
func _apply_sub_bass_filter() -> void:
	var dread_idx: int = VOLUME_TO_BUS_IDX[VOL_DREAD]
	if dread_idx >= AudioServer.bus_count:
		return

	if reduce_audio_horror:
		# Add high-pass filter to kill sub-bass rumble
		if _dread_hpf == null:
			_dread_hpf = AudioEffectHighPassFilter.new()
			_dread_hpf.cutoff_hz = SUB_BASS_HPF_CUTOFF
			_dread_hpf.resonance = 0.0
			_dread_hpf_idx = AudioServer.get_bus_effect_count(dread_idx)
			AudioServer.add_bus_effect(dread_idx, _dread_hpf, _dread_hpf_idx)
	else:
		# Remove the high-pass filter if it was added
		if _dread_hpf != null and _dread_hpf_idx >= 0:
			AudioServer.remove_bus_effect(dread_idx, _dread_hpf_idx)
			_dread_hpf = null
			_dread_hpf_idx = -1


# ─── Colorblind audio patterns ───────────────────────────────────────


## Get the noise type for a band in colorblind mode.
func get_band_noise_type(band_id: int) -> NoiseType:
	if not colorblind_patterns:
		return NoiseType.DEFAULT
	return COLORBLIND_NOISE_MAP.get(band_id, NoiseType.DEFAULT)


## Get the band character override dict for colorblind mode (or null if not applicable).
func get_colorblind_band_character(band_id: int) -> Dictionary:
	if not colorblind_patterns:
		return {}
	return COLORBLIND_CHARACTERS.get(band_id, {})


## Toggle colorblind audio patterns on/off.
func set_colorblind_patterns(enabled: bool) -> void:
	if colorblind_patterns == enabled:
		return
	colorblind_patterns = enabled
	colorblind_patterns_toggled.emit(enabled)


# ─── Subtitles ────────────────────────────────────────────────────────


func set_subtitles_enabled(enabled: bool) -> void:
	subtitles_enabled = enabled
	subtitles_toggled.emit(enabled)


func set_subtitle_bg_enabled(enabled: bool) -> void:
	subtitle_bg_enabled = enabled
	subtitle_bg_toggled.emit(enabled)


# ─── Visual cues ─────────────────────────────────────────────────────


func set_visual_cues_enabled(enabled: bool) -> void:
	visual_cues_enabled = enabled
	visual_cues_toggled.emit(enabled)


func set_hearing_impaired_mode(enabled: bool) -> void:
	hearing_impaired_mode = enabled
	hearing_impaired_toggled.emit(enabled)


# ─── Controls ────────────────────────────────────────────────────────


func set_hold_breath_toggle_mode(toggle: bool) -> void:
	hold_breath_toggle_mode = toggle
	hold_breath_mode_toggled.emit(toggle)


func set_pause_anywhere(enabled: bool) -> void:
	pause_anywhere = enabled
	pause_override_toggled.emit(enabled)


# ─── Visual cue state (updated by connected systems) ─────────────────


func is_dead_air_active() -> bool:
	return _dead_air_active


func get_signal_strength() -> float:
	return _signal_strength


func get_dread_level() -> float:
	return _dread_level


func get_heartbeat_bpm() -> float:
	return _heartbeat_bpm


## Compute dread vignette intensity (0.0-1.0) from dread level.
static func compute_dread_vignette(dread: float) -> float:
	return clampf(dread / 100.0, 0.0, 1.0)


## Compute scanline intensity (0.0-1.0) from signal strength.
## Low signal → high scanline intensity, high signal → low intensity.
static func compute_scanline_intensity(signal_val: float) -> float:
	return clampf(1.0 - (signal_val / 100.0), 0.0, 1.0)


## Compute heartbeat visual pulse intensity (0.0-1.0) from dread level.
## No pulse below dread 40 (heartbeat threshold), full at dread 100.
static func compute_heartbeat_pulse(dread: float) -> float:
	if dread <= 40.0:
		return 0.0
	return clampf((dread - 40.0) / 60.0, 0.0, 1.0)


## Compute dead-air screen darken amount (0.0-1.0).
static func compute_dead_air_darken(active: bool) -> float:
	return 0.3 if active else 0.0


# ─── Signal handlers ─────────────────────────────────────────────────


func _on_call_line_displayed(_line_text: String, _caller_name: String) -> void:
	# SubtitleDisplay (child) listens to subtitles_toggled and shows text.
	# This is where the signal fires; the UI child handles display.
	pass


func _on_dead_air_started() -> void:
	_dead_air_active = true
	dead_air_indicator_changed.emit(true)


func _on_dead_air_ended() -> void:
	_dead_air_active = false
	dead_air_indicator_changed.emit(false)


func _on_signal_changed(signal_val: float) -> void:
	_signal_strength = signal_val
	scanline_intensity_changed.emit(compute_scanline_intensity(signal_val))


func _on_dread_changed(dread: float) -> void:
	_dread_level = dread
	_heartbeat_bpm = lerpf(60.0, 120.0, clampf(dread / 100.0, 0.0, 1.0))
	dread_vignette_changed.emit(compute_dread_vignette(dread))
	heartbeat_pulse_changed.emit(compute_heartbeat_pulse(dread))


# ─── DEA-146: Visual accessibility setters ────────────────────────────


## Set camera shake reduction (0, 50, or 100 percent). Clamped to valid levels.
func set_camera_shake_reduction(reduction: int) -> void:
	var clamped: int = reduction
	if clamped not in CAMERA_SHAKE_LEVELS:
		# Snap to nearest valid level
		var best: int = 0
		var best_dist: int = absi(clamped - 0)
		for level in CAMERA_SHAKE_LEVELS:
			var d: int = absi(clamped - level)
			if d < best_dist:
				best = level
				best_dist = d
		clamped = best
	if camera_shake_reduction == clamped:
		return
	camera_shake_reduction = clamped
	camera_shake_reduction_changed.emit(clamped)


## Get the camera shake multiplier (1.0 = full, 0.5 = half, 0.0 = none).
func get_camera_shake_multiplier() -> float:
	return 1.0 - (float(camera_shake_reduction) / 100.0)


## Toggle high contrast mode.
func set_high_contrast_mode(enabled: bool) -> void:
	if high_contrast_mode == enabled:
		return
	high_contrast_mode = enabled
	high_contrast_toggled.emit(enabled)


## Set text size.
func set_text_size(size: TextSize) -> void:
	if text_size == size:
		return
	text_size = size
	text_size_changed.emit(size)


## Get the text size scale factor (1.0, 1.25, 1.5, or 2.0).
func get_text_size_scale() -> float:
	return TEXT_SIZE_SCALES[text_size]


## Toggle screen flash reduction (eliminates CRT roll, cuts flicker ~75%).
func set_screen_flash_reduction(enabled: bool) -> void:
	if screen_flash_reduction == enabled:
		return
	screen_flash_reduction = enabled
	screen_flash_reduction_toggled.emit(enabled)


## Toggle static reduction (cuts analog noise density ~50%).
func set_static_reduction(enabled: bool) -> void:
	if static_reduction == enabled:
		return
	static_reduction = enabled
	static_reduction_toggled.emit(enabled)


## Toggle vignette reduction (reduce/eliminate vignette darkening).
func set_vignette_reduction(enabled: bool) -> void:
	if vignette_reduction == enabled:
		return
	vignette_reduction = enabled
	vignette_reduction_toggled.emit(enabled)


## Toggle CRT effects on/off (master switch).
func set_crt_enabled(enabled: bool) -> void:
	if crt_enabled == enabled:
		return
	crt_enabled = enabled
	crt_toggled.emit(enabled)


## Set difficulty preset.
func set_difficulty_preset(preset: DifficultyPreset) -> void:
	if difficulty_preset == preset:
		return
	difficulty_preset = preset
	difficulty_preset_changed.emit(preset)


# ─── DEA-146: Difficulty preset parameter getters ────────────────────


## Get the composure decay multiplier for the current difficulty preset.
func get_difficulty_composure_decay_mult() -> float:
	return DIFFICULTY_PRESETS[difficulty_preset]["composure_decay_mult"]


## Get the starting dread level for the current difficulty preset.
func get_difficulty_starting_dread() -> float:
	return DIFFICULTY_PRESETS[difficulty_preset]["starting_dread"]


## Get the save frequency multiplier for the current difficulty preset.
func get_difficulty_save_freq_mult() -> float:
	return DIFFICULTY_PRESETS[difficulty_preset]["save_freq_mult"]


## Get the composure start value for the current difficulty preset.
func get_difficulty_composure_start() -> float:
	return DIFFICULTY_PRESETS[difficulty_preset]["composure_start"]


## Check if the current difficulty preset has one-life mode.
func is_one_life() -> bool:
	return DIFFICULTY_PRESETS[difficulty_preset]["one_life"]


## Check if the current difficulty preset disables saves.
func is_no_saves() -> bool:
	return DIFFICULTY_PRESETS[difficulty_preset]["no_saves"]


## Get the difficulty preset name as a string.
func get_difficulty_preset_name() -> String:
	return DifficultyPreset.keys()[difficulty_preset]


# ─── Testing helpers ─────────────────────────────────────────────────


func _reset_for_testing() -> void:
	subtitles_enabled = true
	subtitle_bg_enabled = false
	visual_cues_enabled = false
	colorblind_patterns = false
	hearing_impaired_mode = false
	reduce_audio_horror = false
	hold_breath_toggle_mode = false
	pause_anywhere = false
	_init_default_volumes()
	_dead_air_active = false
	_signal_strength = 80.0
	_dread_level = 0.0
	_heartbeat_bpm = 60.0
	_dread_hpf = null
	_dread_hpf_idx = -1
	# DEA-146: Visual accessibility resets
	camera_shake_reduction = 0
	high_contrast_mode = false
	text_size = TextSize.SMALL
	screen_flash_reduction = false
	static_reduction = false
	vignette_reduction = false
	crt_enabled = true
	difficulty_preset = DifficultyPreset.NORMAL
