## test_shift_summary.gd — Unit tests for ShiftSummary.
## Tests: UI creation, stat display, save flow, continue signal, button disable after save.
extends RefCounted

var test_name: String = "ShiftSummary"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_summary_creates_title"] = test_summary_creates_title()
	results["test_summary_displays_stats"] = test_summary_displays_stats()
	results["test_summary_continue_button_label"] = test_summary_continue_button_label()
	results["test_summary_save_disables_buttons"] = test_summary_save_disables_buttons()
	results["test_summary_continue_emits_signal"] = test_summary_continue_emits_signal()
	results["test_summary_set_data_updates_display"] = test_summary_set_data_updates_display()
	return results


func test_summary_creates_title() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	var has_title := false
	for label in _find_labels(summary, "SHIFT SUMMARY"):
		has_title = true
		break
	summary.queue_free()
	return has_title


func test_summary_displays_stats() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	var labels := _find_all_labels(summary)
	var has_shift := false
	var has_calls := false
	var has_tapes := false
	var has_bands := false
	for label in labels:
		if "Shift" in label.text:
			has_shift = true
		if "Calls" in label.text:
			has_calls = true
		if "Tapes" in label.text:
			has_tapes = true
		if "Bands" in label.text:
			has_bands = true
	summary.queue_free()
	return has_shift and has_calls and has_tapes and has_bands


func test_summary_continue_button_label() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	var buttons := _find_buttons(summary)
	var label := ""
	for btn in buttons:
		if "Continue" in btn.text:
			label = btn.text
			break
	summary.queue_free()
	return label == "Continue to Night 2"


func test_summary_save_disables_buttons() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	var buttons := _find_buttons(summary)
	var yes_btn: Button = null
	var no_btn: Button = null
	for btn in buttons:
		if btn.text == "Yes":
			yes_btn = btn
		elif btn.text == "No":
			no_btn = btn
	if yes_btn == null or no_btn == null:
		summary.queue_free()
		return false
	yes_btn.pressed.emit()
	var both_disabled := yes_btn.disabled and no_btn.disabled
	SaveManager.delete_save("night_1")
	summary.queue_free()
	return both_disabled


func test_summary_continue_emits_signal() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	var signal_received := false
	summary.continue_pressed.connect(func(): signal_received = true)
	var buttons := _find_buttons(summary)
	for btn in buttons:
		if "Continue" in btn.text:
			btn.pressed.emit()
			break
	summary.queue_free()
	return signal_received


func test_summary_set_data_updates_display() -> bool:
	var summary := ShiftSummary.new()
	Engine.get_main_loop().root.add_child(summary)
	summary.set_summary_data(5, 12, 3, 7)
	var buttons := _find_buttons(summary)
	var continue_label := ""
	for btn in buttons:
		if "Continue" in btn.text:
			continue_label = btn.text
			break
	summary.queue_free()
	return continue_label == "Continue to Night 6"


# --- Helpers ---


func _find_buttons(node: Node) -> Array[Button]:
	var buttons: Array[Button] = []
	for child in node.get_children(true):
		if child is Button:
			buttons.append(child)
		buttons.append_array(_find_buttons(child))
	return buttons


func _find_labels(node: Node, text: String) -> Array[Label]:
	var labels: Array[Label] = []
	for child in node.get_children(true):
		if child is Label and (child as Label).text == text:
			labels.append(child)
		labels.append_array(_find_labels(child, text))
	return labels


func _find_all_labels(node: Node) -> Array[Label]:
	var labels: Array[Label] = []
	for child in node.get_children(true):
		if child is Label:
			labels.append(child)
		labels.append_array(_find_all_labels(child))
	return labels
