## test_radio_tuner.gd — Unit tests for DEA-97 Radio Tuning System.
## Tests: signal formula, band switching, fine tuning, frequency clamping, drift.
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

var test_name: String = "RadioTuner"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_signal_formula_at_center"] = test_signal_formula_at_center()
	results["test_signal_formula_offset"] = test_signal_formula_offset()
	results["test_signal_formula_zero_at_extreme"] = test_signal_formula_zero_at_extreme()
	results["test_fine_tuning_halves_sensitivity"] = test_fine_tuning_halves_sensitivity()
	results["test_band_switch_sets_center_freq"] = test_band_switch_sets_center_freq()
	results["test_band_switch_wraps_next"] = test_band_switch_wraps_next()
	results["test_band_switch_wraps_prev"] = test_band_switch_wraps_prev()
	results["test_frequency_clamped_to_range"] = test_frequency_clamped_to_range()
	results["test_tune_step_increment"] = test_tune_step_increment()
	results["test_signal_quality_thresholds"] = test_signal_quality_thresholds()
	results["test_is_in_band_range"] = test_is_in_band_range()
	results["test_find_band_by_frequency"] = test_find_band_by_frequency()
	return results


## Build a BandConfig with the 8 GDD bands for testing.
func _make_band_config() -> BandConfig:
	var config := BandConfig.new()
	# Band 0: LIVING
	var b0 := BandData.new()
	b0.id = 0
	b0.name = "LIVING"
	b0.center_frequency = 88.7
	b0.sensitivity = 8.0
	b0.freq_range_min = 87.5
	b0.freq_range_max = 92.0
	# Band 1: LIMINAL
	var b1 := BandData.new()
	b1.id = 1
	b1.name = "LIMINAL"
	b1.center_frequency = 94.0
	b1.sensitivity = 6.0
	b1.freq_range_min = 92.0
	b1.freq_range_max = 96.5
	# Band 2: LOST
	var b2 := BandData.new()
	b2.id = 2
	b2.name = "LOST"
	b2.center_frequency = 98.5
	b2.sensitivity = 4.0
	b2.freq_range_min = 96.5
	b2.freq_range_max = 101.0
	# Band 3: CLASSIFIED
	var b3 := BandData.new()
	b3.id = 3
	b3.name = "CLASSIFIED"
	b3.center_frequency = 103.0
	b3.sensitivity = 3.0
	b3.freq_range_min = 101.0
	b3.freq_range_max = 105.5
	# Band 4: ████████
	var b4 := BandData.new()
	b4.id = 4
	b4.name = "████████"
	b4.center_frequency = 106.5
	b4.sensitivity = 1.5
	b4.freq_range_min = 105.5
	b4.freq_range_max = 108.0
	# Band 5: WEATHER
	var b5 := BandData.new()
	b5.id = 5
	b5.name = "WEATHER"
	b5.center_frequency = 162.0
	b5.sensitivity = 5.0
	b5.freq_range_min = 160.0
	b5.freq_range_max = 164.0
	# Band 6: PIRATE
	var b6 := BandData.new()
	b6.id = 6
	b6.name = "PIRATE"
	b6.center_frequency = 166.0
	b6.sensitivity = 2.5
	b6.freq_range_min = 164.0
	b6.freq_range_max = 168.0
	b6.drifts = true
	b6.drift_amount = 0.3
	b6.drift_interval = 30.0
	# Band 7: HISTORICAL
	var b7 := BandData.new()
	b7.id = 7
	b7.name = "HISTORICAL"
	b7.center_frequency = 170.0
	b7.sensitivity = 4.0
	b7.freq_range_min = 168.0
	b7.freq_range_max = 172.0
	config.bands = [b0, b1, b2, b3, b4, b5, b6, b7]
	return config


## Build a RadioTuner (as a Node) with the test band config.
## Since RadioTuner._ready() calls set_band(0), we simulate that here.
func _make_tuner() -> RadioTuner:
	var tuner := RadioTuner.new()
	tuner.band_config = _make_band_config()
	# Simulate _ready() since we're not in a scene tree.
	tuner.set_band(0)
	return tuner


# --- Signal Formula Tests ---

func test_signal_formula_at_center() -> bool:
	var tuner := _make_tuner()
	tuner.set_frequency(88.7)  # LIVING center
	var sig: float = tuner.get_signal()
	# At center, offset=0, signal should be 100
	return abs(sig - 100.0) < 0.01


func test_signal_formula_offset() -> bool:
	var tuner := _make_tuner()
	# LIVING: center=88.7, sensitivity=8.0
	# At freq=89.7, offset=1.0, signal = 100 - (1.0 * 8.0) = 92.0
	tuner.set_frequency(89.7)
	var sig: float = tuner.get_signal()
	return abs(sig - 92.0) < 0.01


func test_signal_formula_zero_at_extreme() -> bool:
	var tuner := _make_tuner()
	# LIVING: center=88.7, sensitivity=8.0
	# At freq=92.0, offset=3.3, signal = 100 - (3.3 * 8.0) = 100 - 26.4 = 73.6
	# At freq=87.5, offset=1.2, signal = 100 - (1.2 * 8.0) = 100 - 9.6 = 90.4
	# To get signal=0: offset = 100/8 = 12.5, freq = 88.7 + 12.5 = 101.2
	tuner.set_frequency(101.2)
	var sig: float = tuner.get_signal()
	return sig == 0.0


# --- Fine Tuning Tests ---

func test_fine_tuning_halves_sensitivity() -> bool:
	var tuner := _make_tuner()
	# LIVING: center=88.7, sensitivity=8.0
	# Without fine tuning: at offset 1.0, signal = 100 - 8.0 = 92.0
	tuner.set_frequency(89.7)
	var signal_normal: float = tuner.get_signal()
	# With fine tuning: sensitivity = 8.0 * 0.5 = 4.0, signal = 100 - 4.0 = 96.0
	tuner.set_fine_tuning(true)
	var signal_fine: float = tuner.get_signal()
	return abs(signal_normal - 92.0) < 0.01 and abs(signal_fine - 96.0) < 0.01


# --- Band Switching Tests ---

func test_band_switch_sets_center_freq() -> bool:
	var tuner := _make_tuner()
	tuner.set_phase(1)  # Phase 1 → LIMINAL is native, avoids cross-pollination penalty
	tuner.set_band(1)  # LIMINAL, center=94.0
	var sig: float = tuner.get_signal()
	# Should be at center, signal=100
	return abs(tuner.current_frequency - 94.0) < 0.01 and abs(sig - 100.0) < 0.01


func test_band_switch_wraps_next() -> bool:
	var tuner := _make_tuner()
	tuner.set_band(7)  # HISTORICAL (last band)
	tuner.next_band()
	# Should wrap to band 0
	return tuner.current_band_id == 0


func test_band_switch_wraps_prev() -> bool:
	var tuner := _make_tuner()
	tuner.set_band(0)  # LIVING (first band)
	tuner.prev_band()
	# Should wrap to band 7
	return tuner.current_band_id == 7


# --- Frequency Clamping Tests ---

func test_frequency_clamped_to_range() -> bool:
	var tuner := _make_tuner()
	# Try to set below minimum
	tuner.set_frequency(50.0)
	if tuner.current_frequency != RadioTuner.FREQ_MIN:
		return false
	# Try to set above maximum
	tuner.set_frequency(2000.0)
	return abs(tuner.current_frequency - RadioTuner.FREQ_MAX) < 0.01


# --- Tune Step Tests ---

func test_tune_step_increment() -> bool:
	var tuner := _make_tuner()
	tuner.set_frequency(88.7)
	tuner.tune(1.0)  # +0.05
	if abs(tuner.current_frequency - 88.75) > 0.001:
		return false
	tuner.tune(-1.0)  # -0.05, back to 88.7
	return abs(tuner.current_frequency - 88.7) < 0.001


# --- Signal Quality Threshold Tests ---

func test_signal_quality_thresholds() -> bool:
	var tuner := _make_tuner()
	# CLEAR: signal > 80
	tuner.set_band(0)
	tuner.set_frequency(88.7)  # At center, signal=100
	if tuner.get_signal_quality() != RadioTuner.SignalQuality.CLEAR:
		return false
	# GARBLED: signal 50-80
	# LIVING sens=8.0, signal=65 → offset = (100-65)/8 = 4.375, freq = 88.7 + 4.375 = 93.075
	tuner.set_frequency(93.075)
	if tuner.get_signal_quality() != RadioTuner.SignalQuality.GARBLED:
		return false
	# FRAGMENTS: signal 20-50
	# offset = (100-35)/8 = 8.125, freq = 88.7 + 8.125 = 96.825
	tuner.set_frequency(96.825)
	if tuner.get_signal_quality() != RadioTuner.SignalQuality.FRAGMENTS:
		return false
	# DEAD_AIR: signal < 20
	# offset = (100-10)/8 = 11.25, freq = 88.7 + 11.25 = 99.95
	tuner.set_frequency(99.95)
	return tuner.get_signal_quality() == RadioTuner.SignalQuality.DEAD_AIR


# --- Band Range Tests ---

func test_is_in_band_range() -> bool:
	var tuner := _make_tuner()
	tuner.set_band(0)  # LIVING: 87.5-92.0
	tuner.set_frequency(90.0)
	if not tuner.is_in_band_range():
		return false
	tuner.set_frequency(95.0)  # Outside LIVING range
	return not tuner.is_in_band_range()


# --- Find Band Tests ---

func test_find_band_by_frequency() -> bool:
	var config := _make_band_config()
	# 90.0 is in LIVING (87.5-92.0)
	if config.find_band_by_frequency(90.0) != 0:
		return false
	# 94.0 is in LIMINAL (92.0-96.5)
	if config.find_band_by_frequency(94.0) != 1:
		return false
	# 162.0 is in WEATHER (160.0-164.0)
	if config.find_band_by_frequency(162.0) != 5:
		return false
	# 155.0 is between bands (not in any range)
	return config.find_band_by_frequency(155.0) == -1
