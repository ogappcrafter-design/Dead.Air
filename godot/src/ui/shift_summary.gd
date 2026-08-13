## shift_summary.gd — Post-shift summary screen with stats and save/continue options.
## Displays: shift number, calls completed, tapes collected, bands unlocked.
## Offers save game (Yes/No) and "Continue to Night N+1" button.
class_name ShiftSummary
extends Control

signal save_requested
signal continue_pressed

var _background: ColorRect
var _title_label: Label
var _stats_container: VBoxContainer
var _save_yes_button: Button
var _save_no_button: Button
var _continue_button: Button
var _save_container: HBoxContainer

var _shift_number: int = 1
var _calls_completed: int = 0
var _tapes_collected: int = 0
var _bands_unlocked: int = 0
var _save_done: bool = false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()


func set_summary_data(shift: int, calls: int, tapes: int, bands: int) -> void:
	_shift_number = shift
	_calls_completed = calls
	_tapes_collected = tapes
	_bands_unlocked = bands
	_update_display()


func _build_ui() -> void:
	# Background
	_background = ColorRect.new()
	_background.color = CRTText.BG_BLACK
	_background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_background)

	# Root VBox
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(root)

	# Title
	_title_label = Label.new()
	_title_label.text = "SHIFT SUMMARY"
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_phosphor_green(_title_label, 48)
	root.add_child(_title_label)

	# Spacer
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 30)
	root.add_child(spacer)

	# Stats container
	_stats_container = VBoxContainer.new()
	_stats_container.alignment = BoxContainer.ALIGNMENT_CENTER
	_stats_container.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.add_child(_stats_container)

	# Spacer
	var spacer2 := Control.new()
	spacer2.custom_minimum_size = Vector2(0, 30)
	root.add_child(spacer2)

	# Save prompt
	var save_prompt := Label.new()
	save_prompt.text = "Save Game?"
	save_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(save_prompt, 24)
	root.add_child(save_prompt)

	# Save buttons
	_save_container = HBoxContainer.new()
	_save_container.alignment = BoxContainer.ALIGNMENT_CENTER
	_save_container.spacing = 20
	root.add_child(_save_container)

	_save_yes_button = Button.new()
	_save_yes_button.text = "Yes"
	_style_button(_save_yes_button)
	_save_yes_button.pressed.connect(_on_save_yes)
	_save_container.add_child(_save_yes_button)

	_save_no_button = Button.new()
	_save_no_button.text = "No"
	_style_button(_save_no_button)
	_save_no_button.pressed.connect(_on_save_no)
	_save_container.add_child(_save_no_button)

	# Spacer
	var spacer3 := Control.new()
	spacer3.custom_minimum_size = Vector2(0, 30)
	root.add_child(spacer3)

	# Continue button
	_continue_button = Button.new()
	_continue_button.text = "Continue to Night %d" % (_shift_number + 1)
	_style_button(_continue_button)
	_continue_button.pressed.connect(_on_continue)
	_continue_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.add_child(_continue_button)

	_update_display()


func _update_display() -> void:
	# Clear old stat lines
	for child in _stats_container.get_children():
		child.queue_free()

	_add_stat_line("Shift", "%d" % _shift_number)
	_add_stat_line("Calls Completed", "%d" % _calls_completed)
	_add_stat_line("Tapes Collected", "%d" % _tapes_collected)
	_add_stat_line("Bands Unlocked", "%d" % _bands_unlocked)

	# Update continue button label
	if is_instance_valid(_continue_button):
		_continue_button.text = "Continue to Night %d" % (_shift_number + 1)


func _add_stat_line(label_text: String, value_text: String) -> void:
	var line := HBoxContainer.new()
	line.alignment = BoxContainer.ALIGNMENT_CENTER
	line.spacing = 20

	var label := Label.new()
	label.text = label_text + ":"
	CRTText.style_amber(label, 22)
	line.add_child(label)

	var value := Label.new()
	value.text = value_text
	CRTText.style_phosphor_green(value, 22)
	line.add_child(value)

	_stats_container.add_child(line)


func _style_button(btn: Button) -> void:
	btn.custom_minimum_size = Vector2(200, 45)
	btn.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	btn.add_theme_color_override("font_hover_color", CRTText.AMBER)
	btn.add_theme_color_override("font_pressed_color", CRTText.BLOOD_RED)
	btn.add_theme_font_size_override("font_size", 20)


func _on_save_yes() -> void:
	if _save_done:
		return
	print("[ShiftSummary] Saving game...")
	save_requested.emit()
	# Create save data from current StationState
	var save_data := SaveData.new()
	save_data.phase = PhaseManager.get_phase()
	save_data.shift = StationState.shift_number
	save_data.callers_helped = _calls_completed
	save_data.tapes_collected = (
		TapeInventory.get_collected_tapes()
		if TapeInventory.has_method("get_collected_tapes")
		else []
	)
	save_data.bands_unlocked = []
	save_data.stamp_timestamp()
	var tape_id := "night_%d" % _shift_number
	var save_ok: bool = SaveManager.save_game(tape_id, save_data)
	if not save_ok:
		print("[ShiftSummary] Save FAILED (tape_id=%s) — tape may already be used" % tape_id)
		_save_yes_button.text = "Save Failed"
		_save_yes_button.disabled = true
		_save_no_button.disabled = true
		_save_done = true
		return
	_save_done = true
	_save_yes_button.disabled = true
	_save_no_button.disabled = true
	print("[ShiftSummary] Save complete (tape_id=%s)" % tape_id)


func _on_save_no() -> void:
	print("[ShiftSummary] Save skipped")
	_save_done = true
	_save_yes_button.disabled = true
	_save_no_button.disabled = true


func _on_continue() -> void:
	print("[ShiftSummary] Continue to Night %d" % (_shift_number + 1))
	continue_pressed.emit()
