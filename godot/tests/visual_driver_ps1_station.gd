extends Node3D
## DEA-175 art-direction rig for the real station scene.
##
## Answers the two open questions with pixels:
##   1. dressed vs undressed station - does the shipped pass look like the room?
##   2. affine on props - visible where it is correct, absent where it is not.
##
## Usage: xvfb-run -a godot --rendering-method gl_compatibility --path godot res://tests/visual_driver_ps1_station.tscn

const STATION := "res://scenes/station/station.tscn"

var _stats := {}


func _ready() -> void:
	get_window().size = Vector2i(640, 480)
	var retro := get_node_or_null("/root/RetroResolutionManager")
	if retro != null:
		retro.enabled = false
	var cam := Camera3D.new()
	cam.position = Vector3(0.6, 1.6, 1.8)
	cam.rotation_degrees = Vector3(-6.0, 18.0, 0.0)
	add_child(cam)
	cam.make_current()

	var plain := await _capture_station(false)
	var plain_stats: Dictionary = _stats.duplicate()
	var dressed := await _capture_station(true)
	var props := await _capture_station(true, true)
	var prop_delta := await _prop_affine_closeup()

	print("PS1STATION surfaces=%d triplanar=%d props=%d" % [
		plain_stats["total"], plain_stats["triplanar"], plain_stats["props"]])
	print("PS1STATION ab_dressed_vs_undressed=%.4f luma_plain=%.1f luma_dressed=%.1f" % [
		_changed(plain, dressed), _mean(plain), _mean(dressed)])
	print("PS1STATION prop_affine_wide=%.4f (props too small in this framing)" % _changed(dressed, props))
	print("PS1STATION prop_affine_closeup=%.4f" % prop_delta)
	print("PS1STATION %s" % ("PASS" if _verdict(plain, dressed, prop_delta) else "FAIL"))
	get_tree().quit()


func _verdict(plain: Image, dressed: Image, prop_delta: float) -> bool:
	if _mean(dressed) < 5.0 or _mean(dressed) > 250.0:
		return false
	if _changed(plain, dressed) > 0.95:
		return false
	if prop_delta < 0.01:
		return false
	return true


## Render one station: dressing on/off, optionally forcing affine onto props.
## The station is destroyed between captures so the frames stay comparable.
func _capture_station(dressing: bool, force_prop_affine: bool = false) -> Image:
	PS1Geometry.dressing_enabled = dressing
	var station: Node = load(STATION).instantiate()
	add_child(station)
	_still(station)
	var total := 0
	var tri := 0
	var props := 0
	for mi in _targets(station):
		var tex := PS1Geometry.surface_texture(mi)
		if tex == null:
			continue
		total += 1
		var cfg := PS1Geometry.surface_settings(mi)
		if cfg["triplanar"]:
			tri += 1
		else:
			props += 1
			if force_prop_affine:
				var mat := PS1Geometry.make_surface_material(tex, true, false)
				if mi is CSGShape3D:
					(mi as CSGShape3D).material = mat
				else:
					(mi as MeshInstance3D).material_override = mat
	_stats = {"total": total, "triplanar": tri, "props": props}
	for _i in range(6):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	station.queue_free()
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	return img


## Affine only shows on UV-interpolated geometry, so measure one prop up close.
## Returns the fraction of pixels affine changes; 0 when no prop exists.
func _prop_affine_closeup() -> float:
	PS1Geometry.dressing_enabled = true
	var station: Node = load(STATION).instantiate()
	add_child(station)
	_still(station)
	var props: Array[Node] = []
	for mi in _targets(station):
		if PS1Geometry.surface_texture(mi) == null:
			continue
		if not PS1Geometry.surface_settings(mi)["triplanar"]:
			props.append(mi)
	if props.is_empty():
		station.queue_free()
		return 0.0
	var target := props[0] as Node3D
	var cam := get_viewport().get_camera_3d()
	var focus := target.global_position
	cam.global_position = focus + Vector3(0.45, 0.25, 0.45)
	cam.look_at(focus)
	for mi in props:
		var tex := PS1Geometry.surface_texture(mi)
		_apply_prop(mi, PS1Geometry.make_surface_material(tex, false, false))
	for _i in range(6):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var perspective := get_viewport().get_texture().get_image()
	for mi in props:
		var tex := PS1Geometry.surface_texture(mi)
		_apply_prop(mi, PS1Geometry.make_surface_material(tex, true, false))
	for _i in range(6):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var affine := get_viewport().get_texture().get_image()
	station.queue_free()
	return _changed(perspective, affine)


func _apply_prop(n: Node, mat: Material) -> void:
	if n is CSGShape3D:
		(n as CSGShape3D).material = mat
	else:
		(n as MeshInstance3D).material_override = mat


## Kill animated content so a frame delta is the shader, not the noise.
func _still(root: Node) -> void:
	for n in root.find_children("*", "GPUParticles3D", true, false):
		(n as GPUParticles3D).emitting = false
	for n in root.find_children("*", "AnimationPlayer", true, false):
		(n as AnimationPlayer).stop()
	for n in root.find_children("*", "CanvasLayer", true, false):
		(n as CanvasLayer).visible = false
	for n in root.find_children("*", "", true, false):
		var s = n.get_script()
		if s != null and String(s.resource_path).ends_with("ambient_life.gd"):
			(n as Node).set_process(false)


func _targets(node: Node) -> Array[Node]:
	var out: Array[Node] = []
	for child in node.find_children("*", "MeshInstance3D", true, false):
		if (child as MeshInstance3D).mesh != null:
			out.append(child)
	for child in node.find_children("*", "CSGShape3D", true, false):
		out.append(child)
	return out


func _mean(img: Image) -> float:
	var total := 0.0
	var n := 0
	for y in range(0, img.get_height(), 4):
		for x in range(0, img.get_width(), 4):
			var c := img.get_pixel(x, y)
			total += (c.r + c.g + c.b) / 3.0
			n += 1
	return total / maxf(1.0, float(n)) * 255.0


func _changed(a: Image, b: Image) -> float:
	var diff := 0
	var n := 0
	for y in range(0, min(a.get_height(), b.get_height()), 2):
		for x in range(0, min(a.get_width(), b.get_width()), 2):
			n += 1
			var ca := a.get_pixel(x, y)
			var cb := b.get_pixel(x, y)
			if absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b) > 0.05:
				diff += 1
	return float(diff) / maxf(1.0, float(n))
