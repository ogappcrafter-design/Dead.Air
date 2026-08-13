# difficulty_manager.gd — Difficulty scaling system
# DEA-97: Radio Tuning System
# Source: GDD difficulty spec (docs/plans/redesign-gdd.md)
class_name DifficultyManager
extends Node

## Difficulty levels.
enum Difficulty {
	EASY,       ## Easy: standard sensitivity, no scaling
	NORMAL,     ## Normal: standard sensitivity
	HARD,       ## Hard: reduced sensitivity
	NIGHTMARE,  ## Nightmare: further reduced sensitivity
	BLANK,      ## Blank (highest): sensitivity ×0.7
}

## Sensitivity multiplier applied at highest difficulty (BLANK).
const BLANK_SENSITIVITY_MULT: float = 0.7

## Current difficulty level.
var current_difficulty: Difficulty = Difficulty.NORMAL

## Reference to RadioTuner for sensitivity scaling.
var radio_tuner: RadioTuner

# Cached base sensitivities keyed by band index, captured on first scaling call.
var _base_sensitivities: Dictionary = {}


## Set the current difficulty level. Applies sensitivity scaling to RadioTuner.
func set_difficulty(diff: Difficulty) -> void:
	current_difficulty = diff
	_apply_sensitivity_scaling()


## Get the sensitivity multiplier for the current difficulty.
func get_sensitivity_multiplier() -> float:
	match current_difficulty:
		Difficulty.BLANK:
			return BLANK_SENSITIVITY_MULT
		Difficulty.NIGHTMARE:
			return 0.8
		Difficulty.HARD:
			return 0.9
		_:
			return 1.0


## Apply the sensitivity scaling to the RadioTuner's band config.
## Computes from cached base sensitivities so difficulty changes are non-destructive.
func _apply_sensitivity_scaling() -> void:
	if radio_tuner == null or radio_tuner.band_config == null:
		return
	var mult: float = get_sensitivity_multiplier()
	for i in range(radio_tuner.band_config.bands.size()):
		var band: BandData = radio_tuner.band_config.bands[i]
		if not _base_sensitivities.has(i):
			_base_sensitivities[i] = band.sensitivity
		band.sensitivity = _base_sensitivities[i] * mult


## Get the difficulty level as a string.
func get_difficulty_name() -> String:
	return Difficulty.keys()[current_difficulty]


## Check if the current difficulty is the highest (BLANK).
func is_highest_difficulty() -> bool:
	return current_difficulty == Difficulty.BLANK
