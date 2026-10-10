## test_phase3_neighborhood.gd — Tests for DEA-121 Location 1 "The Neighborhood".
## Verifies: 6 houses (3 accessible), house entry tracking, signal navigation
## toward the correct house, wrong-house composure cost, evidence/grief
## system, save room with cassette, field call schedule, Empty Lot hole
## sequence, phase-3 state, reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase3Neighborhood"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_six_houses_three_accessible"] = await test_six_houses_three_accessible()
	results["test_start_explore_with_living"] = await test_start_explore_with_living()
	results["test_house_entry_tracked"] = await test_house_entry_tracked()
	results["test_signal_pulses_toward_correct_house"] = await test_signal_pulses_toward_correct_house()
	results["test_wrong_house_costs_composure"] = await test_wrong_house_costs_composure()
	results["test_evidence_three_triggers_grief"] = await test_evidence_three_triggers_grief()
	results["test_field_call_schedule_bands"] = await test_field_call_schedule_bands()
	results["test_shed_save_creates_cassette"] = await test_shed_save_creates_cassette()
	results["test_shed_sets_safe_room"] = await test_shed_sets_safe_room()
	results["test_hole_silence_then_voice_then_complete"] = await test_hole_silence_then_voice_then_complete()
	results["test_hole_runs_once"] = await test_hole_runs_once()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase3/neighborhood.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_six_houses_three_accessible() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.HOUSE_IDS.size() == 6
	if ok:
		ok = segment.ACCESSIBLE_HOUSES.size() == 3
	if ok:
		# All three accessible houses exist as nodes in the scene.
		for hid in ["A_harold", "B_collector", "C_wrongnumber"]:
			var node_name: String = "House" + hid.substr(0, 1)
			ok = ok and segment.get_node_or_null(node_name) != null
	if ok:
		# Locked houses exist too.
		ok = segment.get_node_or_null("HouseE") != null and segment.get_node_or_null("HouseF") != null
	if ok:
		# Gardens with tomatoes on accessible houses.
		ok = segment.get_node_or_null("HouseA/Garden/Tomatoes") != null
	_cleanup_segment(segment)
	return ok

func test_start_explore_with_living() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "EXPLORE"
	if ok:
		ok = segment.get_radio_band_id() == 0
	_cleanup_segment(segment)
	return ok

func test_house_entry_tracked() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [""]
	segment.house_entered.connect(func(hid: String) -> void: got[0] = hid)
	segment.enter_house_for_testing("A_harold")
	var ok: bool = got[0] == "A_harold"
	if ok:
		ok = segment.get_correct_index() == 1
	_cleanup_segment(segment)
	return ok

func test_signal_pulses_toward_correct_house() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_radio_signal() > 0.0
	if ok:
		# Face the correct house (A at x=15, player at x=0): aligned signal high.
		segment._face_player(Vector3(1, 0, 0))
		segment._process(0.016)
		var aligned: float = segment.get_radio_signal()
		# Face away: low signal.
		segment._face_player(Vector3(-1, 0, 0))
		segment._process(0.016)
		var away: float = segment.get_radio_signal()
		ok = aligned > away
	if ok:
		# After visiting all three correct houses, no target: mid signal.
		segment.enter_house_for_testing("A_harold")
		segment.enter_house_for_testing("B_collector")
		segment.enter_house_for_testing("C_wrongnumber")
		segment._process(0.016)
		var mid: float = segment.get_radio_signal()
		ok = mid >= 12.0 and mid <= 30.0
	_cleanup_segment(segment)
	return ok

func test_wrong_house_costs_composure() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var before: float = segment.get_composure()
	var got := [""]
	segment.wrong_house_entered.connect(func(hid: String) -> void: got[0] = hid)
	segment.enter_house_for_testing("E_locked")
	var ok: bool = got[0] == "E_locked"
	if ok:
		var after: float = segment.get_composure()
		ok = after <= before - 9.0
	if ok:
		# Second wrong house entry costs again.
		segment.enter_house_for_testing("F_locked")
		var after2: float = segment.get_composure()
		ok = after2 <= before - 19.0
	_cleanup_segment(segment)
	return ok

func test_evidence_three_triggers_grief() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_grief_active()
	if ok:
		segment.examine_evidence_for_testing("photo_1", "A_harold")
		segment.examine_evidence_for_testing("tape_2", "B_collector")
		ok = not segment.is_grief_active()
	if ok:
		var got := [false]
		segment.grief_started.connect(func() -> void: got[0] = true)
		segment.examine_evidence_for_testing("diary_3", "C_wrongnumber")
		ok = segment.is_grief_active() and got[0]
	if ok:
		ok = segment.get_evidence_count() == 3
	if ok:
		# Duplicate evidence doesn't count twice.
		segment.examine_evidence_for_testing("photo_1", "A_harold")
		ok = segment.get_evidence_count() == 3
	_cleanup_segment(segment)
	return ok

func test_field_call_schedule_bands() -> bool:
	var ok: bool = true
	var calls: Array = NeighborhoodSegment.build_field_call_schedule()
	if ok:
		ok = calls.size() == 3
	if ok:
		var bands: Array = []
		for c in calls:
			bands.append(c["band"])
		ok = bands == [0, 1, 2]
	if ok:
		# Suburban-themed: lines mention domestic/impossible-weather content.
		var all_lines: String = ""
		for c in calls:
			for l in c["lines"]:
				all_lines += l
		ok = "sprinklers" in all_lines and "rain" in all_lines
	return ok

func test_shed_save_creates_cassette() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [""]
	segment.save_performed.connect(func(tid: String) -> void: got[0] = tid)
	# Walk to the shed via its zone handler.
	segment._on_zone_body_entered(segment.get_player())
	# Force the shed branch by calling the internal handler.
	segment._enter_shed()
	var ok: bool = got[0] == "shed_1"
	if ok:
		ok = segment.has_saved()
	if ok:
		var save_mgr: Node = segment._autoload("SaveManager")
		ok = save_mgr and save_mgr.is_tape_used("shed_1")
	_cleanup_segment(segment)
	return ok

func test_shed_sets_safe_room() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment._enter_shed()
	var dc: Node = segment._get_dread_composure()
	var ok: bool = dc != null
	if ok:
		ok = dc.in_safe_room
	_cleanup_segment(segment)
	return ok

func test_hole_silence_then_voice_then_complete() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_hole := [false]
	var got_complete := [false]
	segment.hole_reached.connect(func() -> void: got_hole[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	segment.reach_hole_for_testing()
	var ok: bool = got_hole[0] and segment.get_phase_name() == "HOLE"
	if ok:
		# Silence at the hole.
		segment._process(0.016)
		ok = segment.get_radio_signal() == 0.0
	if ok:
		# Advance: voice starts at 4s, completes at 10s.
		segment._hole_timer = 4.5
		segment._process(0.016)
		ok = segment._hole_voice_started
	if ok:
		segment._hole_timer = 10.5
		segment._process(0.016)
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_hole_runs_once() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.reach_hole_for_testing()
	segment._hole_timer = 10.5
	segment._process(0.016)
	var ok: bool = segment.get_phase_name() == "COMPLETED"
	if ok:
		# Re-entering the hole zone does not restart the sequence.
		segment.reach_hole_for_testing()
		segment._hole_timer = 0.0
		segment._process(0.016)
		ok = segment._hole_timer >= 0.0 and segment.get_phase_name() == "COMPLETED"
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
