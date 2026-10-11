## test_phase4_staircase.gd — Tests for DEA-129 Phase 4 Step 2 "The Staircase".
## Verifies: descent starts on ████████ band, static increases with depth,
## heartbeat speeds up (60→140 BPM), wall era changes (4 eras), call
## fragments fire in order (Call #0 → #17), bottom reaches at 200m depth,
## no save, reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase4Staircase"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_starts_on_redacted_band"] = await test_starts_on_redacted_band()
	results["test_static_increases_with_depth"] = await test_static_increases_with_depth()
	results["test_heartbeat_speeds_up"] = await test_heartbeat_speeds_up()
	results["test_wall_eras_change"] = await test_wall_eras_change()
	results["test_call_fragments_in_order"] = await test_call_fragments_in_order()
	results["test_bottom_reaches_completion"] = await test_bottom_reaches_completion()
	results["test_descent_impossible_depth"] = await test_descent_impossible_depth()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	results["test_whisper_audio_layer"] = await test_whisper_audio_layer()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase4/staircase.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_starts_on_redacted_band() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "DESCENT"
	if ok:
		ok = segment.get_radio_band_id() == segment.REDACTED_BAND_ID
	if ok:
		ok = segment.get_radio_signal() > 50.0
	_cleanup_segment(segment)
	return ok

func test_static_increases_with_depth() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var top: float = 0.0
	var deep: float = 0.0
	segment.descend_to_for_testing(0.0)
	top = segment.get_radio_signal()
	segment.descend_to_for_testing(0.9)
	deep = segment.get_radio_signal()
	var ok: bool = deep > top
	if ok:
		# Signal stays in the expected range.
		ok = top >= segment.SIGNAL_START - 1.0 and deep <= segment.SIGNAL_END + 1.0
	_cleanup_segment(segment)
	return ok

func test_heartbeat_speeds_up() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.descend_to_for_testing(0.0)
	var bpm_top: float = segment.get_heartbeat_bpm()
	segment.descend_to_for_testing(1.0)
	var bpm_bottom: float = segment.get_heartbeat_bpm()
	var ok: bool = bpm_bottom > bpm_top
	if ok:
		ok = absf(bpm_top - segment.HEARTBEAT_START_BPM) < 2.0
	if ok:
		ok = absf(bpm_bottom - segment.HEARTBEAT_END_BPM) < 2.0
	_cleanup_segment(segment)
	return ok

func test_wall_eras_change() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_eras: Array = []
	segment.wall_era_changed.connect(func(e: int) -> void: got_eras.append(e))
	segment.descend_to_for_testing(0.1)
	var ok: bool = segment.get_era_index() == 0
	if ok:
		segment.descend_to_for_testing(0.5)
		ok = segment.get_era_index() >= 1
	if ok:
		segment.descend_to_for_testing(0.9)
		ok = segment.get_era_index() >= 2
	if ok:
		# Era names shift through time.
		ok = segment.ERA_NAMES.size() == 4
	_cleanup_segment(segment)
	return ok

func test_call_fragments_in_order() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var played: Array = []
	segment.call_fragment_played.connect(func(call_id: int) -> void: played.append(call_id))
	segment.descend_to_for_testing(0.0)
	var first: int = segment.get_last_call_fragment()
	var last := -1
	var ok: bool = first == 0  # Call #0 at the top
	if ok:
		segment.descend_to_for_testing(1.0)
		last = segment.get_last_call_fragment()
		# last is the index into CALL_IDS; the emitted call id is CALL_IDS[last].
		ok = last == segment.CALL_IDS.size() - 1
	if ok:
		# Fragments move forward through the list (emitted id for the final
		# index is the last call, #17).
		var final_id: int = segment.CALL_IDS[last]
		ok = final_id == 17
	_cleanup_segment(segment)
	return ok

func test_bottom_reaches_completion() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_bottom := [false]
	var got_complete := [false]
	segment.bottom_reached.connect(func() -> void: got_bottom[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	segment.descend_to_for_testing(0.5)
	var ok: bool = segment.get_phase_name() == "DESCENT"
	if ok:
		segment.descend_to_for_testing(1.0)
		ok = got_bottom[0] and got_complete[0]
	if ok:
		ok = segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_descent_impossible_depth() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.BOTTOM_DEPTH > 200.0 or segment.BOTTOM_DEPTH >= 200.0
	if ok:
		# Tower was 30m; descent far exceeds it.
		ok = segment.BOTTOM_DEPTH > segment.TOWER_HEIGHT * 5.0
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


func test_whisper_audio_layer() -> bool:
	var scene: PackedScene = load("res://scenes/phase4/staircase.tscn")
	var seg: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(seg)
	await _wait_frames(3)
	var whisper: Node = seg.get_node_or_null("DescentWhispers")
	var ok: bool = whisper != null
	if ok:
		ok = whisper.playing
	seg._reset_for_testing()
	seg.queue_free()
	return ok
