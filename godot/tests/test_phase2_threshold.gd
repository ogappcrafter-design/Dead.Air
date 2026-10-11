## test_phase2_threshold.gd — Tests for DEA-117 Segment 2A "The Threshold".
## Verifies: segment starts (Phase 2 active), station door sealed behind
## player (becomes wall, no return), backward movement blocked, forward
## progress allowed, exit door triggers exit_reached, shift 5 completion
## emits phase2_transition_ready, and reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase2Threshold"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_segment_start_sets_phase2"] = await test_segment_start_sets_phase2()
	results["test_station_door_sealed"] = await test_station_door_sealed()
	results["test_backward_blocked"] = await test_backward_blocked()
	results["test_forward_allowed"] = await test_forward_allowed()
	results["test_exit_reached_signal"] = await test_exit_reached_signal()
	results["test_shift5_emits_phase2_transition"] = await test_shift5_emits_phase2_transition()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase2/threshold.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_segment_start_sets_phase2() -> bool:
	var segment: Node = _load_segment()
	var ok := true
	# start_segment runs deferred in _ready; give it a frame
	await _wait_frames(3)
	if not segment.is_started():
		ok = false
	if ok and PhaseManager.get_phase() != PhaseEnums.Phase.PHASE_2_BREAK:
		ok = false
	_cleanup_segment(segment)
	return ok

func test_station_door_sealed() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_station_door_sealed()
	if ok:
		var door: Node3D = segment.get_node_or_null("Hallway/StationDoor")
		ok = door != null and not door.visible
	if ok:
		var wall: Node = segment.get_node_or_null("Hallway/SealedWall")
		ok = wall != null
	_cleanup_segment(segment)
	return ok

func test_backward_blocked() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_cleanup_segment(segment)
		return false
	var start_x: float = player.global_position.x
	# Walk forward to establish furthest progress, then try to go back
	player.global_position.x = start_x + 5.0
	segment._physics_process(0.016)
	player.velocity.x = -5.0
	player.global_position.x = start_x + 3.0
	segment._physics_process(0.016)
	segment._physics_process(0.016)
	# Must clamp back to the furthest forward point, not the retreat target
	var ok: bool = player.global_position.x >= start_x + 5.0 - 0.001
	_cleanup_segment(segment)
	return ok

func test_forward_allowed() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_cleanup_segment(segment)
		return false
	var start_x: float = player.global_position.x
	# Simulate forward movement (via global_position, velocity positive)
	player.velocity.x = 3.0
	player.global_position.x = start_x + 1.0
	segment._physics_process(0.016)
	var ok: bool = player.global_position.x > start_x
	_cleanup_segment(segment)
	return ok

func test_exit_reached_signal() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [false]
	segment.exit_reached.connect(func() -> void: got[0] = true)
	# Simulate the player body entering the exit door area
	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_cleanup_segment(segment)
		return false
	segment._on_exit_door_entered(player)
	var ok: bool = got[0]
	_cleanup_segment(segment)
	return ok

func test_shift5_emits_phase2_transition() -> bool:
	ShiftController._reset_for_testing()
	ShiftController._set_testing_mode(true)
	var got := [false]
	ShiftController.phase2_transition_ready.connect(func() -> void: got[0] = true)

	ShiftController.start_shift(5)
	ShiftController._force_complete_shift()

	var ok: bool = got[0]

	# Shift 4 must NOT emit it
	var got4 := [false]
	var handler := func() -> void: got4[0] = true
	ShiftController.phase2_transition_ready.connect(handler)
	ShiftController.start_shift(4)
	ShiftController._force_complete_shift()
	ShiftController.phase2_transition_ready.disconnect(handler)
	if got4[0]:
		ok = false

	ShiftController._reset_for_testing()
	return ok

func test_reset_restores_phase1() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment._reset_for_testing()
	var ok: bool = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_1_STATION
	segment.queue_free()
	return ok

func _wait_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).process_frame
