## settings.gd — CRT-styled settings screen for Dead Air.
## DEA-190: exposes every option AccessibilityManager implements, built in code so
## an option cannot drift out of sync with the manager. Groups: volume (all six
## buses), audio accessibility, video accessibility, difficulty.
extends Control

const MENU_SCENE := "res://scenes/main_menu.tscn"
const ControlsRemapScreen := preload("res://src/ui/controls_remap_screen.gd")

signal back_to_menu

var _sliders: Dictionary = {}
var _checks: Dictionary = {}
var _sections: VBoxContainer
var _remap_screen: Control
var _remap_layer: CanvasLayer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_sections = $Panel/Frame/VBox/Scroll/Sections
	_build()
	_load_from_accessibility()


func _build() -> void:
	_section("VOLUME")
	for bus_key in AccessibilityManager.VOLUME_KEYS:
		_slider(bus_key, bus_key.capitalize(), 0.0, 100.0, 1.0,
			func(v: float) -> void: AccessibilityManager.set_volume(bus_key, v))

	_section("AUDIO")
	_check("subtitles", "Subtitles",
		func(on: bool) -> void: AccessibilityManager.set_subtitles_enabled(on))
	_check("subtitle_bg", "Subtitle background",
		func(on: bool) -> void: AccessibilityManager.set_subtitle_bg_enabled(on))
	_check("visual_cues", "Visual audio cues (flashes, edges)",
		func(on: bool) -> void: AccessibilityManager.set_visual_cues_enabled(on))
	_check("colorblind", "Colorblind audio patterns",
		func(on: bool) -> void: AccessibilityManager.set_colorblind_patterns(on))
	_check("hearing_impaired", "Hearing-impaired mix",
		func(on: bool) -> void: AccessibilityManager.set_hearing_impaired_mode(on))
	_check("radio_text", "Radio text mode (typed dialogue)",
		func(on: bool) -> void: AccessibilityManager.set_radio_text_mode(on))
	_check("reduce_horror", "Reduce audio horror",
		func(on: bool) -> void: AccessibilityManager.set_reduce_horror(on))
	_check("hold_breath_toggle", "Hold breath is a toggle",
		func(on: bool) -> void: AccessibilityManager.set_hold_breath_toggle_mode(on))
	_check("pause_anywhere", "Allow pause anywhere",
		func(on: bool) -> void: AccessibilityManager.set_pause_anywhere(on))

	_section("VIDEO")
	_slider("camera_shake", "Camera shake reduction", 0.0, 100.0, 50.0,
		func(v: float) -> void: AccessibilityManager.set_camera_shake_reduction(int(v)), 50.0)
	_check("high_contrast", "High contrast",
		func(on: bool) -> void: AccessibilityManager.set_high_contrast_mode(on))
	_slider("text_size", "Text size (S / M / L / XL)", 0.0, 3.0, 1.0,
		func(v: float) -> void: AccessibilityManager.set_text_size(int(v)))
	_check("flash_reduction", "Reduce screen flashes",
		func(on: bool) -> void: AccessibilityManager.set_screen_flash_reduction(on))
	_check("static_reduction", "Reduce static",
		func(on: bool) -> void: AccessibilityManager.set_static_reduction(on))
	_check("vignette_reduction", "Reduce vignette",
		func(on: bool) -> void: AccessibilityManager.set_vignette_reduction(on))
	_check("crt", "CRT overlay",
		func(on: bool) -> void: AccessibilityManager.set_crt_enabled(on))

	_section("DIFFICULTY")
	_slider("difficulty", "Preset (0 Easy / 1 Normal / 2 Hard / 3 Dead Air)", 0.0, 3.0, 1.0,
		func(v: float) -> void: AccessibilityManager.set_difficulty_preset(int(v)))

	_section("CONTROLS")
	var remap_btn := Button.new()
	remap_btn.text = "REMAP CONTROLS"
	remap_btn.pressed.connect(_on_open_remap)
	_sections.add_child(remap_btn)

	var back := Button.new()
	back.text = "BACK"
	back.pressed.connect(_on_back)
	$Panel/Frame/VBox.add_child(back)


func _section(title: String) -> void:
	var label := Label.new()
	label.text = title
	_sections.add_child(label)


func _row(text: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	var label := Label.new()
	label.text = text
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	_sections.add_child(row)
	return row


func _slider(key: String, text: String, lo: float, hi: float, step: float,
		on_change: Callable, initial: float = 0.0) -> HSlider:
	var slider := HSlider.new()
	slider.min_value = lo
	slider.max_value = hi
	slider.step = step
	slider.value = initial
	slider.custom_minimum_size = Vector2(200, 0)
	slider.value_changed.connect(on_change)
	_row(text).add_child(slider)
	_sliders[key] = slider
	return slider


func _check(key: String, text: String, on_toggle: Callable) -> CheckButton:
	var button := CheckButton.new()
	button.text = "on"
	button.toggled.connect(on_toggle)
	_row(text).add_child(button)
	_checks[key] = button
	return button


## One-shot pull of live state into the widgets, so opening the panel never
## fires a change just by reflecting what is already set.
func _load_from_accessibility() -> void:
	for bus_key in AccessibilityManager.VOLUME_KEYS:
		(_sliders[bus_key] as HSlider).set_value_no_signal(AccessibilityManager.get_volume(bus_key))
	(_checks["subtitles"] as CheckButton).set_pressed_no_signal(AccessibilityManager.subtitles_enabled)
	(_checks["subtitle_bg"] as CheckButton).set_pressed_no_signal(AccessibilityManager.subtitle_bg_enabled)
	(_checks["visual_cues"] as CheckButton).set_pressed_no_signal(AccessibilityManager.visual_cues_enabled)
	(_checks["colorblind"] as CheckButton).set_pressed_no_signal(AccessibilityManager.colorblind_patterns)
	(_checks["hearing_impaired"] as CheckButton).set_pressed_no_signal(AccessibilityManager.hearing_impaired_mode)
	(_checks["radio_text"] as CheckButton).set_pressed_no_signal(AccessibilityManager.radio_text_mode)
	(_checks["reduce_horror"] as CheckButton).set_pressed_no_signal(AccessibilityManager.reduce_audio_horror)
	(_checks["hold_breath_toggle"] as CheckButton).set_pressed_no_signal(AccessibilityManager.hold_breath_toggle_mode)
	(_checks["pause_anywhere"] as CheckButton).set_pressed_no_signal(AccessibilityManager.pause_anywhere)
	(_sliders["camera_shake"] as HSlider).set_value_no_signal(float(AccessibilityManager.camera_shake_reduction))
	(_checks["high_contrast"] as CheckButton).set_pressed_no_signal(AccessibilityManager.high_contrast_mode)
	(_sliders["text_size"] as HSlider).set_value_no_signal(float(AccessibilityManager.text_size))
	(_checks["flash_reduction"] as CheckButton).set_pressed_no_signal(AccessibilityManager.screen_flash_reduction)
	(_checks["static_reduction"] as CheckButton).set_pressed_no_signal(AccessibilityManager.static_reduction)
	(_checks["vignette_reduction"] as CheckButton).set_pressed_no_signal(AccessibilityManager.vignette_reduction)
	(_checks["crt"] as CheckButton).set_pressed_no_signal(AccessibilityManager.crt_enabled)
	(_sliders["difficulty"] as HSlider).set_value_no_signal(float(AccessibilityManager.difficulty_preset))


func _on_back() -> void:
	back_to_menu.emit()
	if is_inside_tree():
		get_tree().change_scene_to_file(MENU_SCENE)


func _on_open_remap() -> void:
	if _remap_screen != null and is_instance_valid(_remap_screen):
		return  # one instance at a time
	var remap_screen := ControlsRemapScreen.new()
	remap_screen.back_pressed.connect(_close_remap)
	_remap_screen = remap_screen
	# Host the overlay outside the Settings root's GUI propagation chain:
	# the Settings Control is MOUSE_FILTER_STOP and would eat the empty-space
	# clicks the rebind capture needs to fall through to unhandled input.
	_remap_layer = CanvasLayer.new()
	_remap_layer.layer = 10
	_remap_layer.add_child(remap_screen)
	add_child(_remap_layer)


func _close_remap() -> void:
	if _remap_layer != null and is_instance_valid(_remap_layer):
		_remap_layer.queue_free()
	_remap_layer = null
	if _remap_screen != null and is_instance_valid(_remap_screen):
		_remap_screen.queue_free()
	_remap_screen = null


## Test hook: number of interactive options on the screen.
func option_count() -> int:
	return _sliders.size() + _checks.size()
