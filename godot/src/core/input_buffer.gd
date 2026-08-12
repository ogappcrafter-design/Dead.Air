# input_buffer.gd — 100ms input buffering for action inputs
# DEA-152: Control Scheme Implementation
class_name InputBuffer
extends RefCounted

## Stores input actions with timestamps and expires them after buffer_ms.
## Buffered actions are consumed on the next available frame within the window.

var _buffer: Array[Dictionary] = []
var _buffer_ms: float = 100.0


func _init(buffer_ms: float = 100.0) -> void:
	_buffer_ms = buffer_ms


## Add an action to the buffer with the current (or provided) timestamp.
func buffer_action(action: String, timestamp: float = -1.0) -> void:
	if timestamp < 0.0:
		timestamp = Time.get_ticks_msec()
	_buffer.append({"action": action, "time": timestamp})


## Get and consume a buffered action if it hasn't expired. Returns true if found.
func consume_action(action: String) -> bool:
	var now: float = Time.get_ticks_msec()
	var cutoff: float = now - _buffer_ms
	var i: int = _buffer.size() - 1
	while i >= 0:
		var entry: Dictionary = _buffer[i]
		if entry.time < cutoff:
			_buffer.remove_at(i)
		elif entry.action == action:
			_buffer.remove_at(i)
			return true
		i -= 1
	return false


## Check if a buffered action exists without consuming it.
func has_action(action: String) -> bool:
	var now: float = Time.get_ticks_msec()
	var cutoff: float = now - _buffer_ms
	var i: int = _buffer.size() - 1
	while i >= 0:
		if _buffer[i].time < cutoff:
			_buffer.remove_at(i)
		elif _buffer[i].action == action:
			return true
		i -= 1
	return false


## Remove all buffered actions.
func clear() -> void:
	_buffer.clear()


## Remove expired entries. Called every frame by InputManager.
func update() -> void:
	var now: float = Time.get_ticks_msec()
	var cutoff: float = now - _buffer_ms
	var i: int = _buffer.size() - 1
	while i >= 0:
		if _buffer[i].time < cutoff:
			_buffer.remove_at(i)
		i -= 1


## Get the number of currently buffered (non-expired) actions.
func size() -> int:
	update()
	return _buffer.size()
