# test_band_system.gd — Tests for DEA-99 Band System & Unlock Logic
# Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

var test_name: String = "BandSystem"

# DEA-99 spec band values
const BAND_SPECS = [
	# [name, center, sens, min, max, color_r, color_g, color_b, unlock_type, unlock_shift, unlock_time_band, unlock_time_sec, unlock_event]
	["LIVING", 98.0, 8.0, 88.0, 108.0, 0.0, 1.0, 0.0, 0, 0, -1, 0.0, ""],
	["LIMINAL", 82.0, 6.0, 76.0, 88.0, 0.0, 1.0, 1.0, 1, 2, -1, 0.0, ""],
	["LOST", 114.0, 4.0, 108.0, 120.0, 0.5, 0.0, 0.5, 2, 0, 1, 30.0, ""],
	["CLASSIFIED", 130.0, 3.0, 120.0, 140.0, 1.0, 0.0, 0.0, 3, 0, -1, 0.0, "frequency_clue"],
	["████████", 150.0, 1.5, 140.0, 160.0, 0.0, 0.0, 0.0, 3, 0, -1, 0.0, "classified_event"],
	["WEATHER", 168.0, 5.0, 162.0, 174.0, 0.0, 0.0, 1.0, 0, 0, -1, 0.0, ""],
	["PIRATE", 98.0, 2.5, 87.5, 108.0, 1.0, 0.5, 0.0, 1, 3, -1, 0.0, ""],
	["HISTORICAL", 1000.0, 4.0, 530.0, 1700.0, 1.0, 0.75, 0.0, 3, 0, -1, 0.0, "antique_radio"],
]


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_definitions"] = test_band_definitions()
	results["test_band_switching"] = test_band_switching()
	results["test_unlock_conditions"] = test_unlock_conditions()
	results["test_unlock_manager_shift"] = test_unlock_manager_shift()
	results["test_unlock_manager_tuning"] = test_unlock_manager_tuning()
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


# AC3: Unlock conditions check correctly (shift-based, time-based, event-based)
func test_unlock_conditions() -> bool:
	var config: BandConfig = _make_band_config()

	# Test unlock types and conditions by checking band data fields.
	# Start bands: LIVING(0), WEATHER(5)
	var band0: BandData = config.get_band(0)
	var band5: BandData = config.get_band(5)
	if band0.unlock_type != BandData.UnlockType.START:
		print("    FAIL: LIVING unlock_type should be START, got %d" % band0.unlock_type)
		return false
	if band5.unlock_type != BandData.UnlockType.START:
		print("    FAIL: WEATHER unlock_type should be START, got %d" % band5.unlock_type)
		return false

	# Check SHIFT unlock: LIMINAL=shift 2, PIRATE=shift 3
	var band1: BandData = config.get_band(1)
	var band6: BandData = config.get_band(6)
	if band1.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: LIMINAL unlock_type should be SHIFT, got %d" % band1.unlock_type)
		return false
	if band1.unlock_shift != 2:
		print("    FAIL: LIMINAL unlock_shift should be 2, got %d" % band1.unlock_shift)
		return false
	if band6.unlock_type != BandData.UnlockType.SHIFT:
		print("    FAIL: PIRATE unlock_type should be SHIFT, got %d" % band6.unlock_type)
		return false
	if band6.unlock_shift != 3:
		print("    FAIL: PIRATE unlock_shift should be 3, got %d" % band6.unlock_shift)
		return false

	# Check TIME_TUNING unlock: LOST = tune LIMINAL(1) for 30s
	var band2: BandData = config.get_band(2)
	if band2.unlock_type != BandData.UnlockType.TIME_TUNING:
		print("    FAIL: LOST unlock_type should be TIME_TUNING, got %d" % band2.unlock_type)
		return false
	if band2.unlock_time_tuning_band != 1:
		print("    FAIL: LOST unlock_time_tuning_band should be 1, got %d" % band2.unlock_time_tuning_band)
		return false
	if abs(band2.unlock_time_seconds - 30.0) > 0.01:
		print("    FAIL: LOST unlock_time_seconds should be 30.0, got %s" % band2.unlock_time_seconds)
		return false

	# Check EVENT unlock: CLASSIFIED, ████████, HISTORICAL
	var band3: BandData = config.get_band(3)
	if band3.unlock_type != BandData.UnlockType.EVENT:
		print("    FAIL: CLASSIFIED unlock_type should be EVENT, got %d" % band3.unlock_type)
		return false
	if band3.unlock_event_id != "frequency_clue":
		print("    FAIL: CLASSIFIED unlock_event_id should be frequency_clue, got %s" % band3.unlock_event_id)
		return false

	var band4: BandData = config.get_band(4)
	if band4.unlock_type != BandData.UnlockType.EVENT:
		print("    FAIL: ████████ unlock_type should be EVENT, got %d" % band4.unlock_type)
		return false
	if band4.unlock_event_id != "classified_event":
		print("    FAIL: ████████ unlock_event_id should be classified_event, got %s" % band4.unlock_event_id)
		return false

	var band7: BandData = config.get_band(7)
	if band7.unlock_type != BandData.UnlockType.EVENT:
		print("    FAIL: HISTORICAL unlock_type should be EVENT, got %d" % band7.unlock_type)
		return false
	if band7.unlock_event_id != "antique_radio":
		print("    FAIL: HISTORICAL unlock_event_id should be antique_radio, got %s" % band7.unlock_event_id)
		return false

	return true


# AC3b: BandUnlockManager.on_shift_changed() unlocks SHIFT bands at correct threshold
func test_unlock_manager_shift() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# At shift 1, LIMINAL(1, shift 2) and PIRATE(6, shift 3) should be locked.
	mgr.on_shift_changed(1)
	if mgr.is_band_unlocked(1):
		print("    FAIL: LIMINAL should NOT be unlocked at shift 1")
		return false
	if mgr.is_band_unlocked(6):
		print("    FAIL: PIRATE should NOT be unlocked at shift 1")
		return false

	# At shift 2, LIMINAL unlocks but PIRATE stays locked.
	mgr.on_shift_changed(2)
	if not mgr.is_band_unlocked(1):
		print("    FAIL: LIMINAL should be unlocked at shift 2")
		return false
	if mgr.is_band_unlocked(6):
		print("    FAIL: PIRATE should NOT be unlocked at shift 2")
		return false

	# At shift 3, PIRATE unlocks.
	mgr.on_shift_changed(3)
	if not mgr.is_band_unlocked(6):
		print("    FAIL: PIRATE should be unlocked at shift 3")
		return false

	return true


# AC3c: BandUnlockManager.on_tuning_tick() accumulates time and unlocks at threshold
func test_unlock_manager_tuning() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# LOST(2) unlocks when LIMINAL(1) is tuned for 30s.
	# Tick 29 seconds — should NOT unlock.
	mgr.on_tuning_tick(1, 29.0)
	if mgr.is_band_unlocked(2):
		print("    FAIL: LOST should NOT be unlocked after 29s of tuning LIMINAL")
		return false

	# Tick 1 more second (total 30) — should unlock.
	mgr.on_tuning_tick(1, 1.0)
	if not mgr.is_band_unlocked(2):
		print("    FAIL: LOST should be unlocked after 30s of tuning LIMINAL")
		return false

	# Ticking a different band should not affect LOST progress.
	var mgr2: BandUnlockManager = _make_unlock_manager()
	mgr2.on_tuning_tick(0, 29.0)
	if mgr2.is_band_unlocked(2):
		print("    FAIL: LOST should NOT unlock from tuning LIVING(0)")
		return false

	return true


# AC3d: BandUnlockManager.on_event() unlocks EVENT bands by event_id
func test_unlock_manager_event() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# CLASSIFIED(3) → "frequency_clue"
	mgr.on_event("frequency_clue")
	if not mgr.is_band_unlocked(3):
		print("    FAIL: CLASSIFIED should be unlocked by frequency_clue event")
		return false

	# ████████(4) → "classified_event"
	mgr.on_event("classified_event")
	if not mgr.is_band_unlocked(4):
		print("    FAIL: ████████ should be unlocked by classified_event event")
		return false

	# HISTORICAL(7) → "antique_radio"
	mgr.on_event("antique_radio")
	if not mgr.is_band_unlocked(7):
		print("    FAIL: HISTORICAL should be unlocked by antique_radio event")
		return false

	# Unknown event should not unlock anything new.
	mgr.on_event("nonexistent_event")
	# Only verify no crash and no spurious unlocks of still-locked bands.
	# All EVENT bands already unlocked, so just ensure no exception.

	return true


# AC3e: BandUnlockManager tuning_time persists across save/load round-trip
func test_unlock_manager_persistence() -> bool:
	var mgr: BandUnlockManager = _make_unlock_manager()
	if mgr == null:
		print("    FAIL: Could not create BandUnlockManager")
		return false

	# Tune LIMINAL for 15 seconds (halfway to LOST unlock at 30s).
	mgr.on_tuning_tick(1, 15.0)
	if mgr.is_band_unlocked(2):
		print("    FAIL: LOST should NOT be unlocked at 15s")
		return false

	# Save state.
	var save_data: SaveData = SaveData.new()
	mgr.save_to(save_data)

	# Verify tuning_time was persisted.
	if not save_data.tuning_time.has(2):
		print("    FAIL: tuning_time should contain band 2 after tuning")
		return false
	if abs(float(save_data.tuning_time[2]) - 15.0) > 0.01:
		print("    FAIL: tuning_time[2] should be 15.0, got %s" % save_data.tuning_time[2])
		return false

	# Load into a fresh manager.
	var mgr2: BandUnlockManager = _make_unlock_manager()
	mgr2.load_from_save(save_data)

	# Tune 15 more seconds (total 30) — should now unlock LOST.
	mgr2.on_tuning_tick(1, 15.0)
	if not mgr2.is_band_unlocked(2):
		print("    FAIL: LOST should be unlocked after 15s+15s with save/load in between")
		return false

	# Verify a manager with no saved tuning_time starts fresh.
	var save_empty: SaveData = SaveData.new()
	var mgr3: BandUnlockManager = _make_unlock_manager()
	mgr3.load_from_save(save_empty)
	mgr3.on_tuning_tick(1, 29.0)
	if mgr3.is_band_unlocked(2):
		print("    FAIL: LOST should NOT unlock from 29s with empty tuning_time")
		return false

	return true


# AC4: Cross-pollination multiplier (×0.4 for non-native bands) applies to signal strength
func test_cross_pollination() -> bool:
	var tuner: RadioTuner = _make_tuner()
	if tuner == null:
		print("    FAIL: Could not create RadioTuner")
		return false

	# Phase 0 (PHASE_1_STATION) → LIVING(0) is native.
	tuner.set_phase(0)
	tuner.set_band(0)
	tuner.set_frequency(98.0)  # LIVING center
	var native_signal: float = tuner.get_signal()
	# At center, signal should be 100 (no offset).
	if abs(native_signal - 100.0) > 0.5:
		print("    FAIL: Native band at center should be ~100, got %s" % native_signal)
		return false

	# Switch to WEATHER(5) — non-native for phase 0.
	tuner.set_band(5)
	tuner.set_frequency(168.0)  # WEATHER center
	var non_native_signal: float = tuner.get_signal()
	# Non-native at center should be 100 * 0.4 = 40.
	if abs(non_native_signal - 40.0) > 0.5:
		print("    FAIL: Non-native band at center should be ~40 (100*0.4), got %s" % non_native_signal)
		return false

	# Phase 1 (PHASE_2_BREAK) → LIMINAL(1) is native.
	tuner.set_phase(1)
	tuner.set_band(1)
	tuner.set_frequency(82.0)  # LIMINAL center
	var liminal_signal: float = tuner.get_signal()
	if abs(liminal_signal - 100.0) > 0.5:
		print("    FAIL: LIMINAL as native at center should be ~100, got %s" % liminal_signal)
		return false

	# LIVING(0) is now non-native for phase 1.
	tuner.set_band(0)
	tuner.set_frequency(98.0)
	var living_non_native: float = tuner.get_signal()
	if abs(living_non_native - 40.0) > 0.5:
		print("    FAIL: LIVING as non-native at center should be ~40, got %s" % living_non_native)
		return false

	# Phase 3 → ████████(4) is native.
	tuner.set_phase(3)
	tuner.set_band(4)
	tuner.set_frequency(150.0)  # ████████ center
	var redacted_native: float = tuner.get_signal()
	if abs(redacted_native - 100.0) > 0.5:
		print("    FAIL: ████████ as native at center should be ~100, got %s" % redacted_native)
		return false

	return true


# AC5: PIRATE band center frequency drifts ±0.3 MHz every 30 seconds
func test_pirate_drift() -> bool:
	var tuner: RadioTuner = _make_tuner()
	if tuner == null:
		print("    FAIL: Could not create RadioTuner")
		return false

	# PIRATE band is band 6. Its base center is 98.0.
	tuner.set_band(6)
	var initial_center: float = tuner.get_current_center()
	# Initial center should be 98.0 (no drift yet).
	if abs(initial_center - 98.0) > 0.01:
		print("    FAIL: PIRATE initial center should be 98.0, got %s" % initial_center)
		return false

	# Simulate 30 seconds of _update_pirate_drift to trigger a drift.
	# We call it with delta=30.0 to trigger the drift in one step.
	tuner._update_pirate_drift(30.0)
	var drifted_center: float = tuner.get_current_center()
	# After drift, center should be 98.0 ± some offset in [-0.3, 0.3].
	# The offset could be 0 by chance (randf_range returns 0), so we just verify
	# the center is within [97.7, 98.3].
	if drifted_center < 97.7 or drifted_center > 98.3:
		print("    FAIL: PIRATE drifted center should be in [97.7, 98.3], got %s" % drifted_center)
		return false

	# Test that PIRATE drifts even when NOT the active band.
	tuner.set_band(0)  # Switch to LIVING
	# PIRATE drift should still update.
	tuner._pirate_drift_timer = 0.0  # Reset timer
	tuner._update_pirate_drift(30.0)
	# The pirate_drift_offset should have been updated.
	# We can't check the exact value (random), but we can verify the timer was reset.
	if tuner._pirate_drift_timer != 0.0:
		print("    FAIL: PIRATE drift timer should be reset after 30s, got %s" % tuner._pirate_drift_timer)
		return false

	# Verify that when PIRATE is active, get_current_center() uses the pirate drift offset.
	tuner.set_band(6)
	# After set_band, _drift_offset is reset but _pirate_drift_offset persists.
	# get_current_center() for PIRATE uses _pirate_drift_offset.
	var center_after_switch: float = tuner.get_current_center()
	if center_after_switch < 97.7 or center_after_switch > 98.3:
		print("    FAIL: PIRATE center after re-switch should be in [97.7, 98.3], got %s" % center_after_switch)
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
