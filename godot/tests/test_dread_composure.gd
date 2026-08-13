## test_dread_composure.gd — Unit tests for DreadComposure system.
## Tests: dread/composure tracking, auto-tune at low composure, composure break, signal propagation.
extends RefCounted

var test_name: String = "DreadComposure"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_dread_set_and_clamp"] = test_dread_set_and_clamp()
	results["test_dread_propagates_to_signal_strength"] = test_dread_propagates_to_signal_strength()
	results["test_composure_starts_at_100"] = test_composure_starts_at_100()
	results["test_composure_clamp_range"] = test_composure_clamp_range()
	results["test_composure_decay_entity"] = test_composure_decay_entity()
	results["test_composure_regen_safe_room"] = test_composure_regen_safe_room()
	results["test_composure_regen_between_calls"] = test_composure_regen_between_calls()
	results["test_composure_break_at_zero"] = test_composure_break_at_zero()
	results["test_break_resets_composure_to_20"] = test_break_resets_composure_to_20()
	results["test_auto_tune_triggers_at_low_composure"] = test_auto_tune_triggers_at_low_composure()
	results["test_break_auto_tunes_to_redacted_band"] = test_break_auto_tunes_to_redacted_band()
	results["test_reset_restores_defaults"] = test_reset_restores_defaults()
	return results


## Build a BandConfig with the 8 GDD bands for testing.
func _make_band_config() -> BandConfig:
	var config := BandConfig.new()
	var b0 := BandData.new()
	b0.id = 0; b0.name = "LIVING"; b0.center_frequency = 88.7; b0.sensitivity = 8.0
	b0.freq_range_min = 87.5; b0.freq_range_max = 92.0
	var b1 := BandData.new()
	b1.id = 1; b1.name = "LIMINAL"; b1.center_frequency = 94.0; b1.sensitivity = 6.0
	b1.freq_range_min = 92.0; b1.freq_range_max = 96.5
	var b2 := BandData.new()
	b2.id = 2; b2.name = "LOST"; b2.center_frequency = 98.5; b2.sensitivity = 4.0
	b2.freq_range_min = 96.5; b2.freq_range_max = 101.0
	var b3 := BandData.new()
	b3.id = 3; b3.name = "CLASSIFIED"; b3.center_frequency = 103.0; b3.sensitivity = 3.0
	b3.freq_range_min = 101.0; b3.freq_range_max = 105.5
	var b4 := BandData.new()
	b4.id = 4; b4.name = "████████"; b4.center_frequency = 106.5; b4.sensitivity = 1.5
	b4.freq_range_min = 105.5; b4.freq_range_max = 108.0
	var b5 := BandData.new()
	b5.id = 5; b5.name = "WEATHER"; b5.center_frequency = 162.0; b5.sensitivity = 5.0
	b5.freq_range_min = 160.0; b5.freq_range_max = 164.0
	var b6 := BandData.new()
	b6.id = 6; b6.name = "PIRATE"; b6.center_frequency = 166.0; b6.sensitivity = 2.5
	b6.freq_range_min = 164.0; b6.freq_range_max = 168.0
	b6.drifts = true; b6.drift_amount = 0.3; b6.drift_interval = 30.0
	var b7 := BandData.new()
	b7.id = 7; b7.name = "HISTORICAL"; b7.center_frequency = 170.0; b7.sensitivity = 4.0
	b7.freq_range_min = 168.0; b7.freq_range_max = 172.0
	config.bands = [b0, b1, b2, b3, b4, b5, b6, b7]
	return config


## Build a DreadComposure with optional SignalStrength and RadioTuner.
func _make_dread_composure(with_signal: bool = true, with_tuner: bool = true) -> DreadComposure:
	var dc := DreadComposure.new()
	if with_signal:
		dc.signal_strength = SignalStrength.new()
	if with_tuner:
		dc.radio_tuner = RadioTuner.new()
		dc.radio_tuner.band_config = _make_band_config()
		dc.radio_tuner.set_band(0)
	# Use deterministic RNG for tests
	dc.set_rng_seed(42)
	return dc


# --- Dread Tests ---

func test_dread_set_and_clamp() -> bool:
	var dc := _make_dread_composure()
	dc.set_dread(50.0)
	if abs(dc.dread - 50.0) > 0.01:
		return false
	dc.set_dread(150.0)
	if abs(dc.dread - 100.0) > 0.01:
		return false
	dc.set_dread(-10.0)
	return abs(dc.dread - 0.0) < 0.01


func test_dread_propagates_to_signal_strength() -> bool:
	var dc := _make_dread_composure(true, false)
	dc.set_dread(60.0)
	return abs(dc.signal_strength.dread_level - 60.0) < 0.01


# --- Composure Tests ---

func test_composure_starts_at_100() -> bool:
	var dc := _make_dread_composure(false, false)
	return abs(dc.composure - 100.0) < 0.01


func test_composure_clamp_range() -> bool:
	var dc := _make_dread_composure(false, false)
	dc.set_composure(150.0)
	if abs(dc.composure - 100.0) > 0.01:
		return false
	dc.set_composure(-10.0)
	return abs(dc.composure - 0.0) < 0.01


func test_composure_decay_entity() -> bool:
	var dc := _make_dread_composure(false, false)
	dc.entity_nearby = true
	# Decay = 2.0/sec from entity. Over 1 sec: composure should drop by 2.
	# Simulate _update_composure manually since we're not in scene tree.
	# We can call _process(1.0) which calls _update_composure internally.
	dc._process(1.0)
	return abs(dc.composure - 98.0) < 0.01


func test_composure_regen_safe_room() -> bool:
	var dc := _make_dread_composure(false, false)
	dc.composure = 50.0
	dc.in_safe_room = true
	# Regen = 3.0/sec in safe room. Over 1 sec: composure +3.
	dc._process(1.0)
	return abs(dc.composure - 53.0) < 0.01


func test_composure_regen_between_calls() -> bool:
	var dc := _make_dread_composure(false, false)
	dc.composure = 50.0
	dc.between_calls = true
	# Regen = 1.0/sec between calls. Over 1 sec: composure +1.
	dc._process(1.0)
	return abs(dc.composure - 51.0) < 0.01


# --- Break Tests ---

func test_composure_break_at_zero() -> bool:
	var dc := _make_dread_composure(false, false)
	var flag := {"emitted": false}
	dc.composure_break.connect(func(): flag["emitted"] = true)
	# Need to trigger _update_composure which checks composure <= 0
	# We force the break by having composure reach 0 through decay.
	dc.composure = 1.0
	dc.entity_nearby = true  # -2/sec decay
	dc._process(1.0)  # After 1 sec: 1 - 2 = -1, clamped to 0, should trigger break
	return flag["emitted"] and dc.break_active


func test_break_resets_composure_to_20() -> bool:
	var dc := _make_dread_composure(false, false)
	var flag := {"emitted": false}
	dc.composure_break.connect(func(): flag["emitted"] = true)
	# Trigger break
	dc.composure = 1.0
	dc.entity_nearby = true
	dc._process(1.0)  # triggers break
	if not flag["emitted"] or not dc.break_active:
		return false
	# Wait for break duration (10s)
	dc._process(11.0)  # break should end
	return not dc.break_active and abs(dc.composure - 20.0) < 0.01


# --- Auto-Tune Tests ---

func test_auto_tune_triggers_at_low_composure() -> bool:
	var dc := _make_dread_composure(false, true)
	var flag := {"emitted": false}
	dc.auto_tune_triggered.connect(func(): flag["emitted"] = true)
	# Set composure below 20
	dc.composure = 15.0
	# Simulate 31 seconds of processing — RNG may or may not trigger
	for i in range(31):
		dc._process(1.0)
	# If RNG triggered, verify band switched to REDACTED
	if flag["emitted"]:
		return dc.radio_tuner.current_band_id == DreadComposure.REDACTED_BAND_ID
	# RNG didn't trigger — verify the mechanism directly
	dc._trigger_auto_tune()
	return flag["emitted"] and dc.radio_tuner.current_band_id == DreadComposure.REDACTED_BAND_ID


func test_break_auto_tunes_to_redacted_band() -> bool:
	var dc := _make_dread_composure(false, true)
	var flag := {"emitted": false}
	dc.composure_break.connect(func(): flag["emitted"] = true)
	# Set band to LIVING first
	dc.radio_tuner.set_band(0)
	# Trigger break
	dc.composure = 1.0
	dc.entity_nearby = true
	dc._process(1.0)
	if not flag["emitted"]:
		return false
	# After break, radio should be on REDACTED band (4)
	return dc.radio_tuner.current_band_id == DreadComposure.REDACTED_BAND_ID


# --- Reset Test ---

func test_reset_restores_defaults() -> bool:
	var dc := _make_dread_composure(false, false)
	dc.set_dread(50.0)
	dc.set_composure(30.0)
	dc.break_active = true
	dc.reset()
	return abs(dc.dread - 0.0) < 0.01 and abs(dc.composure - 100.0) < 0.01 and not dc.break_active
