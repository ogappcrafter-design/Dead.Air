class_name TapeInventoryUI
extends Control

## Collapsible drawer UI showing collected tapes.
## Toggled via D-pad Up/Down (move_up/move_down actions).
## Displays tape list with band info, allows selecting for playback.

signal tape_selected(tape_id: String)
signal ui_toggled(is_open: bool)

const _TAPE_LIBRARY_PATH := "res://src/data/tapes.tres"

@export var drawer_offset: float = 300.0
@export var slide_duration: float = 0.3

var _is_open: bool = false
var _tape_list: ItemList = null
var _title_label: Label = null
var _detail_label: Label = null
var _close_hint: Label = null
var _bg_panel: ColorRect = null
var _tape_library: TapeLibrary = null


func _ready() -> void:
	_tape_library = load(_TAPE_LIBRARY_PATH) as TapeLibrary
	_build_ui()
	_refresh_list()
	# Start closed
	_position_closed(false)
	visible = true

	# Connect to TapeInventory signals
	TapeInventory.tape_collected.connect(_on_tape_collected)
	TapeInventory.tape_consumed.connect(_on_tape_consumed)

	set_process_input(true)


func _build_ui() -> void:
	# Background panel positioned on right side
	_bg_panel = ColorRect.new()
	_bg_panel.color = Color(0.05, 0.05, 0.08, 0.85)
	_bg_panel.position = Vector2(get_viewport().get_visible_rect().size.x - drawer_offset, 0)
	_bg_panel.size = Vector2(drawer_offset, get_viewport().get_visible_rect().size.y)
	add_child(_bg_panel)

	var container := VBoxContainer.new()
	container.position = Vector2(8, 8)
	container.size = Vector2(drawer_offset - 16, get_viewport().get_visible_rect().size.y - 16)
	_bg_panel.add_child(container)

	# Title
	_title_label = Label.new()
	_title_label.text = "TAPE COLLECTION"
	_title_label.add_theme_font_size_override("font_size", 20)
	_title_label.add_theme_color_override("font_color", Color(0.4, 0.8, 0.6))
	container.add_child(_title_label)

	# Tape list
	_tape_list = ItemList.new()
	_tape_list.custom_minimum_size = Vector2(0, 300)
	_tape_list.item_selected.connect(_on_item_selected)
	container.add_child(_tape_list)

	# Detail label
	_detail_label = Label.new()
	_detail_label.text = ""
	_detail_label.custom_minimum_size = Vector2(0, 80)
	_detail_label.add_theme_font_size_override("font_size", 14)
	_detail_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	_detail_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	container.add_child(_detail_label)

	# Close hint
	_close_hint = Label.new()
	_close_hint.text = "[Down] to close"
	_close_hint.add_theme_font_size_override("font_size", 12)
	_close_hint.add_theme_color_override("font_color", Color(0.4, 0.4, 0.4))
	container.add_child(_close_hint)


func _refresh_list() -> void:
	_tape_list.clear()
	var collected := TapeInventory.get_collected_tapes()
	for tape_id in collected:
		var display := tape_id
		if _tape_library:
			var data := _tape_library.get_tape_by_id(tape_id)
			if data:
				display = "%s - %s" % [data.display_name, data.band]
		_tape_list.add_item(display)

		# Mark consumed tapes with strikethrough effect (dimmed)
		if TapeInventory.is_tape_consumed(tape_id):
			_tape_list.set_item_custom_fg_color(_tape_list.item_count - 1, Color(0.3, 0.3, 0.3))


func _on_tape_collected(_tape_id: String) -> void:
	_refresh_list()


func _on_tape_consumed(_tape_id: String) -> void:
	_refresh_list()


func _on_item_selected(index: int) -> void:
	var collected := TapeInventory.get_collected_tapes()
	if index >= 0 and index < collected.size():
		var tape_id := collected[index]
		_show_detail(tape_id)
		tape_selected.emit(tape_id)


func _show_detail(tape_id: String) -> void:
	if not _tape_library:
		_detail_label.text = tape_id
		return
	var data := _tape_library.get_tape_by_id(tape_id)
	if data:
		var consumed := " [CONSUMED]" if TapeInventory.is_tape_consumed(tape_id) else ""
		_detail_label.text = (
			"%s\n%s\n%s%s" % [data.title, data.description, data.duration, consumed]
		)
	else:
		_detail_label.text = tape_id


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("move_up") and not _is_open:
		open_drawer()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("move_down") and _is_open:
		close_drawer()
		get_viewport().set_input_as_handled()


func open_drawer() -> void:
	if _is_open:
		return
	_is_open = true
	_refresh_list()
	var tween := create_tween()
	var start_x := get_viewport().get_visible_rect().size.x
	var end_x := get_viewport().get_visible_rect().size.x - drawer_offset
	tween.tween_property(_bg_panel, "position:x", end_x, slide_duration)
	# Also tween the container
	tween.parallel().tween_property(_bg_panel.get_child(0), "position:x", 8, slide_duration)
	ui_toggled.emit(true)


func close_drawer() -> void:
	if not _is_open:
		return
	_is_open = false
	var tween := create_tween()
	var start_x := get_viewport().get_visible_rect().size.x - drawer_offset
	var end_x := get_viewport().get_visible_rect().size.x
	tween.tween_property(_bg_panel, "position:x", end_x, slide_duration)
	tween.parallel().tween_property(_bg_panel.get_child(0), "position:x", end_x + 8, slide_duration)
	ui_toggled.emit(false)


func _position_closed(_instant: bool = true) -> void:
	var screen_x := get_viewport().get_visible_rect().size.x
	_bg_panel.position.x = screen_x
	if _bg_panel.get_child_count() > 0:
		_bg_panel.get_child(0).position.x = screen_x + 8


func is_open() -> bool:
	return _is_open


func get_selected_tape_id() -> String:
	var selected := _tape_list.get_selected_items()
	if selected.is_empty():
		return ""
	var collected := TapeInventory.get_collected_tapes()
	var idx := selected[0]
	if idx >= 0 and idx < collected.size():
		return collected[idx]
	return ""
