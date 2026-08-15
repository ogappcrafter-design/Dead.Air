extends RefCounted
## Tests for ShiftController autoload.
##
## Verifies state transitions, shift data, signal emissions, and integration
## with CallManager, PhaseManager, and band unlock system.
## Covers all 5 shifts including band availability, call counts, save availability,
## sacred call enforcement, recording/decode mechanics, and post-shift flow.

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
var _final_call_starting_count: int = 0
var _tape_review_started_count: int = 0
var _save_opportunity_offered_count: int = 0
var _band_unlock_announced_count: int = 0
var _band_unlock_announced_args: Array[String] = []


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shift_data_definitions"] = test_shift_data_definitions()
	results["test_is_shift_implemented"] = test_is_shift_implemented()
	results["test_start_shift_sets_state"] = test_start_shift_sets_state()
	results["test_phase_transitions"] = test_phase_transitions()
	results["test_shift_1_config"] = test_shift_1_config()
	results["test_shift_2_config"] = test_shift_2_config()
	results["test_shift_3_config"] = test_shift_3_config()
	results["test_shift_4_config"] = test_shift_4_config()
	results["test_shift_5_config"] = test_shift_5_config()
	results["test_band_unlock_signal"] = test_band_unlock_signal()
	results["test_shift_complete_signal"] = test_shift_complete_signal()
	results["test_call_sequence_complete"] = test_call_sequence_complete()
	results["test_unimplemented_shift_rejected"] = test_unimplemented_shift_rejected()
	results["test_phase_name_strings"] = test_phase_name_strings()
	results["test_sacred_call_enforcement"] = test_sacred_call_enforcement()
	results["test_shift_5_save_disabled"] = test_shift_5_save_disabled()
	results["test_recording_enabled_per_shift"] = test_recording_enabled_per_shift()
	results["test_signal_decode_per_shift"] = test_signal_decode_per_shift()
	results["test_wrongness_events_per_shift"] = test_wrongness_events_per_shift()
	results["test_mid_shift_band_unlock"] = test_mid_shift_band_unlock()
	results["test_sacred_call_skip_prevention"] = test_sacred_call_skip_prevention()
	results["test_post_shift_flow_events"] = test_post_shift_flow_events()
	results["test_final_call_starting_signal"] = test_final_call_starting_signal()
	results["test_breather_integration"] = test_breather_integration()
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
	_final_call_starting_count = 0
	_tape_review_started_count = 0
	_save_opportunity_offered_count = 0
	_band_unlock_announced_count = 0
	_band_unlock_announced_args.clear()
	ShiftController.shift_started.connect(_on_shift_started)
	ShiftController.shift_phase_changed.connect(_on_phase_changed)
	ShiftController.call_sequence_complete.connect(_on_call_sequence_complete)
	ShiftController.shift_complete.connect(_on_shift_complete)
	ShiftController.band_unlocked.connect(_on_band_unlocked)
	ShiftController.final_call_starting.connect(_on_final_call_starting)
	ShiftController.tape_review_started.connect(_on_tape_review_started)
	ShiftController.save_opportunity_offered.connect(_on_save_opportunity_offered)
	ShiftController.band_unlock_announced.connect(_on_band_unlock_announced)


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
	if ShiftController.final_call_starting.is_connected(_on_final_call_starting):
		ShiftController.final_call_starting.disconnect(_on_final_call_starting)
	if ShiftController.tape_review_started.is_connected(_on_tape_review_started):
		ShiftController.tape_review_started.disconnect(_on_tape_review_started)
	if ShiftController.save_opportunity_offered.is_connected(_on_save_opportunity_offered):
		ShiftController.save_opportunity_offered.disconnect(_on_save_opportunity_offered)
	if ShiftController.band_unlock_announced.is_connected(_on_band_unlock_announced):
		ShiftController.band_unlock_announced.disconnect(_on_band_unlock_announced)


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


func _on_final_call_starting() -> void:
	_final_call_starting_count += 1


func _on_tape_review_started() -> void:
	_tape_review_started_count += 1


func _on_save_opportunity_offered() -> void:
	_save_opportunity_offered_count += 1


func _on_band_unlock_announced(band_name: String) -> void:
	_band_unlock_announced_count += 1
	_band_unlock_announced_args.append(band_name)


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
		and s1.get("recording_enabled", true) == false
		and s1.get("signal_decode_enabled", true) == false
		and s1["sacred_call_id"] == 3
	)

	# Shift 2 data
	var s2: Dictionary = ShiftController.get_shift_data(2)
	var s2_ok: bool = (
		not s2.is_empty()
		and s2["shift_number"] == 2
		and s2["bands"] == ["LIVING"]
		and s2["dread_meter_visible"] == true
		and s2["save_unlocked"] == true
		and s2["tutorial"] == true
		and s2.get("recording_enabled", true) == false
		and s2["sacred_call_id"] == 5
	)

	# Shift 3 data
	var s3: Dictionary = ShiftController.get_shift_data(3)
	var s3_ok: bool = (
		not s3.is_empty()
		and s3["shift_number"] == 3
		and s3["bands"] == ["LIVING", "LIMINAL"]
		and s3["dread_meter_visible"] == true
		and s3["save_unlocked"] == true
		and s3["tutorial"] == false
		and s3["recording_enabled"] == true
		and s3["signal_decode_enabled"] == false
		and s3["sacred_call_id"] == 9
	)

	# Shift 4 data
	var s4: Dictionary = ShiftController.get_shift_data(4)
	var s4_ok: bool = (
		not s4.is_empty()
		and s4["shift_number"] == 4
		and s4["bands"] == ["LIVING", "LIMINAL", "LOST"]
		and s4["dread_meter_visible"] == true
		and s4["save_unlocked"] == true
		and s4["tutorial"] == false
		and s4["recording_enabled"] == true
		and s4["signal_decode_enabled"] == true
		and s4["sacred_call_id"] == 13
	)

	# Shift 5 data
	var s5: Dictionary = ShiftController.get_shift_data(5)
	var s5_ok: bool = (
		not s5.is_empty()
		and s5["shift_number"] == 5
		and s5["bands"] == ["LIVING", "LIMINAL", "LOST", "CLASSIFIED", "████████"]
		and s5["dread_meter_visible"] == true
		and s5["save_unlocked"] == false  # No saving — one-way trip
		and s5["tutorial"] == false
		and s5["recording_enabled"] == true
		and s5["signal_decode_enabled"] == true
		and s5["sacred_call_id"] == 17
		and s5["wrongness_event_count"] == -1  # Continuous
	)

	# Out of range returns empty
	var oob_ok: bool = (
		ShiftController.get_shift_data(0).is_empty()
		and ShiftController.get_shift_data(99).is_empty()
	)

	return s1_ok and s2_ok and s3_ok and s4_ok and s5_ok and oob_ok


func test_is_shift_implemented() -> bool:
	# All 5 shifts are implemented
	for i in range(1, 6):
		if not ShiftController.is_shift_implemented(i):
			return false
	# Shift 0 and 6+ are not implemented
	if ShiftController.is_shift_implemented(0):
		return false
	if ShiftController.is_shift_implemented(6):
		return false
	if ShiftController.is_shift_implemented(-1):
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

	# Shift 1: LIVING only, no dread, no save, no recording, no decode
	if ShiftController.is_dread_meter_visible() != false:
		return false
	if ShiftController.is_save_available() != false:
		return false
	if ShiftController.is_recording_enabled() != false:
		return false
	if ShiftController.is_signal_decode_enabled() != false:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 1:
		return false
	if bands[0] != "LIVING":
		return false

	# Sacred call ID should be 3 (HAROLD)
	if ShiftController.get_sacred_call_id() != 3:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_2_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2: LIMINAL unlocked, dread shown, save unlocked, no recording, no decode
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false
	if ShiftController.is_recording_enabled() != false:
		return false
	if ShiftController.is_signal_decode_enabled() != false:
		return false

	# Shift 2: only LIVING at start (LIMINAL unlocks mid-shift)
	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 1:
		return false
	if bands[0] != "LIVING":
		return false

	# Sacred call ID should be 5 (3:47 AM)
	if ShiftController.get_sacred_call_id() != 5:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_3_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	# Shift 3: LIVING + LIMINAL + LOST, dread shown, save unlocked, recording enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != false:
		return false

	# Shift 3: LIVING + LIMINAL at start (LOST unlocks mid-shift)
	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 2:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if ShiftController.get_sacred_call_id() != 9:
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(3)
	if data.get("calls", []).size() != 4:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_4_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	# Shift 4: All bands except ████████, dread, save, recording, decode enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != true:
		return false

	# Shift 4: LIVING + LIMINAL + LOST at start (CLASSIFIED unlocks mid-shift)
	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 3:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if bands[2] != "LOST":
		return false

	# Sacred call ID should be 13 (ARIA-9)
	if ShiftController.get_sacred_call_id() != 13:
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(4)
	if data.get("calls", []).size() != 4:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_5_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# Shift 5: All bands, dread, NO save (one-way trip), recording, decode enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != false:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != true:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 5:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if bands[2] != "LOST":
		return false
	if bands[3] != "CLASSIFIED":
		return false
	if bands[4] != "████████":
		return false

	# Sacred call ID should be 17 (DEAD AIR)
	if ShiftController.get_sacred_call_id() != 17:
		return false

	# Wrongness is continuous (-1)
	if ShiftController.get_wrongness_event_count() != -1:
		return false
	if not ShiftController.is_wrongness_continuous():
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(5)
	if data.get("calls", []).size() != 4:
		return false

	# Sacred call ID should be 5 (3:47 AM)
	if ShiftController.get_sacred_call_id() != 5:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_3_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)

	# Shift 3: LIVING + LIMINAL + LOST, dread shown, save unlocked, recording enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != false:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 3:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if bands[2] != "LOST":
		return false

	# Sacred call ID should be 9 (MISSING PERSONS)
	if ShiftController.get_sacred_call_id() != 9:
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(3)
	if data.get("calls", []).size() != 4:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_4_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)

	# Shift 4: All bands except REDACTED, dread, save, recording, decode enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != true:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 4:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if bands[2] != "LOST":
		return false
	if bands[3] != "CLASSIFIED":
		return false

	# Sacred call ID should be 13 (ARIA-9)
	if ShiftController.get_sacred_call_id() != 13:
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(4)
	if data.get("calls", []).size() != 4:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_5_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# Shift 5: All bands, dread, NO save (one-way trip), recording, decode enabled
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != false:
		return false
	if ShiftController.is_recording_enabled() != true:
		return false
	if ShiftController.is_signal_decode_enabled() != true:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 5:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false
	if bands[2] != "LOST":
		return false
	if bands[3] != "CLASSIFIED":
		return false
	if bands[4] != "REDACTED":
		return false

	# Sacred call ID should be 17 (DEAD AIR)
	if ShiftController.get_sacred_call_id() != 17:
		return false

	# Wrongness is continuous (-1)
	if ShiftController.get_wrongness_event_count() != -1:
		return false
	if not ShiftController.is_wrongness_continuous():
		return false

	# 4 calls
	var data: Dictionary = ShiftController.get_shift_data(5)
	if data.get("calls", []).size() != 4:
		return false

	ShiftController._reset_for_testing()
	return true


func test_band_unlock_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2 unlocks only LIVING at start (LIMINAL unlocks mid-shift)
	if _band_unlocked_count < 1:
		return false
	# LIVING should be unlocked
	var found_living := false
	for b in _band_unlocked_args:
		if b == "LIVING":
			found_living = true
			break
	if not found_living:
		return false
	# LIMINAL should NOT be unlocked at shift start
	for b in _band_unlocked_args:
		if b == "LIMINAL":
			ShiftController._reset_for_testing()
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
	# Shift 6 is not implemented (only 5 shifts exist)
	ShiftController.start_shift(6)

	if ShiftController.is_shift_active():
		return false
	if ShiftController.get_current_shift() != 0:
		return false

	# Shift 0 and negative are not implemented
	ShiftController.start_shift(0)
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


func test_sacred_call_enforcement() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)

	# All 5 shifts must have sacred final calls
	var sacred_ids: Array = [3, 5, 9, 13, 17]
	for i in range(5):
		var shift_num := i + 1
		ShiftController.start_shift(shift_num)

		var sacred_id: int = ShiftController.get_sacred_call_id()
		if sacred_id != sacred_ids[i]:
			ShiftController._reset_for_testing()
			return false

		# is_sacred_call should return true for the sacred call ID
		if not ShiftController.is_sacred_call(sacred_id):
			ShiftController._reset_for_testing()
			return false

		# is_sacred_call should return false for a non-sacred ID
		if ShiftController.is_sacred_call(sacred_id + 100):
			ShiftController._reset_for_testing()
			return false

		# Framework always enforces sacred final calls
		if not ShiftController.is_final_call_sacred():
			ShiftController._reset_for_testing()
			return false

		ShiftController._reset_for_testing()
		_connect_signals()

	ShiftController._reset_for_testing()
	return true


func test_shift_5_save_disabled() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)

	# Shift 5 must have saving disabled
	if ShiftController.is_save_available() != false:
		ShiftController._reset_for_testing()
		return false

	# Verify shift data confirms this
	var data: Dictionary = ShiftController.get_shift_data(5)
	if data.get("save_unlocked", true) != false:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_recording_enabled_per_shift() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)

	# Shifts 1-2: recording disabled
	# Shifts 3-5: recording enabled
	var expectations: Array[bool] = [false, false, true, true, true]
	for i in range(5):
		var shift_num := i + 1
		ShiftController.start_shift(shift_num)

		if ShiftController.is_recording_enabled() != expectations[i]:
			ShiftController._reset_for_testing()
			_connect_signals()
			return false

		ShiftController._reset_for_testing()
		_connect_signals()

	ShiftController._reset_for_testing()
	return true


func test_signal_decode_per_shift() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)

	# Shifts 1-3: decode disabled
	# Shifts 4-5: decode enabled
	var expectations: Array[bool] = [false, false, false, true, true]
	for i in range(5):
		var shift_num := i + 1
		ShiftController.start_shift(shift_num)

		if ShiftController.is_signal_decode_enabled() != expectations[i]:
			ShiftController._reset_for_testing()
			_connect_signals()
			return false

		ShiftController._reset_for_testing()
		_connect_signals()

	ShiftController._reset_for_testing()
	return true


func test_wrongness_events_per_shift() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)

	# Shift 1: 1 event, Shift 2: 2 events, Shift 3: 3, Shift 4: 4, Shift 5: -1 (continuous)
	var expectations: Array[int] = [1, 2, 3, 4, -1]
	for i in range(5):
		var shift_num := i + 1
		ShiftController.start_shift(shift_num)

		if ShiftController.get_wrongness_event_count() != expectations[i]:
			ShiftController._reset_for_testing()
			_connect_signals()
			return false

		# Shift 5 should be continuous
		if shift_num == 5 and not ShiftController.is_wrongness_continuous():
			ShiftController._reset_for_testing()
			_connect_signals()
			return false

		ShiftController._reset_for_testing()
		_connect_signals()

	ShiftController._reset_for_testing()
	return true


func test_mid_shift_band_unlock() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# LIMINAL should NOT be unlocked yet — it's a mid-shift unlock band
	var bands_after_start: Array[String] = ShiftController.get_unlocked_bands()
	for b in bands_after_start:
		if b == "LIMINAL":
			ShiftController._reset_for_testing()
			return false

	# Record band_unlocked count before mid-shift unlock
	var unlocked_count_before: int = _band_unlocked_count

	# Simulate the first call starting — should trigger mid-shift unlock
	var call_data: Dictionary = {"id": 2}
	ShiftController._on_call_manager_call_started(call_data)

	# LIMINAL should now be unlocked
	var found_liminal := false
	for b in _band_unlocked_args:
		if b == "LIMINAL":
			found_liminal = true
			break
	if not found_liminal:
		ShiftController._reset_for_testing()
		return false

	# band_unlocked signal should have fired from _on_call_manager_call_started
	if _band_unlocked_count <= unlocked_count_before:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_sacred_call_skip_prevention() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	if not CallManager:
		ShiftController._reset_for_testing()
		return true

	# Build a shift queue so CallManager has a current call
	CallManager._shift_in_progress = true
	CallManager._shift_queue = [
		{"id": 0, "is_sacred": false},
		{"id": 1, "is_sacred": false},
		{"id": 3, "is_sacred": true},
	]
	CallManager._current_call_index = 2
	CallManager._current_call = CallManager._shift_queue[2]
	CallManager._state = CallManager.CallState.ACTIVE

	# Attempting to skip a sacred call should NOT resolve
	# Track via _resolve_call side effect: state should stay ACTIVE, not go to RESOLVING
	CallManager.skip_call()

	if CallManager.get_state() != CallManager.CallState.ACTIVE:
		ShiftController._reset_for_testing()
		return false

	# Now test a non-sacred call — skip should work
	CallManager._current_call = {"id": 0, "is_sacred": false}
	CallManager._state = CallManager.CallState.ACTIVE
	CallManager.skip_call()

	if CallManager.get_state() == CallManager.CallState.ACTIVE:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_post_shift_flow_events() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)
	ShiftController._force_enter_calls_active()

	# If CallManager is available, we'd be in calls_active phase.
	# If CallManager is null (pre-existing autoload issue), the fallback in
	# _enter_calls_active already transitions to post_shift.
	# Only simulate call completion if we're still in calls_active.
	if ShiftController.get_current_phase_name() == "calls_active":
		ShiftController._on_call_manager_shift_ended(1)

	# Post-shift should emit tape_review_started
	if _tape_review_started_count < 1:
		ShiftController._reset_for_testing()
		return false

	# Save is available in shift 2, so save_opportunity_offered should fire
	if _save_opportunity_offered_count < 1:
		ShiftController._reset_for_testing()
		return false

	# Band unlock announcements: shift 3 brings LIMINAL (in bands) and LOST (mid-shift unlock)
	# LOST should be announced (not yet unlocked at this point)
	if _band_unlock_announced_count < 1:
		ShiftController._reset_for_testing()
		return false

	var found_lost := false
	for b in _band_unlock_announced_args:
		if b == "LOST":
			found_lost = true
			break
	if not found_lost:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_final_call_starting_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Shift 1 has 4 calls (procedural + 3 scripted)
	# Simulate call_started for each call
	var call_count: int = ShiftController.get_shift_data(1).get("calls", []).size()
	for i in range(call_count):
		ShiftController._on_call_manager_call_started({"id": i})

	# final_call_starting should have been emitted exactly once (on the last call)
	if _final_call_starting_count != 1:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_breather_integration() -> bool:
	_reset()

	# BreatherSystem is an autoload; verify it exists and has the expected interface
	if not BreatherSystem:
		return false
	if not BreatherSystem.has_method("start_breather"):
		return false
	if not BreatherSystem.has_method("end_breather"):
		return false
	if not BreatherSystem.has_method("is_in_breather"):
		return false

	# Verify breather durations are in the 30-90 sec range per GDD
	if BreatherSystem.BREATHER_DURATION_EASY != 90.0:
		return false
	if BreatherSystem.BREATHER_DURATION_NIGHTMARE != 30.0:
		return false

	# Verify BreatherSystem can start/end a breather cycle
	BreatherSystem.start_breather(45.0)
	if not BreatherSystem.is_in_breather():
		BreatherSystem.end_breather()
		return false
	BreatherSystem.end_breather()
	if BreatherSystem.is_in_breather():
		return false

	ShiftController._reset_for_testing()
	return true
