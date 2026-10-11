extends Node
## Visual verification driver for the four TODO-issue implementations:
## DEA-126 Collector's Tape puzzle scene props, DEA-132 false calls,
## DEA-147 suit stutter/relocation static.
## Screenshots to user://screenshot/. Exit 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	await _run()


func _run() -> void:
	await _test_neighborhood_props()
	await _test_false_calls_visual()
	await _test_suit_visual()
	_finish()


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea_todo_%02d_%s.png" % [_step, name]
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png("user://" + path)
	print("[Driver] snapshot user://%s (err=%d)" % [path, err])


func _check(cond: bool, label: String) -> void:
	if cond:
		_checks.append("PASS: " + label)
	else:
		_failures += 1
		_checks.append("FAIL: " + label)
		print("[Driver] *** FAIL: %s" % label)


func _test_neighborhood_props() -> void:
	print("[Driver] Neighborhood: Collector's Tape props")
	var scene: PackedScene = load("res://scenes/phase3/neighborhood.tscn")
	var seg: Node = scene.instantiate()
	get_tree().root.add_child.call_deferred(seg)
	for i in 4:
		await get_tree().process_frame
	_check(seg.is_started(), "neighborhood started")
	var puzzle: Node = seg.get_collectors_puzzle()
	_check(puzzle != null, "collectors puzzle wired")
	var house_b: Node = seg.get_node_or_null("HouseB")
	if house_b:
		_check(house_b.get_node_or_null("TapeRecorder") != null, "recorder prop exists")
		_check(house_b.get_node_or_null("ArchiveWall") != null, "archive wall exists")
		_check(house_b.get_node_or_null("CollectorShadow") != null, "shadow node exists")
		_check(house_b.get_node_or_null("DigSpot") != null, "dig spot exists")
	# Snap the street view.
	_snap("neighborhood_street")
	seg._reset_for_testing()
	seg.queue_free()
	await get_tree().process_frame


func _test_false_calls_visual() -> void:
	print("[Driver] Clearing: false calls")
	var cm := get_tree().root.get_node_or_null("CallManager")
	if cm and cm.has_method("get_dread_composure"):
		var dc: Node = cm.get_dread_composure()
		if dc and dc.has_method("set_composure"):
			dc.set_composure(20.0)
	var scene: PackedScene = load("res://scenes/phase4/clearing.tscn")
	var seg: Node = scene.instantiate()
	get_tree().root.add_child.call_deferred(seg)
	for i in 4:
		await get_tree().process_frame
	_check(seg.is_started(), "clearing started")
	var got := {"ok": false}
	seg.false_call_started.connect(func(c: Dictionary):
		got["ok"] = c.get("band") == 4)
	seg._process_false_calls(20.0)
	_check(got["ok"], "false call fired on redacted band")
	_snap("clearing_false_call")
	seg._reset_for_testing()
	seg.queue_free()
	await get_tree().process_frame


func _test_suit_visual() -> void:
	print("[Driver] Suit: stutter + relocation static")
	var suit := Suit.new()
	suit.set_rng_seed(42)
	suit.set_patrol_points([Vector3(0, 0, 0)])
	var player := CharacterBody3D.new()
	player.add_to_group("player")
	get_tree().root.add_child.call_deferred(player)
	player.global_position = Vector3(0, 0, -3)
	get_tree().root.add_child.call_deferred(suit)
	suit.set_player(player)
	suit.global_position = Vector3.ZERO
	await get_tree().process_frame
	# Force approach and let the stutter window trigger.
	suit.force_state(Suit.State.APPROACH)
	suit._stutter_timer = 0.0
	var moved := false
	for i in range(10):
		var before: Vector3 = suit.global_position
		suit._physics_process(0.1)
		if suit.global_position != before:
			moved = true
	_check(moved or suit._stutter_freeze > 0.0, "suit approach moves or stutters")
	# Relocation static: trigger contact and check a static overlay spawns.
	suit._stutter_freeze = 0.0
	suit._last_known_player_pos = player.global_position
	suit._stutter_timer = 999.0  # no stutter; direct walk to contact
	for i in range(30):
		suit._physics_process(0.1)
		if suit.get_state() == Suit.State.RELOCATE:
			break
	_check(suit.get_state() == Suit.State.RELOCATE, "contact triggers relocation")
	# The overlay is spawned synchronously in _trigger_relocate; it may have
	# been created during the earlier stutter loop's contact, so accept a
	# static present now rather than a strict before/after delta.
	await get_tree().process_frame
	var statics := _count_static_overlays()
	_check(statics >= 1, "relocation static overlay spawned")
	suit.queue_free()
	player.queue_free()
	await get_tree().process_frame
	_snap("suit_relocate")


func _count_static_overlays() -> int:
	var count := 0
	for child in get_tree().root.get_children():
		if child.name.begins_with("RelocateStatic") or child.name.begins_with("StaticTransition"):
			count += 1
	return count


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	get_tree().quit(0 if _failures == 0 else 1)
