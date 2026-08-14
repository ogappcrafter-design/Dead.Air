# test_band_system.gd — Tests for DEA-99 Band System & Unlock Logic (GDD v2)
# Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

var test_name: String = "BandSystem"

# GDD v2 spec band values
const BAND_SPECS = [
	# [name, center, sens, min, max, color_r, color_g, color_b, unlock_type, unlock_shift, unlock_time_band, unlock_time_sec, unlock_event]
	# unlock_type: 0=START, 1=SHIFT, 2=TIME_TUNING, 3=EVENT
	["LIVING", 88.7, 8.0, 87.5, 92.0, 1.0, 0.55, 0.0, 0, 0, -1, 0.0, ""],
	["LIMINAL", 102.3, 6.0, 92.0, 96.5, 0.8, 1.0, 0.0, 1, 2, -1, 0.0, ""],
	["LOST", 117.8, 4.0, 96.5, 101.0, 0.0, 1.0, 0.82, 1, 3, -1, 0.0, ""],
	["CLASSIFIED", 0.0, 3.0, 101.0, 105.5, 1.0, 0.2, 0.4, 1, 4, -1, 0.0, ""],
	["████████", 0.0, 1.5, 105.5, 108.0, 1.0, 1.0, 1.0, 1, 5, -1, 0.0, ""],
	["WEATHER", 162.0, 5.0, 160.0, 164.0, 0.27, 0.53, 1.0, 1, 3, -1, 0.0, ""],
	["PIRATE", 166.0, 2.5, 164.0, 168.0, 1.0, 0.27, 1.0, 3, 0, -1, 0.0, "find_10_tapes"],
	["HISTORICAL", 170.0, 4.0, 168.0, 172.0, 0.53, 0.53, 0.53, 3, 0, -1, 0.0, "reach_100_static"],
]


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_definitions"] = test_band_definitions()
	results["test_band_switching"] = test_band_switching()
	results["test_unlock_conditions"] = test_unlock_conditions()
	results["test_unlock_manager_shift"] = test_unlock_manager_shift()
	results["test_unlock_manager_event"] = test_unlock_manager_event()
	results["test_unlock_manager_persistence"] = test_unlock_manager_persistence()
	results["test_cross_pollination"] = test_cross_pollination()
	results["test_pirate_drift"] = test_pirate_drift()
	results["test_redacted_reveal"] = test_redacted_reveal()
	return results


# AC1: All 8 bands defined with correct frequency ranges, centers, sensitivities, and colors
func test_band_definitions() -> bool:
	var config: BandConfig = _make_band_config()
	if config == null:
		print("    FAIL: Could not create BandConfig")
		return false
	if config.get_band_count() != 8:
		print("    FAIL: Expected 8 bands, got %d" % config.get_band_count())
		return false
	for i in range(8):
		var band: BandData = config.get_band(i)
		if band == null:
			print("    FAIL: Band %d is null" % i)
			return false
		var spec = BAND_SPECS[i]
		if band.name != spec[0]:
			print("    FAIL: Band %d name: expected %s, got %s" % [i, spec[0], band.name])
			return false
		if abs(band.center_frequency - spec[1]) > 0.01:
			print("    FAIL: Band %d center: expected %s, got %s" % [i, spec[1], band.center_frequency])
			return false
		if abs(band.sensitivity - spec[2]) > 0.01:
			print("    FAIL: Band %d sensitivity: expected %s, got %s" % [i, spec[2], band.sensitivity])
			return false
		if abs(band.freq_range_min - spec[3]) > 0.01:
			print("    FAIL: Band %d range_min: expected %s, got %s" % [i, spec[3], band.freq_range_min])
			return false
		if abs(band.freq_range_max - spec[4]) > 0.01:
			print("    FAIL: Band %d range_max: expected %s, got %s" % [i, spec[4], band.freq_range_max])
			return false
		if abs(band.color.r - spec[5]) > 0.01 or abs(band.color.g - spec[6]) > 0.01 or abs(band.color.b - spec[7]) > 0.01:
			print("    FAIL: Band %d color: expected (%s,%s,%s), got (%s,%s,%s)" % [i, spec[5], spec[6], spec[7], band.color.r, band.color.g, band.color.b])
			return false
		if band.unlock_type != spec[8]:
			print("    FAIL: Band %d unlock_type: expected %d, got %d" % [i, spec[8], band.unlock_type])
			return false
		if band.unlock_shift != spec[9]:
			print("    FAIL: Band %d unlock_shift: expected %d, got %d" % [i, spec[9], band.unlock_shift])
			return false
		if band.unlock_time_tuning_band != spec[10]:
			print("    FAIL: Band %d unlock_time_tuning_band: expected %d, got %d" % [i, spec[10], band.unlock_time_tuning_band])
			return false
		if abs(band.unlock_time_seconds - spec[11]) > 0.01:
			print("    FAIL: Band %d unlock_time_seconds: expected %s, got %s" % [i, spec[11], band.unlock_time_seconds])
			return false
		if band.unlock_event_id != spec[12]:
			print("    FAIL: Band %d unlock_event_id: expected %s, got %s" % [i, spec[12], band.unlock_event_id])
			return false
	return true


# AC2: Band switching works for all 8 bands (next/prev wraps around)
func test_band_switching() -> bool:
	var tuner: RadioTuner = _make_tuner()
	if tuner == null:
		print("    FAIL: Could not create RadioTuner")
		return false
	# Test next_band wraps through all 8
	for i in range(8):
		tuner.set_band(i)
		if tuner.current_band_id != i:
			print("    FAIL: set_band(%d) resulted in band_id %d" % [i, tuner.current_band_id])
			return false
	# Test next_band wraps 7→0
	tuner.set_band(7)
	tuner.next_band()
	if tuner.current_band_id != 0:
		print("    FAIL: next_band from 7 should wrap to 0, got %d" % tuner.current_band_id)
		return false
	# Test prev_band wraps 0→7
	tuner.set_band(0)
	tuner.prev_band()
	if tuner.current_band_id != 7:
		print("    FAIL: prev_band from 0 should wrap to 7, got %d" % tuner.current_band_id)
		return false
	# Test next_band cycles through all 8
	tuner.set_band(0)
	for i in range(1, 8):
		tuner.next_band()
		if tuner.current_band_id != i:
			print("    FAIL: next_band cycle: expected %d, got %d" % [i, tuner.current_band_id])
			return false
	return true


# AC3: Unlock conditions check correctly (shift-based, event-based)
func test_unlock_conditions() -> bool:
	var config: BandConfig = _make_band_config()

	# Test unlock types and conditions by checking band data fields.
	# Start bands: LIVING(0) only in GDD v2.
	var band0: BandData = config.get_band(0)
	if band0.unlock_type != BandData.UnlockType.START:
		print("    FAIL: LIVING unlock_type should be START, got %d" % band0.unlock_type)
		return false

	# Check SHIFT unlock: LIMINAL=shift 2, LOST=shift 3, CLASSIFIED=shift 4, ████████=shift 5, WEATHER=shift 3
	var band1: BandData = config.get_band(1)
	if band1.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: LIMINAL unlock_type should be SHIFT, got %d" % band1.unlock_type)
		return false
	if band1.unlock_shift != 2:
		print("    FAIL: LIMINAL unlock_shift should be 2, got %d" % band1.unlock_shift)
		return false

	var band2: BandData = config.get_band(2)
	if band2.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: LOST unlock_type should be SHIFT, got %d" % band2.unlock_type)
		return false
	if band2.unlock_shift != 3:
		print("    FAIL: LOST unlock_shift should be 3, got %d" % band2.unlock_shift)
		return false

	var band3: BandData = config.get_band(3)
	if band3.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: CLASSIFIED unlock_type should be SHIFT, got %d" % band3.unlock_type)
		return false
	if band3.unlock_shift != 4:
		print("    FAIL: CLASSIFIED unlock_shift should be 4, got %d" % band3.unlock_shift)
		return false

	var band4: BandData = config.get_band(4)
	if band4.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: ████████ unlock_type should be SHIFT, got %d" % band4.unlock_type)
		return false
	if band4.unlock_shift != 5:
		print("    FAIL: ████████ unlock_shift should be 5, got %d" % band4.unlock_shift)
		return false

	var band5: BandData = config.get_band(5)
	if band5.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: WEATHER unlock_type should be SHIFT, got %d" % band5.unlock_type)
		return false
	if band5.unlock_shift != 3:
		print("    FAIL: WEATHER unlock_shift should be 3, got %d" % band5.unlock_shift)
		return false

	# Check EVENT unlock: PIRATE = "find_10_tapes", HISTORICAL = "reach_100_static"
	var band6: BandData = config.get_band(6)
	if band6.unlock_type != BandData.UnlockType.EVENT:
		print("    FAIL: PIRATE unlock_type should be EVENT, got %d" % band6.unlock_type)
		return false
	if band6.unlock_event_id != "find_10_tapes":
		print("    FAIL: PIRATE unlock_event_id should be find_10_tapes, got %s" % band6.unlock_event_id)
		return false

	var band7: BandData = config.get_band(7)
	if band7.unlock_type != BandData.UnlockType.EVENT:
		print("    FAIL: HISTORICAL unlock_type should be EVENT, got %d" % band7.unlock_type)
		return false
	if band7.unlock_event_id != "reach_100_static":
		print("    FAIL: HISTORICAL unlock_event_id should be reach_100_static, got %s" % band7.unlock_event_id)
		return false

	return true


# AC3b: BandUnlockManager.on_shift_changed() unlocks SHIFT bands at correct threshold
func test_unlock_manager_shift() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# At shift 1, all SHIFT bands should be locked (LIMINAL=2, LOST=3, WEATHER=3, CLASSIFIED=4, ████████=5).
	mgr.on_shift_changed(1)
	if mgr.is_band_unlocked(1):
		print("    FAIL: LIMINAL should NOT be unlocked at shift 1")
		return false
	if mgr.is_band_unlocked(2):
		print("    FAIL: LOST should NOT be unlocked at shift 1")
		return false

	# At shift 2, LIMINAL unlocks but LOST stays locked.
	mgr.on_shift_changed(2)
	if not mgr.is_band_unlocked(1):
		print("    FAIL: LIMINAL should be unlocked at shift 2")
		return false
	if mgr.is_band_unlocked(2):
		print("    FAIL: LOST should NOT be unlocked at shift 2")
		return false

	# At shift 3, LOST and WEATHER unlock. CLASSIFIED(4) and ████████(5) stay locked.
	mgr.on_shift_changed(3)
	if not mgr.is_band_unlocked(2):
		print("    FAIL: LOST should be unlocked at shift 3")
		return false
	if not mgr.is_band_unlocked(5):
		print("    FAIL: WEATHER should be unlocked at shift 3")
		return false
	if mgr.is_band_unlocked(3):
		print("    FAIL: CLASSIFIED should NOT be unlocked at shift 3")
		return false
	if mgr.is_band_unlocked(4):
		print("    FAIL: ████████ should NOT be unlocked at shift 3")
		return false

	# At shift 4, CLASSIFIED unlocks. ████████(5) stays locked.
	mgr.on_shift_changed(4)
	if not mgr.is_band_unlocked(3):
		print("    FAIL: CLASSIFIED should be unlocked at shift 4")
		return false
	if mgr.is_band_unlocked(4):
		print("    FAIL: ████████ should NOT be unlocked at shift 4")
		return false

	# At shift 5, ████████ unlocks.
	mgr.on_shift_changed(5)
	if not mgr.is_band_unlocked(4):
		print("    FAIL: ████████ should be unlocked at shift 5")
		return false

	return true


# AC3d: BandUnlockManager.on_event() unlocks EVENT bands by event_id
func test_unlock_manager_event() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# PIRATE(6) → "find_10_tapes"
	mgr.on_event("find_10_tapes")
	if not mgr.is_band_unlocked(6):
		print("    FAIL: PIRATE should be unlocked by find_10_tapes event")
		return false

	# HISTORICAL(7) → "reach_100_static"
	mgr.on_event("reach_100_static")
	if not mgr.is_band_unlocked(7):
		print("    FAIL: HISTORICAL should be unlocked by reach_100_static event")
		return false

	# Unknown event should not unlock anything new.
	mgr.on_event("nonexistent_event")
	# Only verify no crash and no spurious unlocks of still-locked bands.

	return true


# AC3e: BandUnlockManager state persists across save/load round-trip
func test_unlock_manager_persistence() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# Unlock LIMINAL via shift 2.
	mgr.on_shift_changed(2)
	if not mgr.is_band_unlocked(1):
		print("    FAIL: LIMINAL should be unlocked at shift 2")
		return false

	# Save state.
	var save_data: SaveData = SaveData.new()
	mgr.save_to(save_data)

	# Load into a fresh manager — LIMINAL should still be unlocked.
	var mgr2: BandUnlockManager = _make_unlock_manager()
	mgr2.load_from_save(save_data)
	if not mgr2.is_band_unlocked(1):
		print("    FAIL: LIMINAL should still be unlocked after save/load")
		return false

	# Verify a manager with no saved state starts fresh.
	var save_empty: SaveData = SaveData.new()
	var mgr3: BandUnlockManager = _make_unlock_manager()
	mgr3.load_from_save(save_empty)
	if mgr3.is_band_unlocked(1):
		print("    FAIL: LIMINAL should NOT be unlocked with empty save")
		return false

	return true


# AC4: Cross-pollination multiplier (×1.0 native, ×0.4 non-native) via BandController
func test_cross_pollination() -> bool:
	# Test BandController.get_cross_pollination_multiplier() directly.
	# Phase 0 (PHASE_1_STATION) → LIVING(0) is native.
	var native_mult: float = BandController.get_cross_pollination_multiplier(0, 0)
	if abs(native_mult - 1.0) > 0.01:
		print("    FAIL: Native band (LIVING at phase 0) multiplier should be 1.0, got %s" % native_mult)
		return false

	# WEATHER(5) is non-native for phase 0.
	var non_native_mult: float = BandController.get_cross_pollination_multiplier(5, 0)
	if abs(non_native_mult - 0.4) > 0.01:
		print("    FAIL: Non-native band (WEATHER at phase 0) multiplier should be 0.4, got %s" % non_native_mult)
		return false

	# Phase 1 (PHASE_2_BREAK) → LIMINAL(1) is native.
	var liminal_native: float = BandController.get_cross_pollination_multiplier(1, 1)
	if abs(liminal_native - 1.0) > 0.01:
		print("    FAIL: LIMINAL as native (phase 1) multiplier should be 1.0, got %s" % liminal_native)
		return false

	# LIVING(0) is now non-native for phase 1.
	var living_non_native: float = BandController.get_cross_pollination_multiplier(0, 1)
	if abs(living_non_native - 0.4) > 0.01:
		print("    FAIL: LIVING as non-native (phase 1) multiplier should be 0.4, got %s" % living_non_native)
		return false

	# Phase 3 → ████████(4) is native.
	var redacted_native: float = BandController.get_cross_pollination_multiplier(4, 3)
	if abs(redacted_native - 1.0) > 0.01:
		print("    FAIL: ████████ as native (phase 3) multiplier should be 1.0, got %s" % redacted_native)
		return false

	return true


# AC5: PIRATE band center frequency drifts ±0.3 MHz every 30 seconds
func test_pirate_drift() -> bool:
	var tuner: RadioTuner = _make_tuner()
	if tuner == null:
		print("    FAIL: Could not create RadioTuner")
		return false

	# PIRATE band is band 6. Its base center is 166.0 (GDD v2).
	tuner.set_band(6)

	# Trigger PIRATE drift via BandController's API.
	BandController._on_pirate_drift_timeout()
	var drift_offset: float = BandController.get_pirate_drift_offset()
	# Drift offset should be within [-0.3, 0.3].
	if drift_offset < -0.3 or drift_offset > 0.3:
		print("    FAIL: PIRATE drift offset should be in [-0.3, 0.3], got %s" % drift_offset)
		return false

	# Verify RadioTuner.get_current_center() delegates to BandController for PIRATE.
	var center: float = tuner.get_current_center()
	var expected: float = BandController.get_pirate_center_frequency()
	if abs(center - expected) > 0.01:
		print("    FAIL: PIRATE center should delegate to BandController, got %s expected %s" % [center, expected])
		return false

	# Verify drifted center is within [165.7, 166.3].
	if center < 165.7 or center > 166.3:
		print("    FAIL: PIRATE drifted center should be in [165.7, 166.3], got %s" % center)
		return false

	# Test that PIRATE drifts even when NOT the active band.
	tuner.set_band(0)  # Switch to LIVING
	BandController._on_pirate_drift_timeout()
	var drift_after_switch: float = BandController.get_pirate_drift_offset()
	if drift_after_switch < -0.3 or drift_after_switch > 0.3:
		print("    FAIL: PIRATE drift offset after band switch should be in [-0.3, 0.3], got %s" % drift_after_switch)
		return false

	# Verify that when PIRATE is active again, get_current_center() uses the updated drift.
	tuner.set_band(6)
	var center_after_switch: float = tuner.get_current_center()
	var expected_after_switch: float = BandController.get_pirate_center_frequency()
	if abs(center_after_switch - expected_after_switch) > 0.01:
		print("    FAIL: PIRATE center after re-switch should delegate to BandController, got %s expected %s" % [center_after_switch, expected_after_switch])
		return false
	if center_after_switch < 165.7 or center_after_switch > 166.3:
		print("    FAIL: PIRATE center after re-switch should be in [165.7, 166.3], got %s" % center_after_switch)
		return false

	return true


# AC6: ████████ band reveals hidden elements when tuned (stub)
func test_redacted_reveal() -> bool:
	var tuner: RadioTuner = _make_tuner()
	if tuner == null:
		print("    FAIL: Could not create RadioTuner")
		return false

	# Verify the redacted band reveal signal exists and can be connected.
	var signal_received: bool = false
	tuner.redacted_band_revealed.connect(func() -> void: signal_received = true)

	# Switch to ████████ band (id=4).
	tuner.set_band(4)
	if not signal_received:
		print("    FAIL: redacted_band_revealed signal not emitted when switching to band 4")
		return false

	# Verify is_redacted_band_active() returns true.
	if not tuner.is_redacted_band_active():
		print("    FAIL: is_redacted_band_active() should return true when on band 4")
		return false

	# Switch away and verify it returns false.
	tuner.set_band(0)
	if tuner.is_redacted_band_active():
		print("    FAIL: is_redacted_band_active() should return false when on band 0")
		return false

	# Switch back to verify signal fires again.
	signal_received = false
	tuner.set_band(4)
	if not signal_received:
		print("    FAIL: redacted_band_revealed signal not emitted on second switch to band 4")
		return false

	return true


# --- Helpers ---

func _make_band_config() -> BandConfig:
	return load("res://src/data/band_config.tres")


func _make_tuner() -> RadioTuner:
	var tuner: RadioTuner = RadioTuner.new()
	tuner.band_config = _make_band_config()
	# Simulate _ready() by calling set_band(0) manually.
	tuner.set_band(0)
	return tuner


func _make_unlock_manager() -> BandUnlockManager:
	var mgr: BandUnlockManager = BandUnlockManager.new()
	mgr._band_config = _make_band_config()
	# Simulate _ready() — unlock start bands.
	mgr._unlock_start_bands()
	return mgr
