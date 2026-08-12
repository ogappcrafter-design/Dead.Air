# radio_tuner.gd — Core radio frequency tuning system
# DEA-97: Radio Tuning System
# Source: GDD radio tuning spec (docs/plans/redesign-gdd.md lines 850-1020)
class_name RadioTuner
extends Node

## Emitted when the tuning frequency changes (via input or programmatic set).
signal frequency_changed(freq: float)

## Emitted when the active band changes (via band switch input or programmatic set).
signal band_changed(band_id: int)

## Emitted when the calculated signal strength changes.
signal signal_changed(signal_value: float)

## Emitted when fine tuning is enabled or disabled.
signal fine_tune_changed(active: bool)

## Signal quality tiers based on GDD thresholds.
enum SignalQuality {
	DEAD_AIR,   ## signal < 20
	FRAGMENTS,  ## signal 20-50
	GARBLED,    ## signal 50-80
	CLEAR,      ## signal > 80
}

## Band configuration resource containing all 8 bands.
@export var band_config: BandConfig

## Minimum tunable frequency in MHz.
const FREQ_MIN: float = 87.5

## Maximum tunable frequency in MHz.
const FREQ_MAX: float = 173.0

## Frequency change per tuning tick (MHz).
const TUNE_STEP: float = 0.05

## Multiplier applied to sensitivity when fine tuning (L2/LT held).
const FINE_TUNE_MULTIPLIER: float = 0.5

## Current tuned frequency in MHz.
var current_frequency: float = FREQ_MIN

## Current active band index (0-7).
var current_band_id: int = 0

## Whether fine tuning is active (L2/LT held).
var fine_tuning: bool = false

# --- Internal drift state (PIRATE band) ---

var _drift_offset: float = 0.0
var _drift_timer: float = 0.0


func _ready() -> void:
	if band_config == null:
		push_warning("RadioTuner: No band_config assigned. Radio tuning will not function.")
		return
	# Start on band 0 (LIVING) at its center frequency.
	set_band(0)


func _process(delta: float) -> void:
	if band_config == null:
		return
	_update_drift(delta)


## Tune the frequency by a direction (-1.0 for down, +1.0 for up, fractional for analog stick).
## Steps by TUNE_STEP increments. Clamps to FREQ_MIN..FREQ_MAX.
func tune(direction: float) -> void:
	if band_config == null:
		return
	var step: float = TUNE_STEP * sign(direction)
	current_frequency = clamp(current_frequency + step, FREQ_MIN, FREQ_MAX)
	frequency_changed.emit(current_frequency)
	_emit_signal_if_changed()


## Set the frequency directly. Clamps to valid range.
func set_frequency(freq: float) -> void:
	if band_config == null:
		return
	current_frequency = clamp(freq, FREQ_MIN, FREQ_MAX)
	frequency_changed.emit(current_frequency)
	_emit_signal_if_changed()


## Switch to a specific band by index. Sets frequency to that band's center.
func set_band(band_id: int) -> void:
	if band_config == null:
		return
	var count: int = band_config.get_band_count()
	if band_id < 0 or band_id >= count:
		return
	current_band_id = band_id
	# Reset drift state when switching bands.
	_drift_offset = 0.0
	_drift_timer = 0.0
	# Set frequency to the band's center.
	var band: BandData = band_config.get_band(band_id)
	if band != null:
		current_frequency = clamp(band.center_frequency, FREQ_MIN, FREQ_MAX)
		frequency_changed.emit(current_frequency)
	band_changed.emit(band_id)
	_emit_signal_if_changed()


## Switch to the next band (wraps around).
func next_band() -> void:
	if band_config == null:
		return
	set_band(band_config.get_next_band_id(current_band_id))


## Switch to the previous band (wraps around).
func prev_band() -> void:
	if band_config == null:
		return
	set_band(band_config.get_prev_band_id(current_band_id))


## Enable or disable fine tuning mode.
func set_fine_tuning(active: bool) -> void:
	if fine_tuning == active:
		return
	fine_tuning = active
	fine_tune_changed.emit(active)
	_emit_signal_if_changed()


## Calculate the current signal strength (0-100) based on frequency offset from center.
## Formula: signal = max(0, 100 - (abs(currentFreq - centerFreq) * sensitivity))
## When fine tuning, sensitivity is multiplied by FINE_TUNE_MULTIPLIER (wider sweet spot).
func get_signal() -> float:
	if band_config == null:
		return 0.0
	var band: BandData = band_config.get_band(current_band_id)
	if band == null:
		return 0.0
	var center: float = get_current_center()
	var sens: float = get_current_sensitivity()
	var offset: float = abs(current_frequency - center)
	return max(0.0, 100.0 - (offset * sens))


## Get the current band's center frequency, including drift offset if applicable.
func get_current_center() -> float:
	if band_config == null:
		return 0.0
	var band: BandData = band_config.get_band(current_band_id)
	if band == null:
		return 0.0
	return band.center_frequency + _drift_offset


## Get the current sensitivity, applying fine tune modifier if active.
func get_current_sensitivity() -> float:
	if band_config == null:
		return 1.0
	var band: BandData = band_config.get_band(current_band_id)
	if band == null:
		return 1.0
	var sens: float = band.sensitivity
	if fine_tuning:
		sens *= FINE_TUNE_MULTIPLIER
	return sens


## Get the current BandData resource.
func get_current_band() -> BandData:
	if band_config == null:
		return null
	return band_config.get_band(current_band_id)


## Classify the current signal into a quality tier.
func get_signal_quality() -> SignalQuality:
	var s: float = get_signal()
	if s > 80.0:
		return SignalQuality.CLEAR
	elif s > 50.0:
		return SignalQuality.GARBLED
	elif s > 20.0:
		return SignalQuality.FRAGMENTS
	else:
		return SignalQuality.DEAD_AIR


## Check if the current frequency is within the current band's defined range.
func is_in_band_range() -> bool:
	if band_config == null:
		return false
	var band: BandData = band_config.get_band(current_band_id)
	if band == null:
		return false
	return current_frequency >= band.freq_range_min and current_frequency <= band.freq_range_max


# --- Internal: Drift handling for PIRATE band ---

func _update_drift(delta: float) -> void:
	var band: BandData = band_config.get_band(current_band_id)
	if band == null or not band.drifts:
		_drift_offset = 0.0
		_drift_timer = 0.0
		return
	_drift_timer += delta
	if _drift_timer >= band.drift_interval:
		_drift_timer = 0.0
		# Random drift: ±drift_amount
		_drift_offset = randf_range(-band.drift_amount, band.drift_amount)
		_emit_signal_if_changed()


# --- Internal: Signal change emission ---

var _last_signal: float = -1.0

func _emit_signal_if_changed() -> void:
	var s: float = get_signal()
	if abs(s - _last_signal) > 0.01:
		_last_signal = s
		signal_changed.emit(s)
