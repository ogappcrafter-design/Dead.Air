extends Node
## Visual verification driver for DEA-129 Phase 4 Step 2 "The Staircase".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea129.tscn
## Flow: top of shaft -> descent (eras, static, heartbeat) -> bottom.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase4/staircase.tscn")
	var seg := scene.instantiate()
	seg.name = "Staircase"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_top()
	await _step2_descent()
	await _step3_bottom()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Staircase")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea129_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Staircase segment loaded")
	_check(_player != null, "player present")
	_check(_segment.get_node_or_null("Shaft") != null, "shaft present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_top() -> void:
	print("[Driver] Step 1: top of the shaft")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "DESCENT", "phase DESCENT")
	_check(_segment.get_radio_band_id() == 4, "redacted band only")
	var bpm_top: float = _segment.get_heartbeat_bpm()
	_check(bpm_top < 70.0, "heartbeat slow at top")
	await get_tree().create_timer(0.5).timeout
	_snap("shaft_top")


func _step2_descent() -> void:
	print("[Driver] Step 2: descending")
	var eras_seen := []
	_segment.wall_era_changed.connect(func(e: int) -> void: eras_seen.append(e))
	# Mid-descent: era changes, signal higher.
	_segment.descend_to_for_testing(0.5)
	_check(_segment.get_descent_fraction() > 0.4, "descending")
	var bpm_mid: float = _segment.get_heartbeat_bpm()
	_check(bpm_mid > 80.0, "heartbeat speeding up")
	await get_tree().create_timer(0.4).timeout
	_snap("mid_descent")
	# Near bottom: static high.
	_segment.descend_to_for_testing(0.9)
	var sig: float = _segment.get_radio_signal()
	_check(sig > 90.0, "static near maximum at depth")
	await get_tree().create_timer(0.4).timeout
	_snap("deep_descent")


func _step3_bottom() -> void:
	print("[Driver] Step 3: the bottom")
	var got_bottom := [false]
	var got_complete := [false]
	_segment.bottom_reached.connect(func() -> void: got_bottom[0] = true)
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_segment.descend_to_for_testing(1.0)
	_check(got_bottom[0], "bottom reached")
	_check(got_complete[0], "segment completed")
	await get_tree().create_timer(0.3).timeout
	_snap("the_bottom")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
