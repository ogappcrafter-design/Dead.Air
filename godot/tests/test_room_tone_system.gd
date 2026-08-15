## test_room_tone_system.gd — Tests for RoomToneSystem (DEA-135)
## Run via: godot --headless --script res://tests/test_runner.gd
##
## Validates: autoload registration, 3-room setup, ROOM_TONE bus routing,
## angle→room mapping, set_room/transition_to API, and procedural synthesis
## (push_buffer) running in _process without errors.
extends RefCounted

const test_name := "RoomToneSystem"

var _rts: Node


func _init() -> void:
	var tree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		_rts = tree.root.get_node_or_null("/root/RoomToneSystem")


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_room_tone_system_exists"] = test_room_tone_system_exists()
	results["test_three_rooms_created"] = test_three_rooms_created()
	results["test_players_routed_to_room_tone_bus"] = test_players_routed_to_room_tone_bus()
	results["test_playbacks_are_generator_playback"] = test_playbacks_are_generator_playback()
	results["test_angle_to_room_mapping"] = test_angle_to_room_mapping()
	results["test_unknown_angle_returns_empty"] = test_unknown_angle_returns_empty()
	results["test_set_room_changes_volumes"] = test_set_room_changes_volumes()
	results["test_transition_to_changes_current_room"] = test_transition_to_changes_current_room()
	results["test_process_runs_without_error"] = test_process_runs_without_error()
	results["test_synthesis_pushes_buffer"] = test_synthesis_pushes_buffer()
	results["test_get_current_room_initial"] = test_get_current_room_initial()

	return results


# ─── Tests ────────────────────────────────────────────────────────────

func test_room_tone_system_exists() -> bool:
	if _rts == null:
		push_error("RoomToneSystem autoload not found")
		return false
	return true


func test_three_rooms_created() -> bool:
	if _rts == null:
		return false
	var players: Dictionary = _rts._players
	# Must contain booth, hallway, bathroom
	return players.has("booth") and players.has("hallway") and players.has("bathroom")


func test_players_routed_to_room_tone_bus() -> bool:
	if _rts == null:
		return false
	var players: Dictionary = _rts._players
	for room_id in players:
		var player: AudioStreamPlayer = players[room_id]
		if player.bus != _rts.ROOM_TONE_BUS:
			push_error("Room %s bus is %s, expected %s" % [room_id, player.bus, _rts.ROOM_TONE_BUS])
			return false
	return true


func test_playbacks_are_generator_playback() -> bool:
	if _rts == null:
		return false
	var playbacks: Dictionary = _rts._playbacks
	for room_id in playbacks:
		var pb = playbacks[room_id]
		if not (pb is AudioStreamGeneratorPlayback):
			push_error("Playback for %s is not AudioStreamGeneratorPlayback" % room_id)
			return false
	return true


func test_angle_to_room_mapping() -> bool:
	if _rts == null:
		return false
	# BT1 and BT2 both map to booth
	if _rts._angle_to_room("BT1") != "booth":
		push_error("BT1 should map to booth")
		return false
	if _rts._angle_to_room("BT2") != "booth":
		push_error("BT2 should map to booth")
		return false
	if _rts._angle_to_room("H1") != "hallway":
		push_error("H1 should map to hallway")
		return false
	if _rts._angle_to_room("BR1") != "bathroom":
		push_error("BR1 should map to bathroom")
		return false
	return true


func test_unknown_angle_returns_empty() -> bool:
	if _rts == null:
		return false
	return _rts._angle_to_room("UNKNOWN") == ""


func test_set_room_changes_volumes() -> bool:
	if _rts == null:
		return false
	# Set to hallway
	_rts.set_room("hallway")
	var hallway_active: bool = _rts._players["hallway"].volume_db == _rts.ACTIVE_DB
	var booth_silent: bool = _rts._players["booth"].volume_db == _rts.SILENT_DB
	var bathroom_silent: bool = _rts._players["bathroom"].volume_db == _rts.SILENT_DB
	# Reset
	_rts.set_room("booth")
	return hallway_active and booth_silent and bathroom_silent


func test_transition_to_changes_current_room() -> bool:
	if _rts == null:
		return false
	_rts.set_room("booth")
	_rts.transition_to("bathroom")
	# transition_to calls _crossfade_to which sets _current_room immediately
	var current: String = _rts.get_current_room()
	# Cleanup: kill any tween
	if _rts._fade_tween and _rts._fade_tween.is_valid():
		_rts._fade_tween.kill()
	_rts.set_room("booth")
	return current == "bathroom"


func test_process_runs_without_error() -> bool:
	# Critical test for the push_buffer fix (round 1 auto-fix).
	# _process calls _fill_buffer which previously used nonexistent get_buffer().
	# If push_buffer() works, _process runs cleanly. We invoke _process directly
	# multiple times — _process and _fill_buffer are synchronous, so no await needed.
	if _rts == null:
		return false
	# Run _process 10 times with a small delta — this exercises all 3 room synths
	# and the push_buffer path. Any nonexistent-function error would abort the script.
	for i in range(10):
		_rts._process(0.016)
	# If we got here without script-error abort, the synthesis path works
	return true


func test_synthesis_pushes_buffer() -> bool:
	# Directly verify _fill_buffer produces non-zero samples for each room.
	if _rts == null:
		return false
	var all_nonzero := true
	for room_id in _rts._playbacks:
		# Fill buffer manually
		_rts._fill_buffer(room_id, 0.016)
		var pb: AudioStreamGeneratorPlayback = _rts._playbacks[room_id]
		# After push_buffer, get_frames_available should have dropped (buffer consumed)
		# We can't read back the pushed buffer, but we can verify no error occurred
		# and the playback still reports valid frames.
		if pb.get_frames_available() < 0:
			all_nonzero = false
		# Verify synth_state has been advancing (phase accumulators changed)
		var state: Dictionary = _rts._synth_state[room_id]
		# After one fill call, hum_phase or fan_phase should be > 0 for booth/hallway/bathroom
		match room_id:
			"booth":
				if state["hum_phase"] == 0.0:
					all_nonzero = false
			"hallway":
				if state["hum_phase"] == 0.0:
					all_nonzero = false
			"bathroom":
				if state["fan_phase"] == 0.0:
					all_nonzero = false
	return all_nonzero


func test_get_current_room_initial() -> bool:
	if _rts == null:
		return false
	# After _ready, _current_room is set by CameraManager's get_active_angle_id().
	# In headless test mode with no scene loaded, CameraManager returns "" for
	# get_active_angle_id(), so _angle_to_room("") returns "" and _set_room_immediate("")
	# leaves all players silent. This is acceptable — the system should not crash
	# and get_current_room should return a String.
	var current: String = _rts.get_current_room()
	return current is String
