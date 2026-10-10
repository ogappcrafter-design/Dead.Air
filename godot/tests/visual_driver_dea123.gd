extends Node
## Visual verification driver for DEA-123 Location 3 "The Liminal Space".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea123.tscn
## Flow: void + floating doors -> flicker demo -> door discovery ->
## Suit encounter -> safe room -> bunker departure.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase3/liminal_space.tscn")
	var seg := scene.instantiate()
	seg.name = "LiminalSpace"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_void()
	await _step2_flicker()
	await _step3_doors()
	await _step4_suit()
	await _step5_safe_room()
	await _step6_departure()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/LiminalSpace")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea123_%02d_%s.png" % [_step, name]
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


func _step0_environment() -> void:
	print("[Driver] Step 0: environment")
	_check(_segment != null, "LiminalSpace segment loaded")
	_check(_player != null, "player present")
	_check(_segment.get_node_or_null("Doors/NeighborhoodDoor") != null, "floating doors present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_void() -> void:
	print("[Driver] Step 1: the void")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "EXPLORE", "phase EXPLORE")
	_check(_segment.get_radio_signal() >= 65.0, "LIMINAL dominant")
	await get_tree().create_timer(0.5).timeout
	_snap("void_doors")


func _step2_flicker() -> void:
	print("[Driver] Step 2: flicker")
	_segment.tune_for_testing(0)
	var early: float = _segment.get_radio_signal()
	for i in range(10):
		_segment._process(0.5)
	var late: float = _segment.get_radio_signal()
	_check(late < early, "LIVING flickers/decays")
	_segment.tune_for_testing(1)
	_segment._process(0.016)
	_check(_segment.get_radio_signal() >= 65.0, "LIMINAL holds")
	await get_tree().create_timer(0.3).timeout
	_snap("flicker")


func _step3_doors() -> void:
	print("[Driver] Step 3: door discovery")
	# LIVING door.
	_segment.tune_for_testing(0)
	_segment.place_player_at_door_for_testing("neighborhood")
	_segment._process(0.016)
	_check(_segment.is_door_found("neighborhood"), "LIVING door found")
	await get_tree().create_timer(0.3).timeout
	_snap("neighborhood_door")
	# LOST door.
	_segment.tune_for_testing(2)
	_segment.place_player_at_door_for_testing("bunker")
	_segment._process(0.016)
	_check(_segment.is_door_found("bunker"), "LOST door found")
	# LIMINAL door.
	_segment.tune_for_testing(1)
	_segment.place_player_at_door_for_testing("safe")
	_segment._process(0.016)
	_check(_segment.is_door_found("safe"), "LIMINAL door found")


func _step4_suit() -> void:
	print("[Driver] Step 4: the Suits")
	var got_detect := [false]
	_segment.suit_detected_player.connect(func() -> void: got_detect[0] = true)
	var suit = _segment.spawn_suit_for_testing()
	_check(suit != null, "suit spawned")
	_check(_segment.get_phase_name() == "HUNTED", "phase HUNTED")
	# Place near player to trigger static surge, take screenshot.
	suit.global_position = _player.global_position + Vector3(3, 0, 0)
	_segment._process(0.016)
	await get_tree().create_timer(0.4).timeout
	_snap("suit_static")
	# Detection: composure hit + relocation.
	var before: float = _segment.get_composure()
	suit.global_position = _player.global_position
	_segment._process(0.016)
	_check(got_detect[0], "suit detected player")
	var after: float = _segment.get_composure()
	_check(after <= before - 25.0, "composure hit on detection")


func _step5_safe_room() -> void:
	print("[Driver] Step 5: safe room")
	var got_save := [false]
	_segment.saved_in_safe_room.connect(func() -> void: got_save[0] = true)
	_segment.force_safe_room_for_testing()
	_check(_segment.get_phase_name() == "SAFE_ROOM", "safe room entered")
	await _wait_frames(2)
	_check(got_save[0], "cassette saved")
	await get_tree().create_timer(0.4).timeout
	_snap("safe_room")


func _step6_departure() -> void:
	print("[Driver] Step 6: departure")
	var got_complete := [false]
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_segment.tune_for_testing(2)
	_segment._on_door_area_entered(_player, "bunker")
	_check(_segment.get_phase_name() == "DEPARTED", "bunker door entered")
	_segment._process(0.016)
	_check(got_complete[0], "segment completed")
	await get_tree().create_timer(0.3).timeout
	_snap("departure")


func _wait_frames(count: int) -> void:
	for i in range(count):
		await get_tree().process_frame


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
