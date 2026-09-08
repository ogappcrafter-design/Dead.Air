## test_call_audio_pipeline.gd — Tests for CallAudioPipeline (DEA-137)
## Verifies band EQ profiles, signal quality mapping, dread modifier,
## Phase 4 corruption, metadata handling, ducking, and call lifecycle.
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

const EPS := 0.01

var test_name: String = "CallAudioPipeline"

# Reference to CallAudioPipeline autoload
var _pipeline: Node


func _init() -> void:
	var tree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		_pipeline = tree.root.get_node_or_null("/root/CallAudioPipeline")


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_pipeline_exists"] = test_pipeline_exists()
	results["test_default_state"] = test_default_state()
	results["test_band_eq_living_profile"] = test_band_eq_living_profile()
	results["test_band_eq_lost_profile"] = test_band_eq_lost_profile()
	results["test_band_eq_classified_profile"] = test_band_eq_classified_profile()
	results["test_band_eq_redacted_profile"] = test_band_eq_redacted_profile()
	results["test_signal_quality_100_clean"] = test_signal_quality_100_clean()
	results["test_signal_quality_0_extreme"] = test_signal_quality_0_extreme()
	results["test_signal_quality_50_midpoint"] = test_signal_quality_50_midpoint()
	results["test_signal_quality_clamped"] = test_signal_quality_clamped()
	results["test_dread_below_threshold_no_modification"] = test_dread_below_threshold_no_modification()
	results["test_dread_above_threshold_pitch_shift"] = test_dread_above_threshold_pitch_shift()
	results["test_dread_above_threshold_reverb_tail"] = test_dread_above_threshold_reverb_tail()
	results["test_dread_above_threshold_random_gate"] = test_dread_above_threshold_random_gate()
	results["test_start_call_audio_metadata"] = test_start_call_audio_metadata()
	results["test_start_call_audio_segments"] = test_start_call_audio_segments()
	results["test_start_call_audio_ducks_radio_ambient"] = test_start_call_audio_ducks_radio_ambient()
	results["test_stop_call_audio_releases_ducking"] = test_stop_call_audio_releases_ducking()
	results["test_phase4_corruption_toggle"] = test_phase4_corruption_toggle()
	results["test_spatial_mode_default"] = test_spatial_mode_default()
	results["test_spatial_mode_positional"] = test_spatial_mode_positional()
	results["test_recording_specs"] = test_recording_specs()
	results["test_processing_chain_stages"] = test_processing_chain_stages()
	results["test_band_eq_all_profiles_present"] = test_band_eq_all_profiles_present()
	results["test_distortion_drive_per_band"] = test_distortion_drive_per_band()
	results["test_signal_quality_bitcrush_range"] = test_signal_quality_bitcrush_range()
	results["test_signal_quality_radio_noise_range"] = test_signal_quality_radio_noise_range()
	results["test_signal_quality_volume_range"] = test_signal_quality_volume_range()
	results["test_reset_clears_state"] = test_reset_clears_state()
	results["test_segment_metadata"] = test_segment_metadata()
	results["test_band_set_emits_signal"] = test_band_set_emits_signal()

	# Cleanup
	if _pipeline:
		_pipeline.reset()

	return results


# ─── Helper ─────────────────────────────────────────────────────────


func _approx_eq(a: float, b: float, eps: float = EPS) -> bool:
	return abs(a - b) <= eps


func _make_pipeline():
	# For tests that need a fresh instance without the autoload
	var script = load("res://src/audio/call_audio_pipeline.gd")
	if script == null:
		return null
	return script.new()


# ─── Existence and Default State ────────────────────────────────────


func test_pipeline_exists() -> bool:
	if _pipeline == null:
		push_error("CallAudioPipeline autoload not found")
		return false
	return true


func test_default_state() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# Default state: not active, signal quality 100, band LIVING, no corruption
	if p.is_active:
		return false
	if not _approx_eq(p.signal_quality, 100.0):
		return false
	if p.current_band != 0:  # Band.LIVING
		return false
	if p.phase4_corruption:
		return false
	if not _approx_eq(p.dread_level, 0.0):
		return false
	if p.spatial_mode != 0:  # SpatialMode.MONO_CENTER
		return false
	return true


# ─── Band EQ Profile Tests ─────────────────────────────────────────


func test_band_eq_living_profile() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_band_eq(0)  # Band.LIVING
	if p.band_eq_profile.get("label", "") != "LIVING":
		return false
	if p.band_eq_profile.get("filter_type", "") != "full":
		return false
	# LIVING has no bandpass center (full range)
	if float(p.band_eq_profile.get("bandpass_center_hz", -1.0)) != 0.0:
		return false
	return true


func test_band_eq_lost_profile() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_band_eq(2)  # Band.LOST
	if p.band_eq_profile.get("label", "") != "LOST":
		return false
	if p.band_eq_profile.get("filter_type", "") != "bandpass":
		return false
	# Telephone band: 300-3400 Hz, center ~1850 Hz
	var center = float(p.band_eq_profile.get("bandpass_center_hz", 0.0))
	if not _approx_eq(center, 1850.0, 1.0):
		return false
	# LOST has slight distortion for telephone character
	if float(p.band_eq_profile.get("distortion_drive", 0.0)) <= 0.0:
		return false
	return true


func test_band_eq_classified_profile() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_band_eq(3)  # Band.CLASSIFIED
	if p.band_eq_profile.get("label", "") != "CLASSIFIED":
		return false
	if p.band_eq_profile.get("filter_type", "") != "bandpass":
		return false
	# Military radio: narrower bandpass with higher resonance
	var resonance = float(p.band_eq_profile.get("bandpass_resonance", 0.0))
	if resonance <= 0.6:
		return false
	# Military radio crackle: significant distortion
	var drive = float(p.band_eq_profile.get("distortion_drive", 0.0))
	if drive <= 0.15:
		return false
	return true


func test_band_eq_redacted_profile() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_band_eq(4)  # Band.REDACTED
	if p.band_eq_profile.get("label", "") != "████████":
		return false
	if p.band_eq_profile.get("filter_type", "") != "lowpass":
		return false
	# Sub-bass boost: low shelf gain > 0
	var low_gain = float(p.band_eq_profile.get("low_shelf_gain_db", 0.0))
	if low_gain <= 0.0:
		return false
	# Cut highs
	var high_gain = float(p.band_eq_profile.get("high_shelf_gain_db", 0.0))
	if high_gain >= 0.0:
		return false
	return true


func test_band_eq_all_profiles_present() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	for band_id in range(5):  # 0-4
		if not p.BAND_EQ_PROFILES.has(band_id):
			return false
	return true


func test_distortion_drive_per_band() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# LIVING should have no distortion
	p._apply_band_eq(0)
	if not _approx_eq(p.distortion_drive, 0.0):
		return false
	# CLASSIFIED should have the highest distortion
	p._apply_band_eq(3)
	if p.distortion_drive <= 0.2:
		return false
	return true


# ─── Signal Quality Tests ──────────────────────────────────────────


func test_signal_quality_100_clean() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_signal_quality(100.0)
	# Clean: full bit depth, full sample rate, no noise, no warble
	if p.bitcrush_depth != p.BITCRUSH_DEPTH_MAX:
		return false
	if not _approx_eq(p.bitcrush_rate, p.BITCRUSH_RATE_MAX):
		return false
	if p.radio_noise_db > p.RADIO_NOISE_MIN_DB + 1.0:
		return false
	if not _approx_eq(p.warble_hz, 0.0):
		return false
	if not _approx_eq(p.volume_db, p.VOLUME_BASE_DB):
		return false
	return true


func test_signal_quality_0_extreme() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_signal_quality(0.0)
	# Extreme: min bit depth, min sample rate, loud noise, max warble
	if p.bitcrush_depth != p.BITCRUSH_DEPTH_MIN:
		return false
	if not _approx_eq(p.bitcrush_rate, p.BITCRUSH_RATE_MIN):
		return false
	if p.radio_noise_db < p.RADIO_NOISE_MAX_DB - 1.0:
		return false
	if not _approx_eq(p.warble_hz, p.WARBLE_MAX_HZ):
		return false
	if not _approx_eq(p.volume_db, p.VOLUME_MIN_DB):
		return false
	return true


func test_signal_quality_50_midpoint() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_signal_quality(50.0)
	# Midpoint: bit depth between min and max
	var expected_depth = int(lerpf(float(p.BITCRUSH_DEPTH_MIN), float(p.BITCRUSH_DEPTH_MAX), 0.5))
	if p.bitcrush_depth != expected_depth:
		return false
	# Noise should be between extremes
	if p.radio_noise_db <= p.RADIO_NOISE_MIN_DB + 1.0:
		return false
	if p.radio_noise_db >= p.RADIO_NOISE_MAX_DB - 1.0:
		return false
	return true


func test_signal_quality_clamped() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p.set_signal_quality(150.0)
	if not _approx_eq(p.signal_quality, 100.0):
		return false
	p.set_signal_quality(-10.0)
	if not _approx_eq(p.signal_quality, 0.0):
		return false
	return true


func test_signal_quality_bitcrush_range() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# At 100: 16-bit, at 0: 4-bit
	p._apply_signal_quality(100.0)
	if p.bitcrush_depth != 16:
		return false
	p._apply_signal_quality(0.0)
	if p.bitcrush_depth != 4:
		return false
	# Monotonically increasing
	p._apply_signal_quality(75.0)
	var q75 = p.bitcrush_depth
	p._apply_signal_quality(25.0)
	var q25 = p.bitcrush_depth
	return q75 > q25


func test_signal_quality_radio_noise_range() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_signal_quality(100.0)
	var clean_noise = p.radio_noise_db
	p._apply_signal_quality(0.0)
	var extreme_noise = p.radio_noise_db
	# Clean noise should be quieter (more negative) than extreme noise
	return clean_noise < extreme_noise


func test_signal_quality_volume_range() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_signal_quality(100.0)
	if not _approx_eq(p.volume_db, -3.0):
		return false
	p._apply_signal_quality(0.0)
	if not _approx_eq(p.volume_db, -12.0):
		return false
	return true


# ─── Dread Modifier Tests ──────────────────────────────────────────


func test_dread_below_threshold_no_modification() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_dread_modifier(50.0)  # Below threshold of 60
	if not _approx_eq(p.pitch_scale, 1.0):
		return false
	if not _approx_eq(p.reverb_wet, 0.25):
		return false
	if p.gate_active:
		return false
	return true


func test_dread_above_threshold_pitch_shift() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_dread_modifier(70.0)  # Above threshold of 60
	# Pitch shift -2 semitones: 2^(-2/12) ≈ 0.8909
	if not _approx_eq(p.pitch_scale, 0.8909, 0.01):
		return false
	return true


func test_dread_above_threshold_reverb_tail() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_dread_modifier(75.0)  # Above threshold
	# Reverse reverb tail: increased wet level and room size
	if p.reverb_wet <= 0.25:
		return false
	if p.reverb_room_size <= 0.3:
		return false
	return true


func test_dread_above_threshold_random_gate() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p._apply_dread_modifier(80.0)  # Above threshold
	# Random gate should be active
	if not p.gate_active:
		return false
	return true


# ─── Call Lifecycle Tests ──────────────────────────────────────────


func test_start_call_audio_metadata() -> bool:
	# Use the autoload instance
	if _pipeline == null:
		return false
	_pipeline.reset()
	var metadata = {
		"callerId": "1-800-555-0199",
		"callerName": "TEST CALLER",
		"band": 2,  # LOST
		"type": "JUST_LISTEN",
		"signal": 45,
		"lines": ["Line one.", "Line two.", "Line three."],
	}
	_pipeline.start_call_audio(metadata)
	if not _pipeline.is_active:
		return false
	if _pipeline.current_band != 2:
		return false
	if not _approx_eq(_pipeline.signal_quality, 45.0):
		return false
	var meta = _pipeline.get_call_metadata()
	if meta.get("callerId", "") != "1-800-555-0199":
		return false
	_pipeline.stop_call_audio()
	return true


func test_start_call_audio_segments() -> bool:
	if _pipeline == null:
		return false
	_pipeline.reset()
	var metadata = {
		"callerId": "TEST",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 80,
		"lines": ["First line.", "Second line.", "Third line."],
	}
	_pipeline.start_call_audio(metadata)
	var segments = _pipeline.get_segments()
	if segments.size() != 3:
		return false
	# Each segment should have the correct line text and metadata
	if segments[0].get("line_text", "") != "First line.":
		return false
	if segments[2].get("line_text", "") != "Third line.":
		return false
	# Check segment metadata fields
	if segments[0].get("caller_id", "") != "TEST":
		return false
	if segments[0].get("band", -1) != 0:
		return false
	if segments[0].get("call_type", "") != "JUST_LISTEN":
		return false
	_pipeline.stop_call_audio()
	return true


func test_start_call_audio_ducks_radio_ambient() -> bool:
	if _pipeline == null:
		return false
	_pipeline.reset()
	var metadata = {
		"callerId": "TEST",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 80,
		"lines": ["Test line."],
	}
	_pipeline.start_call_audio(metadata)
	# AudioBusManager.duck_for_call(true) should have been called
	# We can verify by checking AudioBusManager._call_active
	var abm = Engine.get_main_loop().root.get_node_or_null("/root/AudioBusManager")
	if abm == null:
		# AudioBusManager not available, skip this check
		_pipeline.stop_call_audio()
		return true
	if not abm._call_active:
		_pipeline.stop_call_audio()
		return false
	_pipeline.stop_call_audio()
	return true


func test_stop_call_audio_releases_ducking() -> bool:
	if _pipeline == null:
		return false
	_pipeline.reset()
	var metadata = {
		"callerId": "TEST",
		"band": 0,
		"type": "JUST_LISTEN",
		"signal": 80,
		"lines": ["Test line."],
	}
	_pipeline.start_call_audio(metadata)
	_pipeline.stop_call_audio()
	# After stop, call should be inactive
	if _pipeline.is_active:
		return false
	# AudioBusManager ducking should be released
	var abm = Engine.get_main_loop().root.get_node_or_null("/root/AudioBusManager")
	if abm == null:
		return true
	if abm._call_active:
		return false
	return true


# ─── Phase 4 Corruption Tests ──────────────────────────────────────


func test_phase4_corruption_toggle() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	if p.phase4_corruption:
		return false
	p.set_phase4_corruption(true)
	if not p.phase4_corruption:
		return false
	p.set_phase4_corruption(false)
	if p.phase4_corruption:
		return false
	return true


# ─── Spatial Mode Tests ───────────────────────────────────────────


func test_spatial_mode_default() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	return p.spatial_mode == p.SpatialMode.MONO_CENTER


func test_spatial_mode_positional() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	p.set_spatial_mode(p.SpatialMode.POSITIONAL)
	return p.spatial_mode == p.SpatialMode.POSITIONAL


# ─── Recording Specs Tests ────────────────────────────────────────


func test_recording_specs() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# Recording specs: mono, 44.1kHz, 16-bit minimum
	if p.RECORDING_SAMPLE_RATE != 44100:
		return false
	if p.RECORDING_BIT_DEPTH != 16:
		return false
	if p.RECORDING_CHANNELS != 1:
		return false
	return true


# ─── Processing Chain Tests ───────────────────────────────────────


func test_processing_chain_stages() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# Verify all 7 stages exist in order
	if p.Stage.BASE != 0:
		return false
	if p.Stage.BAND_EQ != 1:
		return false
	if p.Stage.COMPRESSION != 2:
		return false
	if p.Stage.RADIO_SIM != 3:
		return false
	if p.Stage.BITCRUSH != 4:
		return false
	if p.Stage.SPATIAL != 5:
		return false
	if p.Stage.OUTPUT != 6:
		return false
	return true


# ─── Segment Metadata Tests ──────────────────────────────────────


func test_segment_metadata() -> bool:
	if _pipeline == null:
		return false
	_pipeline.reset()
	var metadata = {
		"callerId": "PRIVATE",
		"band": 3,  # CLASSIFIED
		"type": "STAY_CALM",
		"signal": 30,
		"lines": ["Stay calm.", "Don't move.", "They're listening."],
	}
	_pipeline.start_call_audio(metadata)
	var segments = _pipeline.get_segments()
	if segments.size() != 3:
		return false
	# Verify each segment has all required metadata fields
	for seg in segments:
		if not seg.has("index"):
			return false
		if not seg.has("line_text"):
			return false
		if not seg.has("caller_id"):
			return false
		if not seg.has("band"):
			return false
		if not seg.has("call_type"):
			return false
		if not seg.has("shift"):
			return false
	_pipeline.stop_call_audio()
	return true


# ─── Reset Test ──────────────────────────────────────────────────


func test_reset_clears_state() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	# Set some state
	p.is_active = true
	p.current_band = 3
	p.signal_quality = 20.0
	p.dread_level = 80.0
	p.phase4_corruption = true
	p.spatial_mode = p.SpatialMode.POSITIONAL
	p.volume_db = -8.0
	p.pitch_scale = 0.89

	p.reset()

	# Verify all state cleared
	if p.is_active:
		return false
	if p.current_band != 0:
		return false
	if not _approx_eq(p.signal_quality, 100.0):
		return false
	if not _approx_eq(p.dread_level, 0.0):
		return false
	if p.phase4_corruption:
		return false
	if p.spatial_mode != 0:
		return false
	if not _approx_eq(p.volume_db, -3.0):
		return false
	if not _approx_eq(p.pitch_scale, 1.0):
		return false
	return true


# ─── Signal Emission Test ─────────────────────────────────────────


func test_band_set_emits_signal() -> bool:
	var p = _make_pipeline()
	if p == null:
		return false
	var emitted: Dictionary = {"band": -1}
	p.band_eq_changed.connect(func(b: int) -> void: emitted["band"] = b)
	p.set_band(2)  # LOST
	return emitted["band"] == 2
