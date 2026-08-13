extends Node
## BreatherSystem — Autoload singleton managing breather events between calls.
##
## Breathers are rest periods between calls where signal and composure regenerate.
## Duration scales with difficulty: Easy=90s, Normal=60s, Hard=45s, Nightmare=30s.
##
## During a breather, SignalStrength.in_breather and DreadComposure.between_calls
## are set to true, enabling +1/sec regeneration on both systems.

signal breather_started(duration: float)
signal breather_ended

# Difficulty-scaled breather durations (seconds)
const BREATHER_DURATION_EASY: float = 90.0
const BREATHER_DURATION_NORMAL: float = 60.0
const BREATHER_DURATION_HARD: float = 45.0
const BREATHER_DURATION_NIGHTMARE: float = 30.0

# Current difficulty (0=easy, 1=normal, 2=hard, 3=nightmare)
var _difficulty: int = 1

# State
var _in_breather: bool = false
var _breather_timer: float = 0.0
var _breather_duration: float = 0.0


func _process(delta: float) -> void:
	if not _in_breather:
		return
	_breather_timer -= delta
	if _breather_timer <= 0.0:
		end_breather()


## Start a breather. Use -1.0 for difficulty-scaled default, or specify a custom duration.
func start_breather(duration: float = -1.0) -> void:
	if _in_breather:
		end_breather()

	if duration < 0.0:
		duration = get_difficulty_duration()

	_in_breather = true
	_breather_duration = duration
	_breather_timer = duration
	_set_regen_flags(true)
	breather_started.emit(duration)


## End the current breather immediately.
func end_breather() -> void:
	if not _in_breather:
		return
	_in_breather = false
	_breather_timer = 0.0
	_set_regen_flags(false)
	breather_ended.emit()


func is_in_breather() -> bool:
	return _in_breather


func get_breather_remaining() -> float:
	return max(0.0, _breather_timer) if _in_breather else 0.0


func get_breather_duration() -> float:
	return _breather_duration


func set_difficulty(diff: int) -> void:
	_difficulty = clamp(diff, 0, 3)


func get_difficulty_duration() -> float:
	match _difficulty:
		0:
			return BREATHER_DURATION_EASY
		1:
			return BREATHER_DURATION_NORMAL
		2:
			return BREATHER_DURATION_HARD
		3:
			return BREATHER_DURATION_NIGHTMARE
	return BREATHER_DURATION_NORMAL


func _set_regen_flags(active: bool) -> void:
	if CallManager:
		var ss: Node = CallManager.get_signal_strength()
		if ss:
			ss.in_breather = active
		var dc: Node = CallManager.get_dread_composure()
		if dc:
			dc.between_calls = active


func _reset_for_testing() -> void:
	end_breather()
	_difficulty = 1
