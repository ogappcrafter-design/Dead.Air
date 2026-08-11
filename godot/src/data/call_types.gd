# call_types.gd — Call type enum covering every type in CALLS + constants.ts
# Source: data/calls.js (types used in sacred calls) + lib/constants.ts (full enum)
# DEA-149: React Native → Godot asset migration

# Call types actually used in the 18 sacred calls:
#   RIGHT_ANSWER  — calls 0, 2, 6, 9, 12, 16
#   DEAD_AIR      — calls 1, 5, 17
#   JUST_LISTEN   — calls 3, 7, 8, 10, 11, 14, 15
#   STAY_CALM     — call 4
#   SIGNAL_DECODE — call 13
#
# Additional types from lib/constants.ts (not in sacred calls but needed downstream):
#   RECORDING, MULTI_CALLER, TIMING, PUZZLE, CONVERSATION

enum CallType {
	RIGHT_ANSWER,
	DEAD_AIR,
	JUST_LISTEN,
	SIGNAL_DECODE,
	STAY_CALM,
	RECORDING,
	MULTI_CALLER,
	TIMING,
	PUZZLE,
	CONVERSATION,
}

## Convert a string type name (from JSON data) to the enum value.
static func from_string(type_name: String) -> CallType:
	match type_name:
		"RIGHT_ANSWER": return CallType.RIGHT_ANSWER
		"DEAD_AIR": return CallType.DEAD_AIR
		"JUST_LISTEN": return CallType.JUST_LISTEN
		"SIGNAL_DECODE": return CallType.SIGNAL_DECODE
		"STAY_CALM": return CallType.STAY_CALM
		"RECORDING": return CallType.RECORDING
		"MULTI_CALLER": return CallType.MULTI_CALLER
		"TIMING": return CallType.TIMING
		"PUZZLE": return CallType.PUZZLE
		"CONVERSATION": return CallType.CONVERSATION
		_:
			push_error("Unknown call type: " + type_name)
			return CallType.JUST_LISTEN

## Convert enum value back to string (for serialization/debugging).
static func to_string(type_val: CallType) -> String:
	return CallType.keys()[type_val]
