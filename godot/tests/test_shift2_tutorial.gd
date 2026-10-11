## test_shift2_tutorial.gd — Tests for DEA-112 Shift 2 (Settling In).
## Verifies: LIVING + LIMINAL bands unlocked, call sequence (procedural + ids 2,4,5),
## Shift 2 tutorial steps (dread meter on shift start, band switching on first call),
## dread meter visible, save available, station degradation applied.
extends RefCounted

var test_name: String = "Shift2Tutorial"

var _tutorial_mgr: Node
var _step_shown_args: Array[String] = []
var _tutorial_complete_count: int = 0

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_unlock_living_liminal"] = test_band_unlock_living_liminal()
	results["test_call_sequence_order"] = test_call_sequence_order()
	results["test_tutorial_dread_meter_on_shift_start"] = test_tutorial_dread_meter_on_shift_start()
	results["test_tutorial_band_switching_on_call"] = test_tutorial_band_switching_on_call()
	results["test_tutorial_shift1_steps_not_shown_shift2"] = test_tutorial_shift1_steps_not_shown_shift2()
	results["test_tutorial_complete_after_both_steps"] = test_tutorial_complete_after_both_steps()
	results["test_tutorial_inactive_shift5"] = test_tutorial_inactive_shift5()
	results["test_dread_meter_visible_shift2"] = test_dread_meter_visible_shift2()
	results["test_save_available_shift2"] = test_save_available_shift2()
	results["test_station_degradation_applied"] = test_station_degradation_applied()
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
	_tutorial_mgr.name = "TestTutorialManager2"
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

func test_band_unlock_living_liminal() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# LIVING (0) and LIMINAL (1) should be unlocked
	if not BandController.is_band_unlocked(0):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(1):
		ShiftController._reset_for_testing()
		return false

	# LOST (2) and beyond should remain locked
	for i in range(2, 8):
		if BandController.is_band_unlocked(i):
			ShiftController._reset_for_testing()
			return false

	ShiftController._reset_for_testing()
	return true

func test_call_sequence_order() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(1)  # Shift index 1 = Shift 2

	if CallManager._shift_queue.size() != 4:
		CallManager._reset_for_testing()
		return false

	var first: Dictionary = CallManager._shift_queue[0]
	if first.get("id", -999) != -1:
		CallManager._reset_for_testing()
		return false

	var ids: Array = []
	for i in range(1, CallManager._shift_queue.size()):
		ids.append(int(CallManager._shift_queue[i].get("id", -999)))

	# Scripted calls: THE COLLECTOR (2), THE LOOP (4), 3:47 AM (5)
	if ids != [2, 4, 5]:
		CallManager._reset_for_testing()
		return false

	CallManager._reset_for_testing()
	return true

func test_tutorial_dread_meter_on_shift_start() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(2, true)

	# Dread meter step shown immediately, band switching not yet
	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_DREAD_METER):
		_cleanup_tutorial_mgr()
		return false
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_BAND_SWITCHING):
		_cleanup_tutorial_mgr()
		return false

	# Step signal args should start with "dread meter"
	if _step_shown_args.is_empty() or _step_shown_args[0] != "dread meter":
		_cleanup_tutorial_mgr()
		return false

	# Shift 1 steps must not fire on shift 2
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_TUNING):
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_tutorial_band_switching_on_call() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(2, true)
	_dismiss_active_overlay()

	# First call → band switching step
	_tutorial_mgr.on_call_started({})

	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_BAND_SWITCHING):
		_cleanup_tutorial_mgr()
		return false

	# First step shown should be dread meter, second band switching
	if _step_shown_args.size() < 2 or _step_shown_args[1] != "band switching":
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_tutorial_shift1_steps_not_shown_shift2() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(2, true)
	_dismiss_active_overlay()

	# Composure changes on shift 2 should not trigger the shift 1 composure step
	_tutorial_mgr.on_composure_changed(80.0)
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_COMPOSURE):
		_cleanup_tutorial_mgr()
		return false

	# Tuning and signal meter should also never show
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_TUNING):
		_cleanup_tutorial_mgr()
		return false
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_SIGNAL_METER):
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_tutorial_complete_after_both_steps() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(2, true)

	if _tutorial_complete_count != 0:
		_cleanup_tutorial_mgr()
		return false

	# Dismiss the dread meter overlay, trigger and dismiss the band switching one
	_dismiss_active_overlay()
	_tutorial_mgr.on_call_started({})
	_dismiss_active_overlay()

	if _tutorial_complete_count != 1:
		_cleanup_tutorial_mgr()
		return false

	# Tutorial should no longer be active
	if _tutorial_mgr.is_tutorial_active():
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_tutorial_inactive_shift5() -> bool:
	_setup_tutorial_mgr()

	# Shift 5 has no step sequence — tutorial must not activate even if data says tutorial=true
	_tutorial_mgr.on_shift_started(5, true)

	if _tutorial_mgr.is_tutorial_active():
		_cleanup_tutorial_mgr()
		return false
	if not _step_shown_args.is_empty():
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true

func test_dread_meter_visible_shift2() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	if ShiftController.is_dread_meter_visible() != true:
		ShiftController._reset_for_testing()
		return false

	var dc: Node = CallManager.get_dread_composure()
	if dc == null:
		ShiftController._reset_for_testing()
		return false

	if not dc.is_visible():
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true

func test_save_available_shift2() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	if ShiftController.is_save_available() != true:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true

func test_station_degradation_applied() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# StationDegradation should have applied shift 2 state
	if StationDegradation.get_current_shift() != 2:
		ShiftController._reset_for_testing()
		return false
	if StationDegradation.get_mirror_delay() == 0.0:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true
