extends RefCounted
var test_name := "TapeInventoryUI"

## Unit tests for TapeInventoryUI collapsible drawer.
## Tests the UI state logic without requiring a full viewport.


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_ui_initial_closed_state"] = test_ui_initial_closed_state()
	results["test_ui_open_toggle"] = test_ui_open_toggle()
	results["test_ui_close_toggle"] = test_ui_close_toggle()
	results["test_ui_selected_tape_id"] = test_ui_selected_tape_id()
	results["test_ui_refresh_on_collect"] = test_ui_refresh_on_collect()
	return results


func test_ui_initial_closed_state() -> bool:
	TapeInventory.reset()
	var ui := TapeInventoryUI.new()
	# Before _ready, should not be open
	if ui.is_open():
		ui.free()
		return false
	ui.free()
	return true


func test_ui_open_toggle() -> bool:
	TapeInventory.reset()
	var ui := TapeInventoryUI.new()
	# Simulate opening
	ui._is_open = false
	ui.open_drawer()
	var result := ui.is_open()
	ui.free()
	return result


func test_ui_close_toggle() -> bool:
	TapeInventory.reset()
	var ui := TapeInventoryUI.new()
	ui._is_open = true
	ui.close_drawer()
	var result := not ui.is_open()
	ui.free()
	return result


func test_ui_selected_tape_id() -> bool:
	TapeInventory.reset()
	TapeInventory.collect_tape("test-ui-select-001")
	TapeInventory.collect_tape("test-ui-select-002")
	var ui := TapeInventoryUI.new()
	# No selection initially
	var sel := ui.get_selected_tape_id()
	if sel != "":
		ui.free()
		return false
	ui.free()
	return true


func test_ui_refresh_on_collect() -> bool:
	TapeInventory.reset()
	var ui := TapeInventoryUI.new()
	# The _on_tape_collected handler should exist and be callable
	if not ui.has_method("_on_tape_collected"):
		ui.free()
		return false
	# Call it (should not crash even without _ready having run)
	ui._on_tape_collected("test-refresh-001")
	ui.free()
	return true
