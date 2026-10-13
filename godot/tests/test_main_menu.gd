## test_main_menu.gd — Tests for the main menu (scene-based).
## Verifies: button visibility + labels, scene requests (New Game / Continue /
## Settings), shift-start + save-load behavior, and the settings scene load.
##
## The menu scene is instantiated once for the whole suite (its _ready wires
## the buttons and the real scene-change Callable). Each behavior test shadows
## request_scene_change with a recording stub so the runner's own scene tree
## is never swapped mid-run.
extends RefCounted

var test_name: String = "MainMenu"

const MENU_SCENE_PATH := "res://scenes/main_menu.tscn"
const NIGHT_SHIFT_SCENE_PATH := "res://scenes/night_shift.tscn"
const SETTINGS_SCENE_PATH := "res://scenes/settings.tscn"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	var menu: Node = null

	# ─── Setup ───
	menu = _instantiate_scene(MENU_SCENE_PATH)
	await _wait_frames(2)

	# ─── Test 1: Menu scene exists and has script ───
	var scene := load(MENU_SCENE_PATH)
	results["test_menu_scene_loads"] = scene != null
	if scene == null:
		print("  FAIL: Could not load menu scene")
		_cleanup(menu)
		return results

	results["test_menu_has_script"] = menu.get_script() != null

	# ─── Test 2: All buttons visible ───
	var btn_new_game := menu.get_node("PanelCenter/VBox/NewGameButton")
	var btn_continue := menu.get_node("PanelCenter/VBox/ContinueButton")
	var btn_settings := menu.get_node("PanelCenter/VBox/SettingsButton")
	var btn_credits := menu.get_node("PanelCenter/VBox/CreditsButton")

	var all_buttons := [btn_new_game, btn_continue, btn_settings, btn_credits]
	var all_visible := true
	for btn in all_buttons:
		if btn == null or not btn.visible:
			all_visible = false
			break
	results["test_all_buttons_visible"] = all_visible

	# ─── Test 3: New Game button has correct text ───
	results["test_new_game_text"] = btn_new_game.text == "NEW GAME"

	# ─── Test 4: Continue button has correct text ───
	results["test_continue_text"] = btn_continue.text == "CONTINUE"

	# ─── Test 5: New Game emits new_game_started ───
	# GDScript lambdas capture local variables BY VALUE — an in-lambda
	# assignment never reaches the outer scope, so track emission through a
	# shared Dictionary (same pattern as test_dread_composure.gd).
	var new_game_held: Dictionary = {"emitted": false}
	menu.new_game_started.connect(
		func():
			new_game_held.emitted = true
	)
	_stub_scene_change(menu)
	_press_button(menu, "PanelCenter/VBox/NewGameButton")
	results["test_emits_new_game"] = new_game_held.emitted
	if not new_game_held.emitted:
		print("  FAIL: new_game_started signal not emitted")

	# ─── Test 6: Settings button emits open_settings ───
	var settings_held: Dictionary = {"emitted": false}
	menu.open_settings.connect(
		func():
			settings_held.emitted = true
	)
	_stub_scene_change(menu)
	_press_button(menu, "PanelCenter/VBox/SettingsButton")
	results["test_emits_settings"] = settings_held.emitted
	if not settings_held.emitted:
		print("  FAIL: open_settings signal not emitted")

	# ─── Test 7: New Game requests night shift scene + starts shift 1 ───
	_restore_game_state()
	var new_game_scene := _stub_scene_change(menu)
	_press_button(menu, "PanelCenter/VBox/NewGameButton")
	var new_game_ok: bool = new_game_scene.scene_requested == NIGHT_SHIFT_SCENE_PATH
	new_game_ok = new_game_ok and ShiftController.is_shift_active()
	new_game_ok = new_game_ok and ShiftController.get_current_shift() == 1
	results["test_new_game_starts_shift"] = new_game_ok
	if not new_game_ok:
		print(
			"  FAIL: New Game expected %s + shift 1, got scene '%s', shift %d"
			% [NIGHT_SHIFT_SCENE_PATH, new_game_scene.scene_requested, ShiftController.get_current_shift()]
		)

	# ─── Test 8: Continue with a save resumes the saved shift ───
	_restore_game_state()
	_make_test_save("tape_12", 2, PhaseEnums.Phase.PHASE_1_STATION)
	var continue_scene := _stub_scene_change(menu)
	_press_button(menu, "PanelCenter/VBox/ContinueButton")
	var continue_ok: bool = continue_scene.scene_requested == NIGHT_SHIFT_SCENE_PATH
	continue_ok = continue_ok and ShiftController.is_shift_active()
	continue_ok = continue_ok and ShiftController.get_current_shift() == 2
	results["test_continue_resumes_saved_shift"] = continue_ok
	if not continue_ok:
		print(
			"  FAIL: Continue expected scene %s + shift 2 active, got scene '%s', shift %d"
			% [NIGHT_SHIFT_SCENE_PATH, continue_scene.scene_requested, ShiftController.get_current_shift()]
		)

	# ─── Test 9: Continue disabled without saves ───
	# A fresh menu instance so its _ready re-evaluates the Continue button in
	# a known no-save state (the shared menu's disabled flag was fixed at
	# suite start, before test 8 created a save).
	_restore_game_state()
	var fresh_menu: Node = _instantiate_scene(MENU_SCENE_PATH)
	await _wait_frames(2)
	var fresh_ok: bool = fresh_menu.get_node("PanelCenter/VBox/ContinueButton").disabled
	fresh_menu.queue_free()
	results["test_continue_disabled_without_saves"] = fresh_ok
	if not fresh_ok:
		print("  FAIL: Continue should be disabled when no cassette saves exist")

	# ─── Test 10: Corrupt save fails to load (no crash, returns null) ───
	_restore_game_state()
	var corrupt_saved: bool = SaveManager.save_game("tape_12", _make_save_data(3, 0))
	# Truncate the save file so the checksum no longer matches.
	var corrupt_path := SaveManager.get_save_path("tape_12")
	if corrupt_saved and FileAccess.file_exists(corrupt_path):
		var f := FileAccess.open(corrupt_path, FileAccess.WRITE)
		if f != null:
			f.store_string("{ truncated")
			f.close()
	var corrupt_loaded: SaveData = SaveManager.load_game("tape_12")
	results["test_corrupt_save_loads_null"] = corrupt_saved and corrupt_loaded == null
	if not (corrupt_saved and corrupt_loaded == null):
		print(
			"  FAIL: corrupt save should load null, saved=%s loaded=%s"
			% [corrupt_saved, corrupt_loaded != null]
		)
	SaveManager._reset_for_testing()

	# ─── Test 11: Settings button opens settings scene ───
	var settings_scene := _stub_scene_change(menu)
	_press_button(menu, "PanelCenter/VBox/SettingsButton")
	var settings_ok: bool = settings_scene.scene_requested == SETTINGS_SCENE_PATH
	results["test_settings_opens_scene"] = settings_ok
	if not settings_ok:
		print(
			"  FAIL: Settings expected %s, got '%s'"
			% [SETTINGS_SCENE_PATH, settings_scene.scene_requested]
		)

	# ─── Test 12: Settings scene loads without crashing ───
	var settings_scene_res := load(SETTINGS_SCENE_PATH)
	var settings_loaded := settings_scene_res != null
	if settings_loaded:
		var settings_instance = settings_scene_res.instantiate()
		_get_tree().root.add_child(settings_instance)
		await _wait_frames(2)
		settings_instance.queue_free()
	results["test_settings_no_crash"] = settings_loaded

	# ─── Test 13: Credits label visible ───
	var credits_label := menu.get_node("PanelCenter/VBox/CreditsButton/CreditsLabel")
	results["test_credits_visible"] = credits_label != null and credits_label.visible

	# ─── Teardown ───
	_restore_game_state()
	_cleanup(menu)

	return results


# ─── Helpers ────────────────────────────────────────────────────────────────


func _get_tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


func _instantiate_scene(path: String) -> Node:
	var scene: PackedScene = load(path)
	if scene == null:
		return null
	var instance: Node = scene.instantiate()
	_get_tree().root.add_child(instance)
	return instance


func _cleanup(menu: Node) -> void:
	if menu and is_instance_valid(menu):
		menu.queue_free()


func _press_button(menu: Node, path: String) -> Button:
	var btn := menu.get_node(path) as Button
	if btn == null:
		print("  WARN: button not found: %s" % path)
		return null
	btn.pressed.emit()
	return btn


func _stub_scene_change(menu: Node) -> Dictionary:
	# The real seam would swap the running scene (crash-prone mid-runner);
	# the test shadows it and records the requested path instead.
	var held: Dictionary = {"scene_requested": ""}
	menu.request_scene_change = func(path: String) -> void:
		held.scene_requested = path
	return held


func _make_save_data(shift: int, phase: int) -> SaveData:
	var sd := SaveData.new()
	sd.shift = shift
	sd.phase = phase
	sd.tape_id = "tape_12"
	sd.tapes_collected = ["tape_12"]
	return sd


func _make_test_save(tape_id: String, shift: int, phase: int) -> void:
	var sd := _make_save_data(shift, phase)
	sd.tape_id = tape_id
	SaveManager.save_game(tape_id, sd)


func _wait_frames(count: int) -> void:
	for i in range(count):
		await _get_tree().process_frame


# Leave the shared singletons in their boot defaults so downstream suites
# (ShiftController, BandSystem, StationDegradation, CRTDegradation, …) see
# the same state they would have without these tests running.
func _restore_game_state() -> void:
	ShiftController._reset_for_testing()
	CallManager._reset_for_testing()
	PhaseManager.set_phase(0)
	BandController.lock_all_bands()
	StationState.set_shift(0)
	StationDegradation.apply_degradation(0)
	CRTDegradation.reset()
	SaveManager._reset_for_testing()
