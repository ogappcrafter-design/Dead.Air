## CorruptionScreen — CRT static "THIS TAPE IS DAMAGED" screen shown when save is tampered.
## Part of DEA-153 save system. Shown when corruption is detected on load.
## See: DEA-153 brief, acceptance criterion 9.
class_name CorruptionScreen
extends Control

## Emitted when the player acknowledges the corruption (clicks/taps to continue).
signal acknowledged

## Label displaying the corruption message (assigned in _setup_message).
var _message_label: Label

## Timer for static animation.
var _static_timer: Timer

## AnimationPlayer for CRT static effect.
var _static_player: AnimationPlayer

## How long to show the corruption screen before allowing dismissal (seconds).
@export var display_duration: float = 3.0


func _ready() -> void:
	_setup_static_background()
	_setup_message()
	_setup_timer()


func _setup_static_background() -> void:
	# Create a SubViewport with noise texture for CRT static effect
	var container := CenterContainer.new()
	container.name = "StaticContainer"
	container.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(container)

	# Create a ColorRect for the dark background
	var bg := ColorRect.new()
	bg.color = Color.BLACK
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	container.add_child(bg)

	# Create an AnimationPlayer for static noise animation
	_static_player = AnimationPlayer.new()
	add_child(_static_player)


func _setup_message() -> void:
	# Find or create the message label
	var vbox := VBoxContainer.new()
	vbox.name = "VBoxContainer"
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER

	var center := CenterContainer.new()
	center.name = "CenterContainer"
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	center.add_child(vbox)

	var label := Label.new()
	label.name = "MessageLabel"
	_message_label = label
	label.text = "THIS TAPE IS DAMAGED"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 48)
	label.add_theme_color_override("font_color", Color(0.8, 0.1, 0.1))
	# CRT-style glitchy appearance
	label.add_theme_color_override("font_shadow_color", Color(1, 0, 0, 0.5))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 0)
	label.add_theme_constant_override("shadow_outline_size", 1)

	vbox.add_child(label)

	# Add subtitle
	var subtitle := Label.new()
	subtitle.text = "The data on this tape cannot be read."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 16)
	subtitle.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
	vbox.add_child(subtitle)

	# Add continue prompt
	var prompt := Label.new()
	prompt.text = "Press any key to continue..."
	prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt.add_theme_font_size_override("font_size", 14)
	prompt.add_theme_color_override("font_color", Color(0.3, 0.3, 0.3))
	vbox.add_child(prompt)


func _setup_timer() -> void:
	_static_timer = Timer.new()
	_static_timer.wait_time = 0.08
	_static_timer.timeout.connect(_on_static_tick)
	add_child(_static_timer)
	_static_timer.start()

	# Auto-hide timer
	var auto_hide := Timer.new()
	auto_hide.name = "AutoHideTimer"
	auto_hide.wait_time = display_duration
	auto_hide.one_shot = true
	auto_hide.timeout.connect(_on_display_complete)
	add_child(auto_hide)
	auto_hide.start()


var _flicker_state := false
func _on_static_tick() -> void:
	# Flicker the message for CRT effect
	_flicker_state = not _flicker_state
	if _message_label:
		_message_label.modulate.a = 1.0 if _flicker_state else 0.7


func _on_display_complete() -> void:
	_static_timer.stop()
	if _message_label:
		_message_label.modulate.a = 1.0


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		acknowledged.emit()
		get_viewport().set_input_as_handled()
