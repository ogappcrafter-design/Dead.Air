class_name TutorialManager
extends Node

## Manages tutorial overlay progression for Shift 1.
## Shows three tutorial steps at the right moments:
##   1. TUNING — on shift start (after night transition)
##   2. SIGNAL_METER — on first call_started
##   3. COMPOSURE — on first composure_changed
## Each overlay must be dismissed before the next can show.
## Only active when the current shift has tutorial=true.

signal tutorial_step_shown(step_name: String)
signal tutorial_complete

var _overlay: Control
var _active: bool = false
var _current_step: int = -1
var _shift_number: int = 0
var _steps_shown: Dictionary = {}  # step_index -> bool

const STEP_TUNING := 0
const STEP_SIGNAL_METER := 1
const STEP_COMPOSURE := 2
const TOTAL_STEPS := 3

const TUTORIAL_MESSAGES: Array[Dictionary] = [
	{
		"title": "TUNE THE DIAL",
		"body": "Tune the dial to find a signal.\nUse [A] and [D] to rotate the frequency knob.",
	},
	{
		"title": "SIGNAL METER",
		"body": "Watch the signal meter — it decays over time.\nRe-tune to restore signal strength.",
	},
	{
		"title": "COMPOSURE",
		"body": "Keep your composure up — low composure affects the CRT.\nStay calm between calls.",
	},
]

func _ready() -> void:
	_create_overlay()

func _create_overlay() -> void:
	_overlay = load("res://src/ui/tutorial_overlay.gd").new()
	_overlay.name = "TutorialOverlay"
	add_child(_overlay)
	_overlay.dismissed.connect(_on_overlay_dismissed)

## Called by GameDirector when a shift starts. Only activates for tutorial shifts.
func on_shift_started(shift_number: int, tutorial_enabled: bool) -> void:
	_shift_number = shift_number
	_steps_shown.clear()
	_current_step = -1
	_active = tutorial_enabled

	if not _active:
		return

	# Show tuning tutorial immediately on shift start
	_show_step(STEP_TUNING)

## Called by GameDirector when a call starts.
func on_call_started(call_data: Dictionary) -> void:
	if not _active:
		return
	if _current_step == STEP_TUNING and _overlay.is_active():
		# Don't interrupt the tuning overlay; queue the signal meter step
		return
	_show_step(STEP_SIGNAL_METER)

## Called by GameDirector when composure changes.
func on_composure_changed(value: float) -> void:
	if not _active:
		return
	if _steps_shown.has(STEP_COMPOSURE):
		return
	_show_step(STEP_COMPOSURE)

func _show_step(step: int) -> void:
	if step < 0 or step >= TOTAL_STEPS:
		return
	if _steps_shown.has(step):
		return
	if _overlay.is_active():
		return  # Wait for current overlay to be dismissed

	_steps_shown[step] = true
	_current_step = step
	var msg: Dictionary = TUTORIAL_MESSAGES[step]
	_overlay.show_message(msg.title, msg.body)
	tutorial_step_shown.emit(msg.title.to_lower())

func _on_overlay_dismissed() -> void:
	if _steps_shown.size() >= TOTAL_STEPS:
		_active = false
		tutorial_complete.emit()

func is_tutorial_active() -> bool:
	return _active

func is_step_shown(step: int) -> bool:
	return _steps_shown.has(step)

func _reset_for_testing() -> void:
	_active = false
	_current_step = -1
	_shift_number = 0
	_steps_shown.clear()
	if _overlay:
		_overlay.hide_overlay()
