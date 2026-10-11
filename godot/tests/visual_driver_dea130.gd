extends Node
## Visual verification driver for DEA-130 Phase 4 Step 3 "The Chamber".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea130.tscn
## Flow: chamber + broadcast -> choice offered -> ending chosen.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase4/chamber.tscn")
	var seg := scene.instantiate()
	seg.name = "Chamber"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_chamber()
	await _step2_choice()
	await _step3_ending()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Chamber")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea130_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Chamber segment loaded")
	_check(_player != null, "player present")
	_check(_segment.get_node_or_null("Dais") != null, "dais present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_chamber() -> void:
	print("[Driver] Step 1: the chamber")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "BROADCAST", "phase BROADCAST")
	_check(_segment.get_radio_signal() >= 99.0, "signal 100, perfectly clear")
	_check(_segment.is_broadcast_playing(), "origin broadcast playing")
	await get_tree().create_timer(0.5).timeout
	_snap("the_chamber")


func _step2_choice() -> void:
	print("[Driver] Step 2: the choice")
	_segment.skip_broadcast_for_testing()
	# State-based verification (signal capture is timing-sensitive).
	_check(_segment.is_choice_offered(), "choice offered after broadcast")
	var offered: Array = _segment._get_available_choices()
	_check("A" in offered and "B" in offered and "C" in offered, "A/B/C offered")
	_check(not ("D" in offered), "D hidden by default")
	await get_tree().create_timer(0.4).timeout
	_snap("the_choice")


func _step3_ending() -> void:
	print("[Driver] Step 3: the ending choice")
	var got_chosen := [""]
	var got_complete := [false]
	_segment.ending_chosen.connect(func(c: String) -> void: got_chosen[0] = c)
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_segment.choose_ending("A")
	_check(got_chosen[0] == "A", "ending A chosen")
	_check(_segment.get_ending_id() == "THE_SIGNAL", "A maps to THE SIGNAL")
	await get_tree().create_timer(2.5).timeout
	_check(got_complete[0], "segment completed")
	await get_tree().create_timer(0.3).timeout
	_snap("ending")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
