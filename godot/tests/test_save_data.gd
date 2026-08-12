## test_save_data.gd — Unit tests for SaveData serialization.
## Tests: to_dict/from_dict round-trip, death penalty, position helpers, defaults.
extends RefCounted

var test_name: String = "SaveData"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_round_trip_serialization"] = test_round_trip_serialization()
	results["test_death_penalty"] = test_death_penalty()
	results["test_death_penalty_clamped"] = test_death_penalty_clamped()
	results["test_position_helpers"] = test_position_helpers()
	results["test_defaults"] = test_defaults()
	results["test_duplicate"] = test_duplicate()
	results["test_string_array_conversion"] = test_string_array_conversion()
	return results


func test_round_trip_serialization() -> bool:
	var sd := SaveData.new()
	sd.phase = 2
	sd.shift = 3
	sd.position_x = 10.5
	sd.position_y = 20.0
	sd.position_z = -5.0
	sd.camera_zone = "booth"
	sd.radio_band = "AM"
	sd.radio_signal = 65.0
	sd.radio_frequency = 92.5
	sd.composure = 75.0
	sd.dread = 30.0
	sd.empathy_score = 60
	sd.self_preservation = 40
	sd.curiosity = 70
	sd.sacrifice_count = 2
	sd.tapes_taken = 3
	sd.tapes_refused = 1
	sd.callers_helped = 5
	sd.callers_abandoned = 2
	sd.tapes_collected = ["tape_01", "tape_02"]
	sd.tapes_consumed = ["tape_00"]
	sd.bands_unlocked = ["AM", "FM"]
	sd.call_history = [{"caller_id": "c1", "result": "helped"}]
	sd.station_degradation = 3
	sd.ending_flags = {"ending_a": true}
	sd.entity_states = {"entity_1": {"alive": true, "pos": [1, 2, 3]}}
	sd.playtime_seconds = 3600.0
	sd.tape_id = "tape_03"
	sd.schema_version = 1

	var d := sd.to_dict()
	var sd2 := SaveData.from_dict(d)

	var checks: Array[bool] = [
		sd2.phase == 2,
		sd2.shift == 3,
		sd2.position_x == 10.5,
		sd2.position_y == 20.0,
		sd2.position_z == -5.0,
		sd2.camera_zone == "booth",
		sd2.radio_band == "AM",
		sd2.radio_signal == 65.0,
		sd2.radio_frequency == 92.5,
		sd2.composure == 75.0,
		sd2.dread == 30.0,
		sd2.empathy_score == 60,
		sd2.self_preservation == 40,
		sd2.curiosity == 70,
		sd2.sacrifice_count == 2,
		sd2.tapes_taken == 3,
		sd2.tapes_refused == 1,
		sd2.callers_helped == 5,
		sd2.callers_abandoned == 2,
		sd2.tapes_collected.size() == 2,
		sd2.tapes_collected[0] == "tape_01",
		sd2.tapes_consumed.size() == 1,
		sd2.bands_unlocked.size() == 2,
		sd2.call_history.size() == 1,
		sd2.station_degradation == 3,
		sd2.ending_flags.get("ending_a", false) == true,
		sd2.entity_states.has("entity_1"),
		sd2.playtime_seconds == 3600.0,
		sd2.tape_id == "tape_03",
		sd2.schema_version == 1,
	]

	for check in checks:
		if not check:
			return false
	return true


func test_death_penalty() -> bool:
	var sd := SaveData.new()
	sd.composure = 50.0
	sd.radio_signal = 30.0
	sd.dread = 40.0

	sd.apply_death_penalty()

	return sd.composure == 30.0 and sd.radio_signal == 80.0 and sd.dread == 50.0


func test_death_penalty_clamped() -> bool:
	var sd := SaveData.new()
	sd.composure = 10.0
	sd.dread = 95.0

	sd.apply_death_penalty()

	return sd.composure == 0.0 and sd.dread == 100.0


func test_position_helpers() -> bool:
	var sd := SaveData.new()
	sd.set_position(Vector3(1.0, 2.0, 3.0))
	var pos := sd.get_position()
	return pos == Vector3(1.0, 2.0, 3.0)


func test_defaults() -> bool:
	var sd := SaveData.new()
	var checks: Array[bool] = [
		sd.phase == 1,
		sd.shift == 1,
		sd.composure == 100.0,
		sd.dread == 0.0,
		sd.radio_signal == 80.0,
		sd.empathy_score == 50,
		sd.self_preservation == 50,
		sd.curiosity == 50,
		sd.sacrifice_count == 0,
		sd.tapes_taken == 0,
		sd.tapes_refused == 0,
		sd.callers_helped == 0,
		sd.callers_abandoned == 0,
		sd.station_degradation == 0,
		sd.playtime_seconds == 0.0,
		sd.schema_version == 1,
	]
	for check in checks:
		if not check:
			return false
	return true


func test_duplicate() -> bool:
	var sd := SaveData.new()
	sd.phase = 3
	sd.composure = 50.0
	sd.empathy_score = 70

	var copy := sd.duplicate_data()

	return copy.phase == 3 and copy.composure == 50.0 and copy.empathy_score == 70 and copy != sd


func test_string_array_conversion() -> bool:
	var sd := SaveData.new()
	var d := {"tapes_collected": [1, 2, 3]}  # Non-string values
	var sd2 := SaveData.from_dict(d)
	return sd2.tapes_collected.size() == 3 and sd2.tapes_collected[0] == "1"
