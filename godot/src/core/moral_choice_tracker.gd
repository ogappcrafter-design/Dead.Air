# gdlint:ignore=max-line-length,max-public-methods
## MoralChoiceTracker — autoload singleton tracking player moral decisions across the game.
##
## Tracks empathy / self-preservation / curiosity scores and adjusts world
## responses based on empathy thresholds. Per GDD §Moral Choice Tracking System
## (docs/plans/redesign-gdd.md lines 1128-1175) + DEA-98 brief.
##
## Integration:
##   - CallManager.select_choice() → MoralChoiceTracker.record_choice()
##   - TapeInventory.collect_tape() → MoralChoiceTracker.add_tape_taken()
##   - TapeInventory.refuse_tape()  → MoralChoiceTracker.add_tape_refused()
##   - SaveManager                  → MoralChoiceTracker.save_to() / load_from()
extends Node

# --- Signals ---

## Emitted after a moral choice is recorded. `effects` is the applied delta dict.
signal moral_choice_recorded(call_id: int, choice_type: String, effects: Dictionary)

## Emitted when empathy crosses a threshold boundary (>70 warm, 30-70 neutral, <30 cold).
signal empathy_threshold_crossed(level: String)

## Emitted when dread changes from a moral choice or sacrifice.
signal dread_changed(delta: float, new_value: float)

# --- Thresholds ---

const EMPATHY_WARM_THRESHOLD: int = 70
const EMPATHY_COLD_THRESHOLD: int = 30

# --- Dread constants ---

const MORAL_CHOICE_DREAD: float = 5.0
const SACRIFICE_DREAD: float = 5.0
const MAX_SCORE: int = 100
const MIN_SCORE: int = 0

# --- GDD moral choice mapping ---
# call_id → { choice_text → effects Dictionary }
# effects keys: empathy, self_preservation, curiosity (int deltas),
#               sacrifice (bool), dread (float extra dread), composure_penalty (float → dread)
# Source: GDD lines 1141-1161
const _CHOICE_MAP: Dictionary = {
	0:
	{
		"Yes.": {"empathy": 10, "curiosity": 5},
		"No.": {"self_preservation": 10},
		"Wrong number.": {"curiosity": 10, "empathy": -5},
	},
	2:
	{
		"Yes.": {"empathy": 5, "sacrifice": true, "composure_penalty": 10.0},
		"No.": {"self_preservation": 10, "empathy": -5},
		"How much?": {"curiosity": 10, "empathy": -5},
	},
	9:
	{
		"Yes. I'll play it.": {"empathy": 15, "sacrifice": true, "composure_penalty": 20.0},
		"Don't play it yet. Wait.": {"self_preservation": 5, "curiosity": 5},
		"Burn it.": {"self_preservation": 10, "empathy": -10, "dread": 20.0},
	},
	12:
	{
		"Cooperate.": {"self_preservation": 10, "empathy": -5},
		"I don't know what you mean.": {"curiosity": 5, "self_preservation": 5},
		"Who are you really?": {"curiosity": 15, "empathy": 5, "composure_penalty": 15.0},
	},
	16:
	{
		"I wanted to hear them.": {"curiosity": 20},
		"I was looking for someone.": {"empathy": 20},
		"I don't know why.": {},
	},
}

# --- Moral scores (0-100) ---

var _empathy_score: int = 0
var _self_preservation: int = 0
var _curiosity: int = 0

# --- Counters ---

var _sacrifice_count: int = 0
var _tapes_taken: int = 0
var _tapes_refused: int = 0
var _callers_helped: int = 0
var _callers_abandoned: int = 0

# --- Dread tracking (mirror for systems that query the tracker) ---

var _dread: float = 0.0

# Tracks the empathy level before the latest choice so we can detect threshold crossings.
var _prev_empathy_level: String = "neutral"

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


func _ready() -> void:
	_prev_empathy_level = get_empathy_level()


# ---------------------------------------------------------------------------
# Getters
# ---------------------------------------------------------------------------


## Current empathy score (0-100).
func get_empathy_score() -> int:
	return _empathy_score


## Current self-preservation score (0-100).
func get_self_preservation() -> int:
	return _self_preservation


## Current curiosity score (0-100).
func get_curiosity() -> int:
	return _curiosity


## Number of times the player sacrificed something.
func get_sacrifice_count() -> int:
	return _sacrifice_count


## Number of tapes the player took.
func get_tapes_taken() -> int:
	return _tapes_taken


## Number of tapes the player refused.
func get_tapes_refused() -> int:
	return _tapes_refused


## Number of callers the player helped.
func get_callers_helped() -> int:
	return _callers_helped


## Number of callers the player abandoned.
func get_callers_abandoned() -> int:
	return _callers_abandoned


## Current dread value tracked by the moral system.
func get_dread() -> float:
	return _dread


# ---------------------------------------------------------------------------
# Setters
# ---------------------------------------------------------------------------


## Set empathy score directly (clamped 0-100). Emits threshold signal if level changes.
func set_empathy_score(value: int) -> void:
	_empathy_score = clampi(value, MIN_SCORE, MAX_SCORE)
	_check_empathy_threshold()


## Set self-preservation score directly (clamped 0-100).
func set_self_preservation(value: int) -> void:
	_self_preservation = clampi(value, MIN_SCORE, MAX_SCORE)


## Set curiosity score directly (clamped 0-100).
func set_curiosity(value: int) -> void:
	_curiosity = clampi(value, MIN_SCORE, MAX_SCORE)


# ---------------------------------------------------------------------------
# Core: record_choice
# ---------------------------------------------------------------------------


## Record a moral choice for a specific call. Applies empathy / self-preservation
## / curiosity deltas, sacrifice increments, and dread penalties per the GDD mapping.
## `call_id` is the call's numeric id (0-17). `choice_type` is the choice text.
func record_choice(call_id: int, choice_type: String) -> void:
	var effects: Dictionary = _lookup_effects(call_id, choice_type)
	if not effects.has("_mapped"):
		return
	effects.erase("_mapped")

	# --- Apply score deltas ---
	if effects.has("empathy"):
		set_empathy_score(_empathy_score + int(effects["empathy"]))
	if effects.has("self_preservation"):
		set_self_preservation(_self_preservation + int(effects["self_preservation"]))
	if effects.has("curiosity"):
		set_curiosity(_curiosity + int(effects["curiosity"]))

	# --- Sacrifice ---
	if effects.get("sacrifice", false):
		_sacrifice_count += 1

	# --- Dread ---
	# Baseline: every moral choice adds +5 dread (brief / GDD dread meter spec).
	_apply_dread(MORAL_CHOICE_DREAD)
	# Additional dread from explicit GDD dread penalties (e.g. Call #9 "Burn it" +20).
	if effects.has("dread"):
		_apply_dread(float(effects["dread"]))
	# Composure penalties translate to equivalent dread (composure -X → dread +X).
	# Skip when the call's choice already applies a non-zero sanityDelta in
	# calls.json — CallManager._apply_choice_effects() forwards -sanityDelta
	# as dread to the same live DreadComposure, so applying both would
	# double-count the same penalty.
	if effects.has("composure_penalty") and not _choice_has_sanity_delta(call_id, choice_type):
		_apply_dread(float(effects["composure_penalty"]))

	# Emit the recorded signal with the effects that were applied.
	var applied: Dictionary = effects.duplicate()
	applied["dread_baseline"] = MORAL_CHOICE_DREAD
	moral_choice_recorded.emit(call_id, choice_type, applied)


## Look up the effects dictionary for a (call_id, choice_type) pair.
## Falls back to data-driven lookup via CallData autoload if the hardcoded
## map does not contain the entry.
func _lookup_effects(call_id: int, choice_type: String) -> Dictionary:
	if _CHOICE_MAP.has(call_id):
		var call_choices: Dictionary = _CHOICE_MAP[call_id]
		if call_choices.has(choice_type):
			var result: Dictionary = call_choices[choice_type].duplicate()
			result["_mapped"] = true
			return result

	# Data-driven fallback: check calls.json moral_choices via CallData autoload.
	if CallData:
		var call_data: Dictionary = CallData.get_call(call_id)
		var moral_choices: Array = call_data.get("moral_choices", [])
		for mc in moral_choices:
			if str(mc.get("choice", "")) == choice_type:
				var d: Dictionary = {}
				if mc.has("empathy"):
					d["empathy"] = int(mc["empathy"])
				if mc.has("self_preservation"):
					d["self_preservation"] = int(mc["self_preservation"])
				if mc.has("curiosity"):
					d["curiosity"] = int(mc["curiosity"])
				if mc.get("sacrifice", false):
					d["sacrifice"] = true
				if mc.has("dread"):
					d["dread"] = float(mc["dread"])
				if mc.has("composure_penalty"):
					d["composure_penalty"] = float(mc["composure_penalty"])
				d["_mapped"] = true
				return d
	return {}


## Check if the call's matching choice in calls.json has a non-zero sanityDelta.
## Used to avoid double-counting dread: CallManager._apply_choice_effects()
## already forwards -sanityDelta as dread to the live DreadComposure system.
func _choice_has_sanity_delta(call_id: int, choice_type: String) -> bool:
	if not CallData:
		return false
	var call_data: Dictionary = CallData.get_call(call_id)
	if call_data.is_empty():
		return false
	var choices: Array = call_data.get("choices", [])
	for choice in choices:
		if str(choice.get("text", "")) == choice_type:
			return float(choice.get("sanityDelta", 0.0)) != 0.0
	return false


# ---------------------------------------------------------------------------
# Empathy thresholds & world responses
# ---------------------------------------------------------------------------


## Returns the empathy level string: "warm" (>70), "neutral" (30-70), "cold" (<30).
func get_empathy_level() -> String:
	if _empathy_score > EMPATHY_WARM_THRESHOLD:
		return "warm"
	if _empathy_score < EMPATHY_COLD_THRESHOLD:
		return "cold"
	return "neutral"


## Returns world-response modifiers based on the current empathy level.
## Modifiers: voice_tone (String), degradation_intensity (float), signal_modifier (float).
func get_world_response_modifier() -> Dictionary:
	match get_empathy_level():
		"warm":
			return {
				"voice_tone": "warm",
				"degradation_intensity": 0.8,
				"signal_modifier": 1.1,
			}
		"cold":
			return {
				"voice_tone": "cold",
				"degradation_intensity": 1.2,
				"signal_modifier": 0.9,
			}
		_:
			return {
				"voice_tone": "neutral",
				"degradation_intensity": 1.0,
				"signal_modifier": 1.0,
			}


## Detect empathy threshold crossings and emit the signal.
func _check_empathy_threshold() -> void:
	var new_level := get_empathy_level()
	if new_level != _prev_empathy_level:
		_prev_empathy_level = new_level
		empathy_threshold_crossed.emit(new_level)


# ---------------------------------------------------------------------------
# Tape tracking
# ---------------------------------------------------------------------------


## Increment the tapes-taken counter (called by TapeInventory.collect_tape).
func add_tape_taken() -> void:
	_tapes_taken += 1


## Increment the tapes-refused counter (called by TapeInventory.refuse_tape).
func add_tape_refused() -> void:
	_tapes_refused += 1


# ---------------------------------------------------------------------------
# Caller tracking
# ---------------------------------------------------------------------------


## Increment the callers-helped counter.
func add_caller_helped() -> void:
	_callers_helped += 1


## Increment the callers-abandoned counter.
func add_caller_abandoned() -> void:
	_callers_abandoned += 1


# ---------------------------------------------------------------------------
# Sacrifice
# ---------------------------------------------------------------------------


## Increment sacrifice_count and apply a dread penalty.
func add_sacrifice() -> void:
	_sacrifice_count += 1
	_apply_dread(SACRIFICE_DREAD)


# ---------------------------------------------------------------------------
# Dread application
# ---------------------------------------------------------------------------


## Apply a dread delta. Updates the internal dread mirror and tries to forward
## the change to the live DreadComposure system (child of CallManager autoload)
## if it is available. Emits dread_changed.
func _apply_dread(amount: float) -> void:
	_dread = clampf(_dread + amount, 0.0, 100.0)

	# Forward to the live DreadComposure system if available.
	if CallManager:
		var dc: Node = CallManager.get_dread_composure()
		if dc and dc.has_method("add_dread"):
			dc.add_dread(amount)

	dread_changed.emit(amount, _dread)


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------


## Reset all moral scores and counters to their initial state (new game).
func reset() -> void:
	_empathy_score = 0
	_self_preservation = 0
	_curiosity = 0
	_sacrifice_count = 0
	_tapes_taken = 0
	_tapes_refused = 0
	_callers_helped = 0
	_callers_abandoned = 0
	_dread = 0.0
	_prev_empathy_level = "neutral"


# ---------------------------------------------------------------------------
# Save / Load
# ---------------------------------------------------------------------------


## Serialize all moral state into the provided dictionary (merges into `data`).
func save_to(data: Dictionary) -> Dictionary:
	data["empathy_score"] = _empathy_score
	data["self_preservation"] = _self_preservation
	data["curiosity"] = _curiosity
	data["sacrifice_count"] = _sacrifice_count
	data["tapes_taken"] = _tapes_taken
	data["tapes_refused"] = _tapes_refused
	data["moral_dread"] = _dread
	return data


## Load moral state from a dictionary (e.g. SaveData.to_dict()).
func load_from(data: Dictionary) -> void:
	_empathy_score = clampi(int(data.get("empathy_score", 0)), MIN_SCORE, MAX_SCORE)
	_self_preservation = clampi(int(data.get("self_preservation", 0)), MIN_SCORE, MAX_SCORE)
	_curiosity = clampi(int(data.get("curiosity", 0)), MIN_SCORE, MAX_SCORE)
	_sacrifice_count = int(data.get("sacrifice_count", 0))
	_tapes_taken = int(data.get("tapes_taken", 0))
	_tapes_refused = int(data.get("tapes_refused", 0))
	_dread = float(data.get("moral_dread", 0.0))
	_prev_empathy_level = get_empathy_level()
