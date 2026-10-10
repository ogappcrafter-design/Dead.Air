extends Node
## Visual verification driver for DEA-124 Location 4 "The Bunker".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea124.tscn
## Flow: corridor -> numbers machine -> vault keypad -> alarm -> vault
## open -> elevator. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase3/bunker.tscn")
	var seg := scene.instantiate()
	seg.name = "Bunker"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_corridor()
	await _step2_numbers()
	await _step3_keypad()
	await _step4_alarm()
	await _step5_vault_elevator()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Bunker")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea124_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Bunker segment loaded")
	_check(_player != null, "player present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_corridor() -> void:
	print("[Driver] Step 1: the corridor")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "EXPLORE", "phase EXPLORE")
	_check(_segment.get_radio_signal() >= 70.0, "CLASSIFIED strongest")
	_check(_segment.is_historical_unlocked(), "HISTORICAL unlocked (first appearance)")
	_check(_segment.get_suit_count() == 2, "two suits patrol")
	await get_tree().create_timer(0.5).timeout
	_snap("corridor")


func _step2_numbers() -> void:
	print("[Driver] Step 2: the numbers station")
	_check(not _segment.is_numbers_heard(), "numbers not yet heard")
	_segment.place_player_at_machine_for_testing()
	_segment._process(0.016)
	_check(_segment.is_numbers_heard(), "numbers heard near tape machine")
	await get_tree().create_timer(0.5).timeout
	_snap("numbers_machine")


func _step3_keypad() -> void:
	print("[Driver] Step 3: vault keypad")
	_check(_segment.submit_vault_code("11111") == "wrong", "wrong code 1")
	_check(_segment.submit_vault_code("22222") == "wrong", "wrong code 2")
	await get_tree().create_timer(0.3).timeout
	_snap("keypad_wrong")


func _step4_alarm() -> void:
	print("[Driver] Step 4: the alarm")
	_check(_segment.submit_vault_code("33333") == "alarm", "third wrong triggers alarm")
	_check(_segment.is_alarm_active(), "alarm active")
	await get_tree().create_timer(0.5).timeout
	_snap("alarm")
	# Reset and open properly.
	_segment.reset_for_alarm_testing()
	_segment._process(1.0)
	_check(not _segment.is_alarm_active(), "alarm resets")


func _step5_vault_elevator() -> void:
	print("[Driver] Step 5: vault and elevator")
	_check(_segment.submit_vault_code("22102") == "ok", "correct code opens vault")
	_check(_segment.is_vault_open(), "vault open")
	_check(_segment.is_elevator_powered(), "elevator powered")
	# Save at the desk.
	_segment.place_player_at_desk_for_testing()
	_segment._process(0.016)
	_check(_segment.has_saved(), "office desk save")
	await get_tree().create_timer(0.5).timeout
	_snap("vault_open")
	var got_complete := [false]
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_check(_segment.activate_elevator(true), "elevator activates with key")
	_check(got_complete[0], "segment completed")
	await get_tree().create_timer(0.3).timeout
	_snap("elevator")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
