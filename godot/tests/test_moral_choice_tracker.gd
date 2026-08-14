# gdlint:ignore=max-public-methods
## test_moral_choice_tracker.gd — Unit tests for MoralChoiceTracker autoload.
## Tests: initial state, record_choice for each GDD call, empathy thresholds,
##        world response modifiers, tape/caller/sacrifice tracking, save/load,
##        reset.
extends RefCounted

var test_name: String = "MoralChoiceTracker"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_initial_state_all_zeros"] = test_initial_state_all_zeros()
	results["test_record_choice_call0_yes"] = test_record_choice_call0_yes()
	results["test_record_choice_call0_no"] = test_record_choice_call0_no()
	results["test_record_choice_call0_wrong_number"] = test_record_choice_call0_wrong_number()
	results["test_record_choice_call2_yes"] = test_record_choice_call2_yes()
	results["test_record_choice_call2_no"] = test_record_choice_call2_no()
	results["test_record_choice_call2_how_much"] = test_record_choice_call2_how_much()
	results["test_record_choice_call9_play_it"] = test_record_choice_call9_play_it()
	results["test_record_choice_call9_wait"] = test_record_choice_call9_wait()
	results["test_record_choice_call9_burn_it"] = test_record_choice_call9_burn_it()
	results["test_record_choice_call12_cooperate"] = test_record_choice_call12_cooperate()
	results["test_record_choice_call12_dont_know"] = test_record_choice_call12_dont_know()
	results["test_record_choice_call12_who_are_you"] = test_record_choice_call12_who_are_you()
	results["test_record_choice_call16_wanted_to_hear"] = test_record_choice_call16_wanted_to_hear()
	results["test_record_choice_call16_looking_for"] = test_record_choice_call16_looking_for()
	results["test_record_choice_call16_dont_know"] = test_record_choice_call16_dont_know()
	results["test_empathy_threshold_warm"] = test_empathy_threshold_warm()
	results["test_empathy_threshold_cold"] = test_empathy_threshold_cold()
	results["test_empathy_threshold_neutral"] = test_empathy_threshold_neutral()
	results["test_world_response_warm"] = test_world_response_warm()
	results["test_world_response_neutral"] = test_world_response_neutral()
	results["test_world_response_cold"] = test_world_response_cold()
	results["test_tape_taken_tracking"] = test_tape_taken_tracking()
	results["test_tape_refused_tracking"] = test_tape_refused_tracking()
	results["test_caller_helped_tracking"] = test_caller_helped_tracking()
	results["test_caller_abandoned_tracking"] = test_caller_abandoned_tracking()
	results["test_sacrifice_counting"] = test_sacrifice_counting()
	results["test_save_load_round_trip"] = test_save_load_round_trip()
	results["test_reset"] = test_reset()
	results["test_clamp_scores"] = test_clamp_scores()
	# Clean up
	MoralChoiceTracker.reset()
	return results


## Helper: reset the tracker before each test.
func _reset() -> void:
	MoralChoiceTracker.reset()


# ---------------------------------------------------------------------------
# Initial state
# ---------------------------------------------------------------------------


func test_initial_state_all_zeros() -> bool:
	_reset()
	return (
		MoralChoiceTracker.get_empathy_score() == 0
		and MoralChoiceTracker.get_self_preservation() == 0
		and MoralChoiceTracker.get_curiosity() == 0
		and MoralChoiceTracker.get_sacrifice_count() == 0
		and MoralChoiceTracker.get_tapes_taken() == 0
		and MoralChoiceTracker.get_tapes_refused() == 0
		and MoralChoiceTracker.get_callers_helped() == 0
		and MoralChoiceTracker.get_callers_abandoned() == 0
		and MoralChoiceTracker.get_dread() == 0.0
	)


# ---------------------------------------------------------------------------
# Call #0 tests
# ---------------------------------------------------------------------------


func test_record_choice_call0_yes() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(0, "Yes.")
	if MoralChoiceTracker.get_empathy_score() != 10:
		return false
	if MoralChoiceTracker.get_curiosity() != 5:
		return false
	return true


func test_record_choice_call0_no() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(0, "No.")
	if MoralChoiceTracker.get_self_preservation() != 10:
		return false
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	return true


func test_record_choice_call0_wrong_number() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(0, "Wrong number.")
	if MoralChoiceTracker.get_curiosity() != 10:
		return false
	# Empathy -5 from 0 is clamped to 0 (0-100 range)
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	return true


# ---------------------------------------------------------------------------
# Call #2 tests
# ---------------------------------------------------------------------------


func test_record_choice_call2_yes() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(2, "Yes.")
	if MoralChoiceTracker.get_empathy_score() != 5:
		return false
	if MoralChoiceTracker.get_sacrifice_count() != 1:
		return false
	return true


func test_record_choice_call2_no() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(2, "No.")
	if MoralChoiceTracker.get_self_preservation() != 10:
		return false
	# Empathy -5 from 0 is clamped to 0
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	return true


func test_record_choice_call2_how_much() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(2, "How much?")
	if MoralChoiceTracker.get_curiosity() != 10:
		return false
	# Empathy -5 from 0 is clamped to 0
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	return true


# ---------------------------------------------------------------------------
# Call #9 tests
# ---------------------------------------------------------------------------


func test_record_choice_call9_play_it() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(9, "Yes. I'll play it.")
	if MoralChoiceTracker.get_empathy_score() != 15:
		return false
	if MoralChoiceTracker.get_sacrifice_count() != 1:
		return false
	return true


func test_record_choice_call9_wait() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(9, "Don't play it yet. Wait.")
	if MoralChoiceTracker.get_self_preservation() != 5:
		return false
	if MoralChoiceTracker.get_curiosity() != 5:
		return false
	return true


func test_record_choice_call9_burn_it() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(9, "Burn it.")
	if MoralChoiceTracker.get_self_preservation() != 10:
		return false
	# Empathy -10 from 0 is clamped to 0
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	# "Burn it" has explicit dread +20 + baseline +5 = +25 dread
	if MoralChoiceTracker.get_dread() < 25.0:
		return false
	return true


# ---------------------------------------------------------------------------
# Call #12 tests
# ---------------------------------------------------------------------------


func test_record_choice_call12_cooperate() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(12, "Cooperate.")
	if MoralChoiceTracker.get_self_preservation() != 10:
		return false
	# Empathy -5 from 0 is clamped to 0
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	return true


func test_record_choice_call12_dont_know() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(12, "I don't know what you mean.")
	if MoralChoiceTracker.get_curiosity() != 5:
		return false
	if MoralChoiceTracker.get_self_preservation() != 5:
		return false
	return true


func test_record_choice_call12_who_are_you() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(12, "Who are you really?")
	if MoralChoiceTracker.get_curiosity() != 15:
		return false
	if MoralChoiceTracker.get_empathy_score() != 5:
		return false
	return true


# ---------------------------------------------------------------------------
# Call #16 tests
# ---------------------------------------------------------------------------


func test_record_choice_call16_wanted_to_hear() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(16, "I wanted to hear them.")
	if MoralChoiceTracker.get_curiosity() != 20:
		return false
	return true


func test_record_choice_call16_looking_for() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(16, "I was looking for someone.")
	if MoralChoiceTracker.get_empathy_score() != 20:
		return false
	return true


func test_record_choice_call16_dont_know() -> bool:
	_reset()
	MoralChoiceTracker.record_choice(16, "I don't know why.")
	# No score changes
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	if MoralChoiceTracker.get_curiosity() != 0:
		return false
	if MoralChoiceTracker.get_self_preservation() != 0:
		return false
	return true


# ---------------------------------------------------------------------------
# Empathy thresholds
# ---------------------------------------------------------------------------


func test_empathy_threshold_warm() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(75)
	return MoralChoiceTracker.get_empathy_level() == "warm"


func test_empathy_threshold_cold() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(20)
	return MoralChoiceTracker.get_empathy_level() == "cold"


func test_empathy_threshold_neutral() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(50)
	return MoralChoiceTracker.get_empathy_level() == "neutral"


# ---------------------------------------------------------------------------
# World response modifiers
# ---------------------------------------------------------------------------


func test_world_response_warm() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(75)
	var mod: Dictionary = MoralChoiceTracker.get_world_response_modifier()
	if mod.get("voice_tone", "") != "warm":
		return false
	if mod.get("degradation_intensity", 0.0) != 0.8:
		return false
	if mod.get("signal_modifier", 0.0) != 1.1:
		return false
	return true


func test_world_response_neutral() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(50)
	var mod: Dictionary = MoralChoiceTracker.get_world_response_modifier()
	if mod.get("voice_tone", "") != "neutral":
		return false
	if mod.get("degradation_intensity", 0.0) != 1.0:
		return false
	if mod.get("signal_modifier", 0.0) != 1.0:
		return false
	return true


func test_world_response_cold() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(20)
	var mod: Dictionary = MoralChoiceTracker.get_world_response_modifier()
	if mod.get("voice_tone", "") != "cold":
		return false
	if mod.get("degradation_intensity", 0.0) != 1.2:
		return false
	if mod.get("signal_modifier", 0.0) != 0.9:
		return false
	return true


# ---------------------------------------------------------------------------
# Tape tracking
# ---------------------------------------------------------------------------


func test_tape_taken_tracking() -> bool:
	_reset()
	MoralChoiceTracker.add_tape_taken()
	MoralChoiceTracker.add_tape_taken()
	if MoralChoiceTracker.get_tapes_taken() != 2:
		return false
	return true


func test_tape_refused_tracking() -> bool:
	_reset()
	MoralChoiceTracker.add_tape_refused()
	MoralChoiceTracker.add_tape_refused()
	MoralChoiceTracker.add_tape_refused()
	if MoralChoiceTracker.get_tapes_refused() != 3:
		return false
	return true


# ---------------------------------------------------------------------------
# Caller tracking
# ---------------------------------------------------------------------------


func test_caller_helped_tracking() -> bool:
	_reset()
	MoralChoiceTracker.add_caller_helped()
	if MoralChoiceTracker.get_callers_helped() != 1:
		return false
	return true


func test_caller_abandoned_tracking() -> bool:
	_reset()
	MoralChoiceTracker.add_caller_abandoned()
	MoralChoiceTracker.add_caller_abandoned()
	if MoralChoiceTracker.get_callers_abandoned() != 2:
		return false
	return true


# ---------------------------------------------------------------------------
# Sacrifice counting + dread
# ---------------------------------------------------------------------------


func test_sacrifice_counting() -> bool:
	_reset()
	MoralChoiceTracker.add_sacrifice()
	MoralChoiceTracker.add_sacrifice()
	if MoralChoiceTracker.get_sacrifice_count() != 2:
		return false
	# Each sacrifice applies +5 dread
	if MoralChoiceTracker.get_dread() < 10.0:
		return false
	return true


# ---------------------------------------------------------------------------
# Save / Load round-trip
# ---------------------------------------------------------------------------


func test_save_load_round_trip() -> bool:
	_reset()
	# Set some state
	MoralChoiceTracker.record_choice(0, "Yes.")
	MoralChoiceTracker.record_choice(2, "No.")
	MoralChoiceTracker.add_tape_taken()
	MoralChoiceTracker.add_caller_helped()
	MoralChoiceTracker.add_sacrifice()

	# Save
	var saved: Dictionary = {}
	MoralChoiceTracker.save_to(saved)

	# Reset and verify cleared
	MoralChoiceTracker.reset()
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false

	# Load and verify restored
	MoralChoiceTracker.load_from(saved)
	if MoralChoiceTracker.get_empathy_score() != 5:  # Call #0 Yes: +10, Call #2 No: -5 → 5
		return false
	if MoralChoiceTracker.get_self_preservation() != 10:  # Call #2 No: +10 self_pres
		return false
	if MoralChoiceTracker.get_tapes_taken() != 1:
		return false
	if MoralChoiceTracker.get_sacrifice_count() != 1:
		return false
	return true


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------


func test_reset() -> bool:
	_reset()
	# Set some state
	MoralChoiceTracker.set_empathy_score(50)
	MoralChoiceTracker.set_self_preservation(30)
	MoralChoiceTracker.set_curiosity(70)
	MoralChoiceTracker.add_tape_taken()
	MoralChoiceTracker.add_sacrifice()

	# Reset
	MoralChoiceTracker.reset()
	return (
		MoralChoiceTracker.get_empathy_score() == 0
		and MoralChoiceTracker.get_self_preservation() == 0
		and MoralChoiceTracker.get_curiosity() == 0
		and MoralChoiceTracker.get_sacrifice_count() == 0
		and MoralChoiceTracker.get_tapes_taken() == 0
		and MoralChoiceTracker.get_dread() == 0.0
	)


# ---------------------------------------------------------------------------
# Score clamping
# ---------------------------------------------------------------------------


func test_clamp_scores() -> bool:
	_reset()
	MoralChoiceTracker.set_empathy_score(200)
	if MoralChoiceTracker.get_empathy_score() != 100:
		return false
	MoralChoiceTracker.set_empathy_score(-50)
	if MoralChoiceTracker.get_empathy_score() != 0:
		return false
	MoralChoiceTracker.set_self_preservation(999)
	if MoralChoiceTracker.get_self_preservation() != 100:
		return false
	MoralChoiceTracker.set_curiosity(-100)
	if MoralChoiceTracker.get_curiosity() != 0:
		return false
	return true
