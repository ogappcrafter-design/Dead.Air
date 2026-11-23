extends Node

## Visual verification driver for DEA-178 lighting & atmosphere pass.
## Renders all station and phase scenes under both normal lighting and reduce-horror mode.
## Verifies darkness budget (no pitch-black rooms) and that reduce-horror increases visibility.
## Usage: xvfb-run -a godot --path godot --rendering-method gl_compatibility res://tests/visual_driver_lighting.tscn

const OUT_DIR := "res://screenshot"

const SCENES: Array = [
	["station_booth", "res://scenes/station/booth.tscn", Vector3(0.5, 1.4, 1.8), Vector3(-10, 0, 0)],
	["station_hallway", "res://scenes/station/hallway.tscn", Vector3(0, 1.4, 2.0), Vector3(-8, 0, 0)],
	["station_bathroom", "res://scenes/station/bathroom.tscn", Vector3(0, 1.4, 1.5), Vector3(-10, 0, 0)],
	["station_back_office", "res://scenes/station/back_office.tscn", Vector3(0, 1.4, 1.8), Vector3(-10, 0, 0)],
	["station_rooftop", "res://scenes/station/rooftop.tscn", Vector3(0, 4.0, 4.0), Vector3(-15, 0, 0)],
	["phase2_threshold", "res://scenes/phase2/threshold.tscn", Vector3(25, 1.8, 3.5), Vector3(-10, 0, 0)],
	["phase2_first_house", "res://scenes/phase2/first_house.tscn", Vector3(-1, 1.8, 3.0), Vector3(-10, 0, 0)],
	["phase2_follower", "res://scenes/phase2/follower.tscn", Vector3(25, 2.0, 8.0), Vector3(-8, 0, 0)],
	["phase2_static_sky", "res://scenes/phase2/static_sky.tscn", Vector3(0, 2.0, 6.0), Vector3(-10, 0, 0)],
	["phase3_highway", "res://scenes/phase3/highway.tscn", Vector3(20, 2.5, 10.0), Vector3(-10, 0, 0)],
	["phase3_neighborhood", "res://scenes/phase3/neighborhood.tscn", Vector3(20, 2.5, 10.0), Vector3(-10, 0, 0)],
	["phase3_bunker", "res://scenes/phase3/bunker.tscn", Vector3(0, 2.0, 6.0), Vector3(-10, 0, 0)],
	["phase3_liminal_space", "res://scenes/phase3/liminal_space.tscn", Vector3(0, 2.0, 6.0), Vector3(-10, 0, 0)],
	["phase4_clearing", "res://scenes/phase4/clearing.tscn", Vector3(0, 2.0, 8.0), Vector3(-8, 0, 0)],
	["phase4_staircase", "res://scenes/phase4/staircase.tscn", Vector3(0, 2.0, 4.0), Vector3(-15, 0, 0)],
	["phase4_chamber", "res://scenes/phase4/chamber.tscn", Vector3(0, -197.0, 6.0), Vector3(-12, 0, 0)],
]

var _failures: int = 0
var _snaps: int = 0


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	_run()


func _run() -> void:
	print("[LightingDriver] Starting lighting verification across %d scenes..." % SCENES.size())
	for item in SCENES:
		await _process_scene(item[0], item[1], item[2], item[3])
	print("[LightingDriver] Finished with %d snaps, %d failures" % [_snaps, _failures])
	get_tree().quit(0 if _failures == 0 else 1)


func _process_scene(key: String, scene_path: String, cam_pos: Vector3, cam_rot: Vector3) -> void:
	var scene: PackedScene = load(scene_path)
	if scene == null:
		printerr("[LightingDriver] FAIL: Could not load ", scene_path)
		_failures += 1
		return

	var inst: Node = scene.instantiate()
	get_tree().root.add_child(inst)

	# Set up dedicated verification camera
	var cam := Camera3D.new()
	cam.position = cam_pos
	cam.rotation_degrees = cam_rot
	cam.current = true
	get_tree().root.add_child(cam)

	# Ensure reduce-horror is off initially
	if AccessibilityManager:
		AccessibilityManager.set_reduce_horror(false)

	# Wait for static cuts and transitions to settle
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	cam.current = true

	# 1. Capture normal lighting
	var normal_img := get_viewport().get_texture().get_image()
	var normal_luma := _calculate_mean_luma(normal_img)
	var normal_path := "%s/dea178_%s_normal.png" % [OUT_DIR, key]
	normal_img.save_png(ProjectSettings.globalize_path(normal_path))
	_snaps += 1

	# Playable visibility check: minimum luma > 3.0 (no pitch black room)
	if normal_luma < 3.0:
		printerr("[LightingDriver] FAIL %s normal luma too dark: %.2f" % [key, normal_luma])
		_failures += 1
	else:
		print("[LightingDriver] PASS %s normal luma: %.2f" % [key, normal_luma])

	# 2. Toggle reduce-horror on
	if AccessibilityManager:
		AccessibilityManager.set_reduce_horror(true)
	await get_tree().process_frame
	await get_tree().create_timer(0.2).timeout

	# 3. Capture reduce-horror variant
	var rh_img := get_viewport().get_texture().get_image()
	var rh_luma := _calculate_mean_luma(rh_img)
	var rh_path := "%s/dea178_%s_reduce_horror.png" % [OUT_DIR, key]
	rh_img.save_png(ProjectSettings.globalize_path(rh_path))
	_snaps += 1

	if rh_luma < normal_luma:
		printerr("[LightingDriver] FAIL %s reduce_horror luma did not increase: normal=%.2f, rh=%.2f" % [key, normal_luma, rh_luma])
		_failures += 1
	else:
		print("[LightingDriver] PASS %s reduce_horror luma: %.2f (boost=%.2f)" % [key, rh_luma, rh_luma - normal_luma])

	# Cleanup
	if AccessibilityManager:
		AccessibilityManager.set_reduce_horror(false)
	cam.queue_free()
	inst.queue_free()
	await get_tree().process_frame


func _calculate_mean_luma(img: Image) -> float:
	var total: float = 0.0
	var w := img.get_width()
	var h := img.get_height()
	var step := 4  # sample every 4th pixel for speed
	var count := 0
	for y in range(0, h, step):
		for x in range(0, w, step):
			var c := img.get_pixel(x, y)
			# Standard Rec. 709 luma
			var luma := (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) * 255.0
			total += luma
			count += 1
	return total / float(max(1, count))
