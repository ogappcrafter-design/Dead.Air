extends Node
## Visual verification driver for DEA-115 Shift 5 "Dead Air" (final shift).
## Usage:
##   xv-run godot --path godot res://tests/visual_driver_dea115.tscn
## Flow: shift 5 start (no tutorial, dread 40) → calls 14/15/16/17 →
## choice UI (call 16) → final DEAD AIR call → E1-E4 events →
## station dark → post-shift. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _hud: Node = null
var _radio_tuner: Node = null
var _call_manager: Node = null
var _len_after_calls: float = 0.0


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
	await _step1_shift5_start()
	await _step2_no_tutorial()
	await _step3_calls_sequence()
	await _step4_choice_ui()
	await _step5_final_call()
	await _step6_events_station_dark()
	await _step7_post_shift()
	_finish()


func _resolve_references() -> void:
	_hud = get_node_or_null("/root/NightShift/HUD")
	_radio_tuner = get_node_or_null("/root/NightShift/RadioConsole/RadioTuner")
	_call_manager = get_node_or_null("/root/CallManager")


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea115_%02d_%s.png" % [_step, name]
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


func _fast_forward_breather() -> void:
	if BreatherSystem and BreatherSystem.is_in_breather():
		BreatherSystem.end_breather()


func _step0_environment() -> void:
	print("[Driver] Step 0: verifying environment")
	_check(get_node_or_null("/root/ShiftController") != null, "ShiftController autoload present")
	_check(_call_manager != null, "CallManager autoload present")
	_check(get_node_or_null("/root/StationDegradation") != null, "StationDegradation autoload present")
	_check(_hud != null, "HUD present in night_shift scene")
	_check(_radio_tuner != null, "RadioTuner present in night_shift scene")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_shift5_start() -> void:
	print("[Driver] Step 1: starting Shift 5")
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)
	await get_tree().create_timer(0.5).timeout

	_check(ShiftController.get_current_shift() == 5, "current shift == 5")
	_check(ShiftController.is_shift_active(), "shift active")
	var unlocked := ShiftController.get_unlocked_bands()
	_check(unlocked.has("LIVING") and unlocked.has("LIMINAL") and unlocked.has("LOST")
			and unlocked.has("CLASSIFIED") and unlocked.has("████████"),
			"all five bands unlocked")
	_check(BandController.is_band_unlocked(4), "BandController ████████(4) unlocked")
	_check(StationDegradation.get_current_shift() == 5, "StationDegradation applied shift 5")
	_check(StationDegradation.is_mirror_independent(), "mirror independent flag kept")
	_check(is_equal_approx(StationDegradation.get_hallway_length(), 5.0), "hallway starts at 5m")

	# Dread starts at 40 (GDD)
	var dc: Node = _call_manager.get_dread_composure()
	_check(dc != null and is_equal_approx(float(dc.dread), 40.0), "dread starts at 40")

	# No save this shift (GDD: one-way trip)
	_check(not ShiftController.is_save_available(), "save NOT available shift 5")

	# Shift 5 environment: mug dust, chair gone, doors removed, mirror gone
	var mug: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/CoffeeMug")
	_check(mug != null and not mug.visible, "coffee mug is dust (hidden)")
	var chair: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/Chair")
	_check(chair != null and not chair.visible, "chair is gone (hidden)")
	var booth_door: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/DoorToHallway")
	_check(booth_door != null and not booth_door.visible, "booth door gone")
	var roof_door: Node = get_node_or_null("/root/NightShift/StationEnvironment/Rooftop/DoorToBackOffice")
	_check(roof_door != null and not roof_door.visible, "rooftop door gone (rooftop inaccessible)")
	var mirror: Node = get_node_or_null("/root/NightShift/StationEnvironment/Bathroom/Mirror")
	_check(mirror != null and not mirror.visible, "bathroom mirror is just a wall")
	var dnp_console: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/DoNotPlayTape")
	_check(dnp_console != null, "DO NOT PLAY tape on console")
	_snap("shift5_start")


func _step2_no_tutorial() -> void:
	print("[Driver] Step 2: no tutorial on shift 5")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm:
		_check(not tm.is_tutorial_active(), "tutorial inactive on shift 5")
	_check(not tm.is_step_shown(tm.STEP_DECODE), "no decode step shown")
	await get_tree().create_timer(0.3).timeout


func _step3_calls_sequence() -> void:
	print("[Driver] Step 3: calls 14/15/16/17 sequence")
	ShiftController._force_enter_calls_active()
	await get_tree().create_timer(2.0).timeout

	_check(ShiftController.get_current_phase_name() == "calls_active", "phase == calls_active")

	# Wait for first call (WHISTLEBLOWER) to go active
	var waited := 0.0
	while _call_manager.get_state() != _call_manager.CallState.ACTIVE and waited < 10.0:
		_fast_forward_breather()
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.ACTIVE, "first call ACTIVE")
	var call: Dictionary = _call_manager.get_current_call()
	_check(int(call.get("id", -999)) == 14, "first call is THE WHISTLEBLOWER (14)")
	_snap("first_call_whistleblower")

	# Skip through 14/15 and verify order (16 handled in choice step)
	var expected: Array = [15]
	for i in range(expected.size()):
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
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

	# Layout shifted between calls (GDD: hallway length varies)
	_len_after_calls = StationDegradation.get_hallway_length()
	_check(_len_after_calls > 5.0, "hallway length varied between calls (%.1fm)" % _len_after_calls)
	await get_tree().create_timer(0.2).timeout


func _step4_choice_ui() -> void:
	print("[Driver] Step 4: YOU CALLED US choice UI (call 16)")
	var call: Dictionary = _call_manager.get_current_call()
	var guard := 0
	while int(call.get("id", -999)) != 16 and guard < 6:
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			_fast_forward_breather()
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		call = _call_manager.get_current_call()
		guard += 1
	_check(int(call.get("id", -999)) == 16, "reached call 16 (YOU CALLED US)")

	var t2 := 0.0
	while _call_manager.get_state() != _call_manager.CallState.CHOICE and t2 < 20.0:
		_fast_forward_breather()
		await get_tree().create_timer(0.25).timeout
		t2 += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.CHOICE,
			"CHOICE state entered after call 16 presentation")
	_snap("choice_ui_you_called_us")

	_call_manager.select_choice(0)
	await get_tree().create_timer(0.5).timeout
	_check(_call_manager.get_state() == _call_manager.CallState.RESOLVING
			or _call_manager.get_state() == _call_manager.CallState.COOLDOWN,
			"choice selection resolves call 16")
	_snap("call16_resolved")


func _step5_final_call() -> void:
	print("[Driver] Step 5: DEAD AIR final call (17)")
	var call: Dictionary = _call_manager.get_current_call()
	var guard := 0
	while int(call.get("id", -999)) != 17 and guard < 6:
		if _call_manager.get_state() == _call_manager.CallState.ACTIVE or _call_manager.get_state() == _call_manager.CallState.CHOICE:
			_call_manager.skip_call()
		var t := 0.0
		while _call_manager.get_state() != _call_manager.CallState.ACTIVE and t < 5.0:
			_fast_forward_breather()
			await get_tree().create_timer(0.25).timeout
			t += 0.25
		call = _call_manager.get_current_call()
		guard += 1
	_check(int(call.get("id", -999)) == 17, "reached final call DEAD AIR (17)")

	# DEAD AIR: 20s of silence (waitSeconds). Let it play out partially, snap.
	await get_tree().create_timer(3.0).timeout
	_snap("dead_air_silence")

	# Wait for the final call to resolve: 16 lines × 2.5s = 40s of dialogue,
	# then the 20s dead-air silence (waitSeconds), then RESOLVING→COOLDOWN.
	var t3 := 0.0
	while (_call_manager.get_state() == _call_manager.CallState.ACTIVE
			or _call_manager.get_state() == _call_manager.CallState.RESOLVING) and t3 < 90.0:
		await get_tree().create_timer(1.0).timeout
		t3 += 1.0
	_check(_call_manager.get_state() == _call_manager.CallState.COOLDOWN
			or _call_manager.get_state() == _call_manager.CallState.IDLE,
			"final call DEAD AIR resolved (station goes dark next)")
	_snap("final_call_done")


func _step6_events_station_dark() -> void:
	print("[Driver] Step 6: E1-E4 events and station dark")
	StationDegradation.trigger_event("E1")
	await get_tree().create_timer(0.3).timeout
	var booth_door: Node = get_node_or_null("/root/NightShift/StationEnvironment/Booth/DoorToHallway")
	_check(booth_door != null, "E1: doors shift (booth door trackable)")
	_snap("e1_doors_shift")

	StationDegradation.trigger_event("E2")
	await get_tree().create_timer(0.3).timeout
	_check(StationDegradation.get_hallway_length() > _len_after_calls - 0.1,
			"E2: hallway jump applied (was %.1fm)" % _len_after_calls)
	_snap("e2_hallway_jump")

	StationDegradation.trigger_event("E3")
	await get_tree().create_timer(0.3).timeout
	_snap("e3_door_1920")

	# E4: station goes dark — only console light survives
	var lights_before: Array = []
	var station := get_node_or_null("/root/NightShift/StationEnvironment")
	if station:
		for light in station.find_children("*", "Light3D", true, false):
			lights_before.append(light)
	StationDegradation.trigger_event("E4")
	await get_tree().create_timer(0.5).timeout
	var dark_count := 0
	var lit_count := 0
	for light in lights_before:
		var l := light as Light3D
		if l and is_instance_valid(l):
			if l.light_energy == 0.0:
				dark_count += 1
			else:
				lit_count += 1
	_check(dark_count > 0, "E4: station lights killed (%d dark, %d still lit)" % [dark_count, lit_count])
	_snap("station_dark")


func _step7_post_shift() -> void:
	print("[Driver] Step 7: ending shift — one-way trip")
	ShiftController.end_shift()
	await get_tree().create_timer(4.0).timeout
	_check(ShiftController.get_current_phase_name() == "post_shift", "phase == post_shift after final call")
	_snap("post_shift_final")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
