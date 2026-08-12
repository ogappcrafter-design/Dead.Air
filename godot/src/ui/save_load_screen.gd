## SaveLoadScreen — Visual cassette tape selection screen for save/load.
## Shows cassette tapes (not file names) per DEA-153 acceptance criterion 8.
## Supports both save mode (select a collected tape to save) and load mode (select a used tape to load).
## See: docs/plans/redesign-gdd.md (lines 1555-1592) and DEA-153 brief.
class_name SaveLoadScreen
extends Control

signal save_requested(tape_id: String)
signal load_requested(tape_id: String)
signal closed

enum Mode { SAVE, LOAD }

@export var mode: Mode = Mode.SAVE

# UI Components
var _title_label: Label
var _tape_container: GridContainer
var _back_button: Button
var _corruption_screen: CorruptionScreen
var _scroll_container: ScrollContainer

# Currently displayed tape visuals
var _tape_visuals: Array[CassetteTapeVisual] = []


func _ready() -> void:
	_build_ui()
	_refresh_tape_display()


func _build_ui() -> void:
	# Dark background
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.03, 0.05, 0.98)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	# VBox layout
	var root_vbox := VBoxContainer.new()
	root_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_vbox.add_theme_constant_override("separation", 20)
	root_vbox.offset_left = 40
	root_vbox.offset_top = 40
	root_vbox.offset_right = -40
	root_vbox.offset_bottom = -40
	add_child(root_vbox)

	# Title
	_title_label = Label.new()
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_font_size_override("font_size", 32)
	_title_label.add_theme_color_override("font_color", Color(0.8, 0.8, 0.85))
	root_vbox.add_child(_title_label)

	# Subtitle/instructions
	var subtitle := Label.new()
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 14)
	subtitle.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	subtitle.text = "Select a cassette tape to continue..."
	subtitle.name = "SubtitleLabel"
	root_vbox.add_child(subtitle)

	# Scroll container for tape grid
	_scroll_container = ScrollContainer.new()
	_scroll_container.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root_vbox.add_child(_scroll_container)

	# Grid of cassette tapes
	_tape_container = GridContainer.new()
	_tape_container.columns = 4
	_tape_container.add_theme_constant_override("h_separation", 20)
	_tape_container.add_theme_constant_override("v_separation", 20)
	_tape_container.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_scroll_container.add_child(_tape_container)

	# Back button
	_back_button = Button.new()
	_back_button.text = "Back"
	_back_button.custom_minimum_size = Vector2(120, 40)
	_back_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_back_button.pressed.connect(_on_back_pressed)
	root_vbox.add_child(_back_button)

	_update_title()


func _update_title() -> void:
	match mode:
		Mode.SAVE:
			_title_label.text = "INSERT CASSETTE TO SAVE"
		Mode.LOAD:
			_title_label.text = "SELECT TAPE TO LOAD"


## Refresh the tape display based on current mode and game state.
func _refresh_tape_display() -> void:
	# Clear existing visuals
	for child in _tape_container.get_children():
		child.queue_free()
	_tape_visuals.clear()

	match mode:
		Mode.SAVE:
			_show_save_mode()
		Mode.LOAD:
			_show_load_mode()


## In SAVE mode: show collected (available) tapes. Consumed tapes shown as used.
func _show_save_mode() -> void:
	var available_tapes := TapeInventory.get_collected_tapes()
	var used_tapes := TapeInventory.get_consumed_tapes()

	# Available tapes (can save)
	for tape_id in available_tapes:
		var visual := _create_tape_visual(tape_id, true)
		_tape_container.add_child(visual)
		_tape_visuals.append(visual)

	# Used tapes (cannot save, already consumed)
	for tape_id in used_tapes:
		var visual := _create_tape_visual(tape_id, false)
		_tape_container.add_child(visual)
		_tape_visuals.append(visual)

	# Show empty message if no tapes
	if available_tapes.is_empty() and used_tapes.is_empty():
		_show_no_tapes_message("No cassette tapes found.\nFind tapes in safe rooms to save your progress.")


## In LOAD mode: show all tapes with saves on disk. Corrupted ones marked.
func _show_load_mode() -> void:
	var used_tapes := SaveManager.get_used_tapes()

	for tape_id in used_tapes:
		var is_valid := SaveManager.validate_save(tape_id)
		var visual := _create_tape_visual(tape_id, false)
		visual.is_corrupted = not is_valid
		visual.has_save = true
		visual._update_status()
		visual._update_appearance()
		_tape_container.add_child(visual)
		_tape_visuals.append(visual)

	# Show empty message if no saves
	if used_tapes.is_empty():
		_show_no_tapes_message("No saved tapes found.\nSave your progress by finding cassette tapes in safe rooms.")


## Create a CassetteTapeVisual with appropriate state.
func _create_tape_visual(tape_id: String, is_available: bool) -> CassetteTapeVisual:
	var visual := CassetteTapeVisual.new()
	var display_name := _get_tape_display_name(tape_id)
	var is_used := TapeInventory.is_tape_consumed(tape_id)
	var has_save := SaveManager.is_tape_used(tape_id)
	var subtitle := _get_tape_subtitle(tape_id)

	visual.set_tape_data(tape_id, display_name, is_used, is_available, has_save, false, subtitle)
	visual.tape_selected.connect(_on_tape_selected)
	visual.tape_hovered.connect(_on_tape_hovered)
	return visual


## Get display name for a tape. In production, load from TapeLibrary.
func _get_tape_display_name(tape_id: String) -> String:
	# Try to load from TapeLibrary resource
	if ResourceLoader.exists("res://src/data/tapes.tres"):
		var library := load("res://src/data/tapes.tres") as TapeLibrary
		if library:
			var tape := library.get_tape_by_id(tape_id)
			if tape:
				return tape.display_name
	# Fallback: format from ID
	return "Tape #%s" % tape_id


## Get subtitle for a tape (phase/shift from save, or location hint).
func _get_tape_subtitle(tape_id: String) -> String:
	if SaveManager.is_tape_used(tape_id):
		var save_data := SaveManager.load_game(tape_id)
		if save_data:
			return "Phase %d - Shift %d" % [save_data.phase, save_data.shift]
	return "Unused"


func _show_no_tapes_message(msg: String) -> void:
	var label := Label.new()
	label.text = msg
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size", 16)
	label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_tape_container.add_child(label)


## Handle tape selection.
func _on_tape_selected(tape_id: String) -> void:
	match mode:
		Mode.SAVE:
			# Only allow selecting available tapes
			if TapeInventory.has_tape(tape_id):
				save_requested.emit(tape_id)
		Mode.LOAD:
			# Check for corruption before loading
			if not SaveManager.validate_save(tape_id):
				_show_corruption_screen(tape_id)
			else:
				load_requested.emit(tape_id)


func _on_tape_hovered(_tape_id: String) -> void:
	# Could play a sound here
	pass


## Show the corruption screen when a damaged tape is selected.
func _show_corruption_screen(tape_id: String) -> void:
	_corruption_screen = CorruptionScreen.new()
	_corruption_screen.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_corruption_screen)
	_corruption_screen.acknowledged.connect(_on_corruption_acknowledged)


func _on_corruption_acknowledged() -> void:
	if _corruption_screen:
		_corruption_screen.queue_free()
		_corruption_screen = null


func _on_back_pressed() -> void:
	closed.emit()


## Set the mode (save or load) and refresh.
func set_mode(new_mode: Mode) -> void:
	mode = new_mode
	if is_inside_tree():
		_update_title()
		_refresh_tape_display()


## Refresh the display (call when tape inventory changes).
func refresh() -> void:
	if is_inside_tree():
		_refresh_tape_display()
