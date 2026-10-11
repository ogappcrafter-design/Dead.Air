extends Node
## Visual verification driver for DEA-112 Shift 2 "Settling In".
## Runs inside the real game with the full scene + autoloads.
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea112.tscn
## Writes PNG frames to user://screenshot/ and prints PASS/FAIL per check.
## Exit code 0 when all checks pass, 1 otherwise.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _hud: Node = null
var _radio_tuner: Node = null
var _call_manager: Node = null


func _ready() -> void:
	# We ARE the main scene: load the real game scene as a sibling.
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/night_shift.tscn")
	print("[Driver] loaded scene: ", scene)
	if scene != null:
		var game := scene.instantiate()
		print("[Driver] instantiated: ", game)
		game.name = "NightShift"
		get_tree().root.add_child.call_deferred(game)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	for child in get_tree().root.get_children():
		print("[Driver] ROOT CHILD: ", child.name, " (", child.get_class(), ")")
	var ns := get_node_or_null("/root/NightShift")
	if ns:
		for child in ns.get_children():
			print("[Driver] NS CHILD: ", child.name, " (", child.get_class(), ")")
	_resolve_references()
	await _step0_environment()
	await _step1_shift2_start()
	await _step2_pre_shift_exploration()
	await _step3_first_call_tutorial()
	await _step4_calls_progress()
	await _step5_dread_composure_states()
	await _step6_station_degradation()
	await _step7_post_shift()
	_finish()


func _resolve_references() -> void:
	_hud = get_node_or_null("/root/NightShift/HUD")
	_radio_tuner = get_node_or_null("/root/NightShift/RadioConsole/RadioTuner")
	_call_manager = get_node_or_null("/root/CallManager")


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea112_%02d_%s.png" % [_step, name]
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


# ---------------------------------------------------------------------------
# Step 0: environment — real scene running with autoloads attached
# ---------------------------------------------------------------------------


func _step0_environment() -> void:
	print("[Driver] Step 0: verifying environment")
	_check(get_node_or_null("/root/ShiftController") != null, "ShiftController autoload present")
	_check(_call_manager != null, "CallManager autoload present")
	_check(get_node_or_null("/root/StationDegradation") != null, "StationDegradation autoload present")
	_check(get_node_or_null("/root/CRTDegradation") != null, "CRTDegradation autoload present")
	_check(_hud != null, "HUD present in night_shift scene")
	_check(_radio_tuner != null, "RadioTuner present in night_shift scene")
	_check(get_node_or_null("/root/NightShift/GameDirector") != null, "GameDirector present")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	_check(tm != null, "TutorialManager created by GameDirector")
	await get_tree().process_frame
	_snap("boot_state")


# ---------------------------------------------------------------------------
# Step 1: start Shift 2 — flags, bands, degradation, first tutorial step
# ---------------------------------------------------------------------------


func _step1_shift2_start() -> void:
	print("[Driver] Step 1: starting Shift 2 via ShiftController")
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)
	await get_tree().create_timer(0.5).timeout

	_check(ShiftController.get_current_shift() == 2, "current shift == 2")
	_check(ShiftController.is_shift_active(), "shift active")
	_check(ShiftController.is_dread_meter_visible(), "dread meter visible flag")
	_check(ShiftController.is_save_available(), "save available flag")
	var unlocked := ShiftController.get_unlocked_bands()
	_check(unlocked.has("LIVING") and unlocked.has("LIMINAL"), "LIVING + LIMINAL unlocked")
	_check(BandController.is_band_unlocked(0) and BandController.is_band_unlocked(1),
			"BandController LIVING(0) + LIMINAL(1) unlocked")
	_check(not BandController.is_band_unlocked(2), "LOST(2) still locked")
	_check(StationDegradation.get_current_shift() == 2, "StationDegradation applied shift 2")
	_check(StationDegradation.get_mirror_delay() > 0.0, "mirror delay active for shift 2")

	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm:
		_check(tm.is_step_shown(tm.STEP_DREAD_METER), "tutorial step 'dread meter' shown at shift start")
		_check(not tm.is_step_shown(tm.STEP_BAND_SWITCHING), "band switching step not yet shown")
		if tm._overlay:
			_check(tm._overlay.is_active(), "tutorial overlay active at shift start")
		else:
			_check(false, "tutorial overlay exists")
	_check(ShiftController.is_dread_meter_visible()
			and _call_manager.get_dread_composure().is_visible(),
			"dread meter visible at system level")
	_snap("shift2_start_tutorial")


# ---------------------------------------------------------------------------
# Step 2: pre-shift exploration — dismiss overlay, switch bands, tune
# ---------------------------------------------------------------------------


func _step2_pre_shift_exploration() -> void:
	print("[Driver] Step 2: pre-shift exploration")
	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm and tm._overlay and tm._overlay.is_active():
		tm._overlay.hide_overlay()
	await get_tree().create_timer(0.3).timeout

	BandController.set_active_band(1)
	await get_tree().create_timer(0.3).timeout
	_check(BandController.get_active_band().id == 1, "band switched to LIMINAL(1)")
	_snap("pre_shift_band_liminal")

	BandController.set_active_band(0)
	await get_tree().create_timer(0.3).timeout
	_check(BandController.get_active_band().id == 0, "band switched back to LIVING(0)")

	if _radio_tuner:
		_radio_tuner.tune(0.5)
		await get_tree().create_timer(0.3).timeout
	_snap("pre_shift_tuned")


# ---------------------------------------------------------------------------
# Step 3: first call — band switching tutorial step fires
# ---------------------------------------------------------------------------


func _step3_first_call_tutorial() -> void:
	print("[Driver] Step 3: forcing calls to start (skip pre-shift timer)")
	ShiftController._force_enter_calls_active()
	await get_tree().create_timer(2.0).timeout

	_check(ShiftController.get_current_phase_name() == "calls_active", "phase == calls_active")
	_check(_call_manager.is_shift_active(), "CallManager shift active")

	# Wait for the first call to actually start (cooldown 1.0s then INCOMING 2.0s)
	var waited := 0.0
	while _call_manager.get_state() != _call_manager.CallState.ACTIVE and waited < 10.0:
		await get_tree().create_timer(0.25).timeout
		waited += 0.25
	_check(_call_manager.get_state() == _call_manager.CallState.ACTIVE, "first call ACTIVE")
	_snap("first_call_active")

	var tm := get_node_or_null("/root/NightShift/GameDirector/TutorialManager")
	if tm:
		_check(tm.is_step_shown(tm.STEP_BAND_SWITCHING), "band switching step shown on first call")
		if tm._overlay and tm._overlay.is_active():
			_snap("band_switching_overlay")
			tm._overlay.hide_overlay()
	await get_tree().create_timer(0.3).timeout


# ---------------------------------------------------------------------------
# Step 4: call lifecycle — resolve a call and see the queue advance
# ---------------------------------------------------------------------------


func _step4_calls_progress() -> void:
	print("[Driver] Step 4: resolving calls and letting queue advance")
	if _call_manager.get_state() == _call_manager.CallState.ACTIVE:
		_call_manager.skip_call()
	await get_tree().create_timer(3.0).timeout
	_check(_call_manager.get_current_call().size() > 0 or _call_manager.get_state() != _call_manager.CallState.IDLE,
			"queue advanced after skip")
	_snap("call_queue_advanced")


# ---------------------------------------------------------------------------
# Step 5: dread/composure visual states drive the CRT shader
# ---------------------------------------------------------------------------


func _step5_dread_composure_states() -> void:
	print("[Driver] Step 5: dread/composure visual states")
	var dc: Node = _call_manager.get_dread_composure()
	_check(dc != null, "DreadComposure present")

	dc.add_dread(45.0)  # >40: vignette tier
	await get_tree().create_timer(0.5).timeout
	_snap("dread_high")

	dc.add_dread(25.0)  # >60: color distortion tier
	await get_tree().create_timer(0.5).timeout
	_snap("dread_very_high")

	dc.set_composure(15.0)  # <20: severe flicker/glitch tier
	await get_tree().create_timer(0.5).timeout
	_snap("composure_low")

	dc.set_composure(100.0)
	dc.set_dread(0.0)
	await get_tree().create_timer(0.5).timeout


# ---------------------------------------------------------------------------
# Step 6: station degradation — E1/E2 wrongness events
# ---------------------------------------------------------------------------


func _step6_station_degradation() -> void:
	print("[Driver] Step 6: station degradation E1/E2 events")
	StationDegradation.trigger_event("E1")
	await get_tree().create_timer(0.5).timeout
	_snap("e1_hallway_flicker")

	StationDegradation.trigger_event("E2")
	await get_tree().create_timer(0.5).timeout
	_check(StationDegradation.is_office_door_locked(), "E2 locks office door")
	_snap("e2_door_locked")


# ---------------------------------------------------------------------------
# Step 7: post-shift — end shift, verify state machine lands cleanly
# ---------------------------------------------------------------------------


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
