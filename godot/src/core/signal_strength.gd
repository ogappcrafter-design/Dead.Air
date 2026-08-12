# signal_strength.gd — Signal strength decay and regeneration system
# DEA-97: Radio Tuning System
# Source: GDD radio tuning spec (docs/plans/redesign-gdd.md lines 850-1020)
class_name SignalStrength
extends Node

## Emitted when the effective signal strength changes (after decay/regen).
signal effective_signal_changed(signal_value: float)

## Base signal decay rate per second.
const BASE_DECAY: float = 1.5

## Signal regen rate during active retuning.
const REGEN_RETUNING: float = 2.0

## Signal regen rate between calls.
const REGEN_BETWEEN_CALLS: float = 1.0

## Reference to the RadioTuner for base signal calculation.
@export var radio_tuner: RadioTuner

## Current dread level (0-100). Affects decay rate.
var dread_level: float = 0.0

## Whether the player is in a safe room (decay=0, regen=0).
var in_safe_room: bool = false

## Whether weather interference is active (decay ×1.3).
var weather_interference: bool = false

## Whether an entity is present (additional -0.5/sec signal drain).
var entity_present: bool = false

## Whether the player is actively retuning (regen +2/sec).
var is_retuning: bool = false

## Whether we are between calls (regen +1/sec).
var between_calls: bool = false

## The current effective signal strength after decay/regen (0-100).
var effective_signal: float = 100.0

# Internal: last base signal from RadioTuner
var _last_base_signal: float = 100.0


func _ready() -> void:
	if radio_tuner == null:
		push_warning("SignalStrength: No radio_tuner assigned. Signal tracking inactive.")


func _process(delta: float) -> void:
	if radio_tuner == null:
		return
	var base_signal: float = radio_tuner.get_signal()
	_last_base_signal = base_signal

	# Calculate decay rate
	var decay_rate: float = _get_decay_rate()

	# Calculate regen rate
	var regen_rate: float = _get_regen_rate()

	# Net signal change this frame
	var net: float = regen_rate - decay_rate
	effective_signal = clamp(effective_signal + net * delta, 0.0, 100.0)

	# If the base signal (tuning) drops below effective, clamp effective down
	# (you can't have higher effective signal than what tuning provides)
	if effective_signal > base_signal:
		effective_signal = base_signal

	effective_signal_changed.emit(effective_signal)


## Get the current decay rate based on dread, safe room, weather, entity.
func _get_decay_rate() -> float:
	if in_safe_room:
		return 0.0
	var rate: float = BASE_DECAY
	# Dread scaling
	if dread_level > 75.0:
		rate *= 2.0
	elif dread_level > 50.0:
		rate *= 1.5
	# Weather interference
	if weather_interference:
		rate *= 1.3
	# Entity presence: additional 0.5/sec drain
	if entity_present:
		rate += 0.5
	return rate


## Get the current regen rate based on activity state.
func _get_regen_rate() -> float:
	if in_safe_room:
		return 0.0
	if is_retuning:
		return REGEN_RETUNING
	if between_calls:
		return REGEN_BETWEEN_CALLS
	return 0.0


## Reset effective signal to full (e.g., on band switch or new call).
func reset_signal() -> void:
	effective_signal = 100.0
	if radio_tuner != null:
		effective_signal = radio_tuner.get_signal()
	effective_signal_changed.emit(effective_signal)


## Set dread level (0-100).
func set_dread(level: float) -> void:
	dread_level = clamp(level, 0.0, 100.0)


## Force the effective signal to a specific value (for testing or scripted events).
func set_effective_signal(value: float) -> void:
	effective_signal = clamp(value, 0.0, 100.0)
	effective_signal_changed.emit(effective_signal)
