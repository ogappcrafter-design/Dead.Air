## test_main_menu.gd — Unit tests for MainMenu UI.
## Tests: component creation, button signals, Continue disabled state, New Game phase set.
extends RefCounted

var test_name: String = "MainMenu"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_main_menu_creates_title"] = test_main_menu_creates_title()
	results["test_main_menu_creates_subtitle"] = test_main_menu_creates_subtitle()
	results["test_main_menu_creates_three_buttons"] = test_main_menu_creates_three_buttons()
	results["test_main_menu_new_game_sets_phase"] = test_main_menu_new_game_sets_phase()
	results["test_main_menu_emits_new_game_signal"] = test_main_menu_emits_new_game_signal()
	results["test_main_menu_continue_disabled_no_saves"] = test_main_menu_continue_disabled_no_saves()
	results["test_main_menu_settings_emits_signal"] = test_main_menu_settings_emits_signal()
	return results


func test_main_menu_creates_title() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var has_title := false
	for label in _find_labels(menu, "DEAD AIR"):
		has_title = true
		break
	menu.queue_free()
	return has_title


func test_main_menu_creates_subtitle() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var has_subtitle := false
	for label in _find_labels(menu, "Late Night Radio"):
		has_subtitle = true
		break
	menu.queue_free()
	return has_subtitle


func test_main_menu_creates_three_buttons() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var buttons := _find_buttons(menu)
	var count := buttons.size()
	menu.queue_free()
	return count == 3


func test_main_menu_new_game_sets_phase() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	var buttons := _find_buttons(menu)
	for btn in buttons:
		if btn.text == "New Game":
			btn.pressed.emit()
			break
	var phase := PhaseManager.get_phase()
	menu.queue_free()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	return phase == PhaseEnums.Phase.PHASE_1_STATION


func test_main_menu_emits_new_game_signal() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var signal_received := false
	menu.new_game_pressed.connect(func(): signal_received = true)
	var buttons := _find_buttons(menu)
	for btn in buttons:
		if btn.text == "New Game":
			btn.pressed.emit()
			break
	menu.queue_free()
	return signal_received


func test_main_menu_continue_disabled_no_saves() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var continue_disabled := false
	var buttons := _find_buttons(menu)
	for btn in buttons:
		if btn.text == "Continue":
			continue_disabled = btn.disabled
			break
	menu.queue_free()
	if SaveManager.get_save_count() > 0:
		return not continue_disabled
	return continue_disabled


func test_main_menu_settings_emits_signal() -> bool:
	var menu := MainMenu.new()
	Engine.get_main_loop().root.add_child(menu)
	var signal_received := false
	menu.settings_pressed.connect(func(): signal_received = true)
	var buttons := _find_buttons(menu)
	for btn in buttons:
		if btn.text == "Settings":
			btn.pressed.emit()
			break
	menu.queue_free()
	return signal_received


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
