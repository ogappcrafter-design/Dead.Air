extends Node
## Visual verification driver for DEA-120 Segment 2D "The First House".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea120.tscn
## Flow: arrival (living room, garden window) -> voice starts -> kitchen
## (camera shift, name heard) -> LIMINAL reveal -> walls breathing ->
## exit -> complete. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase2/first_house.tscn")
	var seg := scene.instantiate()
	seg.name = "FirstHouse"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_arrival()
	await _step2_voice()
	await _step3_kitchen_name()
	await _step4_liminal_walls()
	await _step5_exit()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/FirstHouse")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea120_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "FirstHouse segment loaded")
	_check(_player != null, "player present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_arrival() -> void:
	print("[Driver] Step 1: arrival")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "ARRIVAL", "phase == ARRIVAL")
	_segment._process(0.016)
	_check(_segment.get_radio_signal() <= 0.001, "radio dead at arrival")
	await get_tree().create_timer(0.5).timeout
	_snap("arrival_living_room")


func _step2_voice() -> void:
	print("[Driver] Step 2: voice")
	_segment.force_voice_phase_for_testing()
	_check(_segment.get_phase_name() == "VOICE", "phase == VOICE")
	_check(_segment.is_voice_on(), "voice on (in-world, from kitchen)")
	# Walk toward the kitchen to test proximity attenuation.
	_player.global_position = Vector3(2.0, 0.5, -2.0)
	await get_tree().create_timer(0.4).timeout
	var near_att: float = _segment.get_voice_distance_attenuation()
	_player.global_position = Vector3(-2.0, 0.5, 3.0)
	await get_tree().create_timer(0.4).timeout
	var far_att: float = _segment.get_voice_distance_attenuation()
	_check(near_att > far_att, "voice louder near kitchen")
	await get_tree().create_timer(0.3).timeout
	_snap("voice_kitchen_glow")


func _step3_kitchen_name() -> void:
	print("[Driver] Step 3: kitchen, name")
	_segment.force_kitchen_for_testing()
	_check(_segment.get_phase_name() == "KITCHEN", "kitchen entry -> KITCHEN")
	_segment.skip_voice_to_name_for_testing()
	_check(_segment.is_name_heard(), "name heard at end of garden report")
	await get_tree().create_timer(0.4).timeout
	_snap("kitchen_name")


func _step4_liminal_walls() -> void:
	print("[Driver] Step 4: liminal reveal, walls")
	_segment.force_liminal_for_testing()
	_check(_segment.get_phase_name() == "LIMINAL", "phase == LIMINAL")
	_check(_segment.is_liminal_unlocked(), "LIMINAL band unlocked")
	_segment._process(0.016)
	var sig: float = _segment.get_radio_signal()
	_check(sig > 0.0 and sig <= 20.0, "whisper signal after reveal")
	await get_tree().create_timer(0.4).timeout
	_snap("liminal_reveal")
	_segment._walls_timer = 99.0
	_segment._process(0.016)
	_check(_segment.get_phase_name() == "WALLS", "walls breathe after delay")
	_segment._process(0.016)
	_check(_segment.get_wall_offset() > 0.0, "wall breathing visible")
	_check(_segment.is_breath_playing(), "sub-bass breath playing")
	await get_tree().create_timer(0.5).timeout
	_snap("walls_breathing")


func _step5_exit() -> void:
	print("[Driver] Step 5: exit, complete")
	var got_exit := [false]
	var got_complete := [false]
	_segment.house_exited.connect(func() -> void: got_exit[0] = true)
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_segment.force_exit_for_testing()
	_check(got_exit[0], "house exited")
	await get_tree().create_timer(2.5).timeout
	_check(got_complete[0], "segment completed")
	_check(PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_3_JOURNEY,
		"PhaseManager now PHASE_3_JOURNEY")
	await get_tree().create_timer(0.3).timeout
	_snap("neighborhood_begins")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
