extends Node
## Visual verification driver for DEA-131 ending sequences.
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea131.tscn
## Flow: play each ending briefly and capture its unique visual.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _seq: Node = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	_run()


func _run() -> void:
	_seq = EndingSequences.new()
	_seq.name = "Endings"
	get_tree().root.add_child.call_deferred(_seq)
	await get_tree().process_frame
	await get_tree().process_frame
	await _test_signal()
	_finish()


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea131_%02d_%s.png" % [_step, name]
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


func _test_signal() -> void:
	print("[Driver] Ending A: THE SIGNAL")
	_seq.play_choice("A")
	_check(_seq.is_running(), "ending A started")
	_check(_seq.get_current_ending_name() == "THE SIGNAL", "name THE SIGNAL")
	_seq._process(3.0)
	_check(_seq.get_phase_id() == 2, "credits started")
	_seq._process(1.0)
	_snap("signal_credits")
	_seq._process(EndingSequences.CREDITS_DURATION)
	_check(_seq.get_phase_id() == 3, "post credits")
	_seq._process(1.0)
	_snap("signal_post")
	_seq._process(EndingSequences.POST_CREDITS_DURATION)
	_check(not _seq.is_running(), "sequence finished")
	# Repeat quickly for the other three endings' visuals.
	_seq._reset_for_testing()
	_seq.play_choice("B")
	_seq._process(3.5)
	_check(_seq.get_current_ending_name() == "THE RELAY", "name THE RELAY")
	_snap("relay")
	_seq._reset_for_testing()
	_seq.play_choice("C")
	_seq._process(3.5)
	_check(_seq.get_current_ending_name() == "DEAD AIR", "name DEAD AIR")
	_snap("deadair")
	_seq._reset_for_testing()
	_seq.play_choice("D")
	_seq._process(3.5)
	_check(_seq.get_current_ending_name() == "THE WITNESS", "name THE WITNESS")
	_snap("witness")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
