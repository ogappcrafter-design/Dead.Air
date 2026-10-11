extends RefCounted
## test_false_calls.gd — Tests for the Phase 4 false call system (DEA-132).
## Verifies: no false calls at composure >= 30, false calls fire below 30,
## corrupted content on the redacted band, origin-overlap below 10,
## composure drain per call, no tapes from false calls.

var test_name: String = "FalseCalls"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_no_calls_at_high_composure"] = await test_no_calls_at_high_composure()
	results["test_calls_fire_below_threshold"] = await test_calls_fire_below_threshold()
	results["test_calls_on_redacted_band"] = await test_calls_on_redacted_band()
	results["test_overlap_below_ten"] = await test_overlap_below_ten()
	results["test_call_drains_composure"] = await test_call_drains_composure()
	results["test_line_corruption"] = test_line_corruption()
	results["test_no_tapes_from_false_calls"] = test_no_tapes_from_false_calls()
	return results


func _load_clearing() -> Node:
	var scene: PackedScene = load("res://scenes/phase4/clearing.tscn")
	var seg: Node = scene.instantiate()
	(Engine.get_main_loop() as SceneTree).root.add_child(seg)
	for i in 3:
		await (Engine.get_main_loop() as SceneTree).process_frame
	return seg


func _cleanup(seg: Node) -> void:
	if seg and is_instance_valid(seg):
		seg._reset_for_testing()
		seg.queue_free()


func _set_composure(value: float) -> void:
	var cm := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		var dc: Node = cm.get_dread_composure()
		if dc and dc.has_method("set_composure"):
			dc.set_composure(value)


func test_no_calls_at_high_composure() -> bool:
	_set_composure(100.0)
	var seg: Node = await _load_clearing()
	var fired := {"count": 0}
	seg.false_call_started.connect(func(_c): fired["count"] += 1)
	# Well past several intervals at high composure.
	for i in range(5):
		seg._process_false_calls(20.0)
	var ok: bool = fired["count"] == 0
	_cleanup(seg)
	return ok


func test_calls_fire_below_threshold() -> bool:
	_set_composure(20.0)
	var seg: Node = await _load_clearing()
	var fired := {"count": 0}
	seg.false_call_started.connect(func(_c): fired["count"] += 1)
	seg._process_false_calls(20.0)
	var ok: bool = fired["count"] >= 1
	_cleanup(seg)
	return ok


func test_calls_on_redacted_band() -> bool:
	_set_composure(20.0)
	var seg: Node = await _load_clearing()
	var band_ok := {"ok": false}
	seg.false_call_started.connect(func(c: Dictionary): band_ok["ok"] = c.get("band") == 4)
	seg._process_false_calls(20.0)
	var ok: bool = band_ok["ok"]
	_cleanup(seg)
	return ok


func test_overlap_below_ten() -> bool:
	_set_composure(5.0)
	var seg: Node = await _load_clearing()
	var overlap_ok := {"ok": false}
	seg.false_call_started.connect(func(c: Dictionary): overlap_ok["ok"] = c.get("overlap") == true)
	seg._process_false_calls(20.0)
	var ok: bool = overlap_ok["ok"]
	_cleanup(seg)
	return ok


func test_call_drains_composure() -> bool:
	_set_composure(20.0)
	var seg: Node = await _load_clearing()
	var before: float = _current_composure()
	seg._process_false_calls(20.0)
	var after: float = _current_composure()
	var ok: bool = after < before
	# Drain is exactly FALSE_CALL_COMPOSURE_DRAIN (5).
	ok = ok and absf((before - after) - seg.FALSE_CALL_COMPOSURE_DRAIN) < 0.01
	_cleanup(seg)
	return ok


func _current_composure() -> float:
	var cm := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		var dc: Node = cm.get_dread_composure()
		if dc and "composure" in dc:
			return float(dc.composure)
	return -1.0


func test_line_corruption() -> bool:
	var line: String = ClearingSegment.corrupt_false_line("Hello there.")
	var ok: bool = "(we know where you are)" in line
	return ok


func test_no_tapes_from_false_calls() -> bool:
	# Structural check: the false call payload carries no tape fields.
	var seg: Node = await _load_clearing()
	var has_tape := {"ok": true}
	seg.false_call_started.connect(func(c: Dictionary):
		if c.has("tape") or c.has("tapeName"):
			has_tape["ok"] = false)
	seg._process_false_calls(20.0)
	var ok: bool = has_tape["ok"]
	_cleanup(seg)
	return ok
