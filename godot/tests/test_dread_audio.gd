## test_dread_audio.gd — Tests for DreadAudioLayer (DEA-103)
## Verifies component volumes, thresholds, BPM mapping, break event,
## location modifiers, hiding boost, and DreadComposure integration.
extends RefCounted

# Tolerance for float comparisons (dB values)
const EPS := 0.01

var test_name: String = "DreadAudioLayer"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["cello_drone_silent_below_threshold"] = _test_cello_silent_below_threshold()
	results["cello_drone_active_above_threshold"] = _test_cello_active_above_threshold()
	results["cello_drone_volume_formula"] = _test_cello_volume_formula()
	results["heartbeat_silent_below_threshold"] = _test_heartbeat_silent_below_threshold()
	results["heartbeat_active_above_threshold"] = _test_heartbeat_active_above_threshold()
	results["heartbeat_volume_formula"] = _test_heartbeat_volume_formula()
	results["heartbeat_bpm_mapping"] = _test_heartbeat_bpm_mapping()
	results["whisper_silent_below_threshold"] = _test_whisper_silent_below_threshold()
	results["whisper_active_above_threshold"] = _test_whisper_active_above_threshold()
	results["whisper_volume_formula"] = _test_whisper_volume_formula()
	results["rumble_silent_at_zero"] = _test_rumble_silent_at_zero()
	results["rumble_active_above_zero"] = _test_rumble_active_above_zero()
	results["rumble_volume_formula"] = _test_rumble_volume_formula()
	results["secondary_drone_activation"] = _test_secondary_drone_activation()
	results["tertiary_drone_activation"] = _test_tertiary_drone_activation()
	results["lfo_rate_at_dread_50"] = _test_lfo_rate_at_50()
	results["lfo_rate_at_dread_75"] = _test_lfo_rate_at_75()
	results["lfo_rate_below_threshold"] = _test_lfo_rate_below_threshold()
	results["lfo_depth"] = _test_lfo_depth()
	results["call_distortion_below_threshold"] = _test_call_distortion_below_threshold()
	results["call_distortion_formula"] = _test_call_distortion_formula()
	results["radio_pulse_rate"] = _test_radio_pulse_rate()
	results["radio_pulse_below_threshold"] = _test_radio_pulse_below_threshold()
	results["bus_volume_linear_interp"] = _test_bus_volume_linear_interp()
	results["break_event_trigger"] = _test_break_event_trigger()
	results["break_peak_phase"] = _test_break_peak_phase()
	results["break_tone_phase"] = _test_break_tone_phase()
	results["break_reset_to_75"] = _test_break_reset_to_75()
	results["location_bunker_boost"] = _test_location_bunker_boost()
	results["location_liminal_boost"] = _test_location_liminal_boost()
	results["location_chamber_heartbeat_only"] = _test_location_chamber_heartbeat_only()
	results["hiding_boost_applied"] = _test_hiding_boost_applied()
	results["dread_composure_signal_integration"] = _test_dread_composure_signal_integration()
	results["reset_clears_state"] = _test_reset_clears_state()

	return results


# ─── Helper ─────────────────────────────────────────────────────────


func _make_dread_audio_layer():
	# Load and instantiate DreadAudioLayer without adding to scene tree
	# (keeps AudioServer calls inactive for headless testing)
	var script = load("res://src/audio/dread_audio_layer.gd")
	if script == null:
		return null
	return script.new()


func _approx_eq(a: float, b: float, eps: float = EPS) -> bool:
	return abs(a - b) <= eps


# ─── Cello Drone Tests ──────────────────────────────────────────────


func _test_cello_silent_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(15.0)  # Below threshold of 20
	return _approx_eq(dal.cello_volume_db, -80.0)


func _test_cello_active_above_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(25.0)  # Above threshold of 20
	return dal.cello_volume_db > -80.0


func _test_cello_volume_formula() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# volume = dread/100 * -3 dB
	dal.update_dread(50.0)
	var expected = (50.0 / 100.0) * -3.0
	return _approx_eq(dal.cello_volume_db, expected)


# ─── Heartbeat Tests ────────────────────────────────────────────────


func _test_heartbeat_silent_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(35.0)  # Below threshold of 40
	return _approx_eq(dal.heartbeat_volume_db, -80.0)


func _test_heartbeat_active_above_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(45.0)  # Above threshold of 40
	return dal.heartbeat_volume_db > -80.0


func _test_heartbeat_volume_formula() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# volume = dread/100 * -6 dB
	dal.update_dread(80.0)
	var expected = (80.0 / 100.0) * -6.0
	return _approx_eq(dal.heartbeat_volume_db, expected)


func _test_heartbeat_bpm_mapping() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# At dread 0: 60 BPM
	dal.update_dread(0.0)
	if not _approx_eq(dal.heartbeat_bpm, 60.0, 0.1):
		return false
	# At dread 100: 120 BPM
	dal.update_dread(100.0)
	if not _approx_eq(dal.heartbeat_bpm, 120.0, 0.1):
		return false
	# At dread 50: 90 BPM (midpoint)
	dal.update_dread(50.0)
	if not _approx_eq(dal.heartbeat_bpm, 90.0, 0.1):
		return false
	return true


# ─── Whisper Tests ─────────────────────────────────────────────────


func _test_whisper_silent_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(55.0)  # Below threshold of 60
	return _approx_eq(dal.whisper_volume_db, -80.0)


func _test_whisper_active_above_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(65.0)  # Above threshold of 60
	return dal.whisper_volume_db > -80.0


func _test_whisper_volume_formula() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# volume = (dread-60)/40 * -12 dB
	dal.update_dread(80.0)
	var expected = ((80.0 - 60.0) / 40.0) * -12.0
	return _approx_eq(dal.whisper_volume_db, expected)


# ─── Sub-bass Rumble Tests ─────────────────────────────────────────


func _test_rumble_silent_at_zero() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(0.0)
	return _approx_eq(dal.rumble_volume_db, -80.0)


func _test_rumble_active_above_zero() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(10.0)
	return dal.rumble_volume_db > -80.0


func _test_rumble_volume_formula() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# volume = dread/100 * -12 dB
	dal.update_dread(50.0)
	var expected = (50.0 / 100.0) * -12.0
	return _approx_eq(dal.rumble_volume_db, expected)


# ─── Secondary/Tertiary Drone Tests ────────────────────────────────


func _test_secondary_drone_activation() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# Below threshold 50: inactive
	dal.update_dread(45.0)
	if dal.secondary_drone_active:
		return false
	if not _approx_eq(dal.secondary_drone_volume_db, -80.0):
		return false
	# At threshold 50: active
	dal.update_dread(50.0)
	if not dal.secondary_drone_active:
		return false
	return dal.secondary_drone_volume_db > -80.0


func _test_tertiary_drone_activation() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# Below threshold 75: inactive
	dal.update_dread(70.0)
	if dal.tertiary_drone_active:
		return false
	if not _approx_eq(dal.tertiary_drone_volume_db, -80.0):
		return false
	# At threshold 75: active
	dal.update_dread(75.0)
	if not dal.tertiary_drone_active:
		return false
	return dal.tertiary_drone_volume_db > -80.0


# ─── LFO Tests ──────────────────────────────────────────────────────


func _test_lfo_rate_at_50() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(60.0)  # In 50-75 range
	return _approx_eq(dal.lfo_rate, 0.5)


func _test_lfo_rate_at_75() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(85.0)  # In 75-100 range
	return _approx_eq(dal.lfo_rate, 1.5)


func _test_lfo_rate_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(40.0)  # Below LFO threshold of 50
	return _approx_eq(dal.lfo_rate, 0.0)


func _test_lfo_depth() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(60.0)
	return _approx_eq(dal.lfo_depth, 2.0)


# ─── Call Distortion Tests ─────────────────────────────────────────


func _test_call_distortion_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(70.0)  # Below threshold of 75
	return _approx_eq(dal.call_distortion_amount, 0.0)


func _test_call_distortion_formula() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# amount = (dread-75)/25 * 0.3
	dal.update_dread(100.0)
	var expected = (100.0 - 75.0) / 25.0 * 0.3
	return _approx_eq(dal.call_distortion_amount, expected)


# ─── Radio Pulse Tests ─────────────────────────────────────────────


func _test_radio_pulse_rate() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# At dread 60 (50-75 range): 1 Hz
	dal.update_dread(60.0)
	if not _approx_eq(dal.radio_pulse_rate, 1.0):
		return false
	# At dread 85 (75-100 range): 2 Hz
	dal.update_dread(85.0)
	return _approx_eq(dal.radio_pulse_rate, 2.0)


func _test_radio_pulse_below_threshold() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.update_dread(40.0)  # Below threshold of 50
	return _approx_eq(dal.radio_pulse_rate, 0.0)


# ─── Bus Volume Tests ──────────────────────────────────────────────


func _test_bus_volume_linear_interp() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# At dread 0: -80 dB
	dal.update_dread(0.0)
	if not _approx_eq(dal.bus_volume_db, -80.0):
		return false
	# At dread 100: -3 dB
	dal.update_dread(100.0)
	if not _approx_eq(dal.bus_volume_db, -3.0):
		return false
	# At dread 50: midpoint = (-80 + -3) / 2 = -41.5 dB
	dal.update_dread(50.0)
	var expected = (-80.0 + -3.0) / 2.0
	return _approx_eq(dal.bus_volume_db, expected)


# ─── Break Event Tests ─────────────────────────────────────────────


func _test_break_event_trigger() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.trigger_break()
	return dal.is_in_break() and dal.get_break_phase() == 1


func _test_break_peak_phase() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.trigger_break()
	# During peak phase: drones at 0 dB
	return _approx_eq(dal.cello_volume_db, 0.0) and _approx_eq(dal.rumble_volume_db, 0.0)


func _test_break_tone_phase() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.trigger_break()
	# Process through peak phase (2 seconds)
	dal._process_break(2.1)
	# Should now be in tone phase (phase 2)
	if dal.get_break_phase() != 2:
		return false
	# Break tone at 0 dB, drones silent
	if not _approx_eq(dal.break_tone_volume_db, 0.0):
		return false
	if not _approx_eq(dal.cello_volume_db, -80.0):
		return false
	return true


func _test_break_reset_to_75() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.trigger_break()
	# Process through peak phase (2 sec) + tone phase (3 sec)
	dal._process_break(2.1)  # End of peak → tone phase
	dal._process_break(3.1)  # End of tone → reset
	# Break should be complete
	if dal.is_in_break():
		return false
	if dal.get_break_phase() != 0:
		return false
	# Dread should be reset to 75
	return _approx_eq(dal._dread, 75.0, 0.1)


# ─── Location Modifier Tests ───────────────────────────────────────


func _test_location_bunker_boost() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.set_location(1)  # Location.BUNKER
	return _approx_eq(dal.location_modifier_db, 3.0)


func _test_location_liminal_boost() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.set_location(2)  # Location.LIMINAL
	return _approx_eq(dal.location_modifier_db, 6.0)


func _test_location_chamber_heartbeat_only() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.set_location(3)  # Location.CHAMBER
	dal.update_dread(80.0)
	# All components except heartbeat should be silent; heartbeat active
	return (
		_approx_eq(dal.cello_volume_db, -80.0)
		and _approx_eq(dal.whisper_volume_db, -80.0)
		and _approx_eq(dal.rumble_volume_db, -80.0)
		and _approx_eq(dal.secondary_drone_volume_db, -80.0)
		and _approx_eq(dal.tertiary_drone_volume_db, -80.0)
		and dal.heartbeat_volume_db > -80.0
	)


# ─── Hiding Boost Tests ────────────────────────────────────────────


func _test_hiding_boost_applied() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	dal.set_hiding(true)
	# The hiding boost is applied in _apply_audio_params, which only runs
	# when audio nodes are initialized. We test the state flag.
	return dal._hiding == true


# ─── DreadComposure Integration Test ───────────────────────────────


func _test_dread_composure_signal_integration() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false

	# Create a mock DreadComposure-like object
	# We use a simple RefCounted with the required interface
	var dc_script = load("res://src/core/dread_composure.gd")
	if dc_script == null:
		return false
	var dc = dc_script.new()

	# Connect
	dal.connect_to_dread_composure(dc)

	# Set dread via DreadComposure — should propagate to DreadAudioLayer
	dc.set_dread(50.0)

	# Verify DreadAudioLayer received the update
	return _approx_eq(dal._dread, 50.0, 0.1) and dal.cello_volume_db > -80.0


# ─── Reset Test ────────────────────────────────────────────────────


func _test_reset_clears_state() -> bool:
	var dal = _make_dread_audio_layer()
	if dal == null:
		return false
	# Set some state
	dal.update_dread(80.0)
	dal.set_location(1)  # BUNKER
	dal.set_hiding(true)
	if dal.cello_volume_db <= -80.0:
		return false

	# Reset
	dal.reset()

	# Verify all state cleared
	return (
		_approx_eq(dal._dread, 0.0)
		and _approx_eq(dal.cello_volume_db, -80.0)
		and _approx_eq(dal.heartbeat_volume_db, -80.0)
		and _approx_eq(dal.whisper_volume_db, -80.0)
		and _approx_eq(dal.rumble_volume_db, -80.0)
		and _approx_eq(dal.bus_volume_db, -80.0)
		and _approx_eq(dal.location_modifier_db, 0.0)
		and not dal._hiding
		and not dal.is_in_break()
	)
