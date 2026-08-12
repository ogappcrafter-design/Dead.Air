# signal_strength.gd — Signal strength decay and regeneration system
# DEA-98: Signal Strength & Decay System
# DEA-97: Radio Tuning System (original)
# Source: GDD radio tuning spec (docs/plans/redesign-gdd.md lines 850-1020)
class_name SignalStrength
extends Node

## Emitted when the signal strength changes (after decay/regen).
signal signal_changed(signal_value: float)

## Emitted when signal reaches 0 and the player must physically retune.
signal signal_lost()

## Emitted when signal is restored after being lost (retune completed).
signal signal_restored()

## Starting signal strength at shift start.
const INITIAL_SIGNAL: float = 80.0

## Base signal decay rate per second.
const BASE_DECAY: float = 1.5

## Signal regen rate during active retuning.
const REGEN_RETUNING: float = 2.0

## Signal regen rate during breather events.
const REGEN_BREATHER: float = 1.0

## Signal drain per active entity per second.
const ENTITY_DRAIN_PER_ENTITY: float = 0.5

## Reference to the RadioTuner for base signal calculation.
@export var radio_tuner: RadioTuner

## Current dread level (0-100). Affects decay rate.
var dread_level: float = 0.0

## Whether the player is in a safe room (decay=0, regen=0).
var in_safe_room: bool = false

## Whether weather interference is active (decay ×1.3).
var weather_interference: bool = false

## Number of active entities causing signal interference (-0.5/sec each).
var active_entity_count: int = 0

## Whether the player is actively retuning (regen +2/sec).
var is_retuning: bool = false

## Whether a breather event is active (regen +1/sec).
var in_breather: bool = false

## The current signal strength after decay/regen (0-100).
var signal_value: float = INITIAL_SIGNAL

## True when signal has hit 0 — player must physically retune to restore.
var must_retune: bool = false

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

	# If in must-retune state, signal stays at 0 until player retunes
	if must_retune:
		if is_retuning:
			# Player started retuning — clear the lock and begin regen
			must_retune = false
			signal_restored.emit()
		else:
			# Locked at 0, no decay or regen
			signal_value = 0.0
			signal_changed.emit(signal_value)
			return

	# Calculate decay rate
	var decay_rate: float = _get_decay_rate()

	# Calculate regen rate
	var regen_rate: float = _get_regen_rate()

	# Net signal change this frame
	var net: float = regen_rate - decay_rate
	signal_value = clamp(signal_value + net * delta, 0.0, 100.0)

	# If the base signal (tuning) drops below effective, clamp effective down
	# (you can't have higher effective signal than what tuning provides)
	if signal_value > base_signal:
		signal_value = base_signal

	# Check if signal just hit 0
	if signal_value <= 0.0 and not must_retune:
		must_retune = true
		signal_lost.emit()

	signal_changed.emit(signal_value)


## Get the current decay rate based on dread, safe room, weather, entities.
func _get_decay_rate() -> float:
	if in_safe_room:
		return 0.0
	var rate: float = BASE_DECAY
	# Dread scaling (multiplicative)
	if dread_level > 75.0:
		rate *= 2.0
	elif dread_level > 50.0:
		rate *= 1.5
	# Weather interference (multiplicative with dread scaling)
	if weather_interference:
		rate *= 1.3
	# Entity interference: additional drain per active entity
	rate += ENTITY_DRAIN_PER_ENTITY * float(active_entity_count)
	return rate


## Get the current regen rate based on activity state.
func _get_regen_rate() -> float:
	if in_safe_room:
		return 0.0
	var regen: float = 0.0
	if is_retuning:
		regen += REGEN_RETUNING
	if in_breather:
		regen += REGEN_BREATHER
	return regen


## Reset signal to initial value (80) for a new shift.
func start_shift() -> void:
	signal_value = INITIAL_SIGNAL
	must_retune = false
	signal_changed.emit(signal_value)


## Reset signal to full base signal (e.g., on band switch or new call).
func reset_signal() -> void:
	signal_value = 100.0
	must_retune = false
	if radio_tuner != null:
		signal_value = radio_tuner.get_signal()
	signal_changed.emit(signal_value)


## Set dread level (0-100).
func set_dread(level: float) -> void:
	dread_level = clamp(level, 0.0, 100.0)


## Set the number of active entities causing interference.
func set_entity_count(count: int) -> void:
	active_entity_count = max(0, count)


## Force the signal to a specific value (for testing or scripted events).
func set_signal(value: float) -> void:
	signal_value = clamp(value, 0.0, 100.0)
	if signal_value <= 0.0:
		must_retune = true
	else:
		must_retune = false
	signal_changed.emit(signal_value)


## Returns true if the signal is at 0 (silence).
func is_silent() -> bool:
	return signal_value <= 0.0
