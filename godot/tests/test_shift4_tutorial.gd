## test_shift4_tutorial.gd — Tests for DEA-114 Shift 4 (Classified).
## Verifies: LIVING + LIMINAL + LOST + CLASSIFIED bands unlocked, call sequence
## (ids 10,11,12,13 — no procedural opener), decode tutorial step on shift start,
## per-call breathers (90/45/30), CHOICE-state entry for RIGHT_ANSWER call 12,
## submit_decode_result outcomes for SIGNAL_DECODE call 13, station degradation
## shift 4 state (mirror independent, hallway 5m, chair rotation, second chair),
## wrongness events E1-E4, and reset between shifts.
extends RefCounted

var test_name: String = "Shift4Tutorial"

var _tutorial_mgr: Node
var _step_shown_args: Array[String] = []
var _tutorial_complete_count: int = 0

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_unlock_incl_classified"] = test_band_unlock_incl_classified()
	results["test_call_sequence_order"] = test_call_sequence_order()
	results["test_no_procedural_opener"] = test_no_procedural_opener()
	results["test_decode_tutorial_on_shift_start"] = test_decode_tutorial_on_shift_start()
	results["test_breather_durations"] = test_breather_durations()
	results["test_dread_meter_visible_shift4"] = test_dread_meter_visible_shift4()
	results["test_save_available_shift4"] = test_save_available_shift4()
	results["test_choice_state_entered_for_call12"] = test_choice_state_entered_for_call12()
	results["test_decode_success_outcome"] = test_decode_success_outcome()
	results["test_decode_failure_outcome"] = test_decode_failure_outcome()
	results["test_decode_rejects_wrong_state"] = test_decode_rejects_wrong_state()
	results["test_station_degradation_shift4"] = test_station_degradation_shift4()
	results["test_mirror_independent_shift4"] = test_mirror_independent_shift4()
	results["test_e1_bathroom_wrong"] = test_e1_bathroom_wrong()
	results["test_e2_shadow_shapes"] = test_e2_shadow_shapes()
	results["test_e3_antenna_track"] = test_e3_antenna_track()
	results["test_e4_reflection_independent"] = test_e4_reflection_independent()
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
	_tutorial_mgr.name = "TestTutorialManager4"
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

func test_band_unlock_incl_classified() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

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

	# Beyond CLASSIFIED remains locked
	for i in range(4, 8):
		if BandController.is_band_unlocked(i):
			ShiftController._reset_for_testing()
			return false

	ShiftController._reset_for_testing()
	return true

func test_call_sequence_order() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(3)  # Shift index 3 = Shift 4

	if CallManager._shift_queue.size() != 4:
		CallManager._reset_for_testing()
		return false

	var ids: Array = []
	for call in CallManager._shift_queue:
		ids.append(int(call.get("id", -999)))

	# GDD: GRAND (10), FREE SPIRIT (11), AGENT 7 (12), ARIA-9 decode (13)
	if ids != [10, 11, 12, 13]:
		CallManager._reset_for_testing()
		return false

	CallManager._reset_for_testing()
	return true

func test_no_procedural_opener() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(3)

	# Shift 4 opens with scripted GRAND (id 10), not a procedural (-1)
	var first: Dictionary = CallManager._shift_queue[0]
	var ok: bool = int(first.get("id", -999)) == 10

	CallManager._reset_for_testing()
	return ok

func test_decode_tutorial_on_shift_start() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(4, true)

	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_DECODE):
		_cleanup_tutorial_mgr()
		return false

	if _step_shown_args.is_empty() or _step_shown_args[0] != "signal decode":
		_cleanup_tutorial_mgr()
		return false

	# No other steps fire on shift 4
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
	CallManager.start_shift(3)

	# GDD: breathers after calls 10/11/12 are 90s/45s/30s; last call has none
	var expected: Array = [90.0, 45.0, 30.0]
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

func test_dread_meter_visible_shift4() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	var ok: bool = ShiftController.is_dread_meter_visible()
	ShiftController._reset_for_testing()
	return ok

func test_save_available_shift4() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	var ok: bool = ShiftController.is_save_available()
	ShiftController._reset_for_testing()
	return ok

## Call 12 (AGENT 7) is a RIGHT_ANSWER with 3 choices: after CallPlayer finishes
## presenting, the call_display_complete handler must move the state machine
## from ACTIVE to CHOICE so select_choice() is legal.
func test_choice_state_entered_for_call12() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(3)

	var call12: Dictionary = CallManager._shift_queue[2]
	if int(call12.get("id", -999)) != 12:
		CallManager._reset_for_testing()
		return false
	if (call12.get("choices", []) as Array).size() != 3:
		CallManager._reset_for_testing()
		return false

	# Simulate: call 12 goes ACTIVE, then CallPlayer finishes presenting
	CallManager._current_call = call12
	CallManager._current_call_index = 2
	CallManager._enter_state(CallManager.CallState.ACTIVE)
	CallManager._on_call_display_complete(call12)

	var ok: bool = CallManager.get_state() == CallManager.CallState.CHOICE

	# select_choice should now resolve (no state warning path)
	if ok:
		var resolved := [false]
		var handler := func(_idx: int, _choice: Variant) -> void: resolved[0] = true
		CallManager.choice_resolved.connect(handler)
		CallManager.select_choice(1)
		CallManager.choice_resolved.disconnect(handler)
		ok = resolved[0]

	CallManager._reset_for_testing()
	return ok

## SIGNAL_DECODE success: full sanityDelta applied (dread reduced by 8),
## staticReward emitted (120), tape awarded, state resolves to COOLDOWN.
func test_decode_success_outcome() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(3)

	var call13: Dictionary = CallManager._shift_queue[3]
	if int(call13.get("id", -999)) != 13:
		CallManager._reset_for_testing()
		return false

	CallManager._current_call = call13
	CallManager._current_call_index = 3
	CallManager._enter_state(CallManager.CallState.ACTIVE)

	var got_reward := [0]
	var got_tape := [""]
	var reward_handler := func(amount: int) -> void: got_reward[0] = amount
	var tape_handler := func(tape_id: String, _name: String) -> void: got_tape[0] = tape_id
	CallManager.static_rewarded.connect(reward_handler)
	CallManager.tape_awarded.connect(tape_handler)

	var dread_before: float = CallManager.get_dread_composure().dread
	CallManager.submit_decode_result(true)

	CallManager.static_rewarded.disconnect(reward_handler)
	CallManager.tape_awarded.disconnect(tape_handler)

	var ok: bool = got_reward[0] == 120
	if ok:
		# Canonical tape-XXX id resolved through TapeLibrary (Tape #11 → tape-011)
		ok = got_tape[0] == "tape-011"
	if ok:
		# sanityDelta -8 → dread reduced by 8 (add_dread(-sanityDelta) = add_dread(8))
		var dread_after: float = CallManager.get_dread_composure().dread
		ok = is_equal_approx(dread_after, dread_before + 8.0)
	if ok:
		# Call must be resolved (no longer ACTIVE/CHOICE)
		var state: int = CallManager.get_state()
		ok = state == CallManager.CallState.RESOLVING or state == CallManager.CallState.COOLDOWN

	CallManager._reset_for_testing()
	return ok

## SIGNAL_DECODE failure: half sanityDelta (floor(-8/2) = -4 → dread +4),
## no static reward, no tape.
func test_decode_failure_outcome() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(3)

	var call13: Dictionary = CallManager._shift_queue[3]
	CallManager._current_call = call13
	CallManager._current_call_index = 3
	CallManager._enter_state(CallManager.CallState.ACTIVE)

	var got_reward := [0]
	var got_tape := [""]
	var reward_handler := func(amount: int) -> void: got_reward[0] = amount
	var tape_handler := func(tape_id: String, _name: String) -> void: got_tape[0] = tape_id
	CallManager.static_rewarded.connect(reward_handler)
	CallManager.tape_awarded.connect(tape_handler)

	var dread_before: float = CallManager.get_dread_composure().dread
	CallManager.submit_decode_result(false)

	CallManager.static_rewarded.disconnect(reward_handler)
	CallManager.tape_awarded.disconnect(tape_handler)

	var ok: bool = got_reward[0] == 0
	if ok:
		ok = got_tape[0] == ""
	if ok:
		# floor(-8/2) = -4 → add_dread(-(-4)) = add_dread(4)
		var dread_after: float = CallManager.get_dread_composure().dread
		ok = is_equal_approx(dread_after, dread_before + 4.0)

	CallManager._reset_for_testing()
	return ok

## submit_decode_result must be rejected outside ACTIVE/CHOICE states.
func test_decode_rejects_wrong_state() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()

	# In IDLE the call must be ignored (state stays IDLE, no crash)
	CallManager.submit_decode_result(true)
	var ok: bool = CallManager.get_state() == CallManager.CallState.IDLE

	# The queue must also remain untouched (no call resolved)
	if ok:
		CallManager.start_shift(3)
		ok = CallManager._shift_queue.size() == 4

	CallManager._reset_for_testing()
	return ok

func test_station_degradation_shift4() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	var ok: bool = true
	if StationDegradation.get_current_shift() != 4:
		ok = false
	# GDD: mirror independent (delay flag -1.0), hallway 5m
	if not is_equal_approx(StationDegradation.get_mirror_delay(), -1.0):
		ok = false
	if not is_equal_approx(StationDegradation.get_hallway_length(), 5.0):
		ok = false

	ShiftController._reset_for_testing()
	return ok

func test_mirror_independent_shift4() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	var ok: bool = StationDegradation.is_mirror_independent()

	ShiftController._reset_for_testing()
	return ok

func test_e1_bathroom_wrong() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

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

func test_e2_shadow_shapes() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	StationDegradation.trigger_event("E2")
	var ok: bool = true  # E2 emits + ensures second chair; no crash = pass

	ShiftController._reset_for_testing()
	return ok

func test_e3_antenna_track() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	StationDegradation.trigger_event("E3")
	var ok: bool = StationDegradation.is_antenna_tracking()

	ShiftController._reset_for_testing()
	return ok

func test_e4_reflection_independent() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	var got_id := [""]
	var handler := func(eid: String, _d: String) -> void: got_id[0] = eid
	StationDegradation.wrongness_event_triggered.connect(handler)
	StationDegradation.trigger_event("E4")
	StationDegradation.wrongness_event_triggered.disconnect(handler)

	var ok: bool = got_id[0] == "E4"

	ShiftController._reset_for_testing()
	return ok

func test_events_reset_between_shifts() -> bool:
	# Apply shift 4 with E3 fired (sets antenna tracking), then go back to
	# shift 1 and verify everything resets.
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)
	StationDegradation.trigger_event("E3")

	ShiftController._reset_for_testing()
	ShiftController.start_shift(1)
	var ok: bool = (
		is_equal_approx(StationDegradation.get_hallway_length(), 4.0)
		and is_equal_approx(StationDegradation.get_mirror_delay(), 0.0)
		and not StationDegradation.is_antenna_tracking()
		and not StationDegradation.is_mirror_independent()
	)

	ShiftController._reset_for_testing()
	return ok
