extends Node
## Visual verification driver for DEA-122 Location 2 "The Highway".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea122.tscn
## Flow: foggy endless road -> advisory + LIMINAL gradient -> road loop
## (sign degrades) -> dirt road appears -> entry -> complete.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase3/highway.tscn")
	var seg := scene.instantiate()
	seg.name = "Highway"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_road()
	await _step2_advisory_liminal()
	await _step3_loop()
	await _step4_dirt_road()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Highway")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea122_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Highway segment loaded")
	_check(_player != null, "player present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_road() -> void:
	print("[Driver] Step 1: the endless road")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "DRIVE", "phase DRIVE")
	_check(_segment.get_node_or_null("RouteSign/SignText") != null, "route sign present")
	_check(_segment.get_node_or_null("LightPole0") != null, "streetlights present")
	var sign_text: String = _segment.get_sign_text()
	_check(sign_text == "WELCOME TO ROUTE 9", "sign text correct initially")
	_check(_segment.get_radio_signal() > 50.0, "WEATHER strongest")
	await get_tree().create_timer(0.5).timeout
	_snap("foggy_road")


func _step2_advisory_liminal() -> void:
	print("[Driver] Step 2: advisory and liminal gradient")
	var got := [false]
	_segment.advisory_played.connect(func(i: int, t: String) -> void: got[0] = true)
	_segment.play_advisories_for_testing(1)
	_check(got[0], "advisory played")
	# LIMINAL gradient: face the side road vs away.
	_segment.tune_for_testing(1)
	_segment._face_player(Vector3(0.9, 0, 0.4))
	_segment._process(0.016)
	var strong: float = _segment.get_radio_signal()
	_segment._face_player(Vector3(-0.9, 0, -0.4))
	_segment._process(0.016)
	var weak: float = _segment.get_radio_signal()
	_check(strong > weak, "LIMINAL gradient points to side road")
	# Back to WEATHER.
	_segment.tune_for_testing(5)
	_segment._process(0.016)
	_check(_segment.get_radio_signal() > 50.0, "WEATHER strong again")
	await get_tree().create_timer(0.4).timeout
	_snap("advisory_liminal")


func _step3_loop() -> void:
	print("[Driver] Step 3: the road loops")
	var got_loop := [0]
	_segment.loop_completed.connect(func(n: int) -> void: got_loop[0] = n)
	_segment.walk_for_testing(_segment.LOOP_DISTANCE + 5.0)
	_segment._process(0.016)
	_check(got_loop[0] == 1, "road looped once")
	_check(_segment.get_loop_number() == 1, "loop count 1")
	var t1: String = _segment.get_sign_text()
	_check(t1 != "WELCOME TO ROUTE 9", "sign text degraded")
	await get_tree().create_timer(0.4).timeout
	_snap("loop_sign")


func _step4_dirt_road() -> void:
	print("[Driver] Step 4: the dirt road")
	_segment.play_advisories_for_testing(3)
	_segment.tune_for_testing(1)
	_segment._process(0.016)
	_check(_segment.is_dirt_road_visible(), "dirt road visible (advisory 3 + LIMINAL)")
	await get_tree().create_timer(0.4).timeout
	# Move near it for the shot.
	_player.global_position = Vector3(_segment.DIRT_ROAD_X, 0.5, _segment.DIRT_ROAD_Z - 3.0)
	_segment._process(0.016)
	await get_tree().create_timer(0.3).timeout
	_snap("dirt_road")
	var got_complete := [false]
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_player.global_position = Vector3(_segment.DIRT_ROAD_X, 0.5, _segment.DIRT_ROAD_Z)
	_segment._process(0.016)
	_segment._process(0.016)
	_check(got_complete[0], "entry completed segment")
	await get_tree().create_timer(0.3).timeout
	_snap("onto_dirt")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
