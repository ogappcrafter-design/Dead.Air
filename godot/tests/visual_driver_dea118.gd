extends Node
## Visual verification driver for DEA-118 Segment 2B "The Static Sky".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea118.tscn
## Flow: segment load (Phase 2, static sky, high wide camera) → walk forward
## (road bend, houses appear) → signal aligned vs misaligned (navigation)
## → exit reached. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase2/static_sky.tscn")
	var seg := scene.instantiate()
	seg.name = "StaticSky"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_segment_start()
	await _step2_navigation_signal()
	await _step3_walk_and_bend()
	await _step4_houses_and_exit()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/StaticSky")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea118_%02d_%s.png" % [_step, name]
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
	print("[Driver] Step 0: verifying environment")
	_check(_segment != null, "StaticSky segment loaded")
	_check(_player != null, "player present in segment")
	_check(get_node_or_null("/root/PhaseManager") != null, "PhaseManager autoload present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_segment_start() -> void:
	print("[Driver] Step 1: segment start")
	_check(_segment.is_started(), "segment started")
	_check(PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_2_BREAK, "phase == PHASE_2_BREAK")
	var sky: Node = _segment.get_static_sky()
	_check(sky != null and sky is StaticSky, "static sky present")
	_check(sky != null and sky.get_static_brightness() > 0.0 and sky.get_static_brightness() < 0.5, "static sky faint")
	var cam: Camera3D = _segment.get_node_or_null("CameraRig") as Camera3D
	_check(cam != null and cam.global_position.y > 8.0, "camera high angle")
	_check(cam != null and cam.fov >= 50.0, "camera wide FOV")
	await get_tree().create_timer(0.5).timeout
	_snap("static_sky_start")


func _step2_navigation_signal() -> void:
	print("[Driver] Step 2: navigation-by-radio")
	# Facing away: weak
	_segment._face_player(Vector3(-1.0, 0.0, 0.0))
	await get_tree().create_timer(0.2).timeout
	var weak: float = _segment.get_radio_signal()
	_check(weak < 30.0, "signal weak facing away (%.1f)" % weak)
	# Facing down the road: strong
	_segment._face_player(Vector3(1.0, 0.0, 0.0))
	await get_tree().create_timer(0.2).timeout
	var strong: float = _segment.get_radio_signal()
	_check(strong > weak + 25.0, "signal strong facing road (%.1f > %.1f + 25)" % [strong, weak])
	_snap("navigation_signal")


func _step3_walk_and_bend() -> void:
	print("[Driver] Step 3: walk down road, bend")
	var got_bend := [false]
	_segment.bend_reached.connect(func() -> void: got_bend[0] = true)
	_player.global_position.x = 2.0
	await get_tree().create_timer(0.3).timeout
	_snap("road_start")
	_player.global_position.x = 20.0
	await get_tree().create_timer(0.3).timeout
	_snap("mid_road")
	_player.global_position.x = 31.0
	await get_tree().create_timer(0.3).timeout
	_check(got_bend[0], "bend_reached fired near bend")
	_snap("the_bend")


func _step4_houses_and_exit() -> void:
	print("[Driver] Step 4: houses appear, exit")
	var got_houses := [false]
	var got_exit := [false]
	_segment.houses_visible.connect(func() -> void: got_houses[0] = true)
	_segment.exit_reached.connect(func() -> void: got_exit[0] = true)
	_player.global_position.x = 37.0
	await get_tree().create_timer(0.3).timeout
	_check(got_houses[0], "houses_visible fired past bend")
	# Houses visible in world
	var h1: Node = _segment.get_node_or_null("House1")
	_check(h1 != null, "house silhouettes present")
	_snap("houses_appear")
	_segment._on_exit_area_entered(_player)
	await get_tree().create_timer(0.3).timeout
	_check(got_exit[0], "exit_reached fired at end of segment")
	_snap("exit")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
