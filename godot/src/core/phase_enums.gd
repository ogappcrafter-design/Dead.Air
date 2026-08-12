class_name PhaseEnums
extends RefCounted

## Phase identifiers for the four-act story structure.
## See docs/plans/redesign-gdd.md for phase descriptions.
enum Phase {
	PHASE_1_STATION,  ## Act 1 — The Station (radio console, 5 shifts)
	PHASE_2_BREAK,  ## Act 2 — The Break (linear, no save)
	PHASE_3_JOURNEY,  ## Act 3 — The Journey (5 locations, save rooms)
	PHASE_4_DESCENT,  ## Act 4 — The Descent (terminal, no save)
}

## Mode contexts map 1:1 to ControlMode values from control_enums.gd.
## Defined separately so phase logic doesn't depend on ControlEnums import.
enum ModeContext {
	RADIO,
	EXPLORE,
	CALL,
	HIDE,
}

## Default mode context when entering each phase.
const DEFAULT_MODE: Dictionary = {
	Phase.PHASE_1_STATION: ModeContext.RADIO,
	Phase.PHASE_2_BREAK: ModeContext.EXPLORE,
	Phase.PHASE_3_JOURNEY: ModeContext.EXPLORE,
	Phase.PHASE_4_DESCENT: ModeContext.EXPLORE,
}

## Whether manual saving is allowed in each phase.
## Phase 2 (Break) and Phase 4 (Descent) are no-save.
const CAN_SAVE: Dictionary = {
	Phase.PHASE_1_STATION: true,
	Phase.PHASE_2_BREAK: false,
	Phase.PHASE_3_JOURNEY: true,
	Phase.PHASE_4_DESCENT: false,
}

## Human-readable names for debugging and UI.
const PHASE_NAMES: Dictionary = {
	Phase.PHASE_1_STATION: "The Station",
	Phase.PHASE_2_BREAK: "The Break",
	Phase.PHASE_3_JOURNEY: "The Journey",
	Phase.PHASE_4_DESCENT: "The Descent",
}


## Returns the default ModeContext for the given phase.
static func get_default_mode(phase: int) -> int:
	return DEFAULT_MODE.get(phase, ModeContext.EXPLORE)


## Returns true if manual saving is permitted in the given phase.
static func can_save_in_phase(phase: int) -> bool:
	return CAN_SAVE.get(phase, false)


## Returns a human-readable name for the phase.
static func get_phase_name(phase: int) -> String:
	return PHASE_NAMES.get(phase, "Unknown")


## Returns true if the phase value is valid.
static func is_valid_phase(phase: int) -> bool:
	return phase >= 0 and phase < Phase.size()


## Returns true if the mode context value is valid.
static func is_valid_mode(mode: int) -> bool:
	return mode >= 0 and mode < ModeContext.size()
