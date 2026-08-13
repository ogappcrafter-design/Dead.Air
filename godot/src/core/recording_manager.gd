# recording_manager.gd — Radio tape recording and playback system
# DEA-98: Recording Mechanic
# Source: GDD recording spec (docs/plans/redesign-gdd.md)
# Autoload singleton managing tape recording, playback, slot switching,
# and dangerous tape effects.
extends Node

## Emitted when recording starts. Carries the band/frequency metadata.
signal recording_started(band_id: int, frequency: float)

## Emitted when recording stops. Carries the completed TapeData (or null if failed).
signal recording_stopped(tape: TapeData)

## Emitted when a tape starts playing.
signal tape_playback_started(tape: TapeData)

## Emitted when tape playback finishes or is stopped.
signal tape_playback_stopped(tape: TapeData)

## Emitted when the selected slot changes. Carries the new slot index.
signal slot_changed(slot_index: int)

## Emitted when a dangerous tape triggers a composure penalty.
## Carries the penalty amount (negative int) and whether an entity spawned.
signal danger_triggered(composure_penalty: int, spawned_entity: bool)

## Emitted when the slot count changes (radio upgrade).
signal slot_count_changed(new_count: int)

## Signal threshold for recording (signal must be > this to record).
const SIGNAL_THRESHOLD: float = 50.0

## Default number of recording slots.
const DEFAULT_SLOT_COUNT: int = 5

## Maximum recording slots (with radio upgrade).
const MAX_SLOT_COUNT: int = 8

## Composure penalty for dangerous tapes.
const DANGER_COMPOSURE_PENALTY: int = -20

## Composure penalty for DO NOT PLAY tapes.
const DO_NOT_PLAY_COMPOSURE_PENALTY: int = -50

## Recording duration in seconds (tapes capture ~30s of audio).
const RECORDING_DURATION: float = 30.0

## Number of available recording slots.
var slot_count: int = DEFAULT_SLOT_COUNT

## Currently selected slot index (0-based).
var selected_slot: int = 0

## Whether recording is currently active.
var is_recording: bool = false

## Whether a tape is currently playing.
var is_playing: bool = false

## The tape currently being played (null if not playing).
var current_playing_tape: TapeData = null

## Recording slots: Array of TapeData or null.
var slots: Array = []

# Internal: recording state
var _recording_band_id: int = -1
var _recording_frequency: float = 0.0
var _recording_timer: float = 0.0
var _recording_tape: TapeData = null
var _recording_slot: int = -1

# Internal: playback timer
var _playback_timer: float = 0.0

# Internal: references (set by _ready or externally)
# Typed as Node to avoid class_name resolution issues at runtime.
var _radio_tuner: Node = null
var _dread_composure: Node = null


func _ready() -> void:
	_init_slots()
	# Try to find RadioTuner and DreadComposure in the scene tree.
	# They may not be autoloads, so we look for them after the first frame.
	call_deferred("_find_references")


func _init_slots() -> void:
	slots.clear()
	for i in range(MAX_SLOT_COUNT):
		slots.append(null)
	slot_count = DEFAULT_SLOT_COUNT
	selected_slot = 0


func _find_references() -> void:
	# RadioTuner and DreadComposure are not autoloads — they are instantiated
	# by the game scene. We search the tree for them.
	_radio_tuner = _find_node_of_type("RadioTuner")
	_dread_composure = _find_node_of_type("DreadComposure")


func _find_node_of_type(class_name_str: String) -> Node:
	var root = get_tree().current_scene
	if root == null:
		return null
	return _find_node_recursive(root, class_name_str)


func _find_node_recursive(node: Node, class_name_str: String) -> Node:
	if node.is_class(class_name_str) or node.get_class() == class_name_str:
		return node
	if node.has_method("get_script") and node.get_script() != null:
		var script = node.get_script()
		if script.has_method("get_global_name") and script.get_global_name() == class_name_str:
			return node
	for child in node.get_children():
		var found = _find_node_recursive(child, class_name_str)
		if found != null:
			return found
	return null


func _process(delta: float) -> void:
	if is_recording:
		_recording_timer += delta
		if _recording_timer >= RECORDING_DURATION:
			_stop_recording()
		else:
			# Check if signal dropped below threshold during recording.
			if _radio_tuner != null:
				var signal_val = _radio_tuner.get_signal()
				if signal_val < SIGNAL_THRESHOLD:
					_stop_recording()

	if is_playing and current_playing_tape != null:
		_playback_timer += delta
		# Parse duration string "M:SS" to seconds for playback timeout.
		var duration_sec = _parse_duration(current_playing_tape.duration)
		if duration_sec > 0.0 and _playback_timer >= duration_sec:
			_stop_playback()


## Toggle recording on/off. Requires signal > threshold to start.
func toggle_recording() -> void:
	if is_playing:
		return  # Cannot record while playing a tape.
	if is_recording:
		_stop_recording()
	else:
		_start_recording()


func _start_recording() -> void:
	if _radio_tuner == null:
		_find_references()
	if _radio_tuner == null:
		return  # No radio tuner available.

	var signal_val = _radio_tuner.get_signal()
	if signal_val <= SIGNAL_THRESHOLD:
		return  # Signal too weak to record.

	# Find a free slot.
	var free_slot = _find_free_slot()
	if free_slot == -1:
		return  # All slots full.

	_recording_band_id = _radio_tuner.current_band_id
	_recording_frequency = _radio_tuner.current_frequency
	_recording_timer = 0.0
	is_recording = true
	selected_slot = free_slot
	_recording_slot = free_slot

	# Create a placeholder TapeData for the recording.
	_recording_tape = TapeData.new()
	_recording_tape.tape_id = "rec-slot-%d" % free_slot
	_recording_tape.display_name = "Recording Slot %d" % (free_slot + 1)
	_recording_tape.title = "Recorded Broadcast"
	_recording_tape.description = "A recording captured on the radio."
	var current_band = _radio_tuner.get_current_band()
	_recording_tape.band = current_band.name if current_band != null else "Unknown"
	_recording_tape.duration = _format_duration(RECORDING_DURATION)
	_recording_tape.rarity = "common"
	_recording_tape.linked_call_id = -1
	_recording_tape.is_recording = true
	_recording_tape.recorded_band_id = _recording_band_id
	_recording_tape.recorded_frequency = _recording_frequency

	recording_started.emit(_recording_band_id, _recording_frequency)


func _stop_recording() -> void:
	if not is_recording:
		return

	is_recording = false
	var completed_tape = _recording_tape
	_recording_tape = null

	if completed_tape != null:
		# Finalize the recording: mark as no longer recording in-progress.
		completed_tape.is_recording = true  # It IS a recording (stays true)
		# Store in the slot that was selected when recording started.
		slots[_recording_slot] = completed_tape

	recording_stopped.emit(completed_tape)

	_recording_timer = 0.0
	_recording_band_id = -1
	_recording_frequency = 0.0
	_recording_slot = -1


## Play the tape in the currently selected slot.
func play_selected_tape() -> void:
	if is_recording:
		return  # Cannot play while recording.
	if is_playing:
		_stop_playback()
		return  # Toggle: stop if already playing.

	var tape = slots[selected_slot]
	if tape == null:
		return  # No tape in this slot.

	is_playing = true
	current_playing_tape = tape
	_playback_timer = 0.0

	tape_playback_started.emit(tape)

	# Apply dangerous tape effects.
	if tape.is_dangerous:
		var penalty = (
			tape.composure_penalty if tape.composure_penalty != 0 else DANGER_COMPOSURE_PENALTY
		)
		var spawned = tape.spawns_entity

		if _dread_composure != null:
			_dread_composure.add_composure(penalty)

		danger_triggered.emit(penalty, spawned)


## Stop the current tape playback.
func stop_playback() -> void:
	_stop_playback()


func _stop_playback() -> void:
	if not is_playing:
		return
	var tape = current_playing_tape
	is_playing = false
	current_playing_tape = null
	_playback_timer = 0.0
	tape_playback_stopped.emit(tape)


## Switch to the previous slot (wraps around).
func switch_to_prev_slot() -> void:
	var new_slot = selected_slot - 1
	if new_slot < 0:
		new_slot = slot_count - 1
	selected_slot = new_slot
	slot_changed.emit(selected_slot)


## Switch to the next slot (wraps around).
func switch_to_next_slot() -> void:
	var new_slot = (selected_slot + 1) % slot_count
	selected_slot = new_slot
	slot_changed.emit(selected_slot)


## Select a specific slot by index.
func select_slot(index: int) -> void:
	if index < 0 or index >= slot_count:
		return
	selected_slot = index
	slot_changed.emit(selected_slot)


## Expand slot count (radio upgrade). Can go up to MAX_SLOT_COUNT.
func expand_slots(new_count: int = -1) -> void:
	if new_count < 0:
		new_count = slot_count + 1
	new_count = clamp(new_count, slot_count, MAX_SLOT_COUNT)
	if new_count == slot_count:
		return
	slot_count = new_count
	slot_count_changed.emit(slot_count)


## Get the tape in the selected slot (or null if empty).
func get_selected_tape() -> TapeData:
	if selected_slot < 0 or selected_slot >= slots.size():
		return null
	return slots[selected_slot]


## Get the tape in a specific slot (or null if empty).
func get_tape_in_slot(index: int) -> TapeData:
	if index < 0 or index >= slots.size():
		return null
	return slots[index]


## Check if a slot has a tape.
func is_slot_occupied(index: int) -> bool:
	return get_tape_in_slot(index) != null


## Get the number of occupied slots.
func get_occupied_count() -> int:
	var count = 0
	for i in range(slot_count):
		if slots[i] != null:
			count += 1
	return count


## Find the first free (empty) slot. Returns -1 if all slots are full.
func _find_free_slot() -> int:
	for i in range(slot_count):
		if slots[i] == null:
			return i
	return -1


## Clear all slots and reset state (new game / reset).
func reset() -> void:
	if is_recording:
		_stop_recording()
	if is_playing:
		_stop_playback()
	_init_slots()
	selected_slot = 0


## Set references externally (for testing or scene wiring).
func set_radio_tuner(tuner: Node) -> void:
	_radio_tuner = tuner


func set_dread_composure(dc: Node) -> void:
	_dread_composure = dc


## Serialize recording state to dictionary (for save system).
func to_dict() -> Dictionary:
	var slot_data: Array = []
	for i in range(slot_count):
		if slots[i] != null:
			var tape: TapeData = slots[i]
			(
				slot_data
				. append(
					{
						"tape_id": tape.tape_id,
						"display_name": tape.display_name,
						"title": tape.title,
						"description": tape.description,
						"band": tape.band,
						"duration": tape.duration,
						"rarity": tape.rarity,
						"linked_call_id": tape.linked_call_id,
						"is_recording": tape.is_recording,
						"recorded_band_id": tape.recorded_band_id,
						"recorded_frequency": tape.recorded_frequency,
						"is_dangerous": tape.is_dangerous,
						"composure_penalty": tape.composure_penalty,
						"spawns_entity": tape.spawns_entity,
					}
				)
			)
		else:
			slot_data.append(null)
	return {
		"slot_count": slot_count,
		"selected_slot": selected_slot,
		"slots": slot_data,
	}


## Deserialize recording state from dictionary (for save system).
func from_dict(data: Dictionary) -> void:
	reset()
	slot_count = int(data.get("slot_count", DEFAULT_SLOT_COUNT))
	slot_count = clamp(slot_count, DEFAULT_SLOT_COUNT, MAX_SLOT_COUNT)
	selected_slot = int(data.get("selected_slot", 0))
	selected_slot = clamp(selected_slot, 0, slot_count - 1)
	var slot_data: Array = data.get("slots", [])
	for i in range(mini(slot_data.size(), slots.size())):
		if slot_data[i] == null:
			slots[i] = null
		else:
			var d: Dictionary = slot_data[i]
			var tape = TapeData.new()
			tape.tape_id = d.get("tape_id", "")
			tape.display_name = d.get("display_name", "")
			tape.title = d.get("title", "")
			tape.description = d.get("description", "")
			tape.band = d.get("band", "")
			tape.duration = d.get("duration", "")
			tape.rarity = d.get("rarity", "")
			tape.linked_call_id = int(d.get("linked_call_id", -1))
			tape.is_recording = bool(d.get("is_recording", false))
			tape.recorded_band_id = int(d.get("recorded_band_id", -1))
			tape.recorded_frequency = float(d.get("recorded_frequency", 0.0))
			tape.is_dangerous = bool(d.get("is_dangerous", false))
			tape.composure_penalty = int(d.get("composure_penalty", -20))
			tape.spawns_entity = bool(d.get("spawns_entity", false))
			slots[i] = tape


# --- Internal helpers ---


## Format seconds as "M:SS".
func _format_duration(seconds: float) -> String:
	var mins = int(seconds) / 60
	var secs = int(seconds) % 60
	return "%d:%02d" % [mins, secs]


## Parse "M:SS" duration string to seconds. Returns 0.0 on failure.
func _parse_duration(duration_str: String) -> float:
	if duration_str == null or duration_str.is_empty():
		return 0.0
	var parts = duration_str.split(":")
	if parts.size() != 2:
		return 0.0
	return float(parts[0]) * 60.0 + float(parts[1])


## Reset for testing.
func _reset_for_testing() -> void:
	reset()
