class_name FieldCalls
extends Node
## Unified Phase 3 field-call system (DEA-127).
##
## Field calls differ from station calls: shorter, loop-based, tied to
## location. Each location registers a themed schedule; the system fires
## them periodically while exploring.
##
## Call quality depends on signal strength (weak = broken fragments, strong
## = clear lines). Dread corrupts content: high dread drops words, swaps
## names for the player's, and inverts meaning.
##
## Field calls drain composure (-2 to -5 each). They never yield tapes.

signal field_call_started(call_data: Dictionary)
signal field_call_finished

## Composure drain range per call (GDD: -2 to -5).
const COMPOSURE_DRAIN_MIN := 2.0
const COMPOSURE_DRAIN_MAX := 5.0

## Time between calls (seconds), randomized around the location's interval.
const INTERVAL_JITTER := 0.5

## Signal thresholds for quality tiers.
const SIGNAL_CLEAR_MIN := 60.0     # full lines
const SIGNAL_BROKEN_MIN := 25.0    # partial fragments
# below 25: static only — a hiss with a word or two.

## Location schedules are plain arrays of call dictionaries:
## {id, band, callerName, callerId, type, lines}. Built by each location.

var _schedule: Array = []
var _queue: Array = []
var _timer := 0.0
var _interval := 45.0
var _active := false
var _current_call: Dictionary = {}
var _current_line_index := 0
var _line_timer := 0.0

var _signal_strength: Node
var _dread_composure: Node


func setup(schedule: Array, interval: float, signal_strength: Node, dread_composure: Node) -> void:
	_schedule = schedule
	_interval = interval
	_signal_strength = signal_strength
	_dread_composure = dread_composure


func start() -> void:
	if _active:
		return
	_active = true
	_queue = _schedule.duplicate(true)
	_timer = 0.0
	# First call comes quickly after start.
	_timer = _interval * (1.0 - INTERVAL_JITTER)


func stop() -> void:
	_active = false
	_current_call = {}
	_current_line_index = 0


func is_active() -> bool:
	return _active


func get_queue_size() -> int:
	return _queue.size()


func get_current_call() -> Dictionary:
	return _current_call


func _process(delta: float) -> void:
	if not _active:
		return
	if _current_call.is_empty():
		_timer += delta
		if _timer >= _interval:
			_timer = 0.0
			_fire_next_call()
	else:
		_advance_current_call(delta)


func _fire_next_call() -> void:
	if _queue.is_empty():
		# Loop-based: refill from the schedule.
		_queue = _schedule.duplicate(true)
	var call: Dictionary = _queue.pop_front()
	_current_call = _corrupt_call(call)
	_current_line_index = 0
	_line_timer = 0.0
	_drain_composure()
	field_call_started.emit(_current_call)


## Advance line playback; lines display at ~2s each depending on quality.
func _advance_current_call(delta: float) -> void:
	_line_timer += delta
	var quality := _current_quality()
	var line_time := 2.0 if quality >= 2 else 1.2
	if _line_timer >= line_time:
		_line_timer = 0.0
		_current_line_index += 1
		var lines: Array = _current_call.get("lines", [])
		if _current_line_index >= lines.size():
			_current_call = {}
			field_call_finished.emit()


## Pure: quality tier from signal strength.
## 2 = clear, 1 = broken, 0 = static only.
func _current_quality() -> int:
	var signal_value := 100.0
	if _signal_strength and "signal_value" in _signal_strength:
		signal_value = float(_signal_strength.get("signal_value"))
	return get_quality_for_signal(signal_value)


static func get_quality_for_signal(signal_value: float) -> int:
	if signal_value >= SIGNAL_CLEAR_MIN:
		return 2
	if signal_value >= SIGNAL_BROKEN_MIN:
		return 1
	return 0


## Pure: apply the lines for the current quality tier.
## Quality 2: all lines. Quality 1: every other line (fragments).
## Quality 0: empty — static only.
static func get_lines_for_quality(call_data: Dictionary, quality: int) -> Array:
	var lines: Array = call_data.get("lines", [])
	if quality >= 2:
		return lines
	if quality == 1:
		var fragments: Array = []
		for i in range(0, lines.size(), 2):
			fragments.append(lines[i])
		return fragments
	return []


## Pure: corrupt lines based on dread (0-100).
## At dread >= 50: some words drop out. At dread >= 75: names invert.
static func corrupt_lines(lines: Array, dread: float) -> Array:
	if lines.is_empty():
		return lines
	var corrupted: Array = []
	for line in lines:
		var text := str(line)
		if dread >= 75.0:
			# Names invert: capitalize randomly / swap words.
			var words := text.split(" ")
			if words.size() > 2:
				words[words.size() - 1] = "you"
				text = " ".join(words)
		if dread >= 50.0:
			# Drop some words (one per line).
			var words := text.split(" ")
			if words.size() > 4:
				words.remove_at(words.size() / 2)
				text = " ".join(words)
		corrupted.append(text)
	return corrupted


func _corrupt_call(call: Dictionary) -> Dictionary:
	var dread := 0.0
	if _dread_composure and "dread" in _dread_composure:
		dread = float(_dread_composure.dread)
	var out := call.duplicate()
	out["lines"] = corrupt_lines(call.get("lines", []), dread)
	out["quality"] = _current_quality()
	return out


func _drain_composure() -> void:
	if _dread_composure and _dread_composure.has_method("add_composure"):
		var drain := randf_range(COMPOSURE_DRAIN_MIN, COMPOSURE_DRAIN_MAX)
		_dread_composure.add_composure(-drain)


## --- Testing helpers ---

func fire_next_call_for_testing() -> Dictionary:
	_fire_next_call()
	return _current_call


func advance_call_for_testing(delta: float) -> void:
	_advance_current_call(delta)


func force_finish_call_for_testing() -> void:
	_current_call = {}
	field_call_finished.emit()


func get_total_drain_for_testing(drain_count: int) -> float:
	var total := 0.0
	for i in range(drain_count):
		total += randf_range(COMPOSURE_DRAIN_MIN, COMPOSURE_DRAIN_MAX)
	return total


func _reset_for_testing() -> void:
	_active = false
	_queue.clear()
	_schedule.clear()
	_timer = 0.0
	_current_call = {}
	_current_line_index = 0
	_line_timer = 0.0
