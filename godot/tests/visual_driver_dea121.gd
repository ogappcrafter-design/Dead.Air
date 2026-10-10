extends Node
## Visual verification driver for DEA-121 Location 1 "The Neighborhood".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea121.tscn
## Flow: street overview -> house entry -> signal navigation -> evidence
## -> grief -> wrong house -> hole -> complete. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase3/neighborhood.tscn")
	var seg := scene.instantiate()
	seg.name = "Neighborhood"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_street()
	await _step2_navigation()
	await _step3_evidence_grief()
	await _step4_wrong_house()
	await _step5_shed_save()
	await _step6_hole()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Neighborhood")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea121_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Neighborhood segment loaded")
	_check(_player != null, "player present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_street() -> void:
	print("[Driver] Step 1: street overview")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "EXPLORE", "phase EXPLORE")
	# All six houses + shed + hole exist
	_check(_segment.get_node_or_null("HouseA") != null, "House A exists")
	_check(_segment.get_node_or_null("HouseB") != null, "House B exists")
	_check(_segment.get_node_or_null("HouseC") != null, "House C exists")
	_check(_segment.get_node_or_null("HouseE") != null and _segment.get_node_or_null("HouseF") != null, "locked houses exist")
	_check(_segment.get_node_or_null("HouseA/Garden/Tomatoes") != null, "tomato garden visible")
	await get_tree().create_timer(0.5).timeout
	_snap("street_overview")


func _step2_navigation() -> void:
	print("[Driver] Step 2: navigation by signal")
	# Face house A: strong signal
	_segment._face_player(Vector3(1, 0, 0))
	_segment._process(0.016)
	var aligned: float = _segment.get_radio_signal()
	_segment._face_player(Vector3(-1, 0, 0))
	_segment._process(0.016)
	var away: float = _segment.get_radio_signal()
	_check(aligned > away, "signal stronger facing house A")
	# Camera zone system: zones registered with angles (active angle switches
	# when the player physically enters a zone; here we verify registration).
	var cm: Node = get_node_or_null("/root/CameraManager")
	var zones: Array = get_tree().get_nodes_in_group("camera_zone")
	var zones_ok := zones.size() == 5
	if zones_ok:
		for z in zones:
			if z is CameraZone and (z as CameraZone).camera_angle == null:
				zones_ok = false
	_check(cm != null and zones_ok, "camera zones registered with angles (zone system)")
	await get_tree().create_timer(0.4).timeout
	_snap("navigation_signal")


func _step3_evidence_grief() -> void:
	print("[Driver] Step 3: evidence and grief")
	var got_grief := [false]
	_segment.grief_started.connect(func() -> void: got_grief[0] = true)
	_segment.examine_evidence_for_testing("photo", "A_harold")
	_segment.examine_evidence_for_testing("tapes", "B_collector")
	_segment.examine_evidence_for_testing("phone_log", "C_wrongnumber")
	_check(_segment.get_evidence_count() == 3, "three evidence items examined")
	_check(got_grief[0], "grief started after third")
	_check(_segment.is_grief_active(), "grief active")
	await get_tree().create_timer(0.5).timeout
	_snap("grief")


func _step4_wrong_house() -> void:
	print("[Driver] Step 4: wrong house")
	var before: float = _segment.get_composure()
	_segment.enter_house_for_testing("E_locked")
	var after: float = _segment.get_composure()
	_check(after < before, "wrong house cost composure")
	await get_tree().create_timer(0.3).timeout
	_snap("wrong_house")


func _step5_shed_save() -> void:
	print("[Driver] Step 5: shed save")
	var got_save := [""]
	_segment.save_performed.connect(func(tid: String) -> void: got_save[0] = tid)
	_segment._enter_shed()
	_check(got_save[0] == "shed_1", "cassette saved in shed")
	_check(_segment.has_saved(), "save recorded")
	await get_tree().create_timer(0.4).timeout
	_snap("shed_save")


func _step6_hole() -> void:
	print("[Driver] Step 6: the hole")
	_segment.reach_hole_for_testing()
	_check(_segment.get_phase_name() == "HOLE", "phase HOLE")
	_segment._process(0.016)
	_check(_segment.get_radio_signal() == 0.0, "silence at the hole")
	_segment._hole_timer = 4.5
	_segment._process(0.016)
	_check(_segment._hole_voice_started, "1923 voice calls down")
	await get_tree().create_timer(0.4).timeout
	_snap("the_hole")
	_segment._hole_timer = 10.5
	_segment._process(0.016)
	_check(_segment.get_phase_name() == "COMPLETED", "segment completed (fall)")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
