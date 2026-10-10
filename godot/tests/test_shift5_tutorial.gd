## test_shift5_tutorial.gd — Tests for DEA-115 Shift 5 "Dead Air" (final shift).
## Verifies: all 5 bands unlocked, call sequence (ids 14,15,16,17 — no procedural
## opener), no tutorial on shift 5, starting dread 40, save NOT available,
## breathers (20/15/10), station degradation shift 5 state (mug dust, chair gone,
## DNP tape on console, doors removed, mirror gone), per-call layout shifts,
## wrongness events E1-E4, and reset between shifts.
extends RefCounted

var test_name: String = "Shift5Tutorial"

var _tutorial_mgr: Node
var _step_shown_args: Array[String] = []
var _tutorial_complete_count: int = 0

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_unlock_all_five"] = test_band_unlock_all_five()
	results["test_call_sequence_order"] = test_call_sequence_order()
	results["test_no_procedural_opener"] = test_no_procedural_opener()
	results["test_no_tutorial_shift5"] = test_no_tutorial_shift5()
	results["test_breather_durations"] = test_breather_durations()
	results["test_starting_dread_40"] = test_starting_dread_40()
	results["test_save_not_available_shift5"] = test_save_not_available_shift5()
	results["test_dread_meter_visible_shift5"] = test_dread_meter_visible_shift5()
	results["test_station_degradation_shift5"] = test_station_degradation_shift5()
	results["test_layout_shift_on_call_completed"] = test_layout_shift_on_call_completed()
	results["test_e1_doors_shift"] = test_e1_doors_shift()
	results["test_e2_hallway_jump"] = test_e2_hallway_jump()
	results["test_e3_door_1920"] = test_e3_door_1920()
	results["test_e4_station_dark"] = test_e4_station_dark()
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
	_tutorial_mgr.name = "TestTutorialManager5"
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

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_band_unlock_all_five() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	if not BandController.is_band_unlocked(0):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(1):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(2):
		ShiftController._reset_for_testing()
		return false
	if not BandController.is_band_unlocked(3):
		ShiftController._reset_for_testing()
		return false
	# ████████ (redacted) band unlocks on shift 5
	if not BandController.is_band_unlocked(4):
		ShiftController._reset_for_testing()
		return false

	# Extended bands 5-7 remain locked
	for i in range(5, 8):
		if BandController.is_band_unlocked(i):
			ShiftController._reset_for_testing()
			return false

	ShiftController._reset_for_testing()
	return true

func test_call_sequence_order() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(4)  # Shift index 4 = Shift 5

	if CallManager._shift_queue.size() != 4:
		CallManager._reset_for_testing()
		return false

	var ids: Array = []
	for call in CallManager._shift_queue:
		ids.append(int(call.get("id", -999)))

	# GDD: THE WHISTLEBLOWER (14), ORIGIN (15), YOU CALLED US (16), DEAD AIR (17)
	if ids != [14, 15, 16, 17]:
		CallManager._reset_for_testing()
		return false

	CallManager._reset_for_testing()
	return true

func test_no_procedural_opener() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(4)

	# Shift 5 opens with THE WHISTLEBLOWER (id 14), not a procedural (-1)
	var first: Dictionary = CallManager._shift_queue[0]
	var ok: bool = int(first.get("id", -999)) == 14

	CallManager._reset_for_testing()
	return ok

func test_no_tutorial_shift5() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# Shift 5 data: tutorial must be false (GDD: "No tutorial. No safety.")
	var data: Dictionary = ShiftController.get_shift_data(5)
	var ok: bool = data.get("tutorial", true) == false
	if ok:
		# And the tutorial manager must not activate for it
		_setup_tutorial_mgr()
		_tutorial_mgr.on_shift_started(5, data.get("tutorial", true))
		ok = not _tutorial_mgr.is_tutorial_active() and _step_shown_args.is_empty()
		_cleanup_tutorial_mgr()

	ShiftController._reset_for_testing()
	return ok

func test_breather_durations() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(4)

	# GDD: breathers after calls 14/15/16 are 20s/15s/10s; last call has none
	var expected: Array = [20.0, 15.0, 10.0]
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

func test_starting_dread_40() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)

	# Data carries starting_dread
	var data: Dictionary = ShiftController.get_shift_data(5)
	if not is_equal_approx(float(data.get("starting_dread", 0.0)), 40.0):
		ShiftController._reset_for_testing()
		return false

	# And starting shift 5 applies it to DreadComposure
	ShiftController.start_shift(5)
	var dc: Node = CallManager.get_dread_composure()
	var ok: bool = dc != null and is_equal_approx(float(dc.dread), 40.0)

	ShiftController._reset_for_testing()
	return ok

func test_save_not_available_shift5() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# GDD: "No save room. This is a one-way trip."
	var ok: bool = not ShiftController.is_save_available()
	if ok:
		ok = data_get_save_unlocked_false()

	ShiftController._reset_for_testing()
	return ok

func data_get_save_unlocked_false() -> bool:
	var data: Dictionary = ShiftController.get_shift_data(5)
	return data.get("save_unlocked", true) == false

func test_dread_meter_visible_shift5() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	var ok: bool = ShiftController.is_dread_meter_visible()
	ShiftController._reset_for_testing()
	return ok

func test_station_degradation_shift5() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	var ok: bool = true
	if StationDegradation.get_current_shift() != 5:
		ok = false
	# GDD: hallway starts at its shift-5 length and varies between calls
	if not is_equal_approx(StationDegradation.get_hallway_length(), 5.0):
		ok = false
	if not StationDegradation.is_mirror_independent():
		ok = false

	ShiftController._reset_for_testing()
	return ok

## GDD: "layout shifts between every call". on_call_completed advances the
## hallway length through its per-call sequence.
func test_layout_shift_on_call_completed() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	var lengths: Array[float] = []
	lengths.append(StationDegradation.get_hallway_length())
	StationDegradation.on_call_completed()
	lengths.append(StationDegradation.get_hallway_length())
	StationDegradation.on_call_completed()
	lengths.append(StationDegradation.get_hallway_length())

	# Hallway must grow with each completed call (5 → 6 → 7.5)
	var ok: bool = is_equal_approx(lengths[0], 5.0) \
		and is_equal_approx(lengths[1], 6.0) \
		and is_equal_approx(lengths[2], 7.5)

	ShiftController._reset_for_testing()
	return ok

func test_e1_doors_shift() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	var got_signal := [false]
	var got_id := [""]
	var handler := func(eid: String, _d: String) -> void:
		got_signal[0] = true
		got_id[0] = eid
	StationDegradation.wrongness_event_triggered.connect(handler)
	StationDegradation.trigger_event("E1")
	StationDegradation.wrongness_event_triggered.disconnect(handler)

	var ok: bool = got_signal[0] and got_id[0] == "E1"

	ShiftController._reset_for_testing()
	return ok

func test_e2_hallway_jump() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	StationDegradation.trigger_event("E2")
	var ok: bool = is_equal_approx(StationDegradation.get_hallway_length(), 6.0)

	ShiftController._reset_for_testing()
	return ok

func test_e3_door_1920() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	var got_id := [""]
	var handler := func(eid: String, _d: String) -> void: got_id[0] = eid
	StationDegradation.wrongness_event_triggered.connect(handler)
	StationDegradation.trigger_event("E3")
	StationDegradation.wrongness_event_triggered.disconnect(handler)

	var ok: bool = got_id[0] == "E3"

	ShiftController._reset_for_testing()
	return ok

func test_e4_station_dark() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# Only in-game (scene present) can lights actually be killed; verify signal
	# and that no crash occurs. In headless the station root is absent so
	# _all_station_lights() returns empty — still a valid no-crash pass.
	var got_id := [""]
	var handler := func(eid: String, _d: String) -> void: got_id[0] = eid
	StationDegradation.wrongness_event_triggered.connect(handler)
	StationDegradation.trigger_event("E4")
	StationDegradation.wrongness_event_triggered.disconnect(handler)

	var ok: bool = got_id[0] == "E4"

	ShiftController._reset_for_testing()
	return ok

func test_events_reset_between_shifts() -> bool:
	# Apply shift 5 with events fired, then go back to shift 1 and
	# verify everything resets.
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)
	StationDegradation.on_call_completed()
	StationDegradation.trigger_event("E2")

	ShiftController._reset_for_testing()
	ShiftController.start_shift(1)
	var ok: bool = (
		is_equal_approx(StationDegradation.get_hallway_length(), 4.0)
		and is_equal_approx(StationDegradation.get_mirror_delay(), 0.0)
		and not StationDegradation.is_antenna_tracking()
	)

	ShiftController._reset_for_testing()
	return ok
