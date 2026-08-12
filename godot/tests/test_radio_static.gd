extends RefCounted
## Tests for RadioStatic pure logic functions.

var test_name: String = "RadioStatic"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["all_8_bands_have_characters"] = _test_all_bands_have_characters()
	results["band_labels_correct"] = _test_band_labels()
	results["volume_0_is_min"] = _test_volume_0()
	results["volume_50_is_midpoint"] = _test_volume_50()
	results["volume_100_is_max"] = _test_volume_100()
	results["filter_cutoff_increases_with_signal"] = _test_filter_cutoff()
	results["interference_more_frequent_at_low_signal"] = _test_interference_interval()
	results["whisper_below_threshold_false"] = _test_whisper_below()
	results["whisper_above_threshold_true"] = _test_whisper_above()
	results["heartbeat_band_4_true"] = _test_heartbeat_band4()
	results["heartbeat_other_bands_false"] = _test_heartbeat_others()
	results["tier_clear_above_80"] = _test_tier_clear()
	results["tier_garbled_50_to_80"] = _test_tier_garbled()
	results["tier_fragments_20_to_50"] = _test_tier_fragments()
	results["tier_dead_air_below_20"] = _test_tier_dead_air()
	results["tier_dead_air_at_0"] = _test_tier_zero()
	results["static_intensity_per_tier"] = _test_static_intensity()

	return results


# ─── Band Character Tests ────────────────────────────────────────────

func _test_all_bands_have_characters() -> bool:
	for i in range(8):
		var ch := RadioStatic.get_band_character(i)
		if not ch.has("label"):
			return false
		if not ch.has("filter_cutoff_hz"):
			return false
		if not ch.has("filter_resonance"):
			return false
		if not ch.has("noise_gain"):
			return false
	return true


func _test_band_labels() -> bool:
	var expected := ["LIVING", "LIMINAL", "LOST", "CLASSIFIED", "████████", "WEATHER", "PIRATE", "HISTORICAL"]
	for i in range(8):
		var ch := RadioStatic.get_band_character(i)
		if ch["label"] != expected[i]:
			return false
	return true


# ─── Volume Mapping Tests ─────────────────────────────────────────────

func _test_volume_0() -> bool:
	var vol := RadioStatic.signal_to_volume_db(0.0)
	return is_equal_approx(vol, -80.0)


func _test_volume_50() -> bool:
	var vol := RadioStatic.signal_to_volume_db(50.0)
	return is_equal_approx(vol, -40.0)


func _test_volume_100() -> bool:
	var vol := RadioStatic.signal_to_volume_db(100.0)
	return is_equal_approx(vol, 0.0)


# ─── Filter Cutoff Tests ──────────────────────────────────────────────

func _test_filter_cutoff() -> bool:
	var band_cutoff := 8000.0
	var low := RadioStatic.signal_to_filter_cutoff(10.0, band_cutoff)
	var high := RadioStatic.signal_to_filter_cutoff(90.0, band_cutoff)
	# Higher signal should produce higher cutoff
	return high > low


# ─── Interference Interval Tests ──────────────────────────────────────

func _test_interference_interval() -> bool:
	var low_signal := RadioStatic.get_interference_interval(10.0)
	var high_signal := RadioStatic.get_interference_interval(90.0)
	# Lower signal → shorter interval (more frequent)
	return low_signal < high_signal


# ─── Whisper Tests ────────────────────────────────────────────────────

func _test_whisper_below() -> bool:
	return not RadioStatic.should_play_whisper(59.0)


func _test_whisper_above() -> bool:
	return RadioStatic.should_play_whisper(61.0)


# ─── Heartbeat Tests ──────────────────────────────────────────────────

func _test_heartbeat_band4() -> bool:
	return RadioStatic.should_play_heartbeat(4)


func _test_heartbeat_others() -> bool:
	for i in range(8):
		if i == 4:
			continue
		if RadioStatic.should_play_heartbeat(i):
			return false
	return true


# ─── Signal Tier Tests ────────────────────────────────────────────────

func _test_tier_clear() -> bool:
	return RadioStatic.get_signal_tier(81.0) == RadioStatic.SignalTier.CLEAR


func _test_tier_garbled() -> bool:
	return RadioStatic.get_signal_tier(80.0) == RadioStatic.SignalTier.GARBLED


func _test_tier_fragments() -> bool:
	return RadioStatic.get_signal_tier(50.0) == RadioStatic.SignalTier.FRAGMENTS


func _test_tier_dead_air() -> bool:
	return RadioStatic.get_signal_tier(20.0) == RadioStatic.SignalTier.DEAD_AIR


func _test_tier_zero() -> bool:
	return RadioStatic.get_signal_tier(0.0) == RadioStatic.SignalTier.DEAD_AIR


# ─── Static Intensity Tests ──────────────────────────────────────────

func _test_static_intensity() -> bool:
	var clear_i := RadioStatic.get_static_intensity(RadioStatic.SignalTier.CLEAR)
	var garbled_i := RadioStatic.get_static_intensity(RadioStatic.SignalTier.GARBLED)
	var fragments_i := RadioStatic.get_static_intensity(RadioStatic.SignalTier.FRAGMENTS)
	var dead_i := RadioStatic.get_static_intensity(RadioStatic.SignalTier.DEAD_AIR)
	# Intensity should increase as signal degrades
	return clear_i < garbled_i and garbled_i < fragments_i and fragments_i < dead_i
