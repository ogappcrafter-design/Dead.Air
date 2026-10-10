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
const STEP_DREAD_METER := 3
const STEP_BAND_SWITCHING := 4
const STEP_RECORDING := 5
const STEP_DECODE := 6

## Shift-specific tutorial step sequences. Each entry lists the steps for that
## shift, shown in order at their trigger moments. Shifts not listed get no
## tutorial even if their shift data says tutorial=true.
const SHIFT_STEPS: Dictionary = {
	1: [STEP_TUNING, STEP_SIGNAL_METER, STEP_COMPOSURE],
	2: [STEP_DREAD_METER, STEP_BAND_SWITCHING],
	3: [STEP_RECORDING],
	4: [STEP_DECODE],
}

const TOTAL_STEPS := 7

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
	{
		"title": "DREAD METER",
		"body": "The red bar at the bottom is your dread.\nIt rises when calls go badly — and it does not fall easily.",
	},
	{
		"title": "BAND SWITCHING",
		"body": "More than one frequency is out there.\nUse [L1]/[R1] or [TAB] to switch bands.",
	},
	{
		"title": "RECORDING",
		"body": "Your radio has been upgraded — it can record.\nHold [R] to record a call when the signal is strong.\nUse [Q] to play a tape back.",
	},
	{
		"title": "SIGNAL DECODE",
		"body": "Some transmissions aren't voices.\nWhen a code sequence appears, repeat it with the symbol pad.\nMatch it exactly — a mistake loses the signal.",
	},
]

func _ready() -> void:
	_create_overlay()

func _create_overlay() -> void:
	_overlay = load("res://src/ui/tutorial_overlay.gd").new()
	_overlay.name = "TutorialOverlay"
	add_child(_overlay)
	_overlay.dismissed.connect(_on_overlay_dismissed)

## Called by GameDirector when a shift starts. Only activates for shifts with
## tutorial=true that have a step sequence in SHIFT_STEPS.
func on_shift_started(shift_number: int, tutorial_enabled: bool) -> void:
	_shift_number = shift_number
	_steps_shown.clear()
	_current_step = -1
	_active = tutorial_enabled and SHIFT_STEPS.has(shift_number)

	if not _active:
		return

	# Show the shift's first step immediately on shift start
	_show_first_available_step()

## Called by GameDirector when a call starts.
func on_call_started(call_data: Dictionary) -> void:
	if not _active:
		return
	if _current_step == STEP_TUNING and _overlay.is_active():
		# Don't interrupt the tuning overlay; queue the signal meter step
		return
	if _current_step == STEP_DREAD_METER and _overlay.is_active():
		# Don't interrupt the dread meter overlay; queue the band switching step
		return
	_show_step_for_trigger("call")

## Called by GameDirector when composure changes.
func on_composure_changed(value: float) -> void:
	if not _active:
		return
	if _steps_shown.has(STEP_COMPOSURE):
		return
	_show_step_for_trigger("composure")

## Show the next unshown step for the current shift, or the first step whose
## trigger matches (used on shift start).
func _show_first_available_step() -> void:
	var steps: Array = SHIFT_STEPS.get(_shift_number, [])
	for step in steps:
		if not _steps_shown.has(step):
			_show_step(step)
			return

## Show the next unshown step for the current shift that matches a trigger.
## Trigger "call" shows the shift's next step that fires on a call starting;
## trigger "composure" shows the composure step if this shift includes it.
func _show_step_for_trigger(trigger: String) -> void:
	var steps: Array = SHIFT_STEPS.get(_shift_number, [])
	for step in steps:
		if _steps_shown.has(step):
			continue
		if _step_matches_trigger(step, trigger):
			_show_step(step)
			return

func _step_matches_trigger(step: int, trigger: String) -> bool:
	match step:
		STEP_TUNING:
			return trigger == "shift_start"
		STEP_SIGNAL_METER:
			return trigger == "call"
		STEP_COMPOSURE:
			return trigger == "composure"
		STEP_DREAD_METER:
			return trigger == "shift_start"
		STEP_BAND_SWITCHING:
			return trigger == "call"
		STEP_RECORDING:
			return trigger == "shift_start"
		STEP_DECODE:
			return trigger == "shift_start"
		_:
			return false

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
	var steps: Array = SHIFT_STEPS.get(_shift_number, [])
	if not steps.is_empty() and _steps_shown.size() >= steps.size():
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
