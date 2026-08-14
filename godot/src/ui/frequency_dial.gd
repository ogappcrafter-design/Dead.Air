# frequency_dial.gd — Visual radio frequency dial UI
# DEA-97: Radio Tuning System
# Acceptance criterion 5: Visual frequency dial responds to input in real-time.
# Acceptance criterion 6: Audio static changes with frequency offset (closer = clearer).
class_name FrequencyDial
extends Control

## Emitted when the user interacts with the dial (click/drag tuning).
signal dial_tuned(direction: float)

## The RadioTuner node to observe. If null, the dial is decorative only.
@export var radio_tuner: RadioTuner

## SignalStrength node providing cross-pollination-adjusted signal. Overrides raw tuner signal.
@export var signal_strength: SignalStrength

## Dial radius in pixels (the dial is drawn as a circular gauge).
@export var dial_radius: float = 120.0

## Whether to show the signal strength meter below the dial.
@export var show_signal_meter: bool = true

## Whether to show the band name label above the dial.
@export var show_band_label: bool = true

# --- Internal visual components ---

var _freq_label: Label
var _band_label: Label
var _signal_bar: ProgressBar
var _quality_label: Label
var _needle_angle: float = 0.0
var _target_needle_angle: float = 0.0
var _is_dragging: bool = false


func _ready() -> void:
	custom_minimum_size = Vector2(dial_radius * 2 + 40, dial_radius * 2 + 80)
	mouse_filter = Control.MOUSE_FILTER_PASS
	_build_ui()
	if radio_tuner != null:
		radio_tuner.frequency_changed.connect(_on_frequency_changed)
		radio_tuner.band_changed.connect(_on_band_changed)
		radio_tuner.signal_changed.connect(_on_signal_changed)
		radio_tuner.fine_tune_changed.connect(_on_fine_tune_changed)
		_update_from_tuner()
	if signal_strength != null:
		signal_strength.signal_changed.connect(_on_signal_strength_changed)


func _build_ui() -> void:
	# VBox container for the dial + labels
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 4)
	add_child(vbox)

	# Band label (top)
	_band_label = Label.new()
	_band_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_band_label.add_theme_font_size_override("font_size", 18)
	_band_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.85))
	vbox.add_child(_band_label)
	_band_label.visible = show_band_label

	# Frequency label (large, centered)
	_freq_label = Label.new()
	_freq_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_freq_label.add_theme_font_size_override("font_size", 28)
	_freq_label.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))
	vbox.add_child(_freq_label)

	# Dial area (drawn via _draw)
	# We use a custom Control to draw the circular dial.
	var dial_area := Control.new()
	dial_area.custom_minimum_size = Vector2(dial_radius * 2 + 20, dial_radius * 2 + 20)
	dial_area.mouse_filter = Control.MOUSE_FILTER_STOP
	dial_area.gui_input.connect(_on_dial_input)
	vbox.add_child(dial_area)
	_dial_area = dial_area

	# Signal strength bar
	_signal_bar = ProgressBar.new()
	_signal_bar.custom_minimum_size = Vector2(dial_radius * 2, 20)
	_signal_bar.min_value = 0.0
	_signal_bar.max_value = 100.0
	_signal_bar.show_percentage = false
	vbox.add_child(_signal_bar)
	_signal_bar.visible = show_signal_meter

	# Signal quality label
	_quality_label = Label.new()
	_quality_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_quality_label.add_theme_font_size_override("font_size", 14)
	vbox.add_child(_quality_label)
	_quality_label.visible = show_signal_meter


var _dial_area: Control


func _draw() -> void:
	if _dial_area == null or not _dial_area.is_inside_tree():
		return
	# Draw the dial in the dial_area's local space.
	var center := _dial_area.size * 0.5
	var r := dial_radius

	# Outer ring
	draw_arc(center, r, 0.0, TAU, 64, Color(0.3, 0.3, 0.35), 2.0, true)

	# Frequency ticks (every 10 MHz from 80 to 180 = 10 ticks)
	var freq_min_tick: float = 80.0
	var freq_max_tick: float = 180.0
	var tick_count: int = int((freq_max_tick - freq_min_tick) / 10.0)
	for i in range(tick_count + 1):
		var freq: float = freq_min_tick + float(i) * 10.0
		var angle: float = _freq_to_angle(freq)
		var outer := center + Vector2(cos(angle), sin(angle)) * r
		var inner := center + Vector2(cos(angle), sin(angle)) * (r - 12)
		draw_line(inner, outer, Color(0.5, 0.5, 0.55), 1.5)

	# Minor ticks (every 2 MHz)
	for i in range((tick_count * 5) + 1):
		var freq: float = freq_min_tick + float(i) * 2.0
		var angle: float = _freq_to_angle(freq)
		var outer := center + Vector2(cos(angle), sin(angle)) * r
		var inner := center + Vector2(cos(angle), sin(angle)) * (r - 6)
		draw_line(inner, outer, Color(0.35, 0.35, 0.4), 1.0)

	# Band range arcs (color-coded)
	if radio_tuner != null and radio_tuner.band_config != null:
		var band_count: int = radio_tuner.band_config.get_band_count()
		for band_id in range(band_count):
			var band: BandData = radio_tuner.band_config.get_band(band_id)
			if band == null:
				continue
			var a1: float = _freq_to_angle(band.freq_range_min)
			var a2: float = _freq_to_angle(band.freq_range_max)
			# Draw arc for this band's range
			var arc_color: Color = band.color
			arc_color.a = 0.4 if band_id != radio_tuner.current_band_id else 0.8
			draw_arc(center, r + 4, a1, a2, 16, arc_color, 3.0, true)

	# Needle
	var needle_angle_current: float = _needle_angle
	var needle_end := center + Vector2(cos(needle_angle_current), sin(needle_angle_current)) * (r - 8)
	var needle_color: Color = Color(0.9, 0.2, 0.2) if _is_dragging else Color(0.8, 0.8, 0.85)
	draw_line(center, needle_end, needle_color, 2.5, true)
	# Center hub
	draw_circle(center, 4.0, Color(0.5, 0.5, 0.55), true)


func _process(_delta: float) -> void:
	# Smoothly interpolate needle angle toward target.
	if abs(_needle_angle - _target_needle_angle) > 0.001:
		_needle_angle = lerp(_needle_angle, _target_needle_angle, 0.15)
		queue_redraw()


# --- Angle/frequency mapping ---

## Map a frequency to an angle on the dial (0 = right, PI/2 = down).
## Frequencies 80-180 MHz map to 180 degrees (PI radians) of the dial.
func _freq_to_angle(freq: float) -> float:
	var freq_min_tick: float = 80.0
	var freq_max_tick: float = 180.0
	var t: float = clamp((freq - freq_min_tick) / (freq_max_tick - freq_min_tick), 0.0, 1.0)
	# Map to angle starting from -PI*0.75 (top-left) sweeping clockwise to PI*0.25 (right)
	return lerp(-PI * 0.75, PI * 0.25, t)


## Map an angle back to frequency (for click-to-tune).
func _angle_to_freq(angle: float) -> float:
	var freq_min_tick: float = 80.0
	var freq_max_tick: float = 180.0
	# Normalize angle to the dial range
	var t: float = (angle - (-PI * 0.75)) / (PI * 0.25 - (-PI * 0.75))
	t = clamp(t, 0.0, 1.0)
	return lerp(freq_min_tick, freq_max_tick, t)


# --- Input handling ---

func _on_dial_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_is_dragging = true
				_handle_dial_position(event.position)
			else:
				_is_dragging = false
			queue_redraw()
	elif event is InputEventMouseMotion and _is_dragging:
		_handle_dial_position(event.position)


func _handle_dial_position(local_pos: Vector2) -> void:
	if _dial_area == null:
		return
	var center := _dial_area.size * 0.5
	var angle: float = (local_pos - center).angle()
	var freq: float = _angle_to_freq(angle)
	# Snap to TUNE_STEP increments
	freq = round(freq / RadioTuner.TUNE_STEP) * RadioTuner.TUNE_STEP
	if radio_tuner != null:
		radio_tuner.set_frequency(freq)


# --- RadioTuner signal handlers ---

func _on_frequency_changed(freq: float) -> void:
	_freq_label.text = "%.1f MHz" % freq
	_target_needle_angle = _freq_to_angle(freq)
	queue_redraw()


func _on_band_changed(band_id: int) -> void:
	_update_from_tuner()


func _on_signal_changed(signal_value: float) -> void:
	if signal_strength == null:
		_signal_bar.value = signal_value
		_update_quality_label(signal_value)


func _on_signal_strength_changed(signal_value: float) -> void:
	_signal_bar.value = signal_value
	_update_quality_label(signal_value)


func _on_fine_tune_changed(active: bool) -> void:
	if active:
		_freq_label.add_theme_color_override("font_color", Color(0.5, 0.8, 1.0))
	else:
		_freq_label.add_theme_color_override("font_color", Color(0.9, 0.9, 0.95))


# --- Update helpers ---

func _update_from_tuner() -> void:
	if radio_tuner == null:
		return
	var band: BandData = radio_tuner.get_current_band()
	if band != null:
		_band_label.text = band.name
		_band_label.add_theme_color_override("font_color", band.color)
	_freq_label.text = "%.1f MHz" % radio_tuner.current_frequency
	_target_needle_angle = _freq_to_angle(radio_tuner.current_frequency)
	if signal_strength != null:
		var ssig: float = signal_strength.signal_value
		_signal_bar.value = ssig
		_update_quality_label(ssig)
	else:
		var sig: float = radio_tuner.get_signal()
		_signal_bar.value = sig
		_update_quality_label(sig)
	queue_redraw()


func _update_quality_label(signal_value: float) -> void:
	if radio_tuner == null:
		return
	var quality: int = radio_tuner.get_signal_quality()
	match quality:
		RadioTuner.SignalQuality.CLEAR:
			_quality_label.text = "CLEAR"
			_quality_label.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))
		RadioTuner.SignalQuality.GARBLED:
			_quality_label.text = "GARBLED"
			_quality_label.add_theme_color_override("font_color", Color(0.9, 0.8, 0.2))
		RadioTuner.SignalQuality.FRAGMENTS:
			_quality_label.text = "FRAGMENTS"
			_quality_label.add_theme_color_override("font_color", Color(0.8, 0.5, 0.2))
		RadioTuner.SignalQuality.DEAD_AIR:
			_quality_label.text = "DEAD AIR"
			_quality_label.add_theme_color_override("font_color", Color(0.5, 0.2, 0.2))
