extends Node
## Visual verification driver for AmbientLife.
## Loads a scene, captures frames over time, and measures pixel change to
## prove ambient motion (particles + flicker) is actually rendering.
## Usage: xvfb-run godot --path godot res://tests/visual_driver_ambient.tscn

const OUT_DIR := "screenshot"
const SCENE_PATH := "res://scenes/station/station.tscn"

var _frames: Array[Image] = []


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load(SCENE_PATH)
	var inst := scene.instantiate()
	inst.name = "Station"
	get_tree().root.add_child.call_deferred(inst)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(2.0).timeout
	# Aim the active camera into the booth interior so particles are in view.
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		cam.global_position = Vector3(-1.1, 1.6, 1.1)
		cam.look_at(Vector3(1.4, 1.3, -0.9))
	await get_tree().create_timer(0.5).timeout
	await _capture_sequence()
	_finish()


func _snap(idx: int) -> Image:
	await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_png("user://%s/ambient_%d.png" % [OUT_DIR, idx])
	return img


func _capture_sequence() -> void:
	# Three frames ~0.8s apart: ambient particles drift and lights flicker,
	# so consecutive frames must differ if motion is live.
	for i in range(3):
		_frames.append(await _snap(i))
		if i < 2:
			await get_tree().create_timer(0.8).timeout


func _diff(a: Image, b: Image) -> float:
	if a == null or b == null or a.get_size() != b.get_size():
		return -1.0
	var total := 0.0
	var count := 0
	for y in range(0, a.get_height(), 4):
		for x in range(0, a.get_width(), 4):
			var ca := a.get_pixel(x, y)
			var cb := b.get_pixel(x, y)
			total += absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b)
			count += 1
	return total / maxf(count, 1.0)


## Park the camera inside the booth looking across the dust volume, so the
## motes drift through the warm light cone in frame.
func _aim_camera() -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	cam.global_position = Vector3(0, 1.7, 2.6)
	if cam.has_method("look_at"):
		cam.look_at(Vector3(0, 1.1, -1.5), Vector3.UP)

func _finish() -> void:
	var d01 := _diff(_frames[0], _frames[1])
	var d12 := _diff(_frames[1], _frames[2])
	print("[AmbientDriver] frame diff 0->1: %.4f" % d01)
	print("[AmbientDriver] frame diff 1->2: %.4f" % d12)
	var moving := d01 > 0.001 and d12 > 0.001
	print("[AmbientDriver] MOTION=%s" % ("YES" if moving else "NO"))
	get_tree().quit(0 if moving else 1)
