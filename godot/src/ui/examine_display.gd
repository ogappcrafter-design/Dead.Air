class_name ExamineDisplay
extends Control
## Full-screen overlay that displays examination text with a CRT typewriter effect.
## Dismissed on any input. Listens to InteractionRaycast.examine_performed.

@export var typewriter_speed: float = 30.0  # characters per second
@export var fade_duration: float = 0.15

var _label: Label
var _panel: Panel
var _full_text: String
var _char_accum: float
var _tween: Tween
var _is_active: bool
var _is_typing: bool


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)
	modulate.a = 0.0

	_panel = Panel.new()
	_panel.name = "ExaminePanel"
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.add_theme_stylebox_override("panel", StyleBoxFlat.new())
	var style: StyleBoxFlat = _panel.get_theme_stylebox("panel")
	style.bg_color = Color(0.02, 0.02, 0.02, 0.85)
	style.content_margin_left = 60.0
	style.content_margin_right = 60.0
	style.content_margin_top = 40.0
	style.content_margin_bottom = 40.0
	add_child(_panel)

	_label = Label.new()
	_label.name = "ExamineLabel"
	_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.text = ""
	CRTText.style_phosphor_green(_label, 22)
	_panel.add_child(_label)


func show_text(text: String) -> void:
	if text.is_empty():
		return
	_full_text = text
	_char_accum = 0.0
	_label.text = ""
	_is_active = true
	_is_typing = true
	_fade_in()
	set_process(true)
	set_process_input(true)


func dismiss() -> void:
	if not _is_active:
		return
	_is_active = false
	_is_typing = false
	_fade_out()
	set_process(false)
	set_process_input(false)


func _process(delta: float) -> void:
	if _is_typing and _char_accum < _full_text.length():
		_char_accum += typewriter_speed * delta
		if _char_accum >= _full_text.length():
			_char_accum = _full_text.length()
			_is_typing = false
		_label.text = _full_text.substr(0, int(_char_accum))


func _input(event: InputEvent) -> void:
	if not _is_active:
		return
	if event is InputEventKey and event.pressed:
		if _is_typing:
			# Skip typewriter — show full text immediately
			_char_accum = _full_text.length()
			_label.text = _full_text
			_is_typing = false
		else:
			dismiss()
		get_viewport().set_input_as_handled()
	elif event is InputEventJoypadButton and event.pressed:
		if _is_typing:
			_char_accum = _full_text.length()
			_label.text = _full_text
			_is_typing = false
		else:
			dismiss()
		get_viewport().set_input_as_handled()


func _fade_in() -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 1.0, fade_duration)


func _fade_out() -> void:
	if _tween:
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 0.0, fade_duration)
