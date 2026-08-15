extends Node
## ShiftController — Autoload singleton managing the night-by-night shift lifecycle.
##
## Coordinates PhaseManager, CallManager, BandUnlockManager, SaveManager, and
## DreadComposure to drive progression through the game's shift structure.
##
## State machine: PRE_SHIFT → CALLS_ACTIVE → POST_SHIFT → SHIFT_TRANSITION
## Each shift: free exploration → scheduled calls → free exploration → time skip
##
## Shifts 1-2 are implemented; Shifts 3-5 are stubbed as "not implemented".

# ─── Signals ────────────────────────────────────────────────────────────────

signal shift_started(shift_number: int)
signal shift_phase_changed(phase: String)
signal call_sequence_complete
signal shift_complete(shift_number: int)
signal band_unlocked(band_name: String)
signal final_call_starting

# ─── Enums ──────────────────────────────────────────────────────────────────

enum ShiftPhase {
	PRE_SHIFT,  # 2-3 min free exploration before calls
	CALLS_ACTIVE,  # Calls running via CallManager
	POST_SHIFT,  # Free exploration, tape review, save
	SHIFT_TRANSITION,  # Time skip to next night
}

# ─── Constants ───────────────────────────────────────────────────────────────

const PRE_SHIFT_DURATION: float = 120.0  # 2 minutes of free exploration
const POST_SHIFT_DURATION: float = 0.0  # 0 = wait for player input
const SHIFT_TRANSITION_DURATION: float = 3.0  # Short time-skip transition

const MAX_IMPLEMENTED_SHIFTS: int = 2  # Shifts 1-2 implemented; 3-5 stubbed

# ─── Shift Data (hardcoded for Shifts 1-2) ──────────────────────────────────

const SHIFT_DATA: Array = [
	# Shift 1
	{
		"shift_number": 1,
		"bands": ["LIVING"],
		"calls": ["procedural", 0, 1, 3],
		"dread_meter_visible": false,
		"save_unlocked": false,
		"tutorial": true,
	},
	# Shift 2
	{
		"shift_number": 2,
		"bands": ["LIVING", "LIMINAL"],
		"calls": ["procedural", 2, 4, 5],
		"dread_meter_visible": true,
		"save_unlocked": true,
		"tutorial": true,
	},
]

# ─── State ───────────────────────────────────────────────────────────────────

var _current_shift: int = 0
var _current_phase: ShiftPhase = ShiftPhase.PRE_SHIFT
var _phase_timer: float = 0.0
var _shift_active: bool = false

# Feature flags tracked per shift
var _dread_meter_visible: bool = false
var _save_available: bool = false
var _unlocked_bands: Array[String] = []

# BandUnlockManager instance (not an autoload; created as child)
var _band_unlock_manager: Node = null

# Testing helpers
var _testing_mode: bool = false
var _call_count: int = 0

# ─── Lifecycle ───────────────────────────────────────────────────────────────


func _ready() -> void:
	_create_band_unlock_manager()
	if CallManager:
		CallManager.shift_ended.connect(_on_call_manager_shift_ended)
		CallManager.call_started.connect(_on_call_manager_call_started)


func _process(delta: float) -> void:
	if not _shift_active:
		return

	match _current_phase:
		ShiftPhase.PRE_SHIFT:
			_phase_timer -= delta
			if _phase_timer <= 0.0:
				_enter_calls_active()
		ShiftPhase.POST_SHIFT:
			if POST_SHIFT_DURATION > 0.0:
				_phase_timer -= delta
				if _phase_timer <= 0.0:
					_enter_shift_transition()
		ShiftPhase.SHIFT_TRANSITION:
			_phase_timer -= delta
			if _phase_timer <= 0.0:
				_complete_shift()


# ─── Public API ───────────────────────────────────────────────────────────────


func get_current_shift() -> int:
	return _current_shift


func get_current_phase() -> ShiftPhase:
	return _current_phase


func get_current_phase_name() -> String:
	return _phase_to_string(_current_phase)


func is_shift_active() -> bool:
	return _shift_active


func is_dread_meter_visible() -> bool:
	return _dread_meter_visible


func is_save_available() -> bool:
	return _save_available


func get_unlocked_bands() -> Array[String]:
	return _unlocked_bands.duplicate()


func get_call_count() -> int:
	return _call_count


func get_shift_data(shift_number: int) -> Dictionary:
	if shift_number < 1 or shift_number > SHIFT_DATA.size():
		return {}
	return SHIFT_DATA[shift_number - 1]


func is_shift_implemented(shift_number: int) -> bool:
	return shift_number >= 1 and shift_number <= MAX_IMPLEMENTED_SHIFTS


# ─── Shift Lifecycle ─────────────────────────────────────────────────────────


func start_shift(shift_number: int = 1) -> void:
	if _shift_active:
		push_warning("ShiftController: shift already active (shift %d)" % _current_shift)
		return

	if not is_shift_implemented(shift_number):
		push_warning("ShiftController: shift %d is not implemented" % shift_number)
		return

	_current_shift = shift_number
	_shift_active = true
	_call_count = 0

	var data: Dictionary = get_shift_data(shift_number)

	# Configure feature flags from shift data
	_dread_meter_visible = data.get("dread_meter_visible", false)
	_save_available = data.get("save_unlocked", false)
	var bands: Array = data.get("bands", [])

	# Set PhaseManager to PHASE_1_STATION
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)

	# Unlock bands for this shift
	_unlock_bands_for_shift(shift_number)

	# Apply station degradation if available
	_apply_station_degradation(shift_number)

	# Toggle save availability (forward-compatible: call if method exists)
	if SaveManager and SaveManager.has_method("set_save_available"):
		SaveManager.set_save_available(_save_available)

	# Toggle dread meter visibility (forward-compatible)
	_toggle_dread_meter_visibility(_dread_meter_visible)

	# Emit signals
	shift_started.emit(shift_number)
	_set_phase(ShiftPhase.PRE_SHIFT)

	# Start PRE_SHIFT timer (skip in testing mode)
	_phase_timer = PRE_SHIFT_DURATION if not _testing_mode else 0.0


func end_shift() -> void:
	if not _shift_active:
		return
	if _current_phase == ShiftPhase.CALLS_ACTIVE:
		# Tell CallManager to stop. Its shift_ended signal fires synchronously,
		# which triggers _on_call_manager_shift_ended → _enter_post_shift.
		# We must NOT call _enter_shift_transition() here — that would
		# produce a phantom POST_SHIFT → TRANSITION in the same call stack.
		if CallManager and CallManager.is_shift_active():
			CallManager.end_shift()
		# If signal handler didn't fire (no CallManager), fall through to transition
		if _current_phase == ShiftPhase.CALLS_ACTIVE:
			_enter_shift_transition()
	elif _current_phase == ShiftPhase.POST_SHIFT:
		_enter_shift_transition()


func advance_to_next_shift() -> void:
	if _shift_active:
		_complete_shift()
	start_shift(_current_shift + 1)


# ─── Phase Transitions (internal) ────────────────────────────────────────────


func _set_phase(new_phase: ShiftPhase) -> void:
	_current_phase = new_phase
	shift_phase_changed.emit(_phase_to_string(new_phase))


func _enter_calls_active() -> void:
	_set_phase(ShiftPhase.CALLS_ACTIVE)
	# Start calls via CallManager (0-indexed: shift 1 → index 0)
	if CallManager:
		CallManager.start_shift(_current_shift - 1)
	else:
		# No CallManager — simulate completion immediately
		_on_call_manager_shift_ended(_current_shift - 1)


func _enter_post_shift() -> void:
	_set_phase(ShiftPhase.POST_SHIFT)
	_phase_timer = POST_SHIFT_DURATION


func _enter_shift_transition() -> void:
	_set_phase(ShiftPhase.SHIFT_TRANSITION)
	_phase_timer = SHIFT_TRANSITION_DURATION


func _complete_shift() -> void:
	var completed_shift := _current_shift
	_shift_active = false
	shift_complete.emit(completed_shift)
	_set_phase(ShiftPhase.PRE_SHIFT)  # Reset for next shift


# ─── Signal Handlers ─────────────────────────────────────────────────────────


func _on_call_manager_shift_ended(_cm_shift_number: int) -> void:
	# CallManager uses 0-indexed shifts; we use _current_shift (1-indexed)
	call_sequence_complete.emit()
	_enter_post_shift()


func _on_call_manager_call_started(_call_data: Dictionary) -> void:
	_call_count += 1
	var data: Dictionary = get_shift_data(_current_shift)
	var expected_calls: int = data.get("calls", []).size()
	if expected_calls > 0 and _call_count == expected_calls:
		final_call_starting.emit()


# ─── Internal: Band Unlock ───────────────────────────────────────────────────


func _unlock_bands_for_shift(shift_number: int) -> void:
	var data: Dictionary = get_shift_data(shift_number)
	var bands: Array = data.get("bands", [])
	for band_name in bands:
		var band_str := str(band_name)
		if not _unlocked_bands.has(band_str):
			_unlocked_bands.append(band_str)
			band_unlocked.emit(band_str)

	# Also notify BandUnlockManager if available
	if _band_unlock_manager:
		_band_unlock_manager.on_shift_changed(shift_number)


# ─── Internal: Station Degradation ───────────────────────────────────────────


func _apply_station_degradation(shift_number: int) -> void:
	# StationState is an autoload; check for apply_degradation method
	if StationState and StationState.has_method("apply_degradation"):
		StationState.apply_degradation(shift_number)


# ─── Internal: Dread Meter Visibility ─────────────────────────────────────────


func _toggle_dread_meter_visibility(visible: bool) -> void:
	# DreadComposure is a child of CallManager, accessed via get_dread_composure()
	if CallManager:
		var dc: Node = CallManager.get_dread_composure()
		if dc and dc.has_method("set_visible"):
			dc.set_visible(visible)


# ─── Internal: BandUnlockManager Creation ────────────────────────────────────


func _create_band_unlock_manager() -> void:
	var script: Resource = load("res://src/core/band_unlock_manager.gd")
	if script == null:
		return
	_band_unlock_manager = script.new()
	_band_unlock_manager.name = "BandUnlockManager"
	add_child(_band_unlock_manager)


# ─── Internal: Phase Name Conversion ─────────────────────────────────────────


func _phase_to_string(phase: ShiftPhase) -> String:
	match phase:
		ShiftPhase.PRE_SHIFT:
			return "pre_shift"
		ShiftPhase.CALLS_ACTIVE:
			return "calls_active"
		ShiftPhase.POST_SHIFT:
			return "post_shift"
		ShiftPhase.SHIFT_TRANSITION:
			return "transition"
		_:
			return "unknown"


# ─── Testing Helpers ─────────────────────────────────────────────────────────


func _set_testing_mode(enabled: bool) -> void:
	_testing_mode = enabled


func _reset_for_testing() -> void:
	_current_shift = 0
	_current_phase = ShiftPhase.PRE_SHIFT
	_phase_timer = 0.0
	_shift_active = false
	_dread_meter_visible = false
	_save_available = false
	_unlocked_bands.clear()
	_testing_mode = false
	_call_count = 0
	if CallManager:
		CallManager._reset_for_testing()


func _force_enter_calls_active() -> void:
	_enter_calls_active()


func _force_enter_post_shift() -> void:
	_enter_post_shift()


func _force_complete_shift() -> void:
	_complete_shift()


func _force_enter_shift_transition() -> void:
	_enter_shift_transition()
