## VisualAudioCues
## Visual overlay for audio accessibility cues (DEA-141).
## Shows: dead air darken, signal strength meter, dread vignette,
##        heartbeat pulse (hearing impaired), scanline intensity.
## All cues toggle via AccessibilityManager.visual_cues_enabled and
## hearing_impaired_mode.
## Reference: DEA-141, GDD §Accessibility — "Visual indicators for audio-only events"
extends Control

# ─── Visual constants ────────────────────────────────────────────────
const PHOSPHOR_GREEN := Color(0.0, 1.0, 0.255)  # #00FF41
const AMBER := Color(1.0, 0.647, 0.0)  # #FFA500
const BLOOD_RED := Color(1.0, 0.2, 0.0)  # #FF3300
const DEAD_AIR_DARKEN := Color(0.0, 0.0, 0.0, 0.3)  # 30% darken

const METER_WIDTH := 180.0
const METER_HEIGHT := 6.0
const METER_MARGIN := 20.0
const VIGNETTE_MAX_ALPHA := 0.6
const HEARTBEAT_PULSE_SPEED := 8.0  # How fast the pulse fades
const SCANLINE_MAX_ALPHA := 0.3

# ─── Nodes ───────────────────────────────────────────────────────────
var _dead_air_overlay: ColorRect = null
var _signal_meter_bg: ColorRect = null
var _signal_meter_fill: ColorRect = null
var _signal_label: Label = null
var _dread_vignette: ColorRect = null
var _heartbeat_overlay: ColorRect = null
var _scanline_overlay: ColorRect = null

# ─── State ────────────────────────────────────────────────────────────
var _dead_air_active: bool = false
var _signal_strength: float = 80.0
var _dread_level: float = 0.0
var _heartbeat_bpm: float = 60.0
var _heartbeat_pulse: float = 0.0  # Current pulse intensity (0-1)
var _heartbeat_phase: float = 0.0  # Accumulated time for heartbeat
var _scanline_intensity: float = 0.0

# ─── Lifecycle ────────────────────────────────────────────────────────


func _ready() -> void:
	_setup_ui()
	_connect_signals()


func _process(delta: float) -> void:
	_update_heartbeat_pulse(delta)
	_update_ui()


# ─── UI Setup ─────────────────────────────────────────────────────────


func _setup_ui() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Dead air darkening overlay (full screen)
	_dead_air_overlay = ColorRect.new()
	_dead_air_overlay.name = "DeadAirOverlay"
	_dead_air_overlay.color = DEAD_AIR_DARKEN
	_dead_air_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dead_air_overlay.visible = false
	add_child(_dead_air_overlay)

	# Dread vignette (edge darkening, simulated via ColorRect)
	_dread_vignette = ColorRect.new()
	_dread_vignette.name = "DreadVignette"
	_dread_vignette.color = Color(0.0, 0.0, 0.0, 0.0)
	_dread_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dread_vignette.visible = false
	add_child(_dread_vignette)

	# Heartbeat pulse overlay (screen edges)
	_heartbeat_overlay = ColorRect.new()
	_heartbeat_overlay.name = "HeartbeatPulse"
	_heartbeat_overlay.color = Color(1.0, 0.0, 0.0, 0.0)
	_heartbeat_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_heartbeat_overlay.visible = false
	add_child(_heartbeat_overlay)

	# Scanline overlay (hearing impaired — radio static representation)
	_scanline_overlay = ColorRect.new()
	_scanline_overlay.name = "ScanlineOverlay"
	_scanline_overlay.color = Color(0.0, 0.0, 0.0, 0.0)
	_scanline_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_scanline_overlay.visible = false
	add_child(_scanline_overlay)

	# Signal strength meter (bottom-right, always visible when cues on)
	_signal_meter_bg = ColorRect.new()
	_signal_meter_bg.name = "SignalMeterBG"
	_signal_meter_bg.color = Color(0.0, 0.0, 0.0, 0.5)
	_signal_meter_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_signal_meter_bg.visible = false
	add_child(_signal_meter_bg)

	_signal_meter_fill = ColorRect.new()
	_signal_meter_fill.name = "SignalMeterFill"
	_signal_meter_fill.color = PHOSPHOR_GREEN
	_signal_meter_fill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_signal_meter_fill.visible = false
	add_child(_signal_meter_fill)

	_signal_label = Label.new()
	_signal_label.name = "SignalLabel"
	_signal_label.text = "SIG"
	_signal_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)
	_signal_label.add_theme_font_size_override("font_size", 12)
	_signal_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_signal_label.visible = false
	add_child(_signal_label)

	_layout_elements()


func _layout_elements() -> void:
	var screen_size := get_viewport_rect().size if get_viewport() else Vector2(1920, 1080)

	# Full-screen overlays
	for overlay in [_dead_air_overlay, _dread_vignette, _heartbeat_overlay, _scanline_overlay]:
		overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
		overlay.position = Vector2.ZERO
		overlay.size = screen_size

	# Signal meter: bottom-right corner
	var meter_x := screen_size.x - METER_WIDTH - METER_MARGIN
	var meter_y := screen_size.y - METER_MARGIN - METER_HEIGHT - 20

	_signal_meter_bg.position = Vector2(meter_x - 4, meter_y - 4)
	_signal_meter_bg.size = Vector2(METER_WIDTH + 8, METER_HEIGHT + 8)

	_signal_meter_fill.position = Vector2(meter_x, meter_y)
	_signal_meter_fill.size = Vector2(METER_WIDTH, METER_HEIGHT)

	_signal_label.position = Vector2(meter_x, meter_y - 18)
	_signal_label.size = Vector2(METER_WIDTH, 16)


func _connect_signals() -> void:
	if AccessibilityManager:
		AccessibilityManager.visual_cues_toggled.connect(_on_visual_cues_toggled)
		AccessibilityManager.hearing_impaired_toggled.connect(_on_hearing_impaired_toggled)
		AccessibilityManager.dead_air_indicator_changed.connect(_on_dead_air_changed)
		AccessibilityManager.dread_vignette_changed.connect(_on_dread_vignette_changed)
		AccessibilityManager.heartbeat_pulse_changed.connect(_on_heartbeat_pulse_changed)
		AccessibilityManager.scanline_intensity_changed.connect(_on_scanline_changed)


# ─── Update loop ──────────────────────────────────────────────────────


func _update_heartbeat_pulse(delta: float) -> void:
	if not _is_heartbeat_active():
		_heartbeat_pulse = 0.0
		return

	# Heartbeat: double-beat pattern (lub-dub) at BPM rate
	var beat_interval := 60.0 / maxf(_heartbeat_bpm, 1.0)
	_heartbeat_phase += delta
	if _heartbeat_phase >= beat_interval:
		_heartbeat_phase = fmod(_heartbeat_phase, beat_interval)

	# Pulse envelope: sharp rise, quick decay within each beat
	var t := _heartbeat_phase / beat_interval
	if t < 0.1:
		_heartbeat_pulse = t / 0.1  # Quick rise (lub)
	elif t < 0.2:
		_heartbeat_pulse = 1.0 - (t - 0.1) / 0.1 * 0.5  # Partial decay
	elif t < 0.3:
		_heartbeat_pulse = 0.5 + (t - 0.2) / 0.1 * 0.5  # Second beat (dub)
	else:
		_heartbeat_pulse = maxf(0.0, 1.0 - (t - 0.3) / 0.7)  # Slow decay


func _update_ui() -> void:
	var cues_on: bool = AccessibilityManager and AccessibilityManager.visual_cues_enabled

	# Dead air overlay
	_dead_air_overlay.visible = cues_on and _dead_air_active

	# Dread vignette
	if cues_on and _dread_level > 0.0:
		var v := AccessibilityManager.compute_dread_vignette(_dread_level)
		var vignette_alpha := v * VIGNETTE_MAX_ALPHA
		_dread_vignette.color = Color(0.0, 0.0, 0.0, vignette_alpha)
		_dread_vignette.visible = true
	else:
		_dread_vignette.visible = false

	# Signal meter (always visible when cues on)
	_signal_meter_bg.visible = cues_on
	_signal_meter_fill.visible = cues_on
	_signal_label.visible = cues_on
	if cues_on:
		if AccessibilityManager:
			_signal_strength = AccessibilityManager.get_signal_strength()
		var fill_width := METER_WIDTH * clampf(_signal_strength / 100.0, 0.0, 1.0)
		_signal_meter_fill.size.x = fill_width
		# Color: green (strong) → amber (medium) → red (weak)
		if _signal_strength > 50.0:
			_signal_meter_fill.color = PHOSPHOR_GREEN
		elif _signal_strength > 20.0:
			_signal_meter_fill.color = AMBER
		else:
			_signal_meter_fill.color = BLOOD_RED

	# Heartbeat pulse (hearing impaired only)
	if _is_heartbeat_active():
		var pulse_alpha := _heartbeat_pulse * 0.3
		_heartbeat_overlay.color = Color(1.0, 0.0, 0.0, pulse_alpha)
		_heartbeat_overlay.visible = pulse_alpha > 0.01
	else:
		_heartbeat_overlay.visible = false

	# Scanline overlay (hearing impaired — radio static representation)
	if _is_hearing_impaired_active():
		var scan_alpha := _scanline_intensity * SCANLINE_MAX_ALPHA
		_scanline_overlay.color = Color(0.0, 0.0, 0.0, scan_alpha)
		_scanline_overlay.visible = scan_alpha > 0.01
	else:
		_scanline_overlay.visible = false


# ─── Helpers ─────────────────────────────────────────────────────────


func _is_heartbeat_active() -> bool:
	return (
		AccessibilityManager
		and AccessibilityManager.visual_cues_enabled
		and AccessibilityManager.hearing_impaired_mode
	)


func _is_hearing_impaired_active() -> bool:
	return (
		AccessibilityManager
		and AccessibilityManager.visual_cues_enabled
		and AccessibilityManager.hearing_impaired_mode
	)


# ─── Signal handlers ─────────────────────────────────────────────────


func _on_visual_cues_toggled(_enabled: bool) -> void:
	_update_ui()


func _on_hearing_impaired_toggled(_enabled: bool) -> void:
	_update_ui()


func _on_dead_air_changed(active: bool) -> void:
	_dead_air_active = active


func _on_dread_vignette_changed(_intensity: float) -> void:
	_dread_level = AccessibilityManager.get_dread_level()


func _on_heartbeat_pulse_changed(_intensity: float) -> void:
	_heartbeat_bpm = AccessibilityManager.get_heartbeat_bpm()


func _on_scanline_changed(intensity: float) -> void:
	_scanline_intensity = intensity


# ─── Resize handling ─────────────────────────────────────────────────


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_layout_elements()
