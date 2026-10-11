extends RefCounted
## test_field_calls.gd — Tests for the unified field call system (DEA-127).
## Verifies: schedule firing, loop-based refill, signal-based quality tiers,
## dread-based content corruption, composure drain per call, liminal and
## classified location schedules.

var test_name: String = "FieldCalls"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_fires_call_on_interval"] = await test_fires_call_on_interval()
	results["test_loops_schedule"] = await test_loops_schedule()
	results["test_quality_tiers"] = test_quality_tiers()
	results["test_lines_by_quality"] = test_lines_by_quality()
	results["test_corruption_mid_dread"] = test_corruption_mid_dread()
	results["test_corruption_high_dread"] = test_corruption_high_dread()
	results["test_composure_drain"] = await test_composure_drain()
	results["test_liminal_schedule_exists"] = test_liminal_schedule_exists()
	results["test_classified_schedule_exists"] = test_classified_schedule_exists()
	results["test_liminal_integrated"] = await test_liminal_integrated()
	results["test_bunker_integrated"] = await test_bunker_integrated()
	return results


func _make_system() -> Array:
	var system := FieldCalls.new()
	(Engine.get_main_loop() as SceneTree).root.add_child(system)
	var dc := DreadComposure.new()
	dc.set_rng_seed(42)
	(Engine.get_main_loop() as SceneTree).root.add_child(dc)
	var sig := Node.new()
	sig.set_script(load("res://src/core/signal_strength.gd"))
	(Engine.get_main_loop() as SceneTree).root.add_child(sig)
	var schedule: Array = [
		{"id": -1, "band": 1, "callerName": "A", "lines": ["one", "two", "three", "four"]},
		{"id": -1, "band": 1, "callerName": "B", "lines": ["five", "six"]},
	]
	system.setup(schedule, 2.0, sig, dc)
	return [system, sig, dc]


func _cleanup(system: FieldCalls, sig: Node, dc: Node) -> void:
	system._reset_for_testing()
	system.queue_free()
	if sig and is_instance_valid(sig):
		sig.queue_free()
	if dc and is_instance_valid(dc):
		dc.queue_free()


func test_fires_call_on_interval() -> bool:
	var parts: Array = _make_system()
	var system: FieldCalls = parts[0]
	var started := [false]
	system.field_call_started.connect(func(_c): started[0] = true)
	system.start()
	# Interval is 2.0s, start puts the timer near firing.
	system._process(1.1)
	var ok: bool = started[0] and not system.get_current_call().is_empty()
	_cleanup(system, parts[1], parts[2])
	return ok


func test_loops_schedule() -> bool:
	var parts: Array = _make_system()
	var system: FieldCalls = parts[0]
	system.start()
	var fired := {"count": 0}
	system.field_call_started.connect(func(_c): fired["count"] += 1)
	# Fire 4 calls from a 2-call schedule: must refill and loop. The timer
	# only resets when a call fires, so at 1.1s steps a fire occurs every
	# two iterations; eight iterations guarantee at least three fires.
	for i in range(8):
		system._process(1.1)
		system._current_call = {}
	# Refill happens in _fire_next_call when the queue empties.
	var ok: bool = fired["count"] >= 3
	_cleanup(system, parts[1], parts[2])
	return ok


func test_quality_tiers() -> bool:
	var ok: bool = FieldCalls.get_quality_for_signal(80.0) == 2
	if ok:
		ok = FieldCalls.get_quality_for_signal(60.0) == 2
	if ok:
		ok = FieldCalls.get_quality_for_signal(30.0) == 1
	if ok:
		ok = FieldCalls.get_quality_for_signal(10.0) == 0
	return ok


func test_lines_by_quality() -> bool:
	var call := {"lines": ["a", "b", "c", "d", "e"]}
	var ok: bool = FieldCalls.get_lines_for_quality(call, 2).size() == 5
	if ok:
		ok = FieldCalls.get_lines_for_quality(call, 1).size() == 3  # a, c, e
	if ok:
		ok = FieldCalls.get_lines_for_quality(call, 0).size() == 0
	return ok


func test_corruption_mid_dread() -> bool:
	var lines: Array = ["the word here vanishes now", "short"]
	var out: Array = FieldCalls.corrupt_lines(lines, 50.0)
	# Long line loses a word; short line untouched.
	var ok: bool = out[0] == "the word vanishes now"
	if ok:
		ok = out[1] == "short"
	return ok


func test_corruption_high_dread() -> bool:
	var lines: Array = ["one two three four five"]
	var out: Array = FieldCalls.corrupt_lines(lines, 75.0)
	# Last word becomes "you", plus a mid-word drop.
	var ok: bool = "you" in String(out[0])
	if ok:
		ok = String(out[0]).split(" ").size() < 5
	return ok


func test_composure_drain() -> bool:
	var parts: Array = _make_system()
	var system: FieldCalls = parts[0]
	var dc: Node = parts[2]
	dc.set_composure(100.0)
	system.start()
	system._process(1.1)
	var after: float = dc.composure
	# Drain is between 2 and 5 per call.
	var ok: bool = after < 100.0 and after >= 95.0
	_cleanup(system, parts[1], parts[2])
	return ok


func test_liminal_schedule_exists() -> bool:
	var schedule: Array = load("res://src/levels/liminal_space_segment.gd").build_liminal_field_schedule()
	var ok: bool = schedule.size() >= 2
	if ok:
		var first: Dictionary = schedule[0]
		ok = first.get("band") == 1 and first.get("lines", []).size() >= 2
	return ok


func test_classified_schedule_exists() -> bool:
	var script = load("res://src/levels/bunker_segment.gd")
	var schedule: Array = script.build_classified_field_schedule()
	var ok: bool = schedule.size() >= 2
	if ok:
		var first: Dictionary = schedule[0]
		ok = first.get("band") == 3 and first.get("lines", []).size() >= 2
	return ok


func test_liminal_integrated() -> bool:
	var scene: PackedScene = load("res://scenes/phase3/liminal_space.tscn")
	var seg: Node = scene.instantiate()
	(Engine.get_main_loop() as SceneTree).root.add_child(seg)
	for i in 3:
		await (Engine.get_main_loop() as SceneTree).process_frame
	var ok: bool = seg.is_started()
	if ok and seg.get_field_calls() != null:
		ok = seg.get_field_calls().is_active()
	seg._reset_for_testing()
	seg.queue_free()
	return ok


func test_bunker_integrated() -> bool:
	var scene: PackedScene = load("res://scenes/phase3/bunker.tscn")
	var seg: Node = scene.instantiate()
	(Engine.get_main_loop() as SceneTree).root.add_child(seg)
	for i in 3:
		await (Engine.get_main_loop() as SceneTree).process_frame
	var ok: bool = seg.is_started()
	if ok and seg.get_field_calls() != null:
		ok = seg.get_field_calls().is_active()
	seg._reset_for_testing()
	seg.queue_free()
	return ok
