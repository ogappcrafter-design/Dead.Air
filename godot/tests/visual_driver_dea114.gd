extends Node
## Visual verification driver for DEA-114 Shift 4 "Classified".
## Usage:
##   xv-run godot --path godot res://tests/visual_driver_dea114.tscn
## Flow: shift 4 start (decode tutorial) → calls 10/11/12/13 → decode UI →
## choice UI → E1–E4 wrongness events → post-shift. Screenshots to user://screenshot/.
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
	await _step1_shift4_start()
	await _step2_decode_tutorial()
	await _step3_calls_sequence()
	await _step4_choice_ui()
	await _step5_decode_ui()
	await _step6_dread_states()
	await _step7_station_events()
	await _step8_post_shift()
	_finish()


func _resolve_references() -> void:
	_hud = get_node_or_null("/root/NightShift/HUD")
	_radio_tuner = get_node_or_null("/root/NightShift/RadioConsole/RadioTuner")
	_call_manager = get_node_or_null("/root/CallManager")


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea114_%02d_%s.png" % [_step, name]
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
	var decode_display := get_node_or_null("/root/CallPlayer/SignalDecodeDisplay")
	_check(decode_display != null, "SignalDecodeDisplay instantiated by CallPlayer")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_shift4_start() -> void:
	print("[Driver] Step 1: starting Shift 4")
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(4)
	await get_tree().create_timer(0.5).timeout

	_check(ShiftController.get_current_shift() == 4, "current shift == 4")
	_check(ShiftController.is_shift_active(), "shift active")
	var unlocked := ShiftController.get_unlocked_bands()
	_check(unlocked.has("LIVING") and unlocked.has("LIMINAL") and unlocked.has("LOST")
			and unlocked.has("CLASSIFIED"), "LIVING+LIMINAL+LOST+CLASSIFIED unlocked")
	_check(BandController.is_band_unlocked(3), "BandController CLASSIFIED(3) unlocked")
	_check(not BandController.is_band_unlocked(4), "band 4 still locked")
	_check(StationDegradation.get_current_shift() == 4, "StationDegradation applied shift 4")
	_check(StationDegradation.is_mirror_independent(), "mirror independent flag set")
	_check(is_equal_approx(StationDegradation.get_hallway_length(), 5.0), "hallway length 5m")
	_check(ShiftController.is_dread_meter_visible(), "dread meter visible")
	_check(ShiftController.is_save_available(), "save available")
	_snap("shift4_start")


func _step2_decode_tutorial() -> void:
	print("[Driver] Step 2: decode tutorial")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm:
		_check(tm.is_step_shown(tm.STEP_DECODE), "decode tutorial step shown at shift start")
		if tm._overlay and tm._overlay.is_active():
			_snap("decode_tutorial_overlay")
			tm._overlay.hide_overlay()
	await get_tree().create_timer(0.3).timeout


func _fast_forward_breather() -> void:
	# Real breathers are 30-90s; skip them so the driver doesn't stall.
	if BreatherSystem and BreatherSystem.is_in_breather():
		BreatherSystem.end_breather()


func _step3_calls_sequence() -> void:
	print("[Driver] Step 3: calls 10/11/12/13 sequence")
	ShiftController._force_enter_calls_active()
	await get_tree().create_timer(2.0).timeout

	_check(ShiftController.get_current_phase_name() == "calls_active", "phase == calls_active")

	# Wait for first call (GRAND) to go active
	var waited := 0.0
	while _call_manager.get_state() != _call_manager.CallState.ACTIVE and waited < 10.0:
		_fast_forward_breather()
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.ACTIVE, "first call ACTIVE")
	var call: Dictionary = _call_manager.get_current_call()
	_check(int(call.get("id", -999)) == 10, "first call is GRAND (10)")
	_snap("first_call_grand")

	# Skip through calls 10/11 and verify order (call 12 handled in choice step)
	var expected: Array = [11]
	for i in range(expected.size()):
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		# Wait through RESOLVING and breather/cooldown for the next call
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			_fast_forward_breather()
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		if _call_manager.get_state() != _call_manager.CallState.ACTIVE:
			break
		var next_call: Dictionary = _call_manager.get_current_call()
		_check(int(next_call.get("id", -999)) == expected[i],
				"call %d in sequence is id %d" % [i + 2, expected[i]])
	_snap("sequence_progressed")


func _step4_choice_ui() -> void:
	print("[Driver] Step 4: AGENT 7 choice UI (call 12)")
	# If we're mid-call 11, skip to reach call 12
	var call: Dictionary = _call_manager.get_current_call()
	var guard := 0
	while int(call.get("id", -999)) != 12 and guard < 6:
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			_fast_forward_breather()
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		call = _call_manager.get_current_call()
		guard += 1
	_check(int(call.get("id", -999)) == 12, "reached call 12 (AGENT 7)")

	# Let CallPlayer finish presenting lines; CHOICE state must follow
	var t2 := 0.0
	while _call_manager.get_state() != _call_manager.CallState.CHOICE and t2 < 20.0:
		_fast_forward_breather()
		await get_tree().create_timer(0.25).timeout
		t2 += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.CHOICE,
			"CHOICE state entered after call 12 presentation (CallPlayer.call_display_complete)")
	_snap("choice_ui_agent7")

	# Select the tape-bearing choice (Cooperate., index 0 per calls.json)
	_call_manager.select_choice(0)
	await get_tree().create_timer(0.5).timeout
	_check(_call_manager.get_state() == _call_manager.CallState.RESOLVING
			or _call_manager.get_state() == _call_manager.CallState.COOLDOWN,
			"choice selection resolves call 12")
	_snap("call12_resolved")


func _step5_decode_ui() -> void:
	print("[Driver] Step 5: ARIA-9 decode UI (call 13)")
	var call: Dictionary = _call_manager.get_current_call()
	var guard := 0
	while int(call.get("id", -999)) != 13 and guard < 6:
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			_fast_forward_breather()
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		call = _call_manager.get_current_call()
		guard += 1
	_check(int(call.get("id", -999)) == 13, "reached call 13 (ARIA-9)")

	# Intro line plays, then decode UI reveals
	var decode_display := get_node_or_null("/root/CallPlayer/SignalDecodeDisplay")
	var t2 := 0.0
	while (decode_display == null or not decode_display.is_active()) and t2 < 15.0:
		_fast_forward_breather()
		await get_tree().create_timer(0.25).timeout
		t2 += 0.25
	_check(decode_display != null and decode_display.is_active(), "decode UI revealed for ARIA-9")
	_snap("decode_ui_input")

	# Enter the correct sequence [2,2,1,0,2] by pressing the symbol pad
	if decode_display and decode_display.is_active():
		var seq: Array = call.get("sequence", [])
		for idx in seq:
			decode_display._on_symbol_pressed(int(idx))
		# Correct input → SUCCESS phase shows decoded message for 3s
		await get_tree().create_timer(0.3).timeout
		_check(decode_display._phase == decode_display.Phase.SUCCESS,
				"decode SUCCESS phase with correct input")
		_snap("decode_success_message")
		# Wait for the 3s hold + result + resolution
		var t3 := 0.0
		while _call_manager.get_state() == _call_manager.CallState.RESOLVING and t3 < 6.0:
			await get_tree().create_timer(0.25).timeout
			t3 += 0.25


func _step6_dread_states() -> void:
	print("[Driver] Step 6: dread visual states")
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


func _step7_station_events() -> void:
	print("[Driver] Step 7: E1–E4 wrongness events")
	StationDegradation.trigger_event("E1")
	await get_tree().create_timer(0.3).timeout
	var door: Node = get_node_or_null("/root/NightShift/StationEnvironment/Bathroom/DoorToHallway")
	_check(door != null, "E1: bathroom door present")
	_snap("e1_bathroom_wrong")

	StationDegradation.trigger_event("E2")
	await get_tree().create_timer(0.3).timeout
	var second_chair: Node = get_node_or_null("/root/NightShift/StationEnvironment/BackOffice/SecondChair")
	_check(second_chair != null, "E2: second chair present in back office")
	_snap("e2_second_chair")

	StationDegradation.trigger_event("E3")
	await get_tree().create_timer(0.3).timeout
	_check(StationDegradation.is_antenna_tracking(), "E3: antenna tracking flag set")
	var mast: Node = get_node_or_null("/root/NightShift/StationEnvironment/Rooftop/AntennaMast")
	_check(mast != null and mast.get_meta("tracks_player", false), "E3: antenna mast tracks_player meta")
	_snap("e3_antenna_tracking")

	StationDegradation.trigger_event("E4")
	await get_tree().create_timer(0.3).timeout
	var booth: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth")
	_check(booth != null and booth.get_meta("reflection_independent", false),
			"E4: booth reflection_independent meta")
	_snap("e4_reflection")

	# Verify shift 4 permanent degradation visuals
	var mug: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/CoffeeMug")
	_check(mug != null and is_equal_approx(mug.rotation_degrees.z, 90.0),
			"coffee mug shattered (rotated 90)")
	var chair: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/Chair")
	_check(chair != null and is_equal_approx(chair.rotation_degrees.y, 90.0),
			"chair faces door (rotated 90)")
	var dnp: Node = get_node_or_null("/root/NightShift/StationEnvironment/Rooftop/DoNotPlayTape")
	_check(dnp != null, "DO NOT PLAY tape present on rooftop")
	_snap("station_degradation")


func _step8_post_shift() -> void:
	print("[Driver] Step 8: ending shift")
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
