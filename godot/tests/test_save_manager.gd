## test_save_manager.gd — Unit tests for SaveManager serialization, corruption, and tape consumption.
## Tests: save/load round-trip, checksum corruption detection, tape consumption, index rebuild, deletion.
extends RefCounted

var test_name: String = "SaveManager"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_save_and_load"] = test_save_and_load()
	results["test_tape_consumption"] = test_tape_consumption()
	results["test_corruption_detection"] = test_corruption_detection()
	results["test_missing_file"] = test_missing_file()
	results["test_index_rebuild"] = test_index_rebuild()
	results["test_delete_save"] = test_delete_save()
	results["test_validate_save"] = test_validate_save()
	results["test_empty_tape_id"] = test_empty_tape_id()
	results["test_duplicate_save_rejected"] = test_duplicate_save_rejected()
	# Clean up
	SaveManager.delete_all_saves()
	return results


func test_save_and_load() -> bool:
	SaveManager.delete_all_saves()

	var sd := SaveData.new()
	sd.phase = 2
	sd.shift = 3
	sd.composure = 65.0
	sd.dread = 25.0
	sd.empathy_score = 55
	sd.position_x = 15.0
	sd.position_y = 0.0
	sd.position_z = -3.0
	sd.camera_zone = "booth"
	sd.tapes_collected = ["tape_01", "tape_03"]
	sd.bands_unlocked = ["AM"]

	var ok := SaveManager.save_game("test_01", sd)
	if not ok:
		return false

	var loaded := SaveManager.load_game("test_01")
	if loaded == null:
		return false

	var checks: Array[bool] = [
		loaded.phase == 2,
		loaded.shift == 3,
		loaded.composure == 65.0,
		loaded.dread == 25.0,
		loaded.empathy_score == 55,
		loaded.position_x == 15.0,
		loaded.camera_zone == "booth",
		loaded.tapes_collected.size() == 2,
		loaded.bands_unlocked[0] == "AM",
		loaded.tape_id == "test_01",
		not loaded.save_timestamp.is_empty(),
	]

	SaveManager.delete_save("test_01")
	for check in checks:
		if not check:
			return false
	return true


func test_tape_consumption() -> bool:
	SaveManager.delete_all_saves()

	# Player collects a tape
	TapeInventory.reset()
	TapeInventory.collect_tape("consumed_test")
	assert(TapeInventory.has_tape("consumed_test"))

	# Save game consumes the tape
	var sd := SaveData.new()
	sd.phase = 1
	var ok := SaveManager.save_game("consumed_test", sd)
	if not ok:
		return false

	var consumed := TapeInventory.consume_tape("consumed_test")
	if not consumed:
		return false

	# Tape should no longer be in inventory
	if TapeInventory.has_tape("consumed_test"):
		return false

	# Tape should be marked as consumed
	if not TapeInventory.is_tape_consumed("consumed_test"):
		return false

	# SaveManager should know the tape is used
	if not SaveManager.is_tape_used("consumed_test"):
		return false

	SaveManager.delete_save("consumed_test")
	TapeInventory.reset()
	return true


func test_corruption_detection() -> bool:
	SaveManager.delete_all_saves()

	var sd := SaveData.new()
	sd.phase = 1
	sd.composure = 80.0

	var ok := SaveManager.save_game("corrupt_test", sd)
	if not ok:
		return false

	# Tamper with the save file
	var path := SaveManager.get_save_path("corrupt_test")
	var file := FileAccess.open(path, FileAccess.READ)
	var json_string := file.get_as_text()
	file.close()

	# Corrupt the JSON by modifying a value
	var corrupted_json := json_string.replace("\"composure\": 80.0", "\"composure\": 999.0")

	var file2 := FileAccess.open(path, FileAccess.WRITE)
	file2.store_string(corrupted_json)
	file2.close()

	# validate_save should return false (checksum mismatch)
	var is_valid := SaveManager.validate_save("corrupt_test")
	if is_valid:
		return false

	# load_game should return null (corruption detected)
	var loaded := SaveManager.load_game("corrupt_test")
	if loaded != null:
		return false

	SaveManager.delete_save("corrupt_test")
	return true


func test_missing_file() -> bool:
	SaveManager.delete_all_saves()
	var loaded := SaveManager.load_game("nonexistent")
	return loaded == null


func test_index_rebuild() -> bool:
	SaveManager.delete_all_saves()

	# Save a few tapes
	var sd := SaveData.new()
	SaveManager.save_game("idx_01", sd)
	SaveManager.save_game("idx_02", sd)

	# Check index has 2 entries
	if SaveManager.get_save_count() != 2:
		return false

	# Delete one file directly (bypassing SaveManager)
	var path := SaveManager.get_save_path("idx_01")
	DirAccess.remove_absolute(path)

	# Rebuild index
	SaveManager._rebuild_index()

	# Should now have 1 entry
	if SaveManager.get_save_count() != 1:
		return false

	if SaveManager.is_tape_used("idx_01"):
		return false

	if not SaveManager.is_tape_used("idx_02"):
		return false

	SaveManager.delete_all_saves()
	return true


func test_delete_save() -> bool:
	SaveManager.delete_all_saves()

	var sd := SaveData.new()
	SaveManager.save_game("del_test", sd)

	var deleted := SaveManager.delete_save("del_test")
	if not deleted:
		return false

	if SaveManager.is_tape_used("del_test"):
		return false

	# Deleting again should fail (already gone)
	var deleted2 := SaveManager.delete_save("del_test")
	if deleted2:
		return false

	return true


func test_validate_save() -> bool:
	SaveManager.delete_all_saves()

	var sd := SaveData.new()
	sd.phase = 1
	SaveManager.save_game("valid_test", sd)

	var is_valid := SaveManager.validate_save("valid_test")
	if not is_valid:
		return false

	# Non-existent save
	var is_valid2 := SaveManager.validate_save("nonexistent")
	if is_valid2:
		return false

	SaveManager.delete_save("valid_test")
	return true


func test_empty_tape_id() -> bool:
	SaveManager.delete_all_saves()
	var sd := SaveData.new()
	var ok := SaveManager.save_game("", sd)
	return not ok  # Should fail


func test_duplicate_save_rejected() -> bool:
	SaveManager.delete_all_saves()

	var sd := SaveData.new()
	var ok1 := SaveManager.save_game("dup_test", sd)
	if not ok1:
		return false

	# Second save to same tape should fail
	var ok2 := SaveManager.save_game("dup_test", sd)
	if ok2:
		return false

	SaveManager.delete_save("dup_test")
	return true
