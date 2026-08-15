extends Node
## CallManager — autoload singleton managing call lifecycle and shift scheduling.
##
## State machine: IDLE -> INCOMING -> ACTIVE -> CHOICE -> RESOLVING -> COOLDOWN -> IDLE
## Shift scheduling: builds a queue of scripted + procedural calls per shift.

signal call_state_changed(old_state: int, new_state: int)
signal call_started(call_data: Dictionary)
signal call_ended(call_data: Dictionary, outcome: String)
signal shift_started(shift_number: int)
signal shift_ended(shift_number: int)
signal choice_presented(choices: Array)
signal choice_resolved(choice_index: int, choice: Dictionary)
signal static_rewarded(amount: int)
signal sanity_changed(delta: float, new_value: float)
signal tape_awarded(tape_id: String, tape_name: String)
signal sacred_call_started(call_data: Dictionary)

enum CallState {
	IDLE,
	INCOMING,
	ACTIVE,
	CHOICE,
	RESOLVING,
	COOLDOWN,
}

# --- State ---
var _state: CallState = CallState.IDLE
var _current_call: Dictionary = {}
var _current_call_index: int = -1
var _shift_number: int = 0
var _shift_queue: Array[Dictionary] = []
var _shift_in_progress: bool = false
var _cooldown_timer: float = 0.0
var _incoming_timer: float = 0.0
var _resolving_timer: float = 0.0
var _breather_active: bool = false
var _is_last_call_in_shift: bool = false
var _skip_breather: bool = false

# --- Config ---
const COOLDOWN_DURATION: float = 5.0
const INCOMING_DURATION: float = 2.0
const RESOLVING_DURATION: float = 1.5

# --- Sub-systems (created in _ready) ---
var _dread_composure: Node = null
var _signal_strength: Node = null

# --- Procedural templates ---
const PROCEDURAL_TEMPLATES: Array[Dictionary] = [
	{
		"callerId": "proc_band_0_01",
		"callerName": "Distant Voice",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 35.0,
		"staticReward": 12,
		"lines": ["...is anyone there?", "...can you hear me?", "...please..."],
	},
	{
		"callerId": "proc_band_0_02",
		"callerName": "Unknown Signal",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 28.0,
		"staticReward": 15,
		"lines": ["...the frequency...", "...it's getting closer...", "...don't tune away..."],
	},
	{
		"callerId": "proc_band_0_03",
		"callerName": "Faint Whisper",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 22.0,
		"staticReward": 18,
		"lines": ["...I was here once.", "...before the static.", "...before the silence."],
	},
	{
		"callerId": "proc_band_0_04",
		"callerName": "Broken Signal",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 30.0,
		"staticReward": 10,
		"lines": ["...hello?", "...hello?", "...are you receiving?"],
	},
	{
		"callerId": "proc_band_0_05",
		"callerName": "Night Caller",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 25.0,
		"staticReward": 14,
		"lines":
		["...I can't sleep.", "...the radio keeps me company.", "...does it keep you company too?"],
	},
]

# --- Shift definitions (all 5 shifts) ---
# Each shift: array of call specs. Scripted calls use {"id": N}. Procedural use {"procedural": true}.
# The final call of each shift is sacred (is_sacred: true in call data, enforced by ShiftController).
const SHIFT_DEFINITIONS: Array = [
	# Shift 1 — "First Night" (Tutorial)
	[
		{"procedural": true},
		{"id": 0},
		{"id": 1},
		{"id": 3},
	],
	# Shift 2 — "Settling In" (LIMINAL Unlocked)
	[
		{"procedural": true},
		{"id": 2},
		{"id": 4},
		{"id": 5},
	],
	# Shift 3 — "The Dead" (LOST Unlocked)
	[
		{"id": 6},
		{"id": 7},
		{"id": 8},
		{"id": 9},
	],
	# Shift 4 — "Classified" (CLASSIFIED Unlocked)
	[
		{"id": 10},
		{"id": 11},
		{"id": 12},
		{"id": 13},
	],
	# Shift 5 — "Dead Air" (████████ Unlocked, Final Shift)
	[
		{"id": 14},
		{"id": 15},
		{"id": 16},
		{"id": 17},
	],
]

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


func _ready() -> void:
	_create_sub_systems()
	_connectautoload_signals()
	if BreatherSystem:
		BreatherSystem.breather_ended.connect(_on_breather_ended)


func _process(delta: float) -> void:
	match _state:
		CallState.INCOMING:
			_incoming_timer -= delta
			if _incoming_timer <= 0.0:
				_enter_state(CallState.ACTIVE)
		CallState.COOLDOWN:
			if _breather_active:
				pass  # BreatherSystem handles timing; wait for breather_ended signal
			else:
				_cooldown_timer -= delta
				if _cooldown_timer <= 0.0:
					_advance_queue()
		CallState.RESOLVING:
			_resolving_timer -= delta
			if _resolving_timer <= 0.0:
				_enter_state(CallState.COOLDOWN)


# ---------------------------------------------------------------------------
# Sub-systems
# ---------------------------------------------------------------------------


func _create_sub_systems() -> void:
	# Create DreadComposure as a child node (not an autoload)
	var DreadComposureScript = load("res://src/core/dread_composure.gd")
	_dread_composure = DreadComposureScript.new()
	_dread_composure.name = "DreadComposure"
	add_child(_dread_composure)

	# Create SignalStrength as a child node (not an autoload)
	var SignalStrengthScript = load("res://src/core/signal_strength.gd")
	_signal_strength = SignalStrengthScript.new()
	_signal_strength.name = "SignalStrength"
	add_child(_signal_strength)


func _connectautoload_signals() -> void:
	# StingerSystem connections for event-driven stingers during calls
	if StingerSystem:
		pass  # stingers triggered explicitly per call type


# ---------------------------------------------------------------------------
# Public API — State queries
# ---------------------------------------------------------------------------


func get_state() -> CallState:
	return _state


func get_current_call() -> Dictionary:
	return _current_call


func get_shift_number() -> int:
	return _shift_number


func is_in_call() -> bool:
	return _state != CallState.IDLE and _state != CallState.COOLDOWN


func is_shift_active() -> bool:
	return _shift_in_progress


func get_dread_composure() -> Node:
	return _dread_composure


func get_signal_strength() -> Node:
	return _signal_strength


# ---------------------------------------------------------------------------
# Public API — Shift control
# ---------------------------------------------------------------------------


func start_shift(shift_num: int = -1) -> void:
	if _shift_in_progress:
		push_warning("CallManager: shift already in progress")
		return

	_shift_number = shift_num if shift_num >= 0 else _shift_number + 1
	_shift_queue = _build_shift_queue(_shift_number)
	_current_call_index = -1
	_shift_in_progress = true
	shift_started.emit(_shift_number)

	# Signal strength starts in shift
	if _signal_strength:
		_signal_strength.start_shift()

	# Begin first call after brief cooldown (not a breather)
	_skip_breather = true
	_is_last_call_in_shift = false
	_enter_state(CallState.COOLDOWN)
	_cooldown_timer = 1.0  # short initial delay


func end_shift() -> void:
	if not _shift_in_progress:
		return
	_shift_in_progress = false
	_shift_queue.clear()
	_current_call = {}
	_current_call_index = -1
	shift_ended.emit(_shift_number)
	_enter_state(CallState.IDLE)


# ---------------------------------------------------------------------------
# Public API — Call control
# ---------------------------------------------------------------------------


func skip_call() -> void:
	if _state == CallState.ACTIVE or _state == CallState.CHOICE:
		_resolve_call("skipped")


func select_choice(index: int) -> void:
	if _state != CallState.CHOICE:
		push_warning("CallManager: select_choice called in state %d" % _state)
		return
	var choices: Array = _current_call.get("choices", [])
	if index < 0 or index >= choices.size():
		push_warning(
			"CallManager: choice index %d out of range (0-%d)" % [index, choices.size() - 1]
		)
		return
	var choice: Dictionary = choices[index]
	choice_resolved.emit(index, choice)

	# Apply choice effects
	_apply_choice_effects(choice)
	_resolve_call("choice_made")


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------


func _enter_state(new_state: CallState) -> void:
	var old_state := _state
	_state = new_state
	call_state_changed.emit(old_state, new_state)

	match new_state:
		CallState.IDLE:
			_current_call = {}
			_current_call_index = -1
		CallState.INCOMING:
			_incoming_timer = INCOMING_DURATION
			# Enter call mode via PhaseManager
			if PhaseManager:
				PhaseManager.enter_call_mode()
			# Duck audio for call
			if AudioBusManager:
				AudioBusManager.duck_for_call(true)
		CallState.ACTIVE:
			call_started.emit(_current_call)
			# Sacred call detection
			if _current_call.get("is_sacred", false):
				sacred_call_started.emit(_current_call)
				if _dread_composure:
					_dread_composure.add_dread(5.0)
			# Notify CallPlayer to present
			if CallPlayer:
				CallPlayer.present_call(_current_call)
		CallState.CHOICE:
			if _current_call.has("choices"):
				choice_presented.emit(_current_call["choices"])
				if CallPlayer:
					CallPlayer.show_choices(_current_call["choices"])
		CallState.RESOLVING:
			_resolving_timer = RESOLVING_DURATION
		CallState.COOLDOWN:
			# Exit call mode
			if PhaseManager:
				PhaseManager.exit_call_mode()
			if AudioBusManager:
				AudioBusManager.duck_for_call(false)
			# Determine breather vs short cooldown
			if _skip_breather:
				_skip_breather = false
				_breather_active = false
			elif _is_last_call_in_shift:
				_cooldown_timer = COOLDOWN_DURATION
				_breather_active = false
			elif BreatherSystem:
				_breather_active = true
				BreatherSystem.start_breather()
			else:
				_cooldown_timer = COOLDOWN_DURATION
				_breather_active = false


func _advance_queue() -> void:
	if not _shift_in_progress:
		_enter_state(CallState.IDLE)
		return

	_current_call_index += 1
	if _current_call_index >= _shift_queue.size():
		# Shift complete
		end_shift()
		return

	_current_call = _shift_queue[_current_call_index]
	_enter_state(CallState.INCOMING)


func _on_breather_ended() -> void:
	if _state == CallState.COOLDOWN and _breather_active:
		_breather_active = false
		_advance_queue()


# ---------------------------------------------------------------------------
# Call resolution
# ---------------------------------------------------------------------------


func _resolve_call(outcome: String) -> void:
	call_ended.emit(_current_call, outcome)

	# Trigger stingers based on call type / outcome
	_trigger_call_stingers(_current_call, outcome)

	# Check if this was the last call in the shift
	_is_last_call_in_shift = (_current_call_index >= _shift_queue.size() - 1)

	_enter_state(CallState.RESOLVING)


func _trigger_call_stingers(call_data: Dictionary, outcome: String) -> void:
	if not StingerSystem:
		return

	var call_type_str: String = call_data.get("type", "")
	match call_type_str:
		"DEAD_AIR":
			StingerSystem.trigger_stinger(StingerSystem.StingerType.DEAD_AIR)
		"RIGHT_ANSWER":
			if outcome == "choice_made":
				StingerSystem.trigger_moral_choice()
		"STAY_CALM":
			StingerSystem.trigger_wrongness()


# ---------------------------------------------------------------------------
# Effect application
# ---------------------------------------------------------------------------


func _apply_choice_effects(choice: Dictionary) -> void:
	# Sanity delta
	var sanity_delta: float = choice.get("sanityDelta", 0.0)
	if sanity_delta != 0.0 and _dread_composure:
		_dread_composure.add_dread(-sanity_delta)  # positive sanityDelta reduces dread
		sanity_changed.emit(sanity_delta, _dread_composure.dread)

	# Tape award
	var tape_id: String = choice.get("tape", "")
	var tape_name: String = choice.get("tapeName", "")
	if tape_id != "" and TapeInventory:
		TapeInventory.collect_tape(tape_id, _current_call)
		tape_awarded.emit(tape_id, tape_name)

	# Static multiplier (affects signal strength)
	var static_mult: float = choice.get("staticMult", 1.0)
	if static_mult != 1.0 and _signal_strength:
		var new_signal: float = _signal_strength.signal_value * static_mult
		_signal_strength.set_signal(new_signal)

	# DEA-98: Record moral choice for tracking (empathy/self-preservation/curiosity)
	if MoralChoiceTracker:
		var call_id: int = int(_current_call.get("id", -1))
		var choice_text: String = choice.get("text", "")
		if call_id >= 0 and choice_text != "":
			MoralChoiceTracker.record_choice(call_id, choice_text)


# ---------------------------------------------------------------------------
# Shift queue building
# ---------------------------------------------------------------------------


func _build_shift_queue(shift_num: int) -> Array[Dictionary]:
	var queue: Array[Dictionary] = []

	if shift_num < 0 or shift_num >= SHIFT_DEFINITIONS.size():
		push_warning("CallManager: no definition for shift %d" % shift_num)
		return queue

	var definition: Array = SHIFT_DEFINITIONS[shift_num]
	for spec in definition:
		if spec.has("procedural") and spec["procedural"]:
			var proc_call := _generate_procedural_call()
			queue.append(proc_call)
		elif spec.has("id"):
			var call_id: int = spec["id"]
			var call_data: Dictionary = CallData.get_call(call_id)
			if call_data.is_empty():
				push_warning("CallManager: call id %d not found in CallData" % call_id)
			else:
				queue.append(call_data)

	return queue


func _generate_procedural_call() -> Dictionary:
	# Pick random template
	var template: Dictionary = PROCEDURAL_TEMPLATES[randi() % PROCEDURAL_TEMPLATES.size()]
	# Build a complete call dict from template
	var call: Dictionary = template.duplicate(true)
	# Ensure required fields exist with defaults
	if not call.has("id"):
		call["id"] = -1  # negative id marks procedural
	if not call.has("waitSeconds"):
		call["waitSeconds"] = 1.0
	if not call.has("sanityDelta"):
		call["sanityDelta"] = 0.0
	if not call.has("sanityPenalty"):
		call["sanityPenalty"] = 0.0
	if not call.has("duration"):
		call["duration"] = float(call["lines"].size()) * 2.0
	return call


# ---------------------------------------------------------------------------
# Testing helpers
# ---------------------------------------------------------------------------


func _reset_for_testing() -> void:
	_state = CallState.IDLE
	_current_call = {}
	_current_call_index = -1
	_shift_number = 0
	_shift_queue.clear()
	_shift_in_progress = false
	_cooldown_timer = 0.0
	_incoming_timer = 0.0
	_resolving_timer = 0.0
	_breather_active = false
	_is_last_call_in_shift = false
	_skip_breather = false
	if BreatherSystem:
		BreatherSystem._reset_for_testing()
	if _dread_composure:
		_dread_composure.reset()
	if _signal_strength:
		_signal_strength.reset_signal()
