## TapeInventory — Autoload singleton tracking collected and consumed cassette tapes.
## Player starts with 0 tapes. Tapes are found in safe rooms and consumed on save.
## ~8-10 tapes total in full playthrough per GDD.
## See: docs/plans/redesign-gdd.md (lines 1555-1592) and DEA-153 brief.
extends Node

signal tape_collected(tape_id: String)
signal tape_consumed(tape_id: String)
signal tape_refused(tape_id: String)

## Tapes the player has found but not yet used for saving.
var _collected: Dictionary = {}  # tape_id -> TapeData (or dict if no resource)

## Tapes that have been used for saving (consumed).
var _consumed: Dictionary = {}  # tape_id -> true

## Tapes the player refused to take (moral choice tracking).
var _refused: Dictionary = {}  # tape_id -> true


## Collect a tape. Called when player picks up a cassette in a safe room.
func collect_tape(tape_id: String, tape_data: Variant = null) -> void:
	if _collected.has(tape_id) or _consumed.has(tape_id):
		return  # Already collected or consumed
	_collected[tape_id] = tape_data if tape_data != null else {"id": tape_id}
	tape_collected.emit(tape_id)


## Consume a tape to save the game. The tape is removed from inventory.
func consume_tape(tape_id: String) -> bool:
	if not _collected.has(tape_id):
		return false  # Don't have this tape
	_collected.erase(tape_id)
	_consumed[tape_id] = true
	tape_consumed.emit(tape_id)
	return true


## Refuse to take a tape (moral choice). Tracks for empathy/sacrifice scoring.
func refuse_tape(tape_id: String) -> void:
	if _refused.has(tape_id):
		return
	_refused[tape_id] = true
	tape_refused.emit(tape_id)


## Check if the player has a specific tape in their inventory.
func has_tape(tape_id: String) -> bool:
	return _collected.has(tape_id)


## Check if a tape has been consumed (used for saving).
func is_tape_consumed(tape_id: String) -> bool:
	return _consumed.has(tape_id)


## Check if a tape was refused.
func was_tape_refused(tape_id: String) -> bool:
	return _refused.has(tape_id)


## Get all collected tape IDs (available for saving).
func get_collected_tapes() -> Array[String]:
	var result: Array[String] = []
	for key in _collected.keys():
		result.append(key)
	return result


## Get all consumed tape IDs (used for saving).
func get_consumed_tapes() -> Array[String]:
	var result: Array[String] = []
	for key in _consumed.keys():
		result.append(key)
	return result


## Get all refused tape IDs.
func get_refused_tapes() -> Array[String]:
	var result: Array[String] = []
	for key in _refused.keys():
		result.append(key)
	return result


## Number of tapes currently in inventory.
func get_collected_count() -> int:
	return _collected.size()


## Number of tapes consumed (saves made).
func get_consumed_count() -> int:
	return _consumed.size()


## Number of tapes refused.
func get_refused_count() -> int:
	return _refused.size()


## Total tapes encountered (collected + consumed + refused).
func get_total_encountered() -> int:
	return _collected.size() + _consumed.size() + _refused.size()


## Export inventory state for save serialization.
func to_dict() -> Dictionary:
	return {
		"collected": _collected.keys(),
		"consumed": _consumed.keys(),
		"refused": _refused.keys(),
	}


## Import inventory state from a saved dictionary.
func from_dict(data: Dictionary) -> void:
	_collected.clear()
	_consumed.clear()
	_refused.clear()
	for tape_id in data.get("collected", []):
		_collected[tape_id] = {"id": tape_id}
	for tape_id in data.get("consumed", []):
		_consumed[tape_id] = true
	for tape_id in data.get("refused", []):
		_refused[tape_id] = true


## Reset inventory (new game).
func reset() -> void:
	_collected.clear()
	_consumed.clear()
	_refused.clear()
