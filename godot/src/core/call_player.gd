extends Node
## CallPlayer — autoload singleton that handles call presentation by type.
##
## Receives calls from CallManager and delegates to type-specific handlers.
## Manages the display of call lines, choices, and audio ducking.

signal line_displayed(line_text: String, caller_name: String)
signal call_display_complete(call_data: Dictionary)
signal choices_displayed(choices: Array)
signal choice_hidden()

# --- Internal state ---
var _active_call: Dictionary = {}
var _current_line_index: int = -1
var _line_timer: float = 0.0
var _is_presenting: bool = false
var _waiting_for_choice: bool = false

# --- Config ---
const LINE_DURATION: float = 2.5
const DEAD_AIR_DURATION: float = 4.0
const STAY_CALM_DURATION: float = 6.0
const JUST_LISTEN_DURATION: float = 3.0

# --- UI Reference ---
var _choice_display: Control = null


func _ready() -> void:
	_instantiate_choice_display()

func _process(delta: float) -> void:
	if not _is_presenting:
		return
	_line_timer -= delta
	if _line_timer <= 0.0:
		_advance_line()

# ---------------------------------------------------------------------------
# UI Setup
# ---------------------------------------------------------------------------

func _instantiate_choice_display() -> void:
	var ChoiceDisplayScript = load("res://src/ui/choice_display.gd")
	_choice_display = ChoiceDisplayScript.new()
	_choice_display.name = "ChoiceDisplay"
	_choice_display.set_anchors_preset(Control.PRESET_FULL_RECT)
	_choice_display.visible = false
	add_child(_choice_display)

	# Connect choice selection signal
	if _choice_display.has_signal("choice_selected"):
		_choice_display.choice_selected.connect(_on_choice_selected)

# ---------------------------------------------------------------------------
# Public API — Call presentation
# ---------------------------------------------------------------------------

func present_call(call_data: Dictionary) -> void:
	_active_call = call_data
	_current_line_index = -1
	_is_presenting = true
	_waiting_for_choice = false

	var call_type_str: String = call_data.get("type", "JUST_LISTEN")

	match call_type_str:
		"RIGHT_ANSWER":
			_present_right_answer(call_data)
		"DEAD_AIR":
			_present_dead_air(call_data)
		"JUST_LISTEN":
			_present_just_listen(call_data)
		"STAY_CALM":
			_present_stay_calm(call_data)
		"SIGNAL_DECODE":
			_present_signal_decode(call_data)
		_:
			_present_just_listen(call_data)  # fallback

func show_choices(choices: Array) -> void:
	_waiting_for_choice = true
	if _choice_display:
		_choice_display.show_choices(choices)
	choices_displayed.emit(choices)

func hide_choices() -> void:
	_waiting_for_choice = false
	if _choice_display:
		_choice_display.visible = false
		choice_hidden.emit()

# ---------------------------------------------------------------------------
# Type-specific presentation
# ---------------------------------------------------------------------------

func _present_right_answer(call_data: Dictionary) -> void:
	# Display intro text if present
	if call_data.has("intro"):
		line_displayed.emit(call_data["intro"], call_data.get("callerName", "Unknown"))
		_line_timer = LINE_DURATION
	else:
		# Start with first line
		_start_lines(call_data)

func _present_dead_air(call_data: Dictionary) -> void:
	# Dead air: no lines, just silence for duration
	line_displayed.emit("...", call_data.get("callerName", ""))
	_line_timer = call_data.get("duration", DEAD_AIR_DURATION)

func _present_just_listen(call_data: Dictionary) -> void:
	_start_lines(call_data)

func _present_stay_calm(call_data: Dictionary) -> void:
	# Stay calm: show lines, require player to not interact
	if call_data.has("intro"):
		line_displayed.emit(call_data["intro"], call_data.get("callerName", ""))
		_line_timer = LINE_DURATION
	else:
		_start_lines(call_data)

func _present_signal_decode(call_data: Dictionary) -> void:
	# Signal decode: show sequence and wait for input
	if call_data.has("sequence"):
		var seq_str: String = "Decode: " + str(call_data["sequence"])
		line_displayed.emit(seq_str, call_data.get("callerName", ""))
	_line_timer = call_data.get("duration", STAY_CALM_DURATION)

# ---------------------------------------------------------------------------
# Line management
# ---------------------------------------------------------------------------

func _start_lines(call_data: Dictionary) -> void:
	if call_data.has("lines") and call_data["lines"] is Array:
		_current_line_index = 0
		_display_current_line()
	else:
		# No lines, use duration-based timing
		_line_timer = call_data.get("duration", JUST_LISTEN_DURATION)

func _display_current_line() -> void:
	if _current_line_index < 0:
		return
	var lines: Array = _active_call.get("lines", [])
	if _current_line_index < lines.size():
		var line_text: String = lines[_current_line_index]
		var caller: String = _active_call.get("callerName", "Unknown")
		line_displayed.emit(line_text, caller)
		_line_timer = LINE_DURATION
	else:
		_finish_presentation()

func _advance_line() -> void:
	if _waiting_for_choice:
		return  # Don't advance while waiting for choice selection

	if _current_line_index >= 0:
		_current_line_index += 1
		var lines: Array = _active_call.get("lines", [])
		if _current_line_index < lines.size():
			_display_current_line()
		else:
			# Check if call has choices to show after lines
			if _active_call.has("choices") and not _active_call["choices"].is_empty():
				# CallManager will transition to CHOICE state
				_current_line_index = -1  # stop line advance
				_is_presenting = false
			else:
				_finish_presentation()
	else:
		_finish_presentation()

func _finish_presentation() -> void:
	_is_presenting = false
	_current_line_index = -1
	call_display_complete.emit(_active_call)

# ---------------------------------------------------------------------------
# Choice handling
# ---------------------------------------------------------------------------

func _on_choice_selected(index: int) -> void:
	hide_choices()
	if CallManager:
		CallManager.select_choice(index)

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------

func stop_presentation() -> void:
	_is_presenting = false
	_current_line_index = -1
	_waiting_for_choice = false
	hide_choices()
	_active_call = {}

# ---------------------------------------------------------------------------
# Testing helpers
# ---------------------------------------------------------------------------

func is_presenting() -> bool:
	return _is_presenting

func get_active_call() -> Dictionary:
	return _active_call
