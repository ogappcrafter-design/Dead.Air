# band_unlock_manager.gd — Tracks band unlock conditions and persistence (DEA-99)
# Depends on: BandConfig, BandData, SaveData, PhaseManager
class_name BandUnlockManager
extends Node

## Emitted when a band is unlocked. Carries the band id.
signal band_unlocked(band_id: int)

## Band id for the ████████ (redacted) band.
const REDACTED_BAND_ID: int = 4

## PIRATE band id (always-drift tracking).
const PIRATE_BAND_ID: int = 6

## Tracks time spent tuning each band (for TIME_TUNING unlock type).
## Key: band_id (int), Value: accumulated seconds (float).
var _tuning_time: Dictionary = {}

## Band configuration resource. Set directly in tests; otherwise loaded from res://.
var _band_config: BandConfig = null

## Currently unlocked band ids (as strings for SaveData compat).
var _unlocked_bands: Array[String] = []


func _ready() -> void:
	# Bands available from start are unlocked immediately.
	_unlock_start_bands()


## Check if a band is unlocked.
func is_band_unlocked(band_id: int) -> bool:
	return str(band_id) in _unlocked_bands


## Get list of unlocked band ids as integers.
func get_unlocked_band_ids() -> Array[int]:
	var result: Array[int] = []
	for s in _unlocked_bands:
		result.append(int(s))
	return result


## Called when the player shifts to a new shift number.
## Unlocks SHIFT-type bands whose unlock_shift <= current shift.
func on_shift_changed(new_shift: int) -> void:
	var config: BandConfig = _get_band_config()
	if config == null:
		return
	for i in range(config.get_band_count()):
		var band: BandData = config.get_band(i)
		if band == null:
			continue
		if band.unlock_type == BandData.UnlockType.SHIFT and new_shift >= band.unlock_shift:
			_unlock_band(i)


## Called every frame while a band is being tuned.
## Accumulates tuning time for TIME_TUNING unlock type.
func on_tuning_tick(band_id: int, delta: float) -> void:
	var config: BandConfig = _get_band_config()
	if config == null:
		return
	# Accumulate time on the *target* band (the one that needs tuning, not the one being checked).
	# The target band is the one with TIME_TUNING unlock type; we track time spent on the
	# unlock_time_tuning_band.
	for i in range(config.get_band_count()):
		var check_band: BandData = config.get_band(i)
		if check_band == null:
			continue
		if check_band.unlock_type == BandData.UnlockType.TIME_TUNING and check_band.unlock_time_tuning_band == band_id:
			if not is_band_unlocked(i):
				var key: int = i
				if not _tuning_time.has(key):
					_tuning_time[key] = 0.0
				_tuning_time[key] += delta
				if _tuning_time[key] >= check_band.unlock_time_seconds:
					_unlock_band(i)


## Called when a game event fires (e.g., finding a clue, classified event).
## Unlocks EVENT-type bands whose unlock_event_id matches.
func on_event(event_id: String) -> void:
	var config: BandConfig = _get_band_config()
	if config == null:
		return
	for i in range(config.get_band_count()):
		var band: BandData = config.get_band(i)
		if band == null:
			continue
		if band.unlock_type == BandData.UnlockType.EVENT and band.unlock_event_id == event_id:
			_unlock_band(i)


## Load unlock state from SaveData.
func load_from_save(save_data: SaveData) -> void:
	_unlocked_bands = save_data.bands_unlocked.duplicate()
	_tuning_time = save_data.tuning_time.duplicate()
	# Ensure start bands are always unlocked.
	_unlock_start_bands()


## Save unlock state to SaveData.
func save_to(save_data: SaveData) -> void:
	save_data.bands_unlocked = _unlocked_bands.duplicate()
	save_data.tuning_time = _tuning_time.duplicate()


## Check if the ████████ (redacted) band is currently active and unlocked.
func is_redacted_band_unlocked() -> bool:
	return is_band_unlocked(REDACTED_BAND_ID)


# --- Internal ---

func _unlock_band(band_id: int) -> void:
	if is_band_unlocked(band_id):
		return
	_unlocked_bands.append(str(band_id))
	band_unlocked.emit(band_id)


func _unlock_start_bands() -> void:
	var config: BandConfig = _get_band_config()
	if config == null:
		return
	for i in range(config.get_band_count()):
		var band: BandData = config.get_band(i)
		if band == null:
			continue
		if band.unlock_type == BandData.UnlockType.START:
			_unlock_band(i)


func _get_band_config() -> BandConfig:
	if _band_config != null:
		return _band_config
	return load("res://src/data/band_config.tres")
