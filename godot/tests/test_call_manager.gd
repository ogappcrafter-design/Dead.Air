# gdlint:ignore=max-public-methods
## test_call_manager.gd — Unit tests for CallManager state machine and shift scheduling.
## Tests: initial state, shift start/queue building, procedural call generation,
## skip/choice safety, reset, sub-system availability, signal emission.
extends RefCounted

var test_name: String = "CallManager"
var _signal_captured: Variant = null


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_initial_state"] = test_initial_state()
	results["test_dread_composure_available"] = test_dread_composure_available()
	results["test_signal_strength_available"] = test_signal_strength_available()
	results["test_is_in_call_false_when_idle"] = test_is_in_call_false_when_idle()
	results["test_start_shift_1"] = test_start_shift_1()
	results["test_shift_1_queue_has_4_calls"] = test_shift_1_queue_has_4_calls()
	results["test_shift_1_first_call_is_procedural"] = test_shift_1_first_call_is_procedural()
	results["test_shift_1_has_scripted_calls"] = test_shift_1_has_scripted_calls()
	results["test_start_shift_2"] = test_start_shift_2()
	results["test_shift_2_queue_has_4_calls"] = test_shift_2_queue_has_4_calls()
	results["test_shift_2_first_call_is_procedural"] = test_shift_2_first_call_is_procedural()
	results["test_shift_2_has_scripted_calls"] = test_shift_2_has_scripted_calls()
	results["test_procedural_call_is_just_listen"] = test_procedural_call_is_just_listen()
	results["test_procedural_call_band_0"] = test_procedural_call_band_0()
	results["test_procedural_call_static_reward_range"] = test_procedural_call_static_reward_range()
	results["test_procedural_call_has_lines"] = test_procedural_call_has_lines()
	results["test_skip_call_idle_no_crash"] = test_skip_call_idle_no_crash()
	results["test_select_choice_wrong_state_no_crash"] = test_select_choice_wrong_state_no_crash()
	results["test_reset_for_testing"] = test_reset_for_testing()
	results["test_shift_started_signal"] = test_shift_started_signal()
	# Reset after tests
	CallManager._reset_for_testing()
	return results


## Helper: reset CallManager before each test.
func _reset() -> void:
	CallManager._reset_for_testing()


func test_initial_state() -> bool:
	_reset()
	return CallManager.get_state() == CallManager.CallState.IDLE


func test_dread_composure_available() -> bool:
	_reset()
	return CallManager.get_dread_composure() != null


func test_signal_strength_available() -> bool:
	_reset()
	return CallManager.get_signal_strength() != null


func test_is_in_call_false_when_idle() -> bool:
	_reset()
	return CallManager.is_in_call() == false


func test_start_shift_1() -> bool:
	_reset()
	CallManager.start_shift(0)
	if not CallManager.is_shift_active():
		return false
	if CallManager.get_shift_number() != 0:
		return false
	return true


func test_shift_1_queue_has_4_calls() -> bool:
	_reset()
	CallManager.start_shift(0)
	return CallManager._shift_queue.size() == 4


func test_shift_1_first_call_is_procedural() -> bool:
	_reset()
	CallManager.start_shift(0)
	var first: Dictionary = CallManager._shift_queue[0]
	return first.get("id", -999) == -1


func test_shift_1_has_scripted_calls() -> bool:
	_reset()
	CallManager.start_shift(0)
	# Queue: [procedural(-1), call#0, call#1, call#3]
	var ids: Array = []
	for i in range(1, CallManager._shift_queue.size()):
		ids.append(int(CallManager._shift_queue[i].get("id", -999)))
	return ids == [0, 1, 3]


func test_start_shift_2() -> bool:
	_reset()
	CallManager.start_shift(1)
	if not CallManager.is_shift_active():
		return false
	if CallManager.get_shift_number() != 1:
		return false
	return true


func test_shift_2_queue_has_4_calls() -> bool:
	_reset()
	CallManager.start_shift(1)
	return CallManager._shift_queue.size() == 4


func test_shift_2_first_call_is_procedural() -> bool:
	_reset()
	CallManager.start_shift(1)
	var first: Dictionary = CallManager._shift_queue[0]
	return first.get("id", -999) == -1


func test_shift_2_has_scripted_calls() -> bool:
	_reset()
	CallManager.start_shift(1)
	# Queue: [procedural(-1), call#2, call#4, call#5]
	var ids: Array = []
	for i in range(1, CallManager._shift_queue.size()):
		ids.append(int(CallManager._shift_queue[i].get("id", -999)))
	return ids == [2, 4, 5]


func test_procedural_call_is_just_listen() -> bool:
	_reset()
	CallManager.start_shift(0)
	var proc_call: Dictionary = CallManager._shift_queue[0]
	return proc_call.get("type", "") == "JUST_LISTEN"


func test_procedural_call_band_0() -> bool:
	_reset()
	CallManager.start_shift(0)
	var proc_call: Dictionary = CallManager._shift_queue[0]
	return proc_call.get("band", -1) == 0


func test_procedural_call_static_reward_range() -> bool:
	_reset()
	CallManager.start_shift(0)
	var proc_call: Dictionary = CallManager._shift_queue[0]
	var reward: int = proc_call.get("staticReward", 0)
	return reward >= 10 and reward <= 20


func test_procedural_call_has_lines() -> bool:
	_reset()
	CallManager.start_shift(0)
	var proc_call: Dictionary = CallManager._shift_queue[0]
	var lines: Array = proc_call.get("lines", [])
	return lines.size() >= 3 and lines.size() <= 5


func test_skip_call_idle_no_crash() -> bool:
	_reset()
	# skip_call in IDLE should be a no-op, not crash
	CallManager.skip_call()
	return CallManager.get_state() == CallManager.CallState.IDLE


func test_select_choice_wrong_state_no_crash() -> bool:
	_reset()
	# select_choice in IDLE should push warning and return, not crash
	CallManager.select_choice(0)
	return CallManager.get_state() == CallManager.CallState.IDLE


func test_reset_for_testing() -> bool:
	_reset()
	CallManager.start_shift(0)
	if CallManager.get_state() == CallManager.CallState.IDLE:
		return false  # should be in COOLDOWN after start_shift
	CallManager._reset_for_testing()
	return CallManager.get_state() == CallManager.CallState.IDLE


func test_shift_started_signal() -> bool:
	_reset()
	_signal_captured = null
	CallManager.shift_started.connect(func(shift_num: int) -> void: _signal_captured = shift_num)
	CallManager.start_shift(0)
	return _signal_captured != null and int(_signal_captured) == 0
