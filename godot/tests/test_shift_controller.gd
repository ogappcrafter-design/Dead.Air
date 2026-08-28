extends RefCounted
## Tests for ShiftController autoload.
##
## Verifies state transitions, shift data, signal emissions, and integration
## with CallManager, PhaseManager, and band unlock system.

var test_name: String = "ShiftController"

var _shift_started_count: int = 0
var _shift_started_arg: int = 0
var _phase_changed_count: int = 0
var _phase_changed_args: Array[String] = []
var _call_sequence_complete_count: int = 0
var _shift_complete_count: int = 0
var _shift_complete_arg: int = 0
var _band_unlocked_count: int = 0
var _band_unlocked_args: Array[String] = []


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shift_data_definitions"] = test_shift_data_definitions()
	results["test_is_shift_implemented"] = test_is_shift_implemented()
	results["test_start_shift_sets_state"] = test_start_shift_sets_state()
	results["test_phase_transitions"] = test_phase_transitions()
	results["test_shift_1_config"] = test_shift_1_config()
	results["test_shift_2_config"] = test_shift_2_config()
	results["test_band_unlock_signal"] = test_band_unlock_signal()
	results["test_shift_complete_signal"] = test_shift_complete_signal()
	results["test_call_sequence_complete"] = test_call_sequence_complete()
	results["test_unimplemented_shift_rejected"] = test_unimplemented_shift_rejected()
	results["test_phase_name_strings"] = test_phase_name_strings()
	_disconnect_signals()
	return results


# ─── Helpers ─────────────────────────────────────────────────────────────────


func _connect_signals() -> void:
	_shift_started_count = 0
	_shift_started_arg = 0
	_phase_changed_count = 0
	_phase_changed_args.clear()
	_call_sequence_complete_count = 0
	_shift_complete_count = 0
	_shift_complete_arg = 0
	_band_unlocked_count = 0
	_band_unlocked_args.clear()
	ShiftController.shift_started.connect(_on_shift_started)
	ShiftController.shift_phase_changed.connect(_on_phase_changed)
	ShiftController.call_sequence_complete.connect(_on_call_sequence_complete)
	ShiftController.shift_complete.connect(_on_shift_complete)
	ShiftController.band_unlocked.connect(_on_band_unlocked)


func _disconnect_signals() -> void:
	if ShiftController.shift_started.is_connected(_on_shift_started):
		ShiftController.shift_started.disconnect(_on_shift_started)
	if ShiftController.shift_phase_changed.is_connected(_on_phase_changed):
		ShiftController.shift_phase_changed.disconnect(_on_phase_changed)
	if ShiftController.call_sequence_complete.is_connected(_on_call_sequence_complete):
		ShiftController.call_sequence_complete.disconnect(_on_call_sequence_complete)
	if ShiftController.shift_complete.is_connected(_on_shift_complete):
		ShiftController.shift_complete.disconnect(_on_shift_complete)
	if ShiftController.band_unlocked.is_connected(_on_band_unlocked):
		ShiftController.band_unlocked.disconnect(_on_band_unlocked)


func _reset() -> void:
	ShiftController._reset_for_testing()
	if CallManager:
		CallManager._reset_for_testing()
	_connect_signals()


func _on_shift_started(shift_number: int) -> void:
	_shift_started_count += 1
	_shift_started_arg = shift_number


func _on_phase_changed(phase: String) -> void:
	_phase_changed_count += 1
	_phase_changed_args.append(phase)


func _on_call_sequence_complete() -> void:
	_call_sequence_complete_count += 1


func _on_shift_complete(shift_number: int) -> void:
	_shift_complete_count += 1
	_shift_complete_arg = shift_number


func _on_band_unlocked(band_name: String) -> void:
	_band_unlocked_count += 1
	_band_unlocked_args.append(band_name)


# ─── Tests ────────────────────────────────────────────────────────────────────


func test_shift_data_definitions() -> bool:
	# Shift 1 data
	var s1: Dictionary = ShiftController.get_shift_data(1)
	var s1_ok: bool = (
		not s1.is_empty()
		and s1["shift_number"] == 1
		and s1["bands"] == ["LIVING"]
		and s1["dread_meter_visible"] == false
		and s1["save_unlocked"] == false
		and s1["tutorial"] == true
	)

	# Shift 2 data
	var s2: Dictionary = ShiftController.get_shift_data(2)
	var s2_ok: bool = (
		not s2.is_empty()
		and s2["shift_number"] == 2
		and s2["bands"] == ["LIVING", "LIMINAL"]
		and s2["dread_meter_visible"] == true
		and s2["save_unlocked"] == true
		and s2["tutorial"] == true
	)

	# Out of range returns empty
	var oob_ok: bool = (
		ShiftController.get_shift_data(0).is_empty()
		and ShiftController.get_shift_data(99).is_empty()
	)

	return s1_ok and s2_ok and oob_ok


func test_is_shift_implemented() -> bool:
	if not ShiftController.is_shift_implemented(1) or not ShiftController.is_shift_implemented(2):
		return false
	if ShiftController.is_shift_implemented(3) or ShiftController.is_shift_implemented(5):
		return false
	if ShiftController.is_shift_implemented(0) or ShiftController.is_shift_implemented(-1):
		return false
	return true


func test_start_shift_sets_state() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	if not ShiftController.is_shift_active() or ShiftController.get_current_shift() != 1:
		return false
	if _shift_started_count != 1 or _shift_started_arg != 1:
		return false
	# Phase should have changed at least once (PRE_SHIFT)
	if _phase_changed_count < 1 or _phase_changed_args[0] != "pre_shift":
		return false

	ShiftController._reset_for_testing()
	return true


func test_phase_transitions() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# PRE_SHIFT → CALLS_ACTIVE (testing mode skips timer, but we force it)
	ShiftController._force_enter_calls_active()

	if ShiftController.get_current_phase_name() != "calls_active":
		return false

	# CALLS_ACTIVE → POST_SHIFT
	ShiftController._force_enter_post_shift()

	if ShiftController.get_current_phase_name() != "post_shift":
		return false

	# POST_SHIFT → SHIFT_TRANSITION
	ShiftController._force_enter_shift_transition()

	if ShiftController.get_current_phase_name() != "transition":
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_1_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Shift 1: LIVING only, no dread, no save
	if ShiftController.is_dread_meter_visible() != false:
		return false
	if ShiftController.is_save_available() != false:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 1:
		return false
	if bands[0] != "LIVING":
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_2_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2: LIMINAL unlocked, dread shown, save unlocked
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 2:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false

	ShiftController._reset_for_testing()
	return true


func test_band_unlock_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2 unlocks LIVING and LIMINAL
	# LIVING should fire on shift 1 start; on shift 2 both should fire
	if _band_unlocked_count < 1:
		return false
	# Check LIMINAL was unlocked
	var found_liminal := false
	for b in _band_unlocked_args:
		if b == "LIMINAL":
			found_liminal = true
			break
	if not found_liminal:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_complete_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._force_enter_calls_active()
	ShiftController._force_enter_post_shift()
	ShiftController._force_enter_shift_transition()
	ShiftController._force_complete_shift()

	if _shift_complete_count != 1:
		return false
	if _shift_complete_arg != 1:
		return false
	if ShiftController.is_shift_active() != false:
		return false

	ShiftController._reset_for_testing()
	return true


func test_call_sequence_complete() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._force_enter_calls_active()

	# Simulate CallManager finishing all calls
	ShiftController._on_call_manager_shift_ended(0)

	if _call_sequence_complete_count != 1:
		return false
	if ShiftController.get_current_phase_name() != "post_shift":
		return false

	ShiftController._reset_for_testing()
	return true


func test_unimplemented_shift_rejected() -> bool:
	_reset()
	ShiftController.start_shift(3)  # Shift 3 is not implemented

	if ShiftController.is_shift_active():
		return false
	if ShiftController.get_current_shift() != 0:
		return false

	ShiftController.start_shift(5)  # Shift 5 is not implemented

	if ShiftController.is_shift_active():
		return false

	ShiftController._reset_for_testing()
	return true


func test_phase_name_strings() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Collect all phase names through a full cycle
	var phase_names: Array[String] = []
	phase_names.append(ShiftController.get_current_phase_name())  # pre_shift

	ShiftController._force_enter_calls_active()
	phase_names.append(ShiftController.get_current_phase_name())  # calls_active

	ShiftController._force_enter_post_shift()
	phase_names.append(ShiftController.get_current_phase_name())  # post_shift

	ShiftController._force_enter_shift_transition()
	phase_names.append(ShiftController.get_current_phase_name())  # transition

	if phase_names[0] != "pre_shift":
		return false
	if phase_names[1] != "calls_active":
		return false
	if phase_names[2] != "post_shift":
		return false
	if phase_names[3] != "transition":
		return false

	ShiftController._reset_for_testing()
	return true
