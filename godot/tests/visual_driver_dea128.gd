extends Node
## Visual verification driver for DEA-128 Phase 4 Step 1 "The Clearing".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea128.tscn
## Flow: clearing with tower -> fragments -> tower approach -> door.
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase4/clearing.tscn")
	var seg := scene.instantiate()
	seg.name = "Clearing"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_arrival()
	await _step2_fragments()
	await _step3_tower()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Clearing")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea128_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Clearing segment loaded")
	_check(_player != null, "player present")
	_check(_segment.get_node_or_null("Tower") != null, "tower present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_arrival() -> void:
	print("[Driver] Step 1: arrival in the clearing")
	_check(_segment.is_started(), "segment started")
	_check(PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_4_DESCENT, "PHASE_4_DESCENT")
	_check(_segment.get_radio_band_id() == 4, "redacted band tuned")
	_check(_segment.get_radio_signal() >= 80.0, "signal strong and constant")
	_check(_segment.is_origin_call_started(), "ORIGIN call started automatically")
	await get_tree().create_timer(0.5).timeout
	_snap("clearing_arrival")


func _step2_fragments() -> void:
	print("[Driver] Step 2: the three fragments")
	_check(_segment.get_node_or_null("Fragments/Machine") != null, "machine fragment present")
	_check(_segment.get_node_or_null("Fragments/Grave") != null, "grave fragment present")
	_check(_segment.get_node_or_null("Fragments/Farmhouse") != null, "farmhouse fragment present")
	# Walk to the machine.
	_player.global_position = _segment.get_node("Fragments/Machine").global_position + Vector3(1, 0.5, 0)
	_segment._process(0.016)
	_check(_segment.get_fragments_found().has("machine"), "machine fragment found by proximity")
	await get_tree().create_timer(0.4).timeout
	_snap("fragments")


func _step3_tower() -> void:
	print("[Driver] Step 3: the tower")
	var got_tower := [false]
	_segment.tower_reached.connect(func() -> void: got_tower[0] = true)
	# Approach the tower.
	_player.global_position = Vector3(0, 0.5, -33)
	_segment._process(0.016)
	_check(_segment.get_phase_name() == "TOWER", "TOWER phase on approach")
	_player.global_position = Vector3(0, 0.5, -36)
	_segment._process(0.016)
	_check(got_tower[0], "tower reached")
	await get_tree().create_timer(0.4).timeout
	_snap("tower_door")
	var got_complete := [false]
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	var timeout_timer := get_tree().create_timer(2.0)
	await timeout_timer.timeout
	_check(got_complete[0], "segment completed (door open)")
	_snap("tower_complete")


func _finish() -> void:
	print("[Driver] step count: ", _step)
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
