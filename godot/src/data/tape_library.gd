# tape_library.gd — Container for all tape data
# DEA-149: React Native → Godot asset migration
class_name TapeLibrary
extends Resource

## All 15 base tapes in canonical order (Tape #1 through Tape #15)
@export var tapes: Array[TapeData] = []

## Lookup tape by index (0-based, matches ALL_TAPES order)
func get_tape(index: int) -> TapeData:
	if index >= 0 and index < tapes.size():
		return tapes[index]
	push_error("TapeLibrary: No tape at index %d" % index)
	return null

## Lookup tape by display name
func get_tape_by_name(tape_name: String) -> TapeData:
	for tape in tapes:
		if tape.display_name == tape_name:
			return tape
	push_error("TapeLibrary: No tape named '%s'" % tape_name)
	return null

## Lookup tape by tape_id (from tapes.ts)
func get_tape_by_id(tape_id: String) -> TapeData:
	for tape in tapes:
		if tape.tape_id == tape_id:
			return tape
	push_error("TapeLibrary: No tape with id '%s'" % tape_id)
	return null

## Get tapes linked to a specific call
func get_tapes_for_call(call_id: int) -> Array[TapeData]:
	var result: Array[TapeData] = []
	for tape in tapes:
		if tape.linked_call_id == call_id:
			result.append(tape)
	return result

## Get tape count
func get_tape_count() -> int:
	return tapes.size()
