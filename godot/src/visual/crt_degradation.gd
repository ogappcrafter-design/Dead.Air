extends Node

## DEA-145: CRT Per-Shift Permanent Degradation System
##
## Registered as an autoload (`CRTDegradation`). Tracks cumulative CRT
## degradation across shifts. Shift 1 = pristine, Shift 5 = barely holding.
##
## Permanent degradation persists via SaveData and is restored on load.
## CRTPostProcess reads the degradation level and applies it as a baseline
## multiplier on top of real-time meter-driven effects.
##
## Integration:
## - ShiftController calls apply_shift_degradation(shift_num) on shift start
## - SaveManager saves/restores via save_to()/load_from()
## - CRTPostProcess._apply_all_params() reads get_permanent_degradation()

# --- Signals ---
signal degradation_changed(level: float)

# --- Per-shift degradation levels (0.0 = pristine, 1.0 = barely holding) ---
# Shift 1: 0.00 (pristine)
# Shift 2: 0.15
# Shift 3: 0.35
# Shift 4: 0.60
# Shift 5: 0.85 (barely holding)
const SHIFT_DEGRADATION_LEVELS: Array[float] = [0.0, 0.15, 0.35, 0.60, 0.85]

# Maximum degradation cap
const MAX_DEGRADATION: float = 0.85

# --- Internal ---
var _permanent_degradation: float = 0.0
var _current_shift: int = 1


## Get the current permanent degradation level (0.0–1.0).
func get_permanent_degradation() -> float:
	return _permanent_degradation


## Get the degradation level for a specific shift number (1-based).
static func get_shift_degradation_level(shift: int) -> float:
	if shift < 1 or shift > SHIFT_DEGRADATION_LEVELS.size():
		return MAX_DEGRADATION
	return SHIFT_DEGRADATION_LEVELS[shift - 1]


## Apply degradation for the given shift number.
## Called by ShiftController on shift start.
func apply_shift_degradation(shift: int) -> void:
	_current_shift = shift
	var level := get_shift_degradation_level(shift)
	_permanent_degradation = level
	degradation_changed.emit(_permanent_degradation)


## Manually set degradation level (for testing or scripted events).
func set_degradation(level: float) -> void:
	_permanent_degradation = clampf(level, 0.0, MAX_DEGRADATION)
	degradation_changed.emit(_permanent_degradation)


## Add to the current degradation (for incremental damage events).
func add_degradation(amount: float) -> void:
	_permanent_degradation = clampf(_permanent_degradation + amount, 0.0, MAX_DEGRADATION)
	degradation_changed.emit(_permanent_degradation)


## Reset degradation to pristine (new game / new tape).
func reset() -> void:
	_permanent_degradation = 0.0
	_current_shift = 1
	degradation_changed.emit(_permanent_degradation)


## Get the current shift number.
func get_current_shift() -> int:
	return _current_shift


## Save degradation state to a dictionary for SaveData serialization.
func save_to() -> Dictionary:
	return {
		"permanent_degradation": _permanent_degradation,
		"current_shift": _current_shift,
	}


## Load degradation state from a dictionary (from SaveData).
func load_from(data: Dictionary) -> void:
	_permanent_degradation = float(data.get("permanent_degradation", 0.0))
	_current_shift = int(data.get("current_shift", 1))
	_permanent_degradation = clampf(_permanent_degradation, 0.0, MAX_DEGRADATION)
	degradation_changed.emit(_permanent_degradation)
