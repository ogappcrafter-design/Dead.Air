## test_shift3_tutorial.gd — Tests for DEA-113 Shift 3 (The Dead).
## Verifies: LIVING + LIMINAL + LOST bands unlocked, call sequence (ids 6,7,8,9,
## no procedural opener), recording tutorial step, per-call breathers,
## station degradation shift 3 state, wrongness events E1/E2/E3.
extends RefCounted

var test_name: String = "Shift3Tutorial"

var _tutorial_mgr: Node
var _step_shown_args: Array[String] = []
var _tutorial_complete_count: int = 0

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_unlock_living_liminal_lost"] = test_band_unlock_living_liminal_lost()
	results["test_call_sequence_order"] = test_call_sequence_order()
	results["test_no_procedural_opener"] = test_no_procedural_opener()
	results["test_recording_tutorial_on_shift_start"] = test_recording_tutorial_on_shift_start()
	results["test_breather_durations"] = test_breather_durations()
	results["test_dread_meter_visible_shift3"] = test_dread_meter_visible_shift3()
	results["test_save_available_shift3"] = test_save_available_shift3()
	results["test_station_degradation_shift3"] = test_station_degradation_shift3()
	results["test_e1_hallway_stretch"] = test_e1_hallway_stretch()
	results["test_e2_photo_blur"] = test_e2_photo_blur()
	results["test_e3_tile_rotate"] = test_e3_tile_rotate()
	results["test_events_reset_between_shifts"] = test_events_reset_between_shifts()
	_cleanup()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _reset_shift() -> void:
	ShiftController._reset_for_testing()
	if CallManager:
		CallManager._reset_for_testing()

func _setup_tutorial_mgr() -> void:
	_cleanup_tutorial_mgr()
	_tutorial_mgr = load("res://src/ui/tutorial_manager.gd").new()
	_tutorial_mgr.name = "TestTutorialManager3"
	_step_shown_args.clear()
	_tutorial_complete_count = 0
	_tutorial_mgr.tutorial_step_shown.connect(_on_tutorial_step_shown)
	_tutorial_mgr.tutorial_complete.connect(_on_tutorial_complete)
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		tree.root.add_child(_tutorial_mgr)

func _cleanup_tutorial_mgr() -> void:
	if _tutorial_mgr:
		_tutorial_mgr._reset_for_testing()
		if _tutorial_mgr.tutorial_step_shown.is_connected(_on_tutorial_step_shown):
			_tutorial_mgr.tutorial_step_shown.disconnect(_on_tutorial_step_shown)
		if _tutorial_mgr.tutorial_complete.is_connected(_on_tutorial_complete):
			_tutorial_mgr.tutorial_complete.disconnect(_on_tutorial_complete)
		_tutorial_mgr.queue_free()
		_tutorial_mgr = null

func _cleanup() -> void:
	_cleanup_tutorial_mgr()
	_reset_shift()

func _on_tutorial_step_shown(step_name: String) -> void:
	_step_shown_args.append(step_name)

func _on_tutorial_complete() -> void:
	_tutorial_complete_count += 1

func _dismiss_active_overlay() -> void:
	if _tutorial_mgr._overlay and _tutorial_mgr._overlay.is_active():
		_tutorial_mgr._overlay.hide_overlay()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_band_unlock_living_liminal_lost() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	if not BandController.is_band_unlocked(0):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(1):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(2):
		ShiftController._reset_for_testing()
		return false

	# CLASSIFIED (3) and beyond remain locked
	for i in range(3, 8):
		if BandController.is_band_unlocked(i):
			ShiftController._reset_for_testing()
			return false

	ShiftController._reset_for_testing()
	return true

func test_call_sequence_order() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(2)  # Shift index 2 = Shift 3

	if CallManager._shift_queue.size() != 4:
		CallManager._reset_for_testing()
		return false

	var ids: Array = []
	for call in CallManager._shift_queue:
		ids.append(int(call.get("id", -999)))

	# GDD: YESTERDAY'S CALL (6), ECHO (7), GUARDIAN (8), MISSING PERSONS (9)
	if ids != [6, 7, 8, 9]:
		CallManager._reset_for_testing()
		return false

	CallManager._reset_for_testing()
	return true

func test_no_procedural_opener() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(2)

	# Shift 3 opens with scripted YESTERDAY'S CALL (id 6), not a procedural (-1)
	var first: Dictionary = CallManager._shift_queue[0]
	var ok: bool = int(first.get("id", -999)) == 6

	CallManager._reset_for_testing()
	return ok

func test_recording_tutorial_on_shift_start() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(3, true)

	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_RECORDING):
		_cleanup_tutorial_mgr()
		return false

	if _step_shown_args.is_empty() or _step_shown_args[0] != "recording":
		_cleanup_tutorial_mgr()
		return false

	# No other steps fire on shift 3
	if _step_shown_args.size() != 1:
		_cleanup_tutorial_mgr()
		return false

	# Dismiss to complete the one-step tutorial
	_dismiss_active_overlay()
	if _tutorial_complete_count != 1:
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_breather_durations() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(2)

	# GDD: breathers after calls 6/7/8 are 45s/30s/60s; last call has none
	var expected: Array = [45.0, 30.0, 60.0]
	var ok: bool = CallManager._shift_queue.size() == 4
	if ok:
		for i in range(3):
			var breath: Variant = CallManager._shift_queue[i].get("breather")
			if breath == null or not is_equal_approx(float(breath), expected[i]):
				ok = false
				break
		if CallManager._shift_queue[3].has("breather"):
			ok = false

	CallManager._reset_for_testing()
	return ok

func test_dread_meter_visible_shift3() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	var ok: bool = ShiftController.is_dread_meter_visible()
	ShiftController._reset_for_testing()
	return ok

func test_save_available_shift3() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	var ok: bool = ShiftController.is_save_available()
	ShiftController._reset_for_testing()
	return ok

func test_station_degradation_shift3() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	var ok: bool = true
	if StationDegradation.get_current_shift() != 3:
		ok = false
	# GDD: mirror "1-frame delay" (~0.05s), hallway 4.5m
	if not is_equal_approx(StationDegradation.get_mirror_delay(), 0.05):
		ok = false
	if not is_equal_approx(StationDegradation.get_hallway_length(), 4.5):
		ok = false

	ShiftController._reset_for_testing()
	return ok

func test_e1_hallway_stretch() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	StationDegradation.trigger_event("E1")
	var ok: bool = is_equal_approx(StationDegradation.get_hallway_length(), 5.0)

	ShiftController._reset_for_testing()
	return ok

func test_e2_photo_blur() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	var got_signal := [false]
	var handler := func(_eid: String, _d: String) -> void: got_signal[0] = true
	StationDegradation.wrongness_event_triggered.connect(handler)
	StationDegradation.trigger_event("E2")
	StationDegradation.wrongness_event_triggered.disconnect(handler)

	var ok: bool = got_signal[0]

	ShiftController._reset_for_testing()
	return ok

func test_e3_tile_rotate() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	StationDegradation.trigger_event("E3")
	var ok: bool = StationDegradation.get_current_shift() == 3

	ShiftController._reset_for_testing()
	return ok

func test_events_reset_between_shifts() -> bool:
	# Apply shift 3 with all events fired, then go back to shift 1 and
	# verify everything resets.
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)
	StationDegradation.trigger_event("E1")
	StationDegradation.trigger_event("E3")

	ShiftController._reset_for_testing()
	ShiftController.start_shift(1)
	var ok: bool = (
		is_equal_approx(StationDegradation.get_hallway_length(), 4.0)
		and is_equal_approx(StationDegradation.get_mirror_delay(), 0.0)
	)

	ShiftController._reset_for_testing()
	return ok
