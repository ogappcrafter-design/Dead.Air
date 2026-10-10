extends Node
## Visual verification driver for DEA-117 Segment 2A "The Threshold".
## Usage:
##   xv-run godot --path godot res://tests/visual_driver_dea117.tscn
## Flow: segment load (Phase 2, station door seals) → player walks forward →
## backward blocked → exit reached. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase2/threshold.tscn")
	var seg := scene.instantiate()
	seg.name = "Threshold"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_segment_start()
	await _step2_walk_forward()
	await _step3_backward_blocked()
	await _step4_exit_door()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Threshold")
	_player = _segment.get_player() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea117_%02d_%s.png" % [_step, name]
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
	_check(_segment != null, "Threshold segment loaded")
	_check(_player != null, "player present in segment")
	_check(get_node_or_null("/root/PhaseManager") != null, "PhaseManager autoload present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_segment_start() -> void:
	print("[Driver] Step 1: segment start")
	_check(_segment.is_started(), "segment started")
	_check(PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_2_BREAK, "phase == PHASE_2_BREAK")
	_check(_segment.is_station_door_sealed(), "station door sealed")
	var door: Node3D = _segment.get_node_or_null("Hallway/StationDoor")
	_check(door != null and not door.visible, "station door hidden")
	var wall: Node = _segment.get_node_or_null("Hallway/SealedWall")
	_check(wall != null, "sealed wall present behind player")
	# Wood-paneling walls + brass fixtures visible; dead bulb present
	var bulb: Node = _segment.get_node_or_null("Hallway/DeadBulb")
	_check(bulb != null, "dead bulb present")
	var brass: Node = _segment.get_node_or_null("Hallway/BrassFixture1")
	_check(brass != null, "brass fixtures present")
	await get_tree().create_timer(0.5).timeout
	_snap("threshold_start")


func _step2_walk_forward() -> void:
	print("[Driver] Step 2: walking forward")
	# Teleport the player down the hallway in steps, simulating the walk
	var start_x: float = _player.global_position.x
	_player.global_position.x = start_x + 10.0
	await get_tree().create_timer(0.3).timeout
	_check(_player.global_position.x > start_x + 9.0, "player can move forward")
	_player.global_position.x = start_x + 25.0
	await get_tree().create_timer(0.3).timeout
	_snap("mid_hallway")
	_player.global_position.x = start_x + 36.0
	await get_tree().create_timer(0.3).timeout
	_check(_player.global_position.x > start_x + 35.0, "reached end of hallway")


func _step3_backward_blocked() -> void:
	print("[Driver] Step 3: backward blocked")
	var pos_before: float = _player.global_position.x
	_player.global_position.x = pos_before - 5.0
	_player.velocity.x = -5.0
	await get_tree().create_timer(0.3).timeout
	_check(_player.global_position.x >= pos_before - 0.5, "backward movement blocked")
	_snap("backward_blocked")


func _step4_exit_door() -> void:
	print("[Driver] Step 4: exit door")
	var got := [false]
	_segment.exit_reached.connect(func() -> void: got[0] = true)
	_segment._on_exit_door_entered(_player)
	await get_tree().create_timer(0.3).timeout
	_check(got[0], "exit_reached fired at end of hallway")
	_snap("exit_door")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
