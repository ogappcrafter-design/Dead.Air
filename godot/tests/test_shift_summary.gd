## test_shift_summary.gd — Unit tests for ShiftSummary.
## Tests: UI creation, stat display, save flow, continue signal, button disable after save.
extends RefCounted

var test_name: String = "ShiftSummary"

const SUMMARY_SCENE := "res://scenes/shift_summary.tscn"
## The ritual ejects on a wall-clock tween, so its completion is awaited with a
## time bound instead of a frame budget that a fast headless run outruns.
const RITUAL_TIMEOUT_MSEC := 10000


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_summary_creates_title"] = test_summary_creates_title()
	results["test_summary_displays_stats"] = test_summary_displays_stats()
	results["test_summary_continue_button_label"] = test_summary_continue_button_label()
	results["test_summary_save_disables_buttons"] = await test_summary_save_disables_buttons()
	results["test_summary_save_disables_buttons_sync"] = test_summary_save_disables_buttons_sync()
	results["test_summary_checkpoint_save_outside_safe_room"] = (
		await test_summary_checkpoint_save_outside_safe_room()
	)
	results["test_summary_continue_emits_signal"] = test_summary_continue_emits_signal()
	results["test_summary_set_data_updates_display"] = test_summary_set_data_updates_display()
	return results


func test_summary_creates_title() -> bool:
	var summary := _new_summary()
	var has_title := false
	for label in _find_labels(summary, "SHIFT SUMMARY"):
		has_title = true
		break
	summary.queue_free()
	return has_title


func test_summary_displays_stats() -> bool:
	var summary := _new_summary()
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
	var summary := _new_summary()
	var buttons := _find_buttons(summary)
	var label := ""
	for btn in buttons:
		if "Continue" in btn.text:
			label = btn.text
			break
	summary.queue_free()
	return label == "Continue to Night 2"


func test_summary_save_disables_buttons() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var summary := _new_summary()
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
	# Yes opens the slot browser in SAVE mode instead of writing a legacy tape;
	# the summary buttons leave the keyboard focus chain while it is open.
	var browser: SaveLoadScreen = summary.get_node_or_null("SlotSaveBrowser") as SaveLoadScreen
	var browser_open: bool = browser != null and browser.visible
	var controls_locked: bool = (
		yes_btn.focus_mode == Control.FOCUS_NONE and no_btn.focus_mode == Control.FOCUS_NONE
	)
	var legacy_written: bool = SaveManager.is_tape_used("night_1")
	if browser == null:
		summary.queue_free()
		return false
	# Record slot_1 through the browser's own cassette ritual; the browser
	# closes itself when the ritual ejects successfully.
	var ritual: CassetteSaveRitual = browser._save_ritual
	var ejected: Array = [false]
	ritual.ritual_completed.connect(
		func(_slot_id: String, _success: bool) -> void: ejected[0] = true
	)
	(browser._slot_cards["slot_1"]["action_btn"] as Button).pressed.emit()
	var ritual_finished: bool = await _await_ritual_ejection(ejected)
	var both_disabled := yes_btn.disabled and no_btn.disabled
	var browser_hidden: bool = not browser.visible
	var slot_saved: bool = SaveManager.has_slot("slot_1")
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	SaveManager._reset_for_testing()
	summary.queue_free()
	return (
		browser_open
		and controls_locked
		and not legacy_written
		and both_disabled
		and browser_hidden
		and slot_saved
		and ritual_finished
	)


func test_summary_save_disables_buttons_sync() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var summary := _new_summary()
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
	var legacy_written: bool = SaveManager.is_tape_used("night_1")
	# Completing a slot save disables the summary save buttons even before the
	# ritual ejects (the browser closes itself on successful ejection).
	var sd := SaveData.new()
	sd.shift = 1
	sd.stamp_timestamp()
	SaveManager.save_slot("slot_1", sd)
	var both_disabled := yes_btn.disabled and no_btn.disabled
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	SaveManager._reset_for_testing()
	summary.queue_free()
	return not legacy_written and both_disabled


## The post-shift summary is the save point, so its checkpoint ritual must
## write even outside a safe room with the pause-anywhere override off.
func test_summary_checkpoint_save_outside_safe_room() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	if AccessibilityManager != null:
		AccessibilityManager.pause_anywhere = false
	if DreadComposure.instance != null:
		DreadComposure.instance.in_safe_room = false
	var summary := _new_summary()
	var buttons := _find_buttons(summary)
	var yes_btn: Button = null
	for btn in buttons:
		if btn.text == "Yes":
			yes_btn = btn
	if yes_btn == null:
		summary.queue_free()
		return false
	yes_btn.pressed.emit()
	var slot_browser: SaveLoadScreen = summary.get_node_or_null("SlotSaveBrowser") as SaveLoadScreen
	if slot_browser == null:
		summary.queue_free()
		return false
	var ritual: CassetteSaveRitual = slot_browser._save_ritual
	var ejected: Array = [false]
	ritual.ritual_completed.connect(
		func(_slot_id: String, _success: bool) -> void: ejected[0] = true
	)
	var record_btn: Button = slot_browser._slot_cards["slot_1"]["action_btn"]
	var record_enabled: bool = not record_btn.disabled
	record_btn.pressed.emit()
	var ritual_finished: bool = await _await_ritual_ejection(ejected)
	var slot_saved: bool = SaveManager.has_slot("slot_1")
	var browser_hidden: bool = not slot_browser.visible
	if DreadComposure.instance != null:
		DreadComposure.instance.in_safe_room = true
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	SaveManager._reset_for_testing()
	summary.queue_free()
	return record_enabled and slot_saved and browser_hidden and ritual_finished


func test_summary_continue_emits_signal() -> bool:
	var summary := _new_summary()
	var observed := {"fired": false}
	summary.continue_pressed.connect(func(): observed["fired"] = true)
	var buttons := _find_buttons(summary)
	for btn in buttons:
		if "Continue" in btn.text:
			btn.pressed.emit()
			break
	summary.queue_free()
	return observed["fired"]


func test_summary_set_data_updates_display() -> bool:
	var summary := _new_summary()
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


## UI tests exercise the packed scene, not a bare script instance: the scene is
## the surface the game actually loads.
func _new_summary() -> ShiftSummary:
	var scene: PackedScene = load(SUMMARY_SCENE)
	var summary: ShiftSummary = scene.instantiate()
	Engine.get_main_loop().root.add_child(summary)
	return summary


## Wait for the ritual's own completion signal under a wall-clock bound: the
## ejection tween runs on real time, so a frame budget can expire first.
func _await_ritual_ejection(ejected: Array) -> bool:
	var deadline := Time.get_ticks_msec() + RITUAL_TIMEOUT_MSEC
	while not bool(ejected[0]) and Time.get_ticks_msec() < deadline:
		await Engine.get_main_loop().process_frame
	return bool(ejected[0])


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
