## DegradationStub
## Stub for StationDegradation autoload that doesn't exist yet.
## Provides minimal degradation API so night_shift.tscn can wire signals.
## Replace with real StationDegradation when implemented.
extends Node
class_name DegradationStub

signal degradation_changed(level: float)
signal degradation_threshold_reached(threshold: String)

var _degradation_level: float = 0.0
const THRESHOLD_MINOR := 0.25
const THRESHOLD_MAJOR := 0.50
const THRESHOLD_CRITICAL := 0.75


func get_degradation() -> float:
	return _degradation_level


func set_degradation(level: float) -> void:
	var old := _degradation_level
	_degradation_level = clampf(level, 0.0, 1.0)
	if not is_equal_approx(old, _degradation_level):
		degradation_changed.emit(_degradation_level)
	_check_thresholds()


func add_degradation(amount: float) -> void:
	set_degradation(_degradation_level + amount)


func reset() -> void:
	_degradation_level = 0.0
	degradation_changed.emit(0.0)


func _check_thresholds() -> void:
	if _degradation_level >= THRESHOLD_CRITICAL:
		degradation_threshold_reached.emit("critical")
	elif _degradation_level >= THRESHOLD_MAJOR:
		degradation_threshold_reached.emit("major")
	elif _degradation_level >= THRESHOLD_MINOR:
		degradation_threshold_reached.emit("minor")
