## CassetteTapeVisual — Visual representation of a cassette tape for the save/load screen.
## Draws a cassette tape icon with label, used state, and interaction feedback.
## Part of DEA-153 save system. Acceptance criterion 8: visual cassette selection, not file names.
class_name CassetteTapeVisual
extends Control

signal tape_selected(tape_id: String)
signal tape_hovered(tape_id: String)

## The tape ID this visual represents.
@export var tape_id: String = ""

## Display name for the tape (from TapeData).
@export var display_name: String = "Untitled Tape"

## Whether this tape has been used (consumed).
@export var is_used: bool = false

## Whether this tape is available for saving (in inventory).
@export var is_available: bool = false

## Whether this tape has a save file on disk.
@export var has_save: bool = false

## Whether the tape is corrupted (failed validation).
@export var is_corrupted: bool = false

## Subtitle metadata for the save (phase/shift).
@export var save_subtitle: String = ""

# Visual components
var _panel: Panel
var _tape_icon: TextureRect
var _name_label: Label
var _status_label: Label
var _subtitle_label: Label
var _hover_tween: Tween


func _ready() -> void:
	_build_ui()
	mouse_filter = Control.MOUSE_FILTER_PASS
	# Connect mouse hover signals for visual feedback
	mouse_entered.connect(_on_mouse_entered)
	mouse_exited.connect(_on_mouse_exited)


func _build_ui() -> void:
	# Main panel styled as a cassette tape
	_panel = Panel.new()
	_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_panel.custom_minimum_size = Vector2(200, 280)
	add_child(_panel)

	# Apply a stylebox for the cassette look
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.1, 0.1, 0.12, 0.95)
	style.border_color = Color(0.3, 0.3, 0.35)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	_panel.add_theme_stylebox_override("panel", style)

	# VBox container for content
	var vbox := VBoxContainer.new()
	vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	vbox.add_theme_constant_override("separation", 8)
	vbox.offset_left = 12
	vbox.offset_top = 12
	vbox.offset_right = -12
	vbox.offset_bottom = -12
	_panel.add_child(vbox)

	# Cassette icon placeholder (drawn via _draw on a custom control)
	_tape_icon = TextureRect.new()
	_tape_icon.custom_minimum_size = Vector2(176, 110)
	_tape_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_tape_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	vbox.add_child(_tape_icon)

	# Name label
	_name_label = Label.new()
	_name_label.text = display_name
	_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_name_label.add_theme_font_size_override("font_size", 16)
	_name_label.add_theme_color_override("font_color", Color(0.85, 0.85, 0.9))
	vbox.add_child(_name_label)

	# Subtitle (phase/shift info)
	_subtitle_label = Label.new()
	_subtitle_label.text = save_subtitle
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_subtitle_label.add_theme_font_size_override("font_size", 12)
	_subtitle_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	vbox.add_child(_subtitle_label)

	# Status label
	_status_label = Label.new()
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 11)
	vbox.add_child(_status_label)

	_update_status()
	_update_appearance()


func _update_status() -> void:
	if is_corrupted:
		_status_label.text = "DAMAGED"
		_status_label.add_theme_color_override("font_color", Color(0.8, 0.1, 0.1))
	elif is_used or has_save:
		_status_label.text = "USED"
		_status_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
	elif is_available:
		_status_label.text = "AVAILABLE"
		_status_label.add_theme_color_override("font_color", Color(0.3, 0.8, 0.3))
	else:
		_status_label.text = ""
		_status_label.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))


func _update_appearance() -> void:
	if is_corrupted:
		_panel.modulate = Color(0.6, 0.3, 0.3, 0.8)
	elif is_used or has_save:
		_panel.modulate = Color(0.5, 0.5, 0.5, 0.6)
	elif is_available:
		_panel.modulate = Color(1.0, 1.0, 1.0, 1.0)
	else:
		_panel.modulate = Color(0.4, 0.4, 0.4, 0.5)


func _draw() -> void:
	# Draw a simple cassette tape shape as fallback if no texture
	if _tape_icon and _tape_icon.texture == null:
		_draw_cassette_shape(_tape_icon)


func _draw_cassette_shape(rect: TextureRect) -> void:
	# This is a placeholder; in production, load a proper cassette texture
	# For now, just draw the outline shape
	var r := Rect2(Vector2.ZERO, rect.size)
	# Outer shell
	draw_rect(r, Color(0.15, 0.15, 0.18), true)
	draw_rect(r, Color(0.4, 0.4, 0.45), false, 2.0)
	# Reel holes (two circles)
	var reel_y := r.size.y * 0.5
	var reel_r := r.size.y * 0.2
	draw_circle(Vector2(r.size.x * 0.3, reel_y), reel_r, Color(0.05, 0.05, 0.05), true)
	draw_circle(Vector2(r.size.x * 0.3, reel_y), reel_r, Color(0.5, 0.5, 0.55), false, 1.5)
	draw_circle(Vector2(r.size.x * 0.7, reel_y), reel_r, Color(0.05, 0.05, 0.05), true)
	draw_circle(Vector2(r.size.x * 0.7, reel_y), reel_r, Color(0.5, 0.5, 0.55), false, 1.5)
	# Tape window
	var window_r := Rect2(Vector2(r.size.x * 0.15, r.size.y * 0.15), Vector2(r.size.x * 0.7, r.size.y * 0.25))
	draw_rect(window_r, Color(0.02, 0.02, 0.02), true)


## Set the tape data for this visual.
func set_tape_data(tape_id_: String, display_name_: String, is_used_: bool, is_available_: bool, has_save_: bool, is_corrupted_: bool = false, save_subtitle_: String = "") -> void:
	tape_id = tape_id_
	display_name = display_name_
	is_used = is_used_
	is_available = is_available_
	has_save = has_save_
	is_corrupted = is_corrupted_
	save_subtitle = save_subtitle_
	if is_inside_tree():
		_update_status()
		_update_appearance()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if not is_corrupted:
			tape_selected.emit(tape_id)


func _on_mouse_entered() -> void:
	tape_hovered.emit(tape_id)
	if _hover_tween:
		_hover_tween.kill()
	_hover_tween = create_tween()
	_hover_tween.tween_property(_panel, "scale", Vector2(1.05, 1.05), 0.1)


func _on_mouse_exited() -> void:
	if _hover_tween:
		_hover_tween.kill()
	_hover_tween = create_tween()
	_hover_tween.tween_property(_panel, "scale", Vector2(1.0, 1.0), 0.1)
