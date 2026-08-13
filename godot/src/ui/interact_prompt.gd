class_name InteractPrompt
extends Control
## CRT-styled interaction prompt shown at bottom-left of the screen.
## Listens to InteractionRaycast.target_changed and fades in/out.
## Uses CRTText styling for the horror aesthetic.

@export var fade_duration: float = 0.2
@export var offset_from_bottom: float = 80.0
@export var offset_from_left: float = 40.0

var _label: Label
var _tween: Tween
var _visible: bool = false


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	anchor_left = 0.0
	anchor_top = 1.0
	anchor_right = 0.0
	anchor_bottom = 1.0
	offset_left = offset_from_left
	offset_top = -offset_from_bottom - 30
	offset_right = offset_from_left + 400
	offset_bottom = -offset_from_bottom
	modulate.a = 0.0

	_label = Label.new()
	_label.name = "PromptLabel"
	_label.position = Vector2.ZERO
	_label.size = Vector2(400, 30)
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	CRTText.style_phosphor_green(_label, 18)
	add_child(_label)


func show_prompt(text: String) -> void:
	if text.is_empty():
		hide_prompt()
		return
	_label.text = text
	if not _visible:
		_visible = true
		_fade_in()


func hide_prompt() -> void:
	if _visible:
		_visible = false
		_fade_out()


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
