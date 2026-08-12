# gdlint:ignore=max-public-methods
## test_phase_manager.gd — Unit tests for PhaseManager phase/mode state machine.
## Tests: phase transitions, mode defaults, save restrictions, call/hide
## temporary mode swap-and-restore, save/restore state round-trip.
extends RefCounted

var test_name: String = "PhaseManager"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_initial_state"] = test_initial_state()
	results["test_set_phase_changes_mode_to_default"] = test_set_phase_changes_mode_to_default()
	results["test_set_phase_invalid_value"] = test_set_phase_invalid_value()
	results["test_set_mode_changes_mode"] = test_set_mode_changes_mode()
	results["test_set_mode_invalid_value"] = test_set_mode_invalid_value()
	results["test_enter_call_mode"] = test_enter_call_mode()
	results["test_exit_call_mode_restores_previous"] = test_exit_call_mode_restores_previous()
	results["test_enter_hide_mode"] = test_enter_hide_mode()
	results["test_exit_hide_mode_restores_previous"] = test_exit_hide_mode_restores_previous()
	results["test_can_save_phase_1"] = test_can_save_phase_1()
	results["test_cannot_save_phase_2"] = test_cannot_save_phase_2()
	results["test_can_save_phase_3"] = test_can_save_phase_3()
	results["test_cannot_save_phase_4"] = test_cannot_save_phase_4()
	results["test_request_save_blocked_in_phase_2"] = test_request_save_blocked_in_phase_2()
	results["test_request_save_allowed_in_phase_1"] = test_request_save_allowed_in_phase_1()
	results["test_to_save_state"] = test_to_save_state()
	results["test_from_save_state"] = test_from_save_state()
	results["test_call_mode_during_explore"] = test_call_mode_during_explore()
	results["test_hide_mode_during_radio"] = test_hide_mode_during_radio()
	var key := "test_phase_transition_preserves_temporary_mode"
	results[key] = test_phase_transition_preserves_temporary_mode()
	# Reset to initial state after tests
	_reset_phase_manager()
	return results


## Helper: reset PhaseManager to initial state (Phase 1, Radio).
func _reset_phase_manager() -> void:
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	PhaseManager.set_mode(PhaseEnums.ModeContext.RADIO)


func test_initial_state() -> bool:
	_reset_phase_manager()
	return (
		PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_1_STATION
		and PhaseManager.get_mode() == PhaseEnums.ModeContext.RADIO
	)


func test_set_phase_changes_mode_to_default() -> bool:
	_reset_phase_manager()
	# Phase 2 → default Explore
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	if PhaseManager.get_phase() != PhaseEnums.Phase.PHASE_2_BREAK:
		return false
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	# Phase 3 → default Explore
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	# Phase 1 → default Radio
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.RADIO:
		return false
	return true


func test_set_phase_invalid_value() -> bool:
	_reset_phase_manager()
	var old_phase := PhaseManager.get_phase()
	PhaseManager.set_phase(999)
	return PhaseManager.get_phase() == old_phase


func test_set_mode_changes_mode() -> bool:
	_reset_phase_manager()
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	if PhaseManager.get_previous_mode() != PhaseEnums.ModeContext.RADIO:
		return false
	return true


func test_set_mode_invalid_value() -> bool:
	_reset_phase_manager()
	var old_mode := PhaseManager.get_mode()
	PhaseManager.set_mode(999)
	return PhaseManager.get_mode() == old_mode


func test_enter_call_mode() -> bool:
	_reset_phase_manager()
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	PhaseManager.enter_call_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.CALL:
		return false
	if PhaseManager.get_previous_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	return true


func test_exit_call_mode_restores_previous() -> bool:
	_reset_phase_manager()
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	PhaseManager.enter_call_mode()
	PhaseManager.exit_call_mode()
	return PhaseManager.get_mode() == PhaseEnums.ModeContext.EXPLORE


func test_enter_hide_mode() -> bool:
	_reset_phase_manager()
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	PhaseManager.enter_hide_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.HIDE:
		return false
	if PhaseManager.get_previous_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	return true


func test_exit_hide_mode_restores_previous() -> bool:
	_reset_phase_manager()
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	PhaseManager.enter_hide_mode()
	PhaseManager.exit_hide_mode()
	return PhaseManager.get_mode() == PhaseEnums.ModeContext.EXPLORE


func test_can_save_phase_1() -> bool:
	_reset_phase_manager()
	return PhaseManager.can_save() == true


func test_cannot_save_phase_2() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	return PhaseManager.can_save() == false


func test_can_save_phase_3() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	return PhaseManager.can_save() == true


func test_cannot_save_phase_4() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	return PhaseManager.can_save() == false


func test_request_save_blocked_in_phase_2() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	# Track save_blocked signal
	var blocked_reason := ""
	PhaseManager.save_blocked.connect(func(reason: String) -> void: blocked_reason = reason)
	var allowed := PhaseManager.request_save()
	if allowed != false:
		return false
	if blocked_reason.is_empty():
		return false
	return true


func test_request_save_allowed_in_phase_1() -> bool:
	_reset_phase_manager()
	var allowed := PhaseManager.request_save()
	return allowed == true


func test_to_save_state() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	var state := PhaseManager.to_save_state()
	if state.get("phase", -1) != PhaseEnums.Phase.PHASE_3_JOURNEY:
		return false
	if state.get("mode", -1) != PhaseEnums.ModeContext.EXPLORE:
		return false
	if not state.has("previous_mode"):
		return false
	if not state.has("in_temporary_mode"):
		return false
	return true


func test_from_save_state() -> bool:
	_reset_phase_manager()
	var state := {
		"phase": PhaseEnums.Phase.PHASE_3_JOURNEY,
		"mode": PhaseEnums.ModeContext.EXPLORE,
		"previous_mode": PhaseEnums.ModeContext.RADIO,
		"in_temporary_mode": false,
	}
	PhaseManager.from_save_state(state)
	if PhaseManager.get_phase() != PhaseEnums.Phase.PHASE_3_JOURNEY:
		return false
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	if PhaseManager.get_previous_mode() != PhaseEnums.ModeContext.RADIO:
		return false
	return true


func test_call_mode_during_explore() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	# Should be in Explore mode
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	# Enter Call
	PhaseManager.enter_call_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.CALL:
		return false
	# Exit Call should restore Explore
	PhaseManager.exit_call_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	return true


func test_hide_mode_during_radio() -> bool:
	_reset_phase_manager()
	# Phase 1 default is Radio
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.RADIO:
		return false
	# Enter Hide
	PhaseManager.enter_hide_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.HIDE:
		return false
	# Exit Hide should restore Radio
	PhaseManager.exit_hide_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.RADIO:
		return false
	return true


func test_phase_transition_preserves_temporary_mode() -> bool:
	_reset_phase_manager()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)
	# Enter Call (temporary mode)
	PhaseManager.enter_call_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.CALL:
		return false
	# Transition to Phase 4 while in Call — temporary mode should persist
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.CALL:
		return false
	# Exit Call should restore Explore (the mode before Call)
	PhaseManager.exit_call_mode()
	if PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		return false
	return true
