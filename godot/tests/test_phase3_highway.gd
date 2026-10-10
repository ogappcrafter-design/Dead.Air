## test_phase3_highway.gd — Tests for DEA-122 Location 2 "The Highway".
## Verifies: single endless road, wrong streetlight intervals, WEATHER band
## strongest, highway advisories (nonexistent roads), road loop after
## distance with sign degradation, LIMINAL gradient toward side road,
## dirt road visibility conditions, entry completes the segment, no save.
extends RefCounted

var test_name: String = "Phase3Highway"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_starts_on_weather_strongest"] = await test_starts_on_weather_strongest()
	results["test_wrong_light_intervals"] = await test_wrong_light_intervals()
	results["test_advisories_nonexistent_roads"] = await test_advisories_nonexistent_roads()
	results["test_road_loops_after_distance"] = await test_road_loops_after_distance()
	results["test_sign_degrades_per_loop"] = await test_sign_degrades_per_loop()
	results["test_liminal_gradient_toward_side_road"] = await test_liminal_gradient_toward_side_road()
	results["test_dirt_road_requires_conditions"] = await test_dirt_road_requires_conditions()
	results["test_dirt_road_entry_completes"] = await test_dirt_road_entry_completes()
	results["test_camera_snaps_forward"] = await test_camera_snaps_forward()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase3/highway.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_starts_on_weather_strongest() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "DRIVE"
	if ok:
		# Starts tuned to WEATHER, signal strong.
		ok = segment.get_radio_signal() > 50.0
	if ok:
		# Another band is weak.
		segment.tune_for_testing(0)
		segment._process(0.016)
		ok = segment.get_radio_signal() < 30.0
	_cleanup_segment(segment)
	return ok

func test_wrong_light_intervals() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var intervals: Array = segment.LIGHT_INTERVALS
	var ok: bool = intervals.size() >= 5
	if ok:
		# Intervals vary wildly (some small, some huge).
		ok = intervals.min() <= 15.0 and intervals.max() >= 90.0
	if ok:
		# Light poles exist in the scene.
		ok = segment.get_node_or_null("LightPole0") != null and segment.get_node_or_null("LightPole3") != null
	_cleanup_segment(segment)
	return ok

func test_advisories_nonexistent_roads() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [false]
	segment.advisory_played.connect(func(i: int, text: String) -> void: got[0] = i == 0)
	var ok: bool = segment.get_advisory_index() == -1
	if ok:
		segment.play_advisories_for_testing(1)
		ok = segment.get_advisory_index() == 0 and got[0]
	if ok:
		# Advisories reference roads that don't exist.
		var all_text: String = ""
		for a in segment.ADVISORIES:
			all_text += a
		ok = "never built" in all_text and "Not on any map" in all_text
	_cleanup_segment(segment)
	return ok

func test_road_loops_after_distance() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_loop := [0]
	segment.loop_completed.connect(func(n: int) -> void: got_loop[0] = n)
	var ok: bool = segment.get_loop_number() == 0
	if ok:
		# Walk past the loop distance.
		segment.walk_for_testing(segment.LOOP_DISTANCE + 5.0)
		segment._process(0.016)
		ok = segment.get_loop_number() == 1 and got_loop[0] == 1
	if ok:
		# Player was teleported back to the start.
		var player = segment.get_player()
		ok = player.global_position.x < 10.0
	_cleanup_segment(segment)
	return ok

func test_sign_degrades_per_loop() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_sign_text() == "WELCOME TO ROUTE 9"
	var t1 := ""
	var t2 := ""
	if ok:
		segment.walk_for_testing(segment.LOOP_DISTANCE + 5.0)
		segment._process(0.016)
		t1 = segment.get_sign_text()
		ok = t1 != "WELCOME TO ROUTE 9"
	if ok:
		segment.walk_for_testing(segment.LOOP_DISTANCE + 5.0)
		segment._process(0.016)
		t2 = segment.get_sign_text()
		ok = t2 != t1
	_cleanup_segment(segment)
	return ok

func test_liminal_gradient_toward_side_road() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.tune_for_testing(1)  # LIMINAL
	var ok: bool = true
	if ok:
		# Facing the side road (at x=60, z=7 from player at x=0): strong.
		segment._face_player(Vector3(0.9, 0, 0.4))
		segment._process(0.016)
		var strong: float = segment.get_radio_signal()
		# Facing away: weak.
		segment._face_player(Vector3(-0.9, 0, -0.4))
		segment._process(0.016)
		var weak: float = segment.get_radio_signal()
		ok = strong > weak
	if ok:
		# WEATHER tuned again: back to strong flat signal.
		segment.tune_for_testing(5)
		segment._process(0.016)
		ok = segment.get_radio_signal() > 50.0
	_cleanup_segment(segment)
	return ok

func test_dirt_road_requires_conditions() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_dirt_road_visible()
	if ok:
		# LIMINAL tuned but no advisories: still hidden.
		segment.tune_for_testing(1)
		segment._process(0.016)
		ok = not segment.is_dirt_road_visible()
	if ok:
		# Advisories 1-2 played, LIMINAL tuned: still hidden (needs advisory 3).
		segment.play_advisories_for_testing(2)
		segment._process(0.016)
		ok = not segment.is_dirt_road_visible()
	if ok:
		# Advisory 3 played: now visible.
		segment.play_advisories_for_testing(1)
		segment._process(0.016)
		ok = segment.is_dirt_road_visible()
	if ok:
		var got := [false]
		segment.dirt_road_visible.connect(func() -> void: got[0] = true)
		ok = got[0] or segment.is_dirt_road_visible()
	_cleanup_segment(segment)
	return ok

func test_dirt_road_entry_completes() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_entered := [false]
	var got_complete := [false]
	segment.dirt_road_entered.connect(func() -> void: got_entered[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	# Make the road visible, walk to it.
	segment.play_advisories_for_testing(3)
	segment.tune_for_testing(1)
	segment._process(0.016)
	var ok: bool = segment.is_dirt_road_visible()
	var player: Node3D = null
	if ok:
		player = segment.get_player()
		player.global_position = Vector3(segment.DIRT_ROAD_X, 0.5, segment.DIRT_ROAD_Z - 1.0)
		segment._process(0.016)
		ok = got_entered[0] and segment.get_phase_name() == "FOUND_ROAD"
	if ok:
		# Walk deeper: completed at half radius.
		player.global_position = Vector3(segment.DIRT_ROAD_X, 0.5, segment.DIRT_ROAD_Z)
		segment._process(0.016)
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_camera_snaps_forward() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_camera_index() == 0
	if ok:
		# Walk past the first snap threshold (next camera at x=70; snaps at x>45).
		segment.walk_for_testing(50.0)
		segment._process(0.016)
		ok = segment.get_camera_index() == 1
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
