# validation.gd — DEA-149 Migration Validation Script
# Loads all converted resources and asserts field-count + key-field equivalence
# against React Native source data.
# Run: godot --headless --script res://src/data/validation.gd
# Or:   Add as child of a scene and call run_validation()
extends Node

const CallData = preload("res://src/data/call_data.gd")
const CallTypes = preload("res://src/data/call_types.gd")

# Expected values from RN source (data/calls.js)
const EXPECTED_CALL_COUNT = 18
const EXPECTED_BAND_COUNT = 5
const EXPECTED_TAPE_COUNT = 15
const EXPECTED_CALL_TYPES = [
	"RIGHT_ANSWER", "DEAD_AIR", "JUST_LISTEN", "SIGNAL_DECODE",
	"STAY_CALM", "RECORDING", "MULTI_CALLER", "TIMING",
	"PUZZLE", "CONVERSATION"
]
const EXPECTED_BAND_NAMES = ["LIVING", "LIMINAL", "LOST", "CLASSIFIED", "████████"]
const EXPECTED_BAND_FREQS = ["88.7 FM", "102.3 FM", "117.8 AM", "███.█ FM", "???.?"]
const EXPECTED_BAND_COLORS = [
	Color(1.0, 0.549, 0.0, 1.0),    # LIVING #FF8C00
	Color(0.8, 1.0, 0.0, 1.0),      # LIMINAL #CCFF00
	Color(0.0, 1.0, 0.816, 1.0),    # LOST #00FFD0
	Color(1.0, 0.2, 0.4, 1.0),      # CLASSIFIED #FF3366
	Color(1.0, 1.0, 1.0, 1.0),      # ████████ #FFFFFF
]
const EXPECTED_BAND_UNLOCKS = [0, 4, 8, 12, 15]
const EXPECTED_TAPE_NAMES = [
	"Tape #1 — The Wrong Number",
	"Tape #2 — The Collector's Archive",
	"Tape #3 — The 3:47 Sessions",
	"Tape #4 — Yesterday's Frequency",
	"Tape #5 — Echo Chamber",
	"Tape #6 — Signal From Guardian",
	"Tape #7 — Found Signal",
	"Tape #8 — Her Voice",
	"Tape #9 — Open Sky",
	"Tape #10 — Courtesy Call",
	"Tape #11 — ARIA-9 Transcript",
	"Tape #12 — The Network",
	"Tape #13 — First Transmission",
	"Tape #14 — The Choice",
	"Tape #15 — What Answered",
]
const EXPECTED_TAPE_CALL_LINKAGES = [
	0, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17
]

var _pass_count: int = 0
var _fail_count: int = 0
var _results: Array[String] = []


func _ready() -> void:
	run_validation()


func run_validation() -> void:
	_results.clear()
	_pass_count = 0
	_fail_count = 0

	print("=== DEA-149 Migration Validation ===")
	print("")

	_validate_calls()
	_validate_call_types()
	_validate_band_config()
	_validate_tapes()

	print("")
	print("=== Validation Summary ===")
	print("PASS: %d  FAIL: %d" % [_pass_count, _fail_count])
	print("")

	for result in _results:
		print(result)

	if _fail_count > 0:
		push_error("DEA-149 validation FAILED: %d assertions failed" % _fail_count)
		print("\n[RESULT] FAILED")
	else:
		print("\n[RESULT] PASSED")

	# Output CSV for machine-readable results
	_output_csv()

	# Quit after validation in headless mode
	if DisplayServer.get_name() == "headless":
		get_tree().quit(_fail_count)


func _validate_calls() -> void:
	print("--- Validating Calls ---")
	var call_data := CallData.new()
	call_data.load_and_validate()

	# Check call count
	_assert_eq(call_data.calls.size(), EXPECTED_CALL_COUNT, "Call count", "calls.size()")

	# Check each call has required fields
	var required_fields := ["id", "band", "callerId", "callerName", "signal", "type", "staticReward"]
	for i in range(call_data.calls.size()):
		var call = call_data.calls[i]
		for field in required_fields:
			_assert_true(call.has(field), "Call %d has field '%s'" % [i, field], "call[%d].%s" % [i, field])

	# Check unique sequential IDs 0-17
	var ids: Array[int] = []
	for call in call_data.calls:
		ids.append(call["id"])
	for i in range(EXPECTED_CALL_COUNT):
		_assert_eq(ids[i], i, "Call index %d has id %d" % [i, i], "call[%d].id" % [i])

	# Check band range
	for call in call_data.calls:
		_assert_true(call["band"] >= 0 and call["band"] < EXPECTED_BAND_COUNT,
			"Call %d band in range [0,4]" % call["id"], "call[%d].band" % call["id"])

	# Check all types are valid (string membership check)
	for call in call_data.calls:
		_assert_true(EXPECTED_CALL_TYPES.has(call["type"]),
			"Call %d type '%s' is valid" % [call["id"], call["type"]], "call[%d].type" % call["id"])

	# Count tape-bearing calls
	var tape_count := 0
	for call in call_data.calls:
		if call.has("tapeName"):
			tape_count += 1
	_assert_eq(tape_count, EXPECTED_TAPE_COUNT, "Tape-bearing call count", "tape_calls")

	# Verify tape names match ALL_TAPES
	var tape_names_found: Array[String] = []
	for call in call_data.calls:
		if call.has("tapeName"):
			tape_names_found.append(call["tapeName"])
	_assert_eq(tape_names_found.size(), EXPECTED_TAPE_COUNT, "Tape names count", "tape_names")
	for i in range(EXPECTED_TAPE_COUNT):
		_assert_eq(tape_names_found[i], EXPECTED_TAPE_NAMES[i],
			"Tape name %d matches: '%s'" % [i, EXPECTED_TAPE_NAMES[i]],
			"tape_name[%d]" % [i])

	call_data.queue_free()


func _validate_call_types() -> void:
	print("--- Validating Call Types ---")
	# Verify all expected types exist in enum (via from_string roundtrip)
	for type_name in EXPECTED_CALL_TYPES:
		var enum_val: int = CallTypes.from_string(type_name)
		_assert_true(enum_val >= 0 and enum_val < EXPECTED_CALL_TYPES.size(),
			"CallType.%s exists (enum value %d)" % [type_name, enum_val], "CallType.%s" % type_name)

	# Verify to_string roundtrips
	for type_name in EXPECTED_CALL_TYPES:
		var enum_val: int = CallTypes.from_string(type_name)
		var back: String = CallTypes.to_string(enum_val)
		_assert_eq(back, type_name, "CallType roundtrip '%s'" % type_name, "roundtrip.%s" % type_name)


func _validate_band_config() -> void:
	print("--- Validating Band Config ---")
	var band_config := load("res://src/data/band_config.tres")

	_assert_eq(band_config.bands.size(), EXPECTED_BAND_COUNT, "Band count", "bands.size()")

	for i in range(EXPECTED_BAND_COUNT):
		var band = band_config.bands[i]
		_assert_eq(band.id, i, "Band %d id" % i, "band[%d].id" % i)
		_assert_eq(band.name, EXPECTED_BAND_NAMES[i], "Band %d name" % i, "band[%d].name" % i)
		_assert_eq(band.freq, EXPECTED_BAND_FREQS[i], "Band %d freq" % i, "band[%d].freq" % i)
		_assert_color_approx_eq(band.color, EXPECTED_BAND_COLORS[i], "Band %d color" % i, "band[%d].color" % i)
		_assert_eq(band.unlock_at, EXPECTED_BAND_UNLOCKS[i], "Band %d unlock_at" % i, "band[%d].unlock_at" % i)
		_assert_true(band.vibe.length() > 0, "Band %d vibe non-empty" % i, "band[%d].vibe" % i)


func _validate_tapes() -> void:
	print("--- Validating Tapes ---")
	var tape_library := load("res://src/data/tapes.tres")

	_assert_eq(tape_library.tapes.size(), EXPECTED_TAPE_COUNT, "Tape count", "tapes.size()")

	for i in range(EXPECTED_TAPE_COUNT):
		var tape = tape_library.tapes[i]
		_assert_eq(tape.display_name, EXPECTED_TAPE_NAMES[i],
			"Tape %d display_name" % i, "tape[%d].display_name" % i)
		_assert_eq(tape.linked_call_id, EXPECTED_TAPE_CALL_LINKAGES[i],
			"Tape %d linked_call_id" % i, "tape[%d].linked_call_id" % i)
		_assert_true(tape.tape_id.begins_with("tape-"),
			"Tape %d tape_id format" % i, "tape[%d].tape_id" % i)
		_assert_true(tape.title.length() > 0,
			"Tape %d title non-empty" % i, "tape[%d].title" % i)
		_assert_true(tape.description.length() > 0,
			"Tape %d description non-empty" % i, "tape[%d].description" % i)
		_assert_true(tape.band.length() > 0,
			"Tape %d band non-empty" % i, "tape[%d].band" % i)
		_assert_true(tape.duration.length() > 0,
			"Tape %d duration non-empty" % i, "tape[%d].duration" % i)
		_assert_true(["common", "uncommon", "rare", "legendary"].has(tape.rarity),
			"Tape %d rarity valid: '%s'" % [i, tape.rarity], "tape[%d].rarity" % i)


# --- Assertion helpers ---

func _assert_eq(actual: Variant, expected: Variant, label: String, csv_key: String) -> void:
	if actual == expected:
		_pass_count += 1
		_results.append("PASS,%s,%s==%s" % [csv_key, str(actual), str(expected)])
	else:
		_fail_count += 1
		var msg = "FAIL: %s — expected '%s', got '%s'" % [label, str(expected), str(actual)]
		push_error(msg)
		_results.append("FAIL,%s,expected=%s,actual=%s" % [csv_key, str(expected), str(actual)])


func _assert_true(condition: bool, label: String, csv_key: String) -> void:
	if condition:
		_pass_count += 1
		_results.append("PASS,%s,true" % [csv_key])
	else:
		_fail_count += 1
		var msg = "FAIL: %s — expected true" % label
		push_error(msg)
		_results.append("FAIL,%s,expected=true,actual=false" % [csv_key])


func _assert_color_approx_eq(actual: Color, expected: Color, label: String, csv_key: String) -> void:
	var tolerance := 0.01
	var match = absf(actual.r - expected.r) < tolerance \
		and absf(actual.g - expected.g) < tolerance \
		and absf(actual.b - expected.b) < tolerance \
		and absf(actual.a - expected.a) < tolerance
	if match:
		_pass_count += 1
		_results.append("PASS,%s,color(%s,%s,%s,%s)" % [csv_key, str(actual.r), str(actual.g), str(actual.b), str(actual.a)])
	else:
		_fail_count += 1
		var msg = "FAIL: %s — expected color(%s,%s,%s,%s), got color(%s,%s,%s,%s)" % [label, str(expected.r), str(expected.g), str(expected.b), str(expected.a), str(actual.r), str(actual.g), str(actual.b), str(actual.a)]
		push_error(msg)
		_results.append("FAIL,%s,expected=(%s,%s,%s,%s),actual=(%s,%s,%s,%s)" % [csv_key, str(expected.r), str(expected.g), str(expected.b), str(expected.a), str(actual.r), str(actual.g), str(actual.b), str(actual.a)])


func _output_csv() -> void:
	var csv_path := "res://src/data/validation_results.csv"
	var csv_content := "status,key,detail\n"
	for result in _results:
		csv_content += result + "\n"
	var file := FileAccess.open(csv_path, FileAccess.WRITE)
	if file:
		file.store_string(csv_content)
		file.close()
		print("\nCSV results written to: %s" % csv_path)
	else:
		push_error("Failed to write CSV results to %s" % csv_path)
