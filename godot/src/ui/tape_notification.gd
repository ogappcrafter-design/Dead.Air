class_name TapeNotification
extends Control

## HUD toast notification for tape collection feedback.
## Shows tape name on collection, fades out after 3 seconds.

@export var display_duration: float = 3.0
@export var fade_in_duration: float = 0.3
@export var fade_out_duration: float = 0.5
@export var notification_offset: Vector2 = Vector2(20, 20)

var _label: Label = null
var _bg: ColorRect = null
var _tween: Tween = null
var _current_tape_id: String = ""


func _ready() -> void:
	_build_ui()
	visible = false

	# Connect to TapeInventory signal
	TapeInventory.tape_collected.connect(_on_tape_collected)

	set_process(false)


func _build_ui() -> void:
	# Position at top-left
	anchors_preset = Control.PRESET_TOP_LEFT
	position = notification_offset

	# Background
	_bg = ColorRect.new()
	_bg.color = Color(0.05, 0.1, 0.08, 0.8)
	_bg.custom_minimum_size = Vector2(300, 60)
	add_child(_bg)

	# Label
	_label = Label.new()
	_label.position = Vector2(12, 8)
	_label.add_theme_font_size_override("font_size", 18)
	_label.add_theme_color_override("font_color", Color(0.4, 0.8, 0.6))
	_label.custom_minimum_size = Vector2(276, 44)
	_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(_label)


func _on_tape_collected(tape_id: String) -> void:
	show_notification(tape_id)


func show_notification(tape_id: String) -> void:
	_current_tape_id = tape_id

	# Load tape data for display
	var library := load("res://src/data/tapes.tres") as TapeLibrary
	if library:
		var data := library.get_tape_by_id(tape_id)
		if data:
			_label.text = "TAPE COLLECTED\n%s - %s" % [data.display_name, data.title]
		else:
			_label.text = "TAPE COLLECTED\n%s" % tape_id
	else:
		_label.text = "TAPE COLLECTED\n%s" % tape_id

	# Cancel any existing tween
	if _tween:
		_tween.kill()

	# Show and fade in
	visible = true
	modulate.a = 0.0
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 1.0, fade_in_duration)
	# Hold for display duration
	_tween.tween_interval(display_duration)
	# Fade out
	_tween.tween_property(self, "modulate:a", 0.0, fade_out_duration)
	# Hide
	_tween.tween_callback(func(): visible = false)

	set_process(true)


func hide_notification() -> void:
	if _tween:
		_tween.kill()
	visible = false
	modulate.a = 0.0
	set_process(false)


func is_showing() -> bool:
	return visible


func get_current_tape_id() -> String:
	return _current_tape_id
