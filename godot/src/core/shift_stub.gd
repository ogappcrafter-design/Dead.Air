## ShiftStub
## Stub for ShiftController autoload that doesn't exist yet.
## Provides minimal shift-management API so night_shift.tscn can wire signals.
## Replace with real ShiftController when implemented.
extends Node
class_name ShiftStub

signal shift_started(shift_num: int)
signal shift_ended(shift_num: int)
signal shift_progress_updated(progress: float)

var _current_shift: int = 0
var _shift_active: bool = false
var _progress: float = 0.0


func get_shift_number() -> int:
	return _current_shift


func is_shift_active() -> bool:
	return _shift_active


func start_shift(shift_num: int = -1) -> void:
	if shift_num < 0:
		_current_shift += 1
	else:
		_current_shift = shift_num
	_shift_active = true
	_progress = 0.0
	shift_started.emit(_current_shift)


func end_shift() -> void:
	if not _shift_active:
		return
	_shift_active = false
	shift_ended.emit(_current_shift)


func update_progress(p: float) -> void:
	_progress = clampf(p, 0.0, 1.0)
	shift_progress_updated.emit(_progress)


func get_progress() -> float:
	return _progress


func reset() -> void:
	_current_shift = 0
	_shift_active = false
	_progress = 0.0
