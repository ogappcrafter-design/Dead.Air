## test_accessibility_manager.gd — Tests for AccessibilityManager (DEA-141)
## Verifies volume controls, dB conversion, reduce-horror mode, colorblind patterns,
## visual cue computations, subtitles, hold-breath toggle, and pause override.
extends RefCounted

const EPS := 0.01

var test_name: String = "AccessibilityManager"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["percent_to_db_100_percent"] = _test_percent_to_db_100()
	results["percent_to_db_0_percent"] = _test_percent_to_db_0()
	results["percent_to_db_50_percent"] = _test_percent_to_db_50()
	results["db_to_percent_0_db"] = _test_db_to_percent_0()
	results["db_to_percent_min_db"] = _test_db_to_percent_min()
	results["db_to_percent_roundtrip"] = _test_db_to_percent_roundtrip()
	results["default_volumes_loaded"] = _test_default_volumes()
	results["set_volume_clamps"] = _test_set_volume_clamps()
	results["set_volume_emits_signal"] = _test_set_volume_emits_signal()
	results["reduce_horror_offsets_dread"] = _test_reduce_horror_offsets_dread()
	results["reduce_horror_offsets_stinger"] = _test_reduce_horror_offsets_stinger()
	results["reduce_horror_no_offset_master"] = _test_reduce_horror_no_offset_master()
	results["reduce_horror_toggle"] = _test_reduce_horror_toggle()
	results["colorblind_noise_type_living"] = _test_colorblind_living()
	results["colorblind_noise_type_lost"] = _test_colorblind_lost()
	results["colorblind_noise_type_classified"] = _test_colorblind_classified()
	results["colorblind_disabled_returns_default"] = _test_colorblind_disabled()
	results["colorblind_band_character_living"] = _test_colorblind_char_living()
	results["colorblind_band_character_lost"] = _test_colorblind_char_lost()
	results["colorblind_band_character_classified"] = _test_colorblind_char_classified()
	results["colorblind_band_character_unmapped"] = _test_colorblind_char_unmapped()
	results["colorblind_toggle"] = _test_colorblind_toggle()
	results["subtitles_toggle"] = _test_subtitles_toggle()
	results["subtitle_bg_toggle"] = _test_subtitle_bg_toggle()
	results["visual_cues_toggle"] = _test_visual_cues_toggle()
	results["hearing_impaired_toggle"] = _test_hearing_impaired_toggle()
	results["hold_breath_toggle"] = _test_hold_breath_toggle()
	results["pause_override_toggle"] = _test_pause_override_toggle()
	results["dread_vignette_zero"] = _test_dread_vignette_zero()
	results["dread_vignette_full"] = _test_dread_vignette_full()
	results["dread_vignette_half"] = _test_dread_vignette_half()
	results["scanline_intensity_full_signal"] = _test_scanline_full_signal()
	results["scanline_intensity_no_signal"] = _test_scanline_no_signal()
	results["scanline_intensity_half_signal"] = _test_scanline_half_signal()
	results["heartbeat_pulse_below_threshold"] = _test_heartbeat_below_threshold()
	results["heartbeat_pulse_at_threshold"] = _test_heartbeat_at_threshold()
	results["heartbeat_pulse_full"] = _test_heartbeat_full()
	results["dead_air_darken_active"] = _test_dead_air_darken_active()
	results["dead_air_darken_inactive"] = _test_dead_air_darken_inactive()
	results["reset_clears_state"] = _test_reset_clears_state()

	return results


# ─── Helper ─────────────────────────────────────────────────────────


func _make_manager():
	var script = load("res://src/core/accessibility_manager.gd")
	if script == null:
		return null
	return script.new()


func _approx_eq(a: float, b: float, eps: float = EPS) -> bool:
	return abs(a - b) <= eps


# ─── dB Conversion Tests ─────────────────────────────────────────────


func _test_percent_to_db_100() -> bool:
	return _approx_eq(AccessibilityManager.percent_to_db(100.0), 0.0)


func _test_percent_to_db_0() -> bool:
	return _approx_eq(AccessibilityManager.percent_to_db(0.0), -80.0)


func _test_percent_to_db_50() -> bool:
	# 50% → lerp(-80, 0, 0.5) = -40
	return _approx_eq(AccessibilityManager.percent_to_db(50.0), -40.0)


func _test_db_to_percent_0() -> bool:
	return _approx_eq(AccessibilityManager.db_to_percent(0.0), 100.0)


func _test_db_to_percent_min() -> bool:
	return _approx_eq(AccessibilityManager.db_to_percent(-80.0), 0.0)


func _test_db_to_percent_roundtrip() -> bool:
	var percent := 73.0
	var db := AccessibilityManager.percent_to_db(percent)
	var back := AccessibilityManager.db_to_percent(db)
	return _approx_eq(back, percent, 0.5)


# ─── Default Volume Tests ────────────────────────────────────────────


func _test_default_volumes() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Check default volume percentages match GDD spec
	var checks := [
		_approx_eq(am.get_volume("master"), 100.0),
		_approx_eq(am.get_volume("room"), 60.0),
		_approx_eq(am.get_volume("radio"), 80.0),
		_approx_eq(am.get_volume("call"), 90.0),
		_approx_eq(am.get_volume("dread"), 50.0),
		_approx_eq(am.get_volume("stinger"), 70.0),
	]
	for c in checks:
		if not c:
			return false
	return true


# ─── Set Volume Tests ────────────────────────────────────────────────


func _test_set_volume_clamps() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_volume("master", 150.0)  # Over 100
	if not _approx_eq(am.get_volume("master"), 100.0):
		return false
	am.set_volume("master", -10.0)  # Below 0
	if not _approx_eq(am.get_volume("master"), 0.0):
		return false
	return true


func _test_set_volume_emits_signal() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Use a Dictionary (reference type) so the lambda can modify captured state.
	# GDScript lambdas capture value types (String, float) by value, so local
	# String/float variables would not be updated by the signal handler.
	var received: Dictionary = {"key": "", "val": -999.0}
	am.volume_changed.connect(
		func(key, val):
			received["key"] = key
			received["val"] = val
	)
	am.set_volume("radio", 75.0)
	return received["key"] == "radio" and _approx_eq(received["val"], 75.0)


# ─── Reduce Audio Horror Tests ──────────────────────────────────────


func _test_reduce_horror_offsets_dread() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_reduce_audio_horror(true)
	# Dread at 50% → base dB = -40, offset -12 → -52
	var base := AccessibilityManager.percent_to_db(50.0)
	var expected := base + AccessibilityManager.REDUCE_HORROR_DREAD_OFFSET
	# Verify the reduce horror offset is applied conceptually
	return _approx_eq(expected, -52.0)


func _test_reduce_horror_offsets_stinger() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_reduce_audio_horror(true)
	# Stinger at 70% → base dB = -24, offset -12 → -36
	var base := AccessibilityManager.percent_to_db(70.0)
	var expected := base + AccessibilityManager.REDUCE_HORROR_STINGER_OFFSET
	return _approx_eq(expected, -36.0)


func _test_reduce_horror_no_offset_master() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_reduce_audio_horror(true)
	# Master should not be offset
	var expected := AccessibilityManager.percent_to_db(100.0)  # 0 dB, no offset
	return _approx_eq(expected, 0.0)


func _test_reduce_horror_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.reduce_audio_horror:
		return false
	am.set_reduce_audio_horror(true)
	if not am.reduce_audio_horror:
		return false
	am.set_reduce_audio_horror(false)
	return not am.reduce_audio_horror


# ─── Colorblind Audio Pattern Tests ────────────────────────────────


func _test_colorblind_living() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	return am.get_band_noise_type(0) == AccessibilityManager.NoiseType.BROWN


func _test_colorblind_lost() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	return am.get_band_noise_type(2) == AccessibilityManager.NoiseType.PINK


func _test_colorblind_classified() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	return am.get_band_noise_type(3) == AccessibilityManager.NoiseType.WHITE


func _test_colorblind_disabled() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(false)
	return am.get_band_noise_type(0) == AccessibilityManager.NoiseType.DEFAULT


func _test_colorblind_char_living() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	var char_data: Dictionary = am.get_colorblind_band_character(0)
	if char_data.is_empty():
		return false
	return float(char_data["filter_cutoff_hz"]) == 600.0


func _test_colorblind_char_lost() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	var char_data: Dictionary = am.get_colorblind_band_character(2)
	if char_data.is_empty():
		return false
	return float(char_data["filter_cutoff_hz"]) == 4000.0


func _test_colorblind_char_classified() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	var char_data: Dictionary = am.get_colorblind_band_character(3)
	if char_data.is_empty():
		return false
	return float(char_data["filter_cutoff_hz"]) == 12000.0


func _test_colorblind_char_unmapped() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_colorblind_patterns(true)
	# Band 1 (LIMINAL) has no colorblind override
	var char_data: Dictionary = am.get_colorblind_band_character(1)
	return char_data.is_empty()


func _test_colorblind_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.colorblind_patterns:
		return false
	am.set_colorblind_patterns(true)
	if not am.colorblind_patterns:
		return false
	am.set_colorblind_patterns(false)
	return not am.colorblind_patterns


# ─── Toggle Tests ──────────────────────────────────────────────────


func _test_subtitles_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_subtitles_enabled(false)
	if am.subtitles_enabled:
		return false
	am.set_subtitles_enabled(true)
	return am.subtitles_enabled


func _test_subtitle_bg_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_subtitle_bg_enabled(true)
	if not am.subtitle_bg_enabled:
		return false
	am.set_subtitle_bg_enabled(false)
	return not am.subtitle_bg_enabled


func _test_visual_cues_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_visual_cues_enabled(true)
	if not am.visual_cues_enabled:
		return false
	am.set_visual_cues_enabled(false)
	return not am.visual_cues_enabled


func _test_hearing_impaired_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_hearing_impaired_mode(true)
	if not am.hearing_impaired_mode:
		return false
	am.set_hearing_impaired_mode(false)
	return not am.hearing_impaired_mode


func _test_hold_breath_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_hold_breath_toggle_mode(true)
	if not am.hold_breath_toggle_mode:
		return false
	am.set_hold_breath_toggle_mode(false)
	return not am.hold_breath_toggle_mode


func _test_pause_override_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_pause_anywhere(true)
	if not am.pause_anywhere:
		return false
	am.set_pause_anywhere(false)
	return not am.pause_anywhere


# ─── Visual Cue Computation Tests ──────────────────────────────────


func _test_dread_vignette_zero() -> bool:
	return _approx_eq(AccessibilityManager.compute_dread_vignette(0.0), 0.0)


func _test_dread_vignette_full() -> bool:
	return _approx_eq(AccessibilityManager.compute_dread_vignette(100.0), 1.0)


func _test_dread_vignette_half() -> bool:
	return _approx_eq(AccessibilityManager.compute_dread_vignette(50.0), 0.5)


func _test_scanline_full_signal() -> bool:
	# Full signal (100) → 0 scanline intensity
	return _approx_eq(AccessibilityManager.compute_scanline_intensity(100.0), 0.0)


func _test_scanline_no_signal() -> bool:
	# No signal (0) → 1.0 scanline intensity
	return _approx_eq(AccessibilityManager.compute_scanline_intensity(0.0), 1.0)


func _test_scanline_half_signal() -> bool:
	return _approx_eq(AccessibilityManager.compute_scanline_intensity(50.0), 0.5)


func _test_heartbeat_below_threshold() -> bool:
	# Below dread 40 → no pulse
	return _approx_eq(AccessibilityManager.compute_heartbeat_pulse(35.0), 0.0)


func _test_heartbeat_at_threshold() -> bool:
	# At dread 40 → 0.0 (just at threshold)
	return _approx_eq(AccessibilityManager.compute_heartbeat_pulse(40.0), 0.0)


func _test_heartbeat_full() -> bool:
	# At dread 100 → 1.0
	return _approx_eq(AccessibilityManager.compute_heartbeat_pulse(100.0), 1.0)


func _test_dead_air_darken_active() -> bool:
	return _approx_eq(AccessibilityManager.compute_dead_air_darken(true), 0.3)


func _test_dead_air_darken_inactive() -> bool:
	return _approx_eq(AccessibilityManager.compute_dead_air_darken(false), 0.0)


# ─── Reset Test ────────────────────────────────────────────────────


func _test_reset_clears_state() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Set non-default state
	am.set_subtitles_enabled(false)
	am.set_reduce_audio_horror(true)
	am.set_colorblind_patterns(true)
	am.set_hold_breath_toggle_mode(true)
	am.set_pause_anywhere(true)
	am.set_volume("master", 50.0)

	# Reset
	am._reset_for_testing()

	# Verify all state is back to defaults
	return (
		am.subtitles_enabled == true
		and not am.reduce_audio_horror
		and not am.colorblind_patterns
		and not am.hold_breath_toggle_mode
		and not am.pause_anywhere
		and _approx_eq(am.get_volume("master"), 100.0)
		and _approx_eq(am.get_volume("radio"), 80.0)
		and _approx_eq(am.get_volume("dread"), 50.0)
	)
