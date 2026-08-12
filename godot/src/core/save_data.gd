## SaveData — Serializable save state for DEA-153 cassette tape save system.
## Contains the full save data schema per GDD + brief.
## See: docs/plans/redesign-gdd.md (lines 1555-1592) and DEA-153 brief.
class_name SaveData
extends Resource

# --- Progression ---
@export var phase: int = 1
@export var shift: int = 1
@export var position_x: float = 0.0
@export var position_y: float = 0.0
@export var position_z: float = 0.0
@export var camera_zone: String = ""

# --- Radio State ---
@export var radio_band: String = ""
@export var radio_signal: float = 80.0
@export var radio_frequency: float = 0.0

# --- Stress Meters (GDD lines 959-1018) ---
@export var composure: float = 100.0
@export var dread: float = 0.0

# --- Moral Traits (GDD lines 1128-1175) ---
@export var empathy_score: int = 50
@export var self_preservation: int = 50
@export var curiosity: int = 50
@export var sacrifice_count: int = 0
@export var tapes_taken: int = 0
@export var tapes_refused: int = 0
@export var callers_helped: int = 0
@export var callers_abandoned: int = 0

# --- Collection Tracking ---
@export var tapes_collected: Array[String] = []
@export var tapes_consumed: Array[String] = []
@export var bands_unlocked: Array[String] = []

# --- Call History ---
@export var call_history: Array[Dictionary] = []

# --- Station Degradation ---
@export var station_degradation: int = 0

# --- Ending Flags ---
@export var ending_flags: Dictionary = {}

# --- Entity States ---
@export var entity_states: Dictionary = {}

# --- Metadata ---
@export var playtime_seconds: float = 0.0
@export var save_timestamp: String = ""
@export var tape_id: String = ""  # The cassette tape used for this save

# --- Save schema version for forward-compat ---
@export var schema_version: int = 1


## Create a SaveData from a dictionary (e.g. loaded from JSON).
static func from_dict(data: Dictionary) -> SaveData:
	var sd := SaveData.new()
	sd.phase = data.get("phase", 1)
	sd.shift = data.get("shift", 1)
	sd.position_x = data.get("position_x", 0.0)
	sd.position_y = data.get("position_y", 0.0)
	sd.position_z = data.get("position_z", 0.0)
	sd.camera_zone = data.get("camera_zone", "")
	sd.radio_band = data.get("radio_band", "")
	sd.radio_signal = data.get("radio_signal", 80.0)
	sd.radio_frequency = data.get("radio_frequency", 0.0)
	sd.composure = data.get("composure", 100.0)
	sd.dread = data.get("dread", 0.0)
	sd.empathy_score = data.get("empathy_score", 50)
	sd.self_preservation = data.get("self_preservation", 50)
	sd.curiosity = data.get("curiosity", 50)
	sd.sacrifice_count = data.get("sacrifice_count", 0)
	sd.tapes_taken = data.get("tapes_taken", 0)
	sd.tapes_refused = data.get("tapes_refused", 0)
	sd.callers_helped = data.get("callers_helped", 0)
	sd.callers_abandoned = data.get("callers_abandoned", 0)
	sd.tapes_collected = _to_string_array(data.get("tapes_collected", []))
	sd.tapes_consumed = _to_string_array(data.get("tapes_consumed", []))
	sd.bands_unlocked = _to_string_array(data.get("bands_unlocked", []))
	sd.call_history = data.get("call_history", [])
	sd.station_degradation = data.get("station_degradation", 0)
	sd.ending_flags = data.get("ending_flags", {})
	sd.entity_states = data.get("entity_states", {})
	sd.playtime_seconds = data.get("playtime_seconds", 0.0)
	sd.save_timestamp = data.get("save_timestamp", "")
	sd.tape_id = data.get("tape_id", "")
	sd.schema_version = data.get("schema_version", 1)
	return sd


## Convert SaveData to a dictionary for JSON serialization.
func to_dict() -> Dictionary:
	return {
		"phase": phase,
		"shift": shift,
		"position_x": position_x,
		"position_y": position_y,
		"position_z": position_z,
		"camera_zone": camera_zone,
		"radio_band": radio_band,
		"radio_signal": radio_signal,
		"radio_frequency": radio_frequency,
		"composure": composure,
		"dread": dread,
		"empathy_score": empathy_score,
		"self_preservation": self_preservation,
		"curiosity": curiosity,
		"sacrifice_count": sacrifice_count,
		"tapes_taken": tapes_taken,
		"tapes_refused": tapes_refused,
		"callers_helped": callers_helped,
		"callers_abandoned": callers_abandoned,
		"tapes_collected": tapes_collected,
		"tapes_consumed": tapes_consumed,
		"bands_unlocked": bands_unlocked,
		"call_history": call_history,
		"station_degradation": station_degradation,
		"ending_flags": ending_flags,
		"entity_states": entity_states,
		"playtime_seconds": playtime_seconds,
		"save_timestamp": save_timestamp,
		"tape_id": tape_id,
		"schema_version": schema_version,
	}


## Create a deep copy of this SaveData.
func duplicate_data() -> SaveData:
	return SaveData.from_dict(to_dict())


## Apply death/fail penalty per DEA-153 brief:
## Composure -20, signal reset, dread +10, relocate to last save.
func apply_death_penalty() -> void:
	composure = maxf(0.0, composure - 20.0)
	radio_signal = 80.0  # Reset to starting value
	dread = minf(100.0, dread + 10.0)


## Get position as Vector3.
func get_position() -> Vector3:
	return Vector3(position_x, position_y, position_z)


## Set position from Vector3.
func set_position(pos: Vector3) -> void:
	position_x = pos.x
	position_y = pos.y
	position_z = pos.z


## Stamp the save timestamp.
func stamp_timestamp() -> void:
	save_timestamp = Time.get_unix_time_string_from_system()


static func _to_string_array(arr: Array) -> Array[String]:
	var result: Array[String] = []
	for item in arr:
		result.append(str(item))
	return result
