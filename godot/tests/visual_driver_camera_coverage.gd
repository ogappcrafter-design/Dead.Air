extends Node
## Visual verification driver for DEA-177 fixed-camera coverage.
## Usage:  xvfb-run -a godot --path godot --rendering-method gl_compatibility \
##           res://tests/visual_driver_camera_coverage.tscn
## Flow: for each of the nine zero-zone scenes, walk the player through every
## authored zone and snapshot the frame each cut produces. The camera must land
## on the zone's own angle, so the images double as the coverage eyeball check.
## Screenshots to user://screenshot/. Exit code 0 when every zone matched.

const SegmentCameraScript = preload("res://src/visual/segment_camera.gd")

const OUT_DIR := "screenshot"

const SCENES := [
	["first_house", "res://scenes/phase2/first_house.tscn"],
	["follower", "res://scenes/phase2/follower.tscn"],
	["static_sky", "res://scenes/phase2/static_sky.tscn"],
	["bunker", "res://scenes/phase3/bunker.tscn"],
	["highway", "res://scenes/phase3/highway.tscn"],
	["liminal_space", "res://scenes/phase3/liminal_space.tscn"],
	["chamber", "res://scenes/phase4/chamber.tscn"],
	["clearing", "res://scenes/phase4/clearing.tscn"],
	["staircase", "res://scenes/phase4/staircase.tscn"],
]

var _step := 0
var _failures := 0
var _snaps := 0


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	_run()


func _run() -> void:
	for entry in SCENES:
		await _run_scene(String(entry[0]), String(entry[1]))
	print("[Driver] %d snapshots, %d failures" % [_snaps, _failures])
	get_tree().quit(0 if _failures == 0 else 1)


func _run_scene(key: String, path: String) -> void:
	var scene: PackedScene = load(path)
	if scene == null:
		_fail(key, "scene loads")
		return
	var segment: Node = scene.instantiate()
	get_tree().root.add_child.call_deferred(segment)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(0.6).timeout

	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_fail(key, "player present")
		await _teardown(segment)
		return

	var cam_mgr: Node = get_node_or_null("/root/CameraManager")
	var defs: Array = SegmentCameraScript.COVERAGE[key]
	# Hold the body still: gravity would otherwise drop it out of a raised zone
	# (the staircase shaft) before the cut finishes and the frame is taken.
	var had_physics: bool = player.is_physics_processing()
	player.set_physics_process(false)
	for i in range(defs.size()):
		var def: Dictionary = defs[i]
		var angle_id: String = String(def["angle_id"])
		# Step outside every box first so the previous zone emits its exit and the
		# next zone's enter is not rejected by the still-active higher priority.
		player.global_position = Vector3(0.0, 1000.0, 0.0)
		await get_tree().physics_frame
		await get_tree().physics_frame
		player.global_position = def["zone_pos"]
		# Teleporting is not walking: the highway loops the player back to the
		# road start when it believes a large distance was covered, which would
		# undo the jump into the far zones.
		if "_player_last_x" in segment:
			segment._player_last_x = player.global_position.x
		await get_tree().physics_frame
		await get_tree().physics_frame
		# Let the 0.75 s static cut finish before the frame is worth looking at.
		await get_tree().create_timer(1.0).timeout
		var active: String = String(cam_mgr.get_active_angle_id()) if cam_mgr != null else ""
		if active == angle_id:
			print("[Driver] PASS %s/%s" % [key, angle_id])
		else:
			_fail(key, "%s active (got '%s')" % [angle_id, active])
		_snap("%s_%s" % [key, angle_id])
	if had_physics:
		player.set_physics_process(true)
	await _teardown(segment)


func _teardown(segment: Node) -> void:
	var cam_mgr: Node = get_node_or_null("/root/CameraManager")
	if cam_mgr != null:
		cam_mgr.reset()
	if segment != null:
		if segment.has_method("_reset_for_testing"):
			segment._reset_for_testing()
		segment.queue_free()
	await get_tree().process_frame


func _snap(name: String) -> void:
	_step += 1
	_snaps += 1
	var path := OUT_DIR + "/dea177_%02d_%s.png" % [_step, name]
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png("user://" + path)
	print("[Driver] snapshot user://%s (err=%d)" % [path, err])


func _fail(key: String, label: String) -> void:
	_failures += 1
	print("[Driver] *** FAIL %s: %s" % [key, label])
