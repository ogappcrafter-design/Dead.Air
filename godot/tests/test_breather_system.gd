extends RefCounted
## Tests for BreatherSystem autoload singleton.
##
## Tests breather lifecycle, signal emission, difficulty scaling,
## and regen flag integration with SignalStrength and DreadComposure.

var test_name: String = "BreatherSystem"

# Signal capture helpers (member vars for lambda-by-reference workaround)
var _signal_started: bool = false
var _signal_ended: bool = false


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_breather_initial_state"] = _test_breather_initial_state()
	results["test_start_breather"] = _test_start_breather()
	results["test_end_breather"] = _test_end_breather()
	results["test_breather_signals"] = _test_breather_signals()
	results["test_breather_timer_counts_down"] = _test_breather_timer_counts_down()
	results["test_difficulty_durations"] = _test_difficulty_durations()
	results["test_custom_duration"] = _test_custom_duration()
	results["test_regen_flags_set"] = _test_regen_flags_set()
	results["test_regen_flags_cleared"] = _test_regen_flags_cleared()
	results["test_reset_for_testing"] = _test_reset_for_testing()
	results["test_breather_remaining"] = _test_breather_remaining()
	return results


# ─── Setup ─────────────────────────────────────────────────────────────────


func _setup() -> void:
	if BreatherSystem:
		BreatherSystem._reset_for_testing()
	if CallManager:
		CallManager._reset_for_testing()


# ─── Tests ─────────────────────────────────────────────────────────────────


func _test_breather_initial_state() -> bool:
	_setup()
	if not BreatherSystem:
		push_error("BreatherSystem autoload not available")
		return false
	return not BreatherSystem.is_in_breather() and BreatherSystem.get_breather_remaining() == 0.0


func _test_start_breather() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.start_breather(2.0)
	var ok: bool = BreatherSystem.is_in_breather()
	BreatherSystem.end_breather()
	return ok


func _test_end_breather() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.start_breather(5.0)
	BreatherSystem.end_breather()
	return not BreatherSystem.is_in_breather()


func _test_breather_signals() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	_signal_started = false
	_signal_ended = false
	BreatherSystem.breather_started.connect(_on_test_breather_started)
	BreatherSystem.breather_ended.connect(_on_test_breather_ended)
	BreatherSystem.start_breather(1.0)
	var ok_start: bool = _signal_started
	BreatherSystem.end_breather()
	var ok_end: bool = _signal_ended
	BreatherSystem.breather_started.disconnect(_on_test_breather_started)
	BreatherSystem.breather_ended.disconnect(_on_test_breather_ended)
	return ok_start and ok_end


func _on_test_breather_started(_d: float) -> void:
	_signal_started = true


func _on_test_breather_ended() -> void:
	_signal_ended = true


func _test_breather_timer_counts_down() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.start_breather(1.0)
	# Simulate one frame of 0.1s
	BreatherSystem._process(0.1)
	var remaining: float = BreatherSystem.get_breather_remaining()
	BreatherSystem.end_breather()
	# After 0.1s of a 1.0s breather, remaining should be ~0.9
	return remaining > 0.0 and remaining < 1.0


func _test_difficulty_durations() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.set_difficulty(0)  # Easy
	var easy: float = BreatherSystem.get_difficulty_duration()
	BreatherSystem.set_difficulty(1)  # Normal
	var normal: float = BreatherSystem.get_difficulty_duration()
	BreatherSystem.set_difficulty(2)  # Hard
	var hard: float = BreatherSystem.get_difficulty_duration()
	BreatherSystem.set_difficulty(3)  # Nightmare
	var nightmare: float = BreatherSystem.get_difficulty_duration()
	return easy == 90.0 and normal == 60.0 and hard == 45.0 and nightmare == 30.0


func _test_custom_duration() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.start_breather(42.0)
	var dur: float = BreatherSystem.get_breather_duration()
	BreatherSystem.end_breather()
	return dur == 42.0


func _test_regen_flags_set() -> bool:
	_setup()
	if not BreatherSystem or not CallManager:
		return false
	BreatherSystem.start_breather(5.0)
	var ss: Node = CallManager.get_signal_strength()
	var dc: Node = CallManager.get_dread_composure()
	var ss_ok: bool = ss and ss.in_breather == true
	var dc_ok: bool = dc and dc.between_calls == true
	BreatherSystem.end_breather()
	return ss_ok and dc_ok


func _test_regen_flags_cleared() -> bool:
	_setup()
	if not BreatherSystem or not CallManager:
		return false
	BreatherSystem.start_breather(5.0)
	BreatherSystem.end_breather()
	var ss: Node = CallManager.get_signal_strength()
	var dc: Node = CallManager.get_dread_composure()
	var ss_ok: bool = ss and ss.in_breather == false
	var dc_ok: bool = dc and dc.between_calls == false
	return ss_ok and dc_ok


func _test_reset_for_testing() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	BreatherSystem.start_breather(10.0)
	BreatherSystem.set_difficulty(3)  # Nightmare
	BreatherSystem._reset_for_testing()
	return not BreatherSystem.is_in_breather() and BreatherSystem.get_difficulty_duration() == 60.0


func _test_breather_remaining() -> bool:
	_setup()
	if not BreatherSystem:
		return false
	# No breather active — should return 0
	var before: float = BreatherSystem.get_breather_remaining()
	BreatherSystem.start_breather(3.0)
	var after: float = BreatherSystem.get_breather_remaining()
	BreatherSystem._process(1.0)
	var after_process: float = BreatherSystem.get_breather_remaining()
	BreatherSystem.end_breather()
	return before == 0.0 and after == 3.0 and after_process < 3.0 and after_process > 1.5
