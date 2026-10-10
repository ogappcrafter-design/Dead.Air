## test_phase4_chamber.gd — Tests for DEA-130 Phase 4 Step 3 "The Chamber".
## Verifies: chamber starts on ████████ with signal 100 (perfectly clear),
## origin broadcast plays then the choice is offered, choice D hidden
## (composure > 80 AND 15 tapes), A/B/C frequencies select endings,
## ending choice completes the segment, reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase4Chamber"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_starts_perfectly_clear"] = await test_starts_perfectly_clear()
	results["test_broadcast_then_choice"] = await test_broadcast_then_choice()
	results["test_choice_d_hidden_by_default"] = await test_choice_d_hidden_by_default()
	results["test_choice_d_available_when_unlocked"] = await test_choice_d_available_when_unlocked()
	results["test_frequency_selects_ending"] = await test_frequency_selects_ending()
	results["test_all_endings_map_correctly"] = await test_all_endings_map_correctly()
	results["test_choice_completes_segment"] = await test_choice_completes_segment()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase4/chamber.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_starts_perfectly_clear() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "BROADCAST"
	if ok:
		ok = segment.get_radio_band_id() == 4
	if ok:
		# Signal 100: no static, perfectly clear for the first time.
		ok = segment.get_radio_signal() >= 99.0
	_cleanup_segment(segment)
	return ok

func test_broadcast_then_choice() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_broadcast_playing()
	if ok:
		ok = not segment.is_choice_offered()
	if ok:
		# Fast-forward the broadcast.
		segment.force_choice_for_testing()
		ok = segment.is_choice_offered() and segment.get_phase_name() == "CHOICE"
	_cleanup_segment(segment)
	return ok

func test_choice_d_hidden_by_default() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.skip_broadcast_for_testing()
	var available: Array = segment._get_available_choices()
	var ok: bool = "A" in available and "B" in available and "C" in available
	if ok:
		ok = not ("D" in available)
	_cleanup_segment(segment)
	return ok

func test_choice_d_available_when_unlocked() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	# Set up unlock conditions: composure > 80, 15+ tapes.
	var dc: Node = null
	var cm: Node = segment._autoload("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		dc = cm.get_dread_composure()
	if dc and dc.has_method("set_composure"):
		dc.set_composure(90.0)
	var ti: Node = segment._autoload("TapeInventory")
	if ti:
		for i in range(15):
			ti.collect_tape("test_tape_%d" % i)
	segment.skip_broadcast_for_testing()
	var available: Array = segment._get_available_choices()
	var ok: bool = "D" in available
	if ti:
		for i in range(15):
			ti._collected.erase("test_tape_%d" % i)
	_cleanup_segment(segment)
	return ok

func test_frequency_selects_ending() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [""]
	segment.ending_chosen.connect(func(c: String) -> void: got[0] = c)
	segment.skip_broadcast_for_testing()
	# Tune to A's frequency (640 kHz).
	var rt: Node = segment._radio_tuner
	rt.set("current_frequency", segment.CHOICE_FREQUENCIES["A"])
	segment._process(0.016)
	var ok: bool = got[0] == "A"
	if ok:
		ok = segment.get_chosen() == "A" and segment.get_phase_name() == "ENDING"
	_cleanup_segment(segment)
	return ok

func test_all_endings_map_correctly() -> bool:
	var ok: bool = true
	var expected := {
		"A": "THE_SIGNAL",
		"B": "THE_RELAY",
		"C": "DEAD_AIR",
		"D": "THE_WITNESS",
	}
	for key in expected:
		ok = ok and (ChamberSegment.ENDING_IDS.get(key, "") == expected[key])
	return ok

func test_choice_completes_segment() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_complete := [false]
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	segment.skip_broadcast_for_testing()
	segment.choose_ending("C")
	var ok: bool = segment.get_phase_name() == "ENDING"
	if ok:
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		await tree.create_timer(2.5).timeout
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
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
