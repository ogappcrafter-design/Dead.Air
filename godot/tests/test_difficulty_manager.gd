## test_difficulty_manager.gd — Unit tests for DifficultyManager.
## Tests: difficulty scaling, sensitivity multiplier, band sensitivity modification.
extends RefCounted

var test_name: String = "DifficultyManager"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_default_difficulty_normal"] = test_default_difficulty_normal()
	results["test_sensitivity_multiplier_easy"] = test_sensitivity_multiplier_easy()
	results["test_sensitivity_multiplier_normal"] = test_sensitivity_multiplier_normal()
	results["test_sensitivity_multiplier_blank"] = test_sensitivity_multiplier_blank()
	results["test_blank_applies_0_7_sensitivity"] = test_blank_applies_0_7_sensitivity()
	results["test_normal_does_not_modify_sensitivity"] = test_normal_does_not_modify_sensitivity()
	results["test_difficulty_switch_restores_sensitivity"] = test_difficulty_switch_restores_sensitivity()
	results["test_is_highest_difficulty"] = test_is_highest_difficulty()
	results["test_get_difficulty_name"] = test_get_difficulty_name()
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


## Build a DifficultyManager with a RadioTuner.
func _make_difficulty_manager() -> DifficultyManager:
	var dm := DifficultyManager.new()
	dm.radio_tuner = RadioTuner.new()
	dm.radio_tuner.band_config = _make_band_config()
	dm.radio_tuner.set_band(0)
	return dm


# --- Difficulty Tests ---

func test_default_difficulty_normal() -> bool:
	var dm := _make_difficulty_manager()
	return dm.current_difficulty == DifficultyManager.Difficulty.NORMAL


func test_sensitivity_multiplier_easy() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.EASY)
	return abs(dm.get_sensitivity_multiplier() - 1.0) < 0.01


func test_sensitivity_multiplier_normal() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.NORMAL)
	return abs(dm.get_sensitivity_multiplier() - 1.0) < 0.01


func test_sensitivity_multiplier_blank() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.BLANK)
	return abs(dm.get_sensitivity_multiplier() - 0.7) < 0.01


func test_blank_applies_0_7_sensitivity() -> bool:
	var dm := _make_difficulty_manager()
	# LIVING band sensitivity starts at 8.0
	var original_sens := dm.radio_tuner.band_config.bands[0].sensitivity
	if abs(original_sens - 8.0) > 0.01:
		return false
	dm.set_difficulty(DifficultyManager.Difficulty.BLANK)
	# After BLANK difficulty, LIVING sensitivity should be 8.0 * 0.7 = 5.6
	var new_sens := dm.radio_tuner.band_config.bands[0].sensitivity
	return abs(new_sens - 5.6) < 0.01


func test_normal_does_not_modify_sensitivity() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.NORMAL)
	var sens := dm.radio_tuner.band_config.bands[0].sensitivity
	return abs(sens - 8.0) < 0.01


func test_difficulty_switch_restores_sensitivity() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.BLANK)
	var blank_sens := dm.radio_tuner.band_config.bands[0].sensitivity
	if abs(blank_sens - 5.6) > 0.01:
		return false
	dm.set_difficulty(DifficultyManager.Difficulty.NORMAL)
	var restored_sens := dm.radio_tuner.band_config.bands[0].sensitivity
	return abs(restored_sens - 8.0) < 0.01


func test_is_highest_difficulty() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.BLANK)
	if not dm.is_highest_difficulty():
		return false
	dm.set_difficulty(DifficultyManager.Difficulty.NORMAL)
	return not dm.is_highest_difficulty()


func test_get_difficulty_name() -> bool:
	var dm := _make_difficulty_manager()
	dm.set_difficulty(DifficultyManager.Difficulty.BLANK)
	return dm.get_difficulty_name() == "BLANK"
