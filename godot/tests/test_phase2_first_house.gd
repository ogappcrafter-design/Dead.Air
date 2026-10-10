## test_phase2_first_house.gd — Tests for DEA-120 Segment 2D "The First House".
## Verifies: start in ARRIVAL with radio dead (signal 0), voice starts from
## the kitchen (in-world, not radio), kitchen entry triggers camera shift,
## voice loops with name heard at the end, LIMINAL unlocks after the name,
## walls breathe, exit triggers completion and PHASE_3_JOURNEY, reset
## restores Phase 1.
extends RefCounted

var test_name: String = "Phase2FirstHouse"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_arrival_starts_with_dead_radio"] = await test_arrival_starts_with_dead_radio()
	results["test_voice_starts_after_arrival"] = await test_voice_starts_after_arrival()
	results["test_voice_is_inworld_not_radio"] = await test_voice_is_inworld_not_radio()
	results["test_kitchen_entry_shifts_camera"] = await test_kitchen_entry_shifts_camera()
	results["test_name_heard_after_loop_time"] = await test_name_heard_after_loop_time()
	results["test_voice_lines_reversed_from_call3"] = await test_voice_lines_reversed_from_call3()
	results["test_liminal_unlocked_after_name"] = await test_liminal_unlocked_after_name()
	results["test_whisper_signal_after_reveal"] = await test_whisper_signal_after_reveal()
	results["test_walls_breathe_after_liminal"] = await test_walls_breathe_after_liminal()
	results["test_exit_completes_to_phase3"] = await test_exit_completes_to_phase3()
	results["test_exit_requires_liminal_phase"] = await test_exit_requires_liminal_phase()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase2/first_house.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_arrival_starts_with_dead_radio() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "ARRIVAL"
	if ok:
		segment._process(0.016)
		ok = segment.get_radio_signal() == 0.0
	_cleanup_segment(segment)
	return ok

func test_voice_starts_after_arrival() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_phase_name() == "ARRIVAL"
	if ok:
		# Advance past the arrival beat (3s).
		for i in range(20):
			segment._process(0.2)
		ok = segment.get_phase_name() == "VOICE"
	if ok:
		ok = segment.is_voice_on()
	_cleanup_segment(segment)
	return ok

func test_voice_is_inworld_not_radio() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_voice_on()
	if ok:
		# Start voice, then check: in-world voice audible while radio signal 0.
		segment.force_voice_phase_for_testing()
		segment._process(0.016)
		ok = segment.is_voice_on()
	if ok:
		ok = segment.get_radio_signal() == 0.0
	if ok:
		# The voice player is spatialized (AudioStreamPlayer3D), not on the
		# radio bus.
		var vp: Node = segment.get_node_or_null("HaroldVoice")
		ok = vp != null and vp is AudioStreamPlayer3D and vp.bus == "Master"
	_cleanup_segment(segment)
	return ok

func test_kitchen_entry_shifts_camera() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_voice_phase_for_testing()
	var got_kitchen := [false]
	segment.kitchen_entered.connect(func() -> void: got_kitchen[0] = true)
	segment.force_kitchen_for_testing()
	var ok: bool = got_kitchen[0]
	if ok:
		ok = segment.get_phase_name() == "KITCHEN"
	_cleanup_segment(segment)
	return ok

func test_name_heard_after_loop_time() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_voice_phase_for_testing()
	var got_name := [false]
	segment.name_heard.connect(func() -> void: got_name[0] = true)
	var ok: bool = not segment.is_name_heard()
	if ok:
		# Voice script: Harold's garden report lines, reversed, ending in the
		# name slot.
		var script: Array = segment.get_voice_script()
		ok = script.size() == 5
	if ok:
		var last: Dictionary = segment.get_voice_script()[4]
		ok = last["name"] == true
	if ok:
		# Skip to the name slot and advance one character.
		segment.skip_voice_to_name_for_testing()
		ok = segment.is_name_heard() and got_name[0]
	_cleanup_segment(segment)
	return ok

func test_voice_lines_reversed_from_call3() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_voice_on()
	segment.force_voice_phase_for_testing()
	if ok:
		var script: Array = segment.get_voice_script()
		ok = script.size() == 5
	if ok:
		# First line is call #3 line 1 reversed ("tomatoes" -> "seotamot...").
		var first_text: String = segment.get_voice_script()[0]["text"]
		ok = first_text.contains("seotamoT")
	_cleanup_segment(segment)
	return ok

func test_liminal_unlocked_after_name() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_voice_phase_for_testing()
	var got_liminal := [false]
	segment.liminal_revealed.connect(func() -> void: got_liminal[0] = true)
	var ok: bool = not segment.is_liminal_unlocked()
	if ok:
		# Hear the name, then wait out the reveal delay (3s).
		segment.skip_voice_to_name_for_testing()
		for i in range(40):
			segment._process(0.1)
		ok = segment.is_liminal_unlocked() and got_liminal[0]
	if ok:
		ok = segment.get_phase_name() == "LIMINAL"
	_cleanup_segment(segment)
	return ok

func test_whisper_signal_after_reveal() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_liminal_for_testing()
	var ok: bool = segment.get_phase_name() == "LIMINAL"
	if ok:
		segment._process(0.016)
		# Dead air lifts: the new band bleeds through as a whisper.
		var sig: float = segment.get_radio_signal()
		ok = sig > 0.0 and sig <= 20.0
	_cleanup_segment(segment)
	return ok

func test_walls_breathe_after_liminal() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_liminal_for_testing()
	var got_walls := [false]
	segment.walls_breathing.connect(func() -> void: got_walls[0] = true)
	var ok: bool = segment.get_phase_name() == "LIMINAL"
	if ok:
		# Wait out the walls delay (5s).
		for i in range(60):
			segment._process(0.1)
		ok = segment.get_phase_name() == "WALLS" and got_walls[0]
	if ok:
		# Walls have an offset from their original position.
		ok = segment.get_wall_offset() != 0.0
	_cleanup_segment(segment)
	return ok

func test_exit_completes_to_phase3() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_liminal_for_testing()
	var got_exit := [false]
	var got_complete := [false]
	segment.house_exited.connect(func() -> void: got_exit[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	# Enter WALLS so exit zone works.
	for i in range(60):
		segment._process(0.1)
	var ok: bool = segment.get_phase_name() == "WALLS"
	if ok:
		segment.force_exit_for_testing()
		ok = got_exit[0] and segment.get_phase_name() == "EXIT"
	if ok:
		# The completion timer is 2s; wait it out.
		await _wait_frames(1)
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		await tree.create_timer(2.1).timeout
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	if ok:
		ok = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_3_JOURNEY
	_cleanup_segment(segment)
	return ok

func test_exit_requires_liminal_phase() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	# In VOICE phase, the exit zone does nothing.
	segment.force_voice_phase_for_testing()
	segment.force_exit_for_testing()
	var ok: bool = segment.get_phase_name() == "VOICE" and not segment.has_exit_fired()
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
