## SaveManager — Autoload singleton for DEA-153 cassette tape save system.
## Handles JSON serialization to user:// directory, corruption detection via checksum,
## and save/load operations. Each save file is named after the tape used (e.g. tape_03_save.json).
## See: docs/plans/redesign-gdd.md (lines 1555-1592) and DEA-153 brief.
extends Node

signal save_completed(tape_id: String)
signal save_failed(tape_id: String, reason: String)
signal load_completed(save_data: SaveData)
signal load_failed(tape_id: String, reason: String)
signal corruption_detected(tape_id: String)

## Save file extension and prefix
const SAVE_DIR := "user://saves/"
const SAVE_PREFIX := "tape_"
const SAVE_SUFFIX := "_save.json"
const CHECKSUM_FIELD := "_checksum"
const CORRUPTION_MARKER := "THIS TAPE IS DAMAGED"

## All save slots indexed by tape_id
var _save_index: Dictionary = {}


func _ready() -> void:
	_ensure_save_directory()
	_rebuild_index()


## Ensure the save directory exists.
func _ensure_save_directory() -> void:
	DirAccess.make_dir_recursive_absolute(SAVE_DIR)


## Get the full file path for a given tape_id.
func get_save_path(tape_id: String) -> String:
	return SAVE_DIR + SAVE_PREFIX + tape_id + SAVE_SUFFIX


## Save game state to a cassette tape slot.
## The tape is consumed after a successful save (one save per tape).
func save_game(tape_id: String, data: SaveData) -> bool:
	if tape_id.is_empty():
		save_failed.emit(tape_id, "tape_id is empty")
		return false

	if _save_index.has(tape_id):
		save_failed.emit(tape_id, "tape already used (consumed)")
		return false

	data.tape_id = tape_id
	data.stamp_timestamp()

	# Build save dict once, compute checksum on un-indented stringification
	# so it matches the recompute on load (which also uses no indent).
	var save_dict := data.to_dict()
	# DEA-98: Sync live MoralChoiceTracker state into the save dict
	if MoralChoiceTracker:
		MoralChoiceTracker.save_to(save_dict)
	var checksum := _compute_checksum(JSON.stringify(save_dict))
	save_dict[CHECKSUM_FIELD] = checksum

	var full_json := JSON.stringify(save_dict, "\t")
	var path := get_save_path(tape_id)

	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		save_failed.emit(
			tape_id, "cannot open file: %s (error: %d)" % [path, FileAccess.get_open_error()]
		)
		return false

	file.store_string(full_json)
	file.close()

	_save_index[tape_id] = path
	save_completed.emit(tape_id)
	return true


## Load a save from a cassette tape slot.
## Returns SaveData if valid, null if corrupted or missing.
func load_game(tape_id: String) -> SaveData:
	var path := get_save_path(tape_id)
	if not FileAccess.file_exists(path):
		load_failed.emit(tape_id, "save file not found")
		return null

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		load_failed.emit(tape_id, "cannot open file (error: %d)" % FileAccess.get_open_error())
		return null

	var json_string := file.get_as_text()
	file.close()

	# Parse JSON
	var parsed = JSON.parse_string(json_string)
	if typeof(parsed) != TYPE_DICTIONARY:
		corruption_detected.emit(tape_id)
		return null

	var save_dict: Dictionary = parsed

	# Verify checksum
	var stored_checksum: String = save_dict.get(CHECKSUM_FIELD, "")
	if stored_checksum.is_empty():
		corruption_detected.emit(tape_id)
		return null

	# Recompute checksum on the data without the checksum field
	var data_only := save_dict.duplicate()
	data_only.erase(CHECKSUM_FIELD)
	var recomputed := _compute_checksum(JSON.stringify(data_only))

	if stored_checksum != recomputed:
		corruption_detected.emit(tape_id)
		return null

	# Reconstruct SaveData from the validated dict
	var save_data := SaveData.from_dict(data_only)
	# DEA-98: Sync MoralChoiceTracker from loaded save data
	if MoralChoiceTracker:
		MoralChoiceTracker.load_from(data_only)
	load_completed.emit(save_data)
	return save_data


## Check whether a tape has been used (save exists for it).
func is_tape_used(tape_id: String) -> bool:
	return _save_index.has(tape_id)


## Get all tape IDs that have saves.
func get_used_tapes() -> Array[String]:
	var result: Array[String] = []
	for key in _save_index.keys():
		result.append(key)
	return result


## Delete a save file for a given tape_id (admin/debug only).
func delete_save(tape_id: String) -> bool:
	var path := get_save_path(tape_id)
	if not FileAccess.file_exists(path):
		return false
	var err := DirAccess.remove_absolute(path)
	if err == OK:
		_save_index.erase(tape_id)
		return true
	return false


## Delete all saves (admin/debug only).
func delete_all_saves() -> int:
	var count := 0
	for tape_id in _save_index.keys():
		if delete_save(tape_id):
			count += 1
	return count


## Rebuild the save index from files on disk.
func _rebuild_index() -> void:
	_save_index.clear()
	var dir := DirAccess.open(SAVE_DIR)
	if dir == null:
		return

	dir.list_dir_begin()
	var file_name := dir.get_next()
	while not file_name.is_empty():
		if not dir.current_is_dir() and file_name.ends_with(SAVE_SUFFIX):
			# Extract tape_id from filename: tape_XX_save.json -> XX
			var tape_id := file_name.substr(SAVE_PREFIX.length())
			tape_id = tape_id.substr(0, tape_id.length() - SAVE_SUFFIX.length())
			_save_index[tape_id] = SAVE_DIR + file_name
		file_name = dir.get_next()
	dir.list_dir_end()


## Compute SHA-256 checksum of a string.
func _compute_checksum(data: String) -> String:
	var hasher := HashingContext.new()
	hasher.start(HashingContext.HASH_SHA256)
	hasher.update(data.to_utf8_buffer())
	var hash_bytes := hasher.finish()
	return hash_bytes.hex_encode()


## Get the number of saves on disk.
func get_save_count() -> int:
	return _save_index.size()


## Validate a save file's integrity without loading it.
## Returns true if the checksum is valid, false if corrupted.
func validate_save(tape_id: String) -> bool:
	var path := get_save_path(tape_id)
	if not FileAccess.file_exists(path):
		return false

	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false

	var json_string := file.get_as_text()
	file.close()

	var parsed = JSON.parse_string(json_string)
	if typeof(parsed) != TYPE_DICTIONARY:
		return false

	var save_dict: Dictionary = parsed
	var stored_checksum: String = save_dict.get(CHECKSUM_FIELD, "")
	if stored_checksum.is_empty():
		return false

	var data_only := save_dict.duplicate()
	data_only.erase(CHECKSUM_FIELD)
	var recomputed := _compute_checksum(JSON.stringify(data_only))

	return stored_checksum == recomputed
