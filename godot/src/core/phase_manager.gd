extends Node

## Autoload singleton tracking the current story phase and mode context.
## Synchronizes InputManager.ControlMode whenever the mode changes.
##
## Phases follow the four-act structure from docs/plans/redesign-gdd.md:
##   PHASE_1_STATION  → radio console, save at booth
##   PHASE_2_BREAK    → linear walk, no save
##   PHASE_3_JOURNEY  → 5 locations, save in safe rooms
##   PHASE_4_DESCENT  → terminal descent, no save
##
## Mode contexts (RADIO, EXPLORE, CALL, HIDE) drive InputManager state.

## Emitted when the story phase changes.
signal phase_changed(old_phase: int, new_phase: int)

## Emitted when the active mode context changes.
signal mode_context_changed(old_mode: int, new_mode: int)

## Emitted when a save attempt is blocked by phase rules.
signal save_blocked(reason: String)

## Emitted when entering Call or Hide mode (temporary mode override).
signal temporary_mode_entered(mode: int)

## Emitted when returning from Call or Hide mode to previous context.
signal temporary_mode_exited(restored_mode: int)

var _phase: int = PhaseEnums.Phase.PHASE_1_STATION
var _mode: int = PhaseEnums.ModeContext.RADIO
var _previous_mode: int = PhaseEnums.ModeContext.RADIO

# Tracks whether we're in a temporary Call/Hide override so we know
# to restore the prior mode on exit instead of falling back to default.
var _in_temporary_mode: bool = false


func _ready() -> void:
	_apply_mode_to_input_manager(_mode)


## Returns the current story phase (Phase enum value).
func get_phase() -> int:
	return _phase


## Returns the current mode context (ModeContext enum value).
func get_mode() -> int:
	return _mode


## Returns the mode that was active before the current one.
func get_previous_mode() -> int:
	return _previous_mode


## Sets the story phase. Resets the mode to the phase default unless a
## temporary mode is active (Call/Hide survives phase transitions).
func set_phase(new_phase: int) -> void:
	if not PhaseEnums.is_valid_phase(new_phase):
		push_error("PhaseManager: invalid phase value %d" % new_phase)
		return
	if new_phase == _phase:
		return
	var old_phase := _phase
	_phase = new_phase
	phase_changed.emit(old_phase, new_phase)
	if not _in_temporary_mode:
		var default_mode := PhaseEnums.get_default_mode(new_phase)
		set_mode(default_mode)


## Sets the active mode context. Updates InputManager and emits signals.
func set_mode(new_mode: int) -> void:
	if not PhaseEnums.is_valid_mode(new_mode):
		push_error("PhaseManager: invalid mode value %d" % new_mode)
		return
	if new_mode == _mode:
		return
	_previous_mode = _mode
	_mode = new_mode
	mode_context_changed.emit(_previous_mode, new_mode)
	_apply_mode_to_input_manager(new_mode)


## Enters Call mode temporarily. The prior mode is restored on exit.
func enter_call_mode() -> void:
	if _mode == PhaseEnums.ModeContext.CALL:
		return
	_previous_mode = _mode
	_in_temporary_mode = true
	_mode = PhaseEnums.ModeContext.CALL
	mode_context_changed.emit(_previous_mode, _mode)
	temporary_mode_entered.emit(_mode)
	_apply_mode_to_input_manager(_mode)


## Exits Call mode, restoring the prior mode context.
func exit_call_mode() -> void:
	if _mode != PhaseEnums.ModeContext.CALL:
		return
	var restored := _previous_mode
	_in_temporary_mode = false
	_mode = restored
	mode_context_changed.emit(PhaseEnums.ModeContext.CALL, restored)
	temporary_mode_exited.emit(restored)
	_apply_mode_to_input_manager(restored)


## Enters Hide mode temporarily. The prior mode is restored on exit.
func enter_hide_mode() -> void:
	if _mode == PhaseEnums.ModeContext.HIDE:
		return
	_previous_mode = _mode
	_in_temporary_mode = true
	_mode = PhaseEnums.ModeContext.HIDE
	mode_context_changed.emit(_previous_mode, _mode)
	temporary_mode_entered.emit(_mode)
	_apply_mode_to_input_manager(_mode)


## Exits Hide mode, restoring the prior mode context.
func exit_hide_mode() -> void:
	if _mode != PhaseEnums.ModeContext.HIDE:
		return
	var restored := _previous_mode
	_in_temporary_mode = false
	_mode = restored
	mode_context_changed.emit(PhaseEnums.ModeContext.HIDE, restored)
	temporary_mode_exited.emit(restored)
	_apply_mode_to_input_manager(restored)


## Returns true if manual saving is permitted in the current phase.
func can_save() -> bool:
	return PhaseEnums.can_save_in_phase(_phase)


## Returns true if a save attempt should be allowed, emitting save_blocked
## with a reason when it is not. Call this before invoking SaveManager.
func request_save() -> bool:
	if not can_save():
		var reason := "Saving is not allowed in phase %s" % PhaseEnums.get_phase_name(_phase)
		save_blocked.emit(reason)
		return false
	return true


## Returns a snapshot of the current phase/mode state for save data.
func to_save_state() -> Dictionary:
	return {
		"phase": _phase,
		"mode": _mode,
		"previous_mode": _previous_mode,
		"in_temporary_mode": _in_temporary_mode,
	}


## Restores phase/mode state from save data.
func from_save_state(state: Dictionary) -> void:
	if state.has("phase") and PhaseEnums.is_valid_phase(int(state["phase"])):
		var new_phase := int(state["phase"])
		if new_phase != _phase:
			var old := _phase
			_phase = new_phase
			phase_changed.emit(old, new_phase)
	if state.has("mode") and PhaseEnums.is_valid_mode(int(state["mode"])):
		var new_mode := int(state["mode"])
		if new_mode != _mode:
			_previous_mode = _mode
			_mode = new_mode
			mode_context_changed.emit(_previous_mode, _mode)
			_apply_mode_to_input_manager(_mode)
	if state.has("previous_mode") and PhaseEnums.is_valid_mode(int(state["previous_mode"])):
		_previous_mode = int(state["previous_mode"])
	if state.has("in_temporary_mode"):
		_in_temporary_mode = bool(state["in_temporary_mode"])


## Maps ModeContext to InputManager.ControlMode and applies it.
## In test contexts where InputManager autoload isn't started, this is a no-op.
func _apply_mode_to_input_manager(mode: int) -> void:
	if not is_inside_tree():
		return
	var tree := get_tree()
	var root := tree.get_root()
	if root == null or not root.has_node("InputManager"):
		return
	var im := root.get_node("InputManager")
	var control_mode: int = _mode_context_to_control_mode(mode)
	im.set_mode(control_mode)


## Converts a ModeContext value to the corresponding ControlMode value.
## ModeContext.RADIO   → ControlMode.RADIO   (1)
## ModeContext.EXPLORE → ControlMode.EXPLORE (0)
## ModeContext.CALL    → ControlMode.CALL    (2)
## ModeContext.HIDE    → ControlMode.HIDE    (3)
func _mode_context_to_control_mode(mode: int) -> int:
	match mode:
		PhaseEnums.ModeContext.RADIO:
			return 1  # ControlMode.RADIO
		PhaseEnums.ModeContext.EXPLORE:
			return 0  # ControlMode.EXPLORE
		PhaseEnums.ModeContext.CALL:
			return 2  # ControlMode.CALL
		PhaseEnums.ModeContext.HIDE:
			return 3  # ControlMode.HIDE
		_:
			push_error("PhaseManager: unknown mode %d" % mode)
			return 0
