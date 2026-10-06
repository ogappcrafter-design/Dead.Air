class_name TutorialOverlay
extends Control

## Dismissible CRT-styled tutorial overlay.
## Shows a title + body message with phosphor green text on a dark panel.
## Dismissed by clicking or pressing any key. Emits [signal dismissed].

signal dismissed

var _title_label: Label
var _body_label: Label
var _hint_label: Label
var _panel: Panel
var _active: bool = false

const PHOSPHOR_GREEN := Color(0.4, 1.0, 0.4, 1.0)
const PHOSPHOR_DIM := Color(0.3, 0.7, 0.3, 0.8)
const PANEL_BG := Color(0.02, 0.05, 0.02, 0.92)
const PANEL_BORDER := Color(0.3, 0.6, 0.3, 0.6)

const OVERLAY_Z_INDEX := 100

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = OVERLAY_Z_INDEX
	visible = false
	_build_ui()

func _build_ui() -> void:
	# Full-screen dim background
	var bg := ColorRect.new()
	bg.name = "Background"
	bg.color = Color(0.0, 0.0, 0.0, 0.55)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	# Centered panel
	_panel = Panel.new()
	_panel.name = "Panel"
	_panel.set_anchors_preset(Control.PRESET_CENTER)
	_panel.custom_minimum_size = Vector2(480, 0)
	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = PANEL_BG
	panel_style.border_color = PANEL_BORDER
	panel_style.border_width_left = 2
	panel_style.border_width_right = 2
	panel_style.border_width_top = 2
	panel_style.border_width_bottom = 2
	panel_style.content_margin_left = 24
	panel_style.content_margin_right = 24
	panel_style.content_margin_top = 20
	panel_style.content_margin_bottom = 20
	_panel.add_theme_stylebox_override("panel", panel_style)
	add_child(_panel)

	var vbox := VBoxContainer.new()
	vbox.name = "VBox"
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 12)
	_panel.add_child(vbox)

	# Title label
	_title_label = Label.new()
	_title_label.name = "TitleLabel"
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_font_size_override("font_size", 22)
	_title_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)
	vbox.add_child(_title_label)

	# Body label
	_body_label = Label.new()
	_body_label.name = "BodyLabel"
	_body_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_body_label.add_theme_font_size_override("font_size", 15)
	_body_label.add_theme_color_override("font_color", PHOSPHOR_DIM)
	_body_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body_label.custom_minimum_size = Vector2(0, 40)
	vbox.add_child(_body_label)

	# Dismiss hint
	_hint_label = Label.new()
	_hint_label.name = "HintLabel"
	_hint_label.text = "[ click or press any key to continue ]"
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.add_theme_font_size_override("font_size", 12)
	_hint_label.add_theme_color_override("font_color", Color(0.3, 0.5, 0.3, 0.5))
	vbox.add_child(_hint_label)

func show_message(title: String, body: String) -> void:
	_title_label.text = title
	_body_label.text = body
	visible = true
	_active = true

func hide_overlay() -> void:
	visible = false
	_active = false

func is_active() -> bool:
	return _active

func _input(event: InputEvent) -> void:
	if not _active:
		return
	if event is InputEventKey and event.pressed:
		_dismiss()
	elif event is InputEventMouseButton and event.pressed:
		_dismiss()

func _dismiss() -> void:
	hide_overlay()
	dismissed.emit()
	get_viewport().set_input_as_handled()
