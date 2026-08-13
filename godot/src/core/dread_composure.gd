# dread_composure.gd — Dread and composure tracking system
# DEA-97: Radio Tuning System
# Source: GDD composure spec (docs/plans/redesign-gdd.md lines 854-1010)
class_name DreadComposure
extends Node

## Emitted when the dread level changes (0-100).
signal dread_changed(dread: float)

## Emitted when the composure level changes (0-100).
signal composure_changed(composure: float)

## Emitted when composure breaks (hits 0). Auto-tune to ████████ for 10s, composure resets to 20.
signal composure_break

## Emitted when an auto-tune event triggers (composure < 20, 30% chance per 30s).
signal auto_tune_triggered

## Reference to SignalStrength for dread propagation.
@export var signal_strength: SignalStrength

## Reference to RadioTuner for auto-tune frequency jumps.
@export var radio_tuner: RadioTuner

## Band ID for ████████ (the REDACTED band, index 4).
const REDACTED_BAND_ID: int = 4

## Composure at start.
const COMPOSURE_START: float = 100.0

## Composure reset value after BREAK.
const COMPOSURE_BREAK_RESET: float = 20.0

## Composure threshold for auto-tune chance.
const AUTO_TUNE_THRESHOLD: float = 20.0

## Auto-tune chance per check (30%).
const AUTO_TUNE_CHANCE: float = 0.30

## Auto-tune check interval in seconds.
const AUTO_TUNE_INTERVAL: float = 30.0

## BREAK duration in seconds (auto-tune to ████████).
const BREAK_DURATION: float = 10.0

## Composure regen in safe room (+3/sec).
const REGEN_SAFE_ROOM: float = 3.0

## Composure regen between calls (+1/sec).
const REGEN_BETWEEN_CALLS: float = 1.0

## Composure decay from entity proximity (-2/sec).
const DECAY_ENTITY: float = 2.0

## Composure decay from hiding while detected (-2/sec).
const DECAY_HIDING: float = 2.0

## Composure decay from hallucination (-1/sec).
const DECAY_HALLUCINATION: float = 1.0

## Current dread level (0-100).
var dread: float = 0.0

## Current composure level (0-100).
var composure: float = COMPOSURE_START

## Whether the player is in a safe room (composure regen +3/sec).
var in_safe_room: bool = false

## Whether an entity is nearby (composure decay -2/sec).
var entity_nearby: bool = false

## Whether the player is hiding while detected (composure decay -2/sec).
var hiding_detected: bool = false

## Whether the player is hallucinating (composure decay -1/sec).
var hallucinating: bool = false

## Whether we are between calls (composure regen +1/sec).
var between_calls: bool = false

## Whether a composure BREAK is currently active.
var break_active: bool = false

# Internal: auto-tune timer
var _auto_tune_timer: float = 0.0

# Internal: break timer
var _break_timer: float = 0.0

# Internal: RNG seed for deterministic testing (0 = random)
var _rng_seed: int = 0
var _rng: RandomNumberGenerator


func _ready() -> void:
	_rng = RandomNumberGenerator.new()
	if _rng_seed != 0:
		_rng.seed = _rng_seed


func _process(delta: float) -> void:
	_update_composure(delta)
	_update_auto_tune(delta)
	_update_break(delta)


## Set dread level (0-100). Propagates to SignalStrength.
func set_dread(level: float) -> void:
	dread = clamp(level, 0.0, 100.0)
	if signal_strength != null:
		signal_strength.set_dread(dread)
	dread_changed.emit(dread)


## Add to dread (clamped 0-100).
func add_dread(amount: float) -> void:
	set_dread(dread + amount)


## Set composure directly (clamped 0-100).
func set_composure(level: float) -> void:
	composure = clamp(level, 0.0, 100.0)
	composure_changed.emit(composure)


## Add to composure (clamped 0-100).
func add_composure(amount: float) -> void:
	set_composure(composure + amount)


## Set RNG seed for deterministic testing.
func set_rng_seed(seed: int) -> void:
	_rng_seed = seed
	_rng = RandomNumberGenerator.new()
	_rng.seed = seed


## Update composure based on current state.
func _update_composure(delta: float) -> void:
	if break_active:
		return  # Composure frozen during BREAK

	var regen: float = 0.0
	var decay: float = 0.0

	# Regen sources
	if in_safe_room:
		regen += REGEN_SAFE_ROOM
	if between_calls:
		regen += REGEN_BETWEEN_CALLS

	# Decay sources
	if entity_nearby:
		decay += DECAY_ENTITY
	if hiding_detected:
		decay += DECAY_HIDING
	if hallucinating:
		decay += DECAY_HALLUCINATION

	var net: float = regen - decay
	if abs(net) < 0.001:
		return

	composure = clamp(composure + net * delta, 0.0, 100.0)
	composure_changed.emit(composure)

	# Check for composure break
	if composure <= 0.0 and not break_active:
		_trigger_break()


## Check for auto-tune at low composure (composure < 20, 30% chance per 30s).
func _update_auto_tune(delta: float) -> void:
	if break_active:
		return

	if composure >= AUTO_TUNE_THRESHOLD:
		_auto_tune_timer = 0.0
		return

	_auto_tune_timer += delta
	if _auto_tune_timer >= AUTO_TUNE_INTERVAL:
		_auto_tune_timer = 0.0
		# 30% chance to auto-tune
		if _rng.randf() < AUTO_TUNE_CHANCE:
			_trigger_auto_tune()


## Handle BREAK state countdown.
func _update_break(delta: float) -> void:
	if not break_active:
		return

	_break_timer -= delta
	if _break_timer <= 0.0:
		break_active = false
		# Composure resets to 20 after BREAK
		composure = COMPOSURE_BREAK_RESET
		composure_changed.emit(composure)


## Trigger a composure BREAK: auto-tune to ████████ for 10s.
func _trigger_break() -> void:
	break_active = true
	_break_timer = BREAK_DURATION
	composure_break.emit()
	# Auto-tune to ████████
	if radio_tuner != null:
		radio_tuner.set_band(REDACTED_BAND_ID)


## Trigger an auto-tune event at low composure.
func _trigger_auto_tune() -> void:
	auto_tune_triggered.emit()
	if radio_tuner != null:
		radio_tuner.set_band(REDACTED_BAND_ID)


## Reset composure to starting value (for new game / checkpoint).
func reset() -> void:
	dread = 0.0
	composure = COMPOSURE_START
	break_active = false
	_auto_tune_timer = 0.0
	_break_timer = 0.0
	if signal_strength != null:
		signal_strength.set_dread(0.0)
	dread_changed.emit(dread)
	composure_changed.emit(composure)
