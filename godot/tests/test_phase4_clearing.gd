## test_phase4_clearing.gd — Tests for DEA-128 Phase 4 Step 1 "The Clearing".
## Verifies: forest clearing start on PHASE_4_DESCENT, redacted band only
## (strong, constant), no room tone (world buses muted), ORIGIN call starts
## automatically, fragments discoverable, tower reach completes the step,
## reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase4Clearing"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_starts_in_phase4"] = await test_starts_in_phase4()
	results["test_redacted_band_strong_constant"] = await test_redacted_band_strong_constant()
	results["test_world_buses_muted_no_room_tone"] = await test_world_buses_muted_no_room_tone()
	results["test_origin_call_starts_automatically"] = await test_origin_call_starts_automatically()
	results["test_fragments_discoverable"] = await test_fragments_discoverable()
	results["test_tower_reach_completes"] = await test_tower_reach_completes()
	results["test_tower_proximity_enters_tower_phase"] = await test_tower_proximity_enters_tower_phase()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase4/clearing.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_starts_in_phase4() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_4_DESCENT
	if ok:
		ok = segment.get_phase_name() == "EXPLORE"
	_cleanup_segment(segment)
	return ok

func test_redacted_band_strong_constant() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_radio_band_id() == 4
	if ok:
		ok = segment.get_radio_signal() >= 80.0
	if ok:
		for i in range(10):
			segment._process(0.5)
		ok = segment.get_radio_signal() >= 80.0
	_cleanup_segment(segment)
	return ok

func test_world_buses_muted_no_room_tone() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var rt_idx: int = AudioServer.get_bus_index("ROOM_TONE")
	var ok: bool = AudioServer.is_bus_mute(rt_idx)
	if ok:
		var call_idx: int = AudioServer.get_bus_index("CALL_AUDIO")
		ok = AudioServer.is_bus_mute(call_idx)
	_cleanup_segment(segment)
	return ok

func test_origin_call_starts_automatically() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	# The signal fires during start_segment (before the test can connect);
	# the flag is the durable state.
	var ok: bool = segment.is_origin_call_started()
	if ok:
		ok = segment.get_node_or_null("OriginVoice") != null
	_cleanup_segment(segment)
	return ok

func test_fragments_discoverable() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_fragments_found().is_empty()
	if ok:
		segment.find_fragment_for_testing("machine")
		segment.find_fragment_for_testing("grave")
		segment.find_fragment_for_testing("farmhouse")
		ok = segment.get_fragments_found().size() == 3
	_cleanup_segment(segment)
	return ok

func test_tower_reach_completes() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_tower := [false]
	var got_complete := [false]
	segment.tower_reached.connect(func() -> void: got_tower[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	segment.force_tower_reach_for_testing()
	var ok: bool = got_tower[0]
	if ok:
		await _wait_frames(2)
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		await tree.create_timer(1.8).timeout
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_tower_proximity_enters_tower_phase() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player = segment.get_player()
	player.global_position = Vector3(0, 0.5, -32)
	segment._process(0.016)
	var ok: bool = segment.get_phase_name() == "TOWER"
	_cleanup_segment(segment)
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
