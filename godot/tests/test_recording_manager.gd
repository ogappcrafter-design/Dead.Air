extends RefCounted
## Tests for RecordingManager autoload.
##
## Verifies slot initialization, recording toggle, playback,
## dangerous tape effects, slot switching, expansion, and serialization.

var test_name: String = "RecordingManager"

var _recording_started_count: int = 0
var _recording_started_band: int = -1
var _recording_started_freq: float = 0.0
var _recording_stopped_count: int = 0
var _playback_started_count: int = 0
var _playback_stopped_count: int = 0
var _slot_changed_count: int = 0
var _slot_changed_arg: int = -1
var _danger_triggered_count: int = 0
var _danger_penalty: int = 0
var _danger_spawned: bool = false
var _slot_count_changed_count: int = 0
var _slot_count_changed_arg: int = 0


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_slot_initialization"] = test_slot_initialization()
	results["test_slot_switching_wrap"] = test_slot_switching_wrap()
	results["test_select_slot"] = test_select_slot()
	results["test_slot_expansion"] = test_slot_expansion()
	results["test_recording_requires_signal"] = test_recording_requires_signal()
	results["test_recording_toggle"] = test_recording_toggle()
	results["test_recording_auto_stop_duration"] = test_recording_auto_stop_duration()
	results["test_recording_auto_stop_low_signal"] = test_recording_auto_stop_low_signal()
	results["test_playback_start_stop"] = test_playback_start_stop()
	results["test_dangerous_tape_effect"] = test_dangerous_tape_effect()
	results["test_cannot_play_while_recording"] = test_cannot_play_while_recording()
	results["test_cannot_record_while_playing"] = test_cannot_record_while_playing()
	results["test_serialization_roundtrip"] = test_serialization_roundtrip()
	results["test_reset"] = test_reset()
	results["test_occupied_count"] = test_occupied_count()
	_disconnect_signals()
	return results


# ─── Helpers ─────────────────────────────────────────────────────────────────


func _connect_signals() -> void:
	_disconnect_signals()
	_recording_started_count = 0
	_recording_started_band = -1
	_recording_started_freq = 0.0
	_recording_stopped_count = 0
	_playback_started_count = 0
	_playback_stopped_count = 0
	_slot_changed_count = 0
	_slot_changed_arg = -1
	_danger_triggered_count = 0
	_danger_penalty = 0
	_danger_spawned = false
	_slot_count_changed_count = 0
	_slot_count_changed_arg = 0
	RecordingManager.recording_started.connect(_on_recording_started)
	RecordingManager.recording_stopped.connect(_on_recording_stopped)
	RecordingManager.tape_playback_started.connect(_on_playback_started)
	RecordingManager.tape_playback_stopped.connect(_on_playback_stopped)
	RecordingManager.slot_changed.connect(_on_slot_changed)
	RecordingManager.danger_triggered.connect(_on_danger_triggered)
	RecordingManager.slot_count_changed.connect(_on_slot_count_changed)


func _disconnect_signals() -> void:
	if RecordingManager.recording_started.is_connected(_on_recording_started):
		RecordingManager.recording_started.disconnect(_on_recording_started)
	if RecordingManager.recording_stopped.is_connected(_on_recording_stopped):
		RecordingManager.recording_stopped.disconnect(_on_recording_stopped)
	if RecordingManager.tape_playback_started.is_connected(_on_playback_started):
		RecordingManager.tape_playback_started.disconnect(_on_playback_started)
	if RecordingManager.tape_playback_stopped.is_connected(_on_playback_stopped):
		RecordingManager.tape_playback_stopped.disconnect(_on_playback_stopped)
	if RecordingManager.slot_changed.is_connected(_on_slot_changed):
		RecordingManager.slot_changed.disconnect(_on_slot_changed)
	if RecordingManager.danger_triggered.is_connected(_on_danger_triggered):
		RecordingManager.danger_triggered.disconnect(_on_danger_triggered)
	if RecordingManager.slot_count_changed.is_connected(_on_slot_count_changed):
		RecordingManager.slot_count_changed.disconnect(_on_slot_count_changed)


func _reset() -> void:
	RecordingManager._reset_for_testing()
	_connect_signals()


func _on_recording_started(band_id: int, frequency: float) -> void:
	_recording_started_count += 1
	_recording_started_band = band_id
	_recording_started_freq = frequency


func _on_recording_stopped(_tape: TapeData) -> void:
	_recording_stopped_count += 1


func _on_playback_started(_tape: TapeData) -> void:
	_playback_started_count += 1


func _on_playback_stopped(_tape: TapeData) -> void:
	_playback_stopped_count += 1


func _on_slot_changed(slot_index: int) -> void:
	_slot_changed_count += 1
	_slot_changed_arg = slot_index


func _on_danger_triggered(penalty: int, spawned: bool) -> void:
	_danger_triggered_count += 1
	_danger_penalty = penalty
	_danger_spawned = spawned


func _on_slot_count_changed(new_count: int) -> void:
	_slot_count_changed_count += 1
	_slot_count_changed_arg = new_count


class MockTuner:
	extends Node
	var current_band_id: int = 0
	var current_frequency: float = 0.0
	var _signal_value: float = 0.0

	func set_signal(value: float) -> void:
		_signal_value = value

	func get_signal() -> float:
		return _signal_value

	func get_current_band() -> BandData:
		return null


class MockComposure:
	extends Node
	var composure: float = 100.0
	var dread: float = 0.0

	func set_composure(level: float) -> void:
		composure = clampf(level, 0.0, 100.0)

	func add_composure(amount: float) -> void:
		composure = clampf(composure + amount, 0.0, 100.0)


func _make_tape(
	is_dangerous: bool = false, composure_penalty: int = -20, spawns_entity: bool = false
) -> TapeData:
	var tape = TapeData.new()
	tape.tape_id = "test-tape"
	tape.display_name = "Test Tape"
	tape.title = "Test"
	tape.description = "A test tape."
	tape.band = "LIVING"
	tape.duration = "0:10"
	tape.rarity = "common"
	tape.linked_call_id = -1
	tape.is_recording = false
	tape.recorded_band_id = 0
	tape.recorded_frequency = 98.5
	tape.is_dangerous = is_dangerous
	tape.composure_penalty = composure_penalty
	tape.spawns_entity = spawns_entity
	return tape


# ─── Tests ────────────────────────────────────────────────────────────────────


func test_slot_initialization() -> bool:
	_reset()
	# Default 5 slots, all empty, selected = 0.
	if RecordingManager.slot_count != 5:
		return false
	if RecordingManager.selected_slot != 0:
		return false
	if RecordingManager.get_occupied_count() != 0:
		return false
	for i in range(5):
		if RecordingManager.is_slot_occupied(i):
			return false
	return true


func test_slot_switching_wrap() -> bool:
	_reset()
	# Next slot: 0 → 1 → 2 → 3 → 4 → 0 (wrap)
	RecordingManager.switch_to_next_slot()
	if RecordingManager.selected_slot != 1:
		return false
	if _slot_changed_count != 1 or _slot_changed_arg != 1:
		return false

	RecordingManager.switch_to_next_slot()
	RecordingManager.switch_to_next_slot()
	RecordingManager.switch_to_next_slot()
	if RecordingManager.selected_slot != 4:
		return false

	RecordingManager.switch_to_next_slot()  # wraps to 0
	if RecordingManager.selected_slot != 0:
		return false

	# Prev slot: 0 → 4 (wrap backward)
	RecordingManager.switch_to_prev_slot()
	if RecordingManager.selected_slot != 4:
		return false

	return true


func test_select_slot() -> bool:
	_reset()
	RecordingManager.select_slot(3)
	if RecordingManager.selected_slot != 3:
		return false
	if _slot_changed_count != 1 or _slot_changed_arg != 3:
		return false

	# Out of range rejected
	RecordingManager.select_slot(99)
	if RecordingManager.selected_slot != 3:
		return false
	RecordingManager.select_slot(-1)
	if RecordingManager.selected_slot != 3:
		return false

	return true


func test_slot_expansion() -> bool:
	_reset()
	# Default is 5, expand to 8.
	RecordingManager.expand_slots(8)
	if RecordingManager.slot_count != 8:
		return false
	if _slot_count_changed_count != 1 or _slot_count_changed_arg != 8:
		return false

	# Can't exceed MAX (8).
	RecordingManager.expand_slots(10)
	if RecordingManager.slot_count != 8:
		return false

	# Can't go below DEFAULT (5).
	RecordingManager.expand_slots(3)
	if RecordingManager.slot_count != 8:
		return false

	# Increment by 1 if no arg.
	_reset()
	RecordingManager.expand_slots()  # 5 → 6
	if RecordingManager.slot_count != 6:
		return false

	return true


func test_recording_requires_signal() -> bool:
	_reset()
	# No radio tuner set — toggle should not start recording.
	RecordingManager.set_radio_tuner(null)
	RecordingManager.toggle_recording()
	if RecordingManager.is_recording:
		return false
	if _recording_started_count != 0:
		return false
	return true


func test_recording_toggle() -> bool:
	_reset()
	# Create a radio tuner with strong signal.
	var tuner = MockTuner.new()
	tuner.current_band_id = 1
	tuner.current_frequency = 101.3
	tuner.set_signal(80.0)
	RecordingManager.set_radio_tuner(tuner)

	# Start recording.
	RecordingManager.toggle_recording()
	if not RecordingManager.is_recording or _recording_started_count != 1:
		return false
	if _recording_started_band != 1 or _recording_started_freq != 101.3:
		return false

	# Stop recording manually.
	RecordingManager.toggle_recording()
	if RecordingManager.is_recording or _recording_stopped_count != 1:
		return false

	# A tape should now occupy the selected slot with recording metadata.
	var tape = RecordingManager.get_tape_in_slot(0)
	if tape == null or not tape.is_recording:
		return false
	if tape.recorded_band_id != 1 or tape.recorded_frequency != 101.3:
		return false

	return true


func test_recording_auto_stop_duration() -> bool:
	_reset()
	var tuner = MockTuner.new()
	tuner.current_band_id = 1
	tuner.current_frequency = 101.3
	tuner.set_signal(80.0)
	RecordingManager.set_radio_tuner(tuner)

	RecordingManager.toggle_recording()
	if not RecordingManager.is_recording:
		return false

	# Simulate time passing beyond RECORDING_DURATION (30s).
	RecordingManager._process(35.0)

	if RecordingManager.is_recording:
		return false
	if _recording_stopped_count != 1:
		return false

	return true


func test_recording_auto_stop_low_signal() -> bool:
	_reset()
	var tuner = MockTuner.new()
	tuner.current_band_id = 0
	tuner.current_frequency = 92.0
	tuner.set_signal(65.0)
	RecordingManager.set_radio_tuner(tuner)

	RecordingManager.toggle_recording()
	if not RecordingManager.is_recording:
		return false

	# Signal drops below threshold.
	tuner.set_signal(30.0)
	RecordingManager._process(0.5)

	if RecordingManager.is_recording:
		return false
	if _recording_stopped_count != 1:
		return false

	return true


func test_playback_start_stop() -> bool:
	_reset()
	# Put a tape in slot 0.
	var tape = _make_tape()
	RecordingManager.slots[0] = tape
	RecordingManager.select_slot(0)

	# Start playback.
	RecordingManager.play_selected_tape()
	if not RecordingManager.is_playing:
		return false
	if RecordingManager.current_playing_tape != tape:
		return false
	if _playback_started_count != 1:
		return false

	# Stop playback.
	RecordingManager.stop_playback()
	if RecordingManager.is_playing:
		return false
	if _playback_stopped_count != 1:
		return false

	return true


func test_dangerous_tape_effect() -> bool:
	_reset()
	# Create a MockComposure to verify penalty.
	var dc = MockComposure.new()
	dc.set_composure(80.0)
	RecordingManager.set_dread_composure(dc)

	# Dangerous tape: -20 composure, no entity spawn.
	var tape = _make_tape(true, -20, false)
	RecordingManager.slots[0] = tape
	RecordingManager.select_slot(0)

	RecordingManager.play_selected_tape()
	if _playback_started_count != 1:
		return false
	if _danger_triggered_count != 1:
		return false
	if _danger_penalty != -20:
		return false
	if _danger_spawned != false:
		return false

	# Composure should have dropped by 20.
	if dc.composure != 60.0:
		return false

	return true


func test_cannot_play_while_recording() -> bool:
	_reset()
	var tuner = MockTuner.new()
	tuner.current_band_id = 0
	tuner.current_frequency = 95.0
	tuner.set_signal(70.0)
	RecordingManager.set_radio_tuner(tuner)

	# Put a tape in a slot.
	var tape = _make_tape()
	RecordingManager.slots[0] = tape

	RecordingManager.toggle_recording()
	if not RecordingManager.is_recording:
		return false

	# Attempt to play should be blocked.
	RecordingManager.play_selected_tape()
	if RecordingManager.is_playing:
		return false
	if _playback_started_count != 0:
		return false

	return true


func test_cannot_record_while_playing() -> bool:
	_reset()
	var tuner = MockTuner.new()
	tuner.current_band_id = 0
	tuner.current_frequency = 95.0
	tuner.set_signal(70.0)
	RecordingManager.set_radio_tuner(tuner)

	var tape = _make_tape()
	RecordingManager.slots[0] = tape
	RecordingManager.select_slot(0)

	RecordingManager.play_selected_tape()
	if not RecordingManager.is_playing:
		return false

	# Attempt to record should be blocked.
	RecordingManager.toggle_recording()
	if RecordingManager.is_recording:
		return false
	if _recording_started_count != 0:
		return false

	return true


func test_serialization_roundtrip() -> bool:
	_reset()
	# Put a tape in slot 1.
	var tape = _make_tape(true, -50, true)
	tape.tape_id = "serial-test"
	tape.title = "Serial"
	RecordingManager.slots[1] = tape
	RecordingManager.select_slot(2)
	RecordingManager.expand_slots(7)

	var data = RecordingManager.to_dict()
	var slot_data: Array = data["slots"]
	if data["slot_count"] != 7 or data["selected_slot"] != 2:
		return false
	if (
		slot_data[1] == null
		or slot_data[1]["tape_id"] != "serial-test"
		or slot_data[1]["is_dangerous"] != true
		or slot_data[1]["composure_penalty"] != -50
		or slot_data[1]["spawns_entity"] != true
	):
		return false

	# Reset and restore.
	RecordingManager._reset_for_testing()
	RecordingManager.from_dict(data)

	if RecordingManager.slot_count != 7 or RecordingManager.selected_slot != 2:
		return false
	var restored = RecordingManager.get_tape_in_slot(1)
	if (
		restored == null
		or restored.tape_id != "serial-test"
		or restored.is_dangerous != true
		or restored.composure_penalty != -50
		or restored.spawns_entity != true
	):
		return false

	return true


func test_reset() -> bool:
	_reset()
	# Put tapes in slots.
	RecordingManager.slots[0] = _make_tape()
	RecordingManager.slots[1] = _make_tape()
	RecordingManager.select_slot(1)
	RecordingManager.expand_slots(8)

	RecordingManager.reset()
	if RecordingManager.slot_count != 5:
		return false
	if RecordingManager.selected_slot != 0:
		return false
	if RecordingManager.get_occupied_count() != 0:
		return false
	if RecordingManager.is_recording:
		return false
	if RecordingManager.is_playing:
		return false

	return true


func test_occupied_count() -> bool:
	_reset()
	RecordingManager.slots[0] = _make_tape()
	RecordingManager.slots[2] = _make_tape()
	RecordingManager.slots[4] = _make_tape()
	if RecordingManager.get_occupied_count() != 3:
		return false
	if not RecordingManager.is_slot_occupied(0):
		return false
	if RecordingManager.is_slot_occupied(1):
		return false
	if not RecordingManager.is_slot_occupied(2):
		return false
	return true
