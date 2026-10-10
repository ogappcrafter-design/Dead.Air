extends Node
## Visual verification driver for DEA-113 Shift 3 "The Dead".
## Usage:
##   xv-run godot --path godot res://tests/visual_driver_dea113.tscn
## Flow: shift 3 start (recording tutorial) → calls 6/7/8/9 → dread states →
## E1/E2/E3 wrongness events → post-shift. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _hud: Node = null
var _radio_tuner: Node = null
var _call_manager: Node = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/night_shift.tscn")
	if scene != null:
		var game := scene.instantiate()
		game.name = "NightShift"
		get_tree().root.add_child.call_deferred(game)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_shift3_start()
	await _step2_recording_tutorial()
	await _step3_calls_sequence()
	await _step4_lost_band_tuning()
	await _step5_dread_states()
	await _step6_station_events()
	await _step7_post_shift()
	_finish()


func _resolve_references() -> void:
	_hud = get_node_or_null("/root/NightShift/HUD")
	_radio_tuner = get_node_or_null("/root/NightShift/RadioConsole/RadioTuner")
	_call_manager = get_node_or_null("/root/CallManager")


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea113_%02d_%s.png" % [_step, name]
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
	_check(get_node_or_null("/root/ShiftController") != null, "ShiftController autoload present")
	_check(_call_manager != null, "CallManager autoload present")
	_check(get_node_or_null("/root/StationDegradation") != null, "StationDegradation autoload present")
	_check(_hud != null, "HUD present in night_shift scene")
	_check(_radio_tuner != null, "RadioTuner present in night_shift scene")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	_check(tm != null, "TutorialManager created by GameDirector")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_shift3_start() -> void:
	print("[Driver] Step 1: starting Shift 3")
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(3)
	await get_tree().create_timer(0.5).timeout

	_check(ShiftController.get_current_shift() == 3, "current shift == 3")
	_check(ShiftController.is_shift_active(), "shift active")
	var unlocked := ShiftController.get_unlocked_bands()
	_check(unlocked.has("LIVING") and unlocked.has("LIMINAL") and unlocked.has("LOST"),
			"LIVING + LIMINAL + LOST unlocked")
	_check(BandController.is_band_unlocked(2), "BandController LOST(2) unlocked")
	_check(not BandController.is_band_unlocked(3), "CLASSIFIED(3) still locked")
	_check(StationDegradation.get_current_shift() == 3, "StationDegradation applied shift 3")
	_check(is_equal_approx(StationDegradation.get_hallway_length(), 4.5), "hallway length 4.5m")
	_check(ShiftController.is_dread_meter_visible(), "dread meter visible")
	_check(ShiftController.is_save_available(), "save available")
	_snap("shift3_start")


func _step2_recording_tutorial() -> void:
	print("[Driver] Step 2: recording tutorial")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm:
		_check(tm.is_step_shown(tm.STEP_RECORDING), "recording tutorial step shown at shift start")
		if tm._overlay and tm._overlay.is_active():
			_snap("recording_tutorial_overlay")
			tm._overlay.hide_overlay()
	await get_tree().create_timer(0.3).timeout


func _step3_calls_sequence() -> void:
	print("[Driver] Step 3: calls 6/7/8/9 sequence")
	ShiftController._force_enter_calls_active()
	await get_tree().create_timer(2.0).timeout

	_check(ShiftController.get_current_phase_name() == "calls_active", "phase == calls_active")

	# Wait for first call (YESTERDAY'S CALL) to go active
	var waited := 0.0
	while _call_manager.get_state() != _call_manager.CallState.ACTIVE and waited < 10.0:
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.ACTIVE, "first call ACTIVE")
	var call: Dictionary = _call_manager.get_current_call()
	_check(int(call.get("id", -999)) == 6, "first call is YESTERDAY'S CALL (6)")
	_snap("first_call_yesterday")

	# Skip through the sequence and verify order
	var expected: Array = [7, 8, 9]
	for i in range(expected.size()):
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		# Wait through RESOLVING and breather/cooldown for the next call
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		if _call_manager.get_state() != _call_manager.CallState.ACTIVE:
			break
		var next_call: Dictionary = _call_manager.get_current_call()
		_check(int(next_call.get("id", -999)) == expected[i],
				"call %d in sequence is id %d" % [i + 2, expected[i]])
	_snap("sequence_progressed")


func _step4_lost_band_tuning() -> void:
	print("[Driver] Step 4: LOST band tuning")
	BandController.set_active_band(2)
	await get_tree().create_timer(0.3).timeout
	_check(BandController.get_active_band().id == 2, "band switched to LOST(2)")
	_snap("lost_band_active")

	BandController.set_active_band(0)
	await get_tree().create_timer(0.3).timeout


func _step5_dread_states() -> void:
	print("[Driver] Step 5: dread visual states")
	var dc: Node = _call_manager.get_dread_composure()
	dc.add_dread(45.0)
	await get_tree().create_timer(0.5).timeout
	_snap("dread_high")

	dc.add_dread(25.0)
	await get_tree().create_timer(0.5).timeout
	_snap("dread_very_high")

	dc.set_composure(100.0)
	dc.set_dread(0.0)
	await get_tree().create_timer(0.5).timeout


func _step6_station_events() -> void:
	print("[Driver] Step 6: E1/E2/E3 wrongness events")
	StationDegradation.trigger_event("E1")
	await get_tree().create_timer(0.5).timeout
	_check(is_equal_approx(StationDegradation.get_hallway_length(), 5.0), "E1: hallway stretched to 5m")
	_snap("e1_hallway_stretched")

	StationDegradation.trigger_event("E2")
	await get_tree().create_timer(0.3).timeout
	var photo: Node = get_node_or_null("/root/NightShift/StationEnvironment/Hallway/FamilyPhoto")
	_check(photo != null and photo.get_meta("face_blurred", false), "E2: photo face blurred")
	_snap("e2_photo_blurred")

	StationDegradation.trigger_event("E3")
	await get_tree().create_timer(0.3).timeout
	var floor_node: Node = get_node_or_null("/root/NightShift/StationEnvironment/Bathroom/Floor")
	_check(floor_node != null and is_equal_approx(floor_node.rotation_degrees.z, 90.0),
			"E3: bathroom tile rotated 90 degrees")
	_snap("e3_tile_rotated")


func _step7_post_shift() -> void:
	print("[Driver] Step 7: ending shift")
	ShiftController.end_shift()
	await get_tree().create_timer(4.0).timeout
	_check(ShiftController.get_current_phase_name() == "post_shift", "phase == post_shift after calls end")
	_snap("post_shift")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
