# call_data.gd — Loads and validates calls.json at runtime
# DEA-149: React Native → Godot asset migration
# Fails loudly on schema mismatch or data corruption.
extends Node

const CALLS_PATH: String = "res://src/data/calls.json"
const SCHEMA_PATH: String = "res://src/data/calls.schema.json"
const EXPECTED_CALL_COUNT: int = 18

## Valid call type strings (must match call_types.gd enum keys)
const VALID_TYPES: Array[String] = [
	"RIGHT_ANSWER",
	"DEAD_AIR",
	"JUST_LISTEN",
	"SIGNAL_DECODE",
	"STAY_CALM",
	"RECORDING",
	"MULTI_CALLER",
	"TIMING",
	"PUZZLE",
	"CONVERSATION",
]

## Required fields for every call entry
const REQUIRED_FIELDS: Array[String] = [
	"id",
	"band",
	"callerId",
	"callerName",
	"signal",
	"type",
	"staticReward",
]

## Optional fields that may appear on any call
const OPTIONAL_FIELDS: Array[String] = [
	"waitSeconds",
	"sanityDelta",
	"sanityPenalty",
	"duration",
	"tape",
	"tapeName",
	"lines",
	"choices",
	"intro",
	"sequence",
	"decodedMessage",
	"is_sacred",
]

## Required fields for each choice object
const CHOICE_REQUIRED_FIELDS: Array[String] = [
	"text",
	"outcome",
	"sanityDelta",
	"staticMult",
	"tape",
]

## Loaded call data (array of dictionaries, verbatim from JSON)
var calls: Array[Dictionary] = []

## Index by call id for O(1) lookup
var calls_by_id: Dictionary = {}

signal calls_loaded(call_data: Array[Dictionary])

func _ready() -> void:
	load_and_validate()

## Load calls.json and run full validation. Fails loudly on any mismatch.
func load_and_validate() -> void:
	var file := FileAccess.open(CALLS_PATH, FileAccess.READ)
	if file == null:
		push_error("CallData: Cannot open calls.json at %s — error: %s" % [CALLS_PATH, FileAccess.get_open_error()])
		assert(false, "CallData: FATAL — calls.json not found or unreadable")
		return

	var json_text := file.get_as_text()
	file.close()

	var json := JSON.new()
	var err := json.parse(json_text)
	if err != OK:
		push_error("CallData: JSON parse error at line %d: %s" % [json.get_error_line(), json.get_error_message()])
		assert(false, "CallData: FATAL — calls.json is not valid JSON")
		return

	var data = json.data
	if data == null:
		push_error("CallData: calls.json parsed to null")
		assert(false, "CallData: FATAL — calls.json is null")
		return

	if not data is Array:
		push_error("CallData: calls.json root is not an array (got %s)" % [typeof(data)])
		assert(false, "CallData: FATAL — calls.json root must be array")
		return

	var arr := data as Array

	# --- Count check ---
	if arr.size() != EXPECTED_CALL_COUNT:
		push_error("CallData: Expected %d calls, got %d" % [EXPECTED_CALL_COUNT, arr.size()])
		assert(false, "CallData: FATAL — call count mismatch")
		return

	# --- Per-call validation ---
	var seen_ids: Dictionary = {}
	calls.clear()
	calls_by_id.clear()

	for i in range(arr.size()):
		var entry: Variant = arr[i]
		if not entry is Dictionary:
			push_error("CallData: Entry %d is not a dictionary" % i)
			assert(false, "CallData: FATAL — entry %d not a dict" % i)
			return

		var call: Dictionary = entry as Dictionary
		var prefix := "CallData: Call %d (index %d)" % [call.get("id", "?"), i]

		# Check required fields
		for field in REQUIRED_FIELDS:
			if not call.has(field):
				push_error("%s missing required field '%s'" % [prefix, field])
				assert(false, "CallData: FATAL — missing field %s in call %d" % [field, i])
				return

		# Check no unexpected fields
		for key in call.keys():
			if not REQUIRED_FIELDS.has(key) and not OPTIONAL_FIELDS.has(key):
				push_warning("%s has unknown field '%s' (may be downstream-relevant)" % [prefix, key])

		# Validate type is a known enum value
		var type_str: String = str(call["type"])
		if not VALID_TYPES.has(type_str):
			push_error("%s has invalid type '%s'" % [prefix, type_str])
			assert(false, "CallData: FATAL — unknown call type %s" % type_str)
			return

		# Validate id is unique
		var call_id: int = int(call["id"])
		if seen_ids.has(call_id):
			push_error("%s duplicate id %d" % [prefix, call_id])
			assert(false, "CallData: FATAL — duplicate call id %d" % call_id)
			return
		seen_ids[call_id] = true

		# Validate band is 0-4
		var band_val: int = int(call["band"])
		if band_val < 0 or band_val > 4:
			push_error("%s band %d out of range [0,4]" % [prefix, band_val])
			assert(false, "CallData: FATAL — band out of range")
			return

		# Validate choices if present
		if call.has("choices"):
			var choices: Variant = call["choices"]
			if not choices is Array:
				push_error("%s 'choices' is not array" % prefix)
				assert(false, "CallData: FATAL — choices not array in call %d" % i)
				return
			for j in range((choices as Array).size()):
				var choice: Variant = (choices as Array)[j]
				if not choice is Dictionary:
					push_error("%s choice %d not a dict" % [prefix, j])
					assert(false, "CallData: FATAL — choice %d not dict in call %d" % [j, i])
					return
				for cf in CHOICE_REQUIRED_FIELDS:
					if not (choice as Dictionary).has(cf):
						push_error("%s choice %d missing field '%s'" % [prefix, j, cf])
						assert(false, "CallData: FATAL — choice %d missing %s in call %d" % [j, cf, i])
						return

		# Store verbatim
		calls.append(call.duplicate(true))
		calls_by_id[call_id] = call

	# Validate sequential ids 0..17
	for expected_id in range(EXPECTED_CALL_COUNT):
		if not seen_ids.has(expected_id):
			push_error("CallData: Missing call id %d" % expected_id)
			assert(false, "CallData: FATAL — missing call id %d" % expected_id)
			return

	print("CallData: Loaded and validated %d sacred calls" % calls.size())
	calls_loaded.emit(calls)

## Get a call by id. Returns null if not found.
func get_call(call_id: int) -> Dictionary:
	if calls_by_id.has(call_id):
		return calls_by_id[call_id]
	push_warning("CallData: No call with id %d" % call_id)
	return {}

## Get all calls of a given type string.
func get_calls_by_type(type_str: String) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for call in calls:
		if str(call["type"]) == type_str:
			result.append(call)
	return result

## Get all calls for a given band index.
func get_calls_by_band(band: int) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for call in calls:
		if int(call["band"]) == band:
			result.append(call)
	return result
