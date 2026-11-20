extends Node3D
## DEA-175 art-direction pass: measures the ps1_geometry shader against the
## real station scene, not a synthetic quad, to pick a snap grid and decide
## whether affine UVs are safe on shipping geometry.
## Usage: xvfb-run -a godot --rendering-method gl_compatibility --path godot res://tests/visual_driver_ps1_station.tscn

const STATION := "res://scenes/station/station.tscn"
const GRIDS := [Vector2(0, 0), Vector2(160, 120), Vector2(320, 240), Vector2(640, 480)]

var _mesh_count := 0
var _base: Image


func _ready() -> void:
	get_window().size = Vector2i(640, 480)
	var retro := get_node_or_null("/root/RetroResolutionManager")
	if retro != null:
		retro.enabled = false
	var station: Node = load(STATION).instantiate()
	add_child(station)
	var cam := Camera3D.new()
	cam.position = Vector3(0.6, 1.6, 1.8)
	cam.rotation_degrees = Vector3(-6, 18, 0)
	add_child(cam)
	cam.make_current()
	# Freeze animation so frame deltas are the shader, not noise.
	get_tree().paused = true
	for n in station.find_children("*", "CanvasLayer", true, false):
		(n as CanvasLayer).visible = false
	for _i in range(6):
		await get_tree().process_frame
	_base = await _frozen_capture()
	print("PS1STATION meshes=%d base_luma=%.1f" % [_mesh_count, _mean(_base)])
	await _sweep(station)
	get_tree().quit()


## The station is built from CSG brushes, not imported meshes.
func _targets(node: Node) -> Array[Node]:
	var out: Array[Node] = []
	for child in node.find_children("*", "MeshInstance3D", true, false):
		if (child as MeshInstance3D).mesh != null:
			out.append(child)
	for child in node.find_children("*", "CSGShape3D", true, false):
		out.append(child)
	return out


## Reuse whatever albedo texture the slot already had so the comparison is
## about geometry, not about stripping the station's art.
func _texture_of(n: Node) -> Texture2D:
	var m: Material = null
	if n is CSGShape3D:
		m = (n as CSGShape3D).material
	elif n is MeshInstance3D:
		m = (n as MeshInstance3D).material_override
		if m == null and (n as MeshInstance3D).mesh != null:
			m = (n as MeshInstance3D).mesh.surface_get_material(0)
	if m is BaseMaterial3D:
		return (m as BaseMaterial3D).albedo_texture
	return null


func _apply(n: Node, mat: ShaderMaterial) -> void:
	if n is CSGShape3D:
		(n as CSGShape3D).material = mat
	else:
		(n as MeshInstance3D).material_override = mat


func _sweep(station: Node) -> void:
	var targets := _targets(station)
	_mesh_count = targets.size()
	print("PS1STATION textures=%s" % str(_texture_of(targets[0]) != null if targets.size() > 0 else false))
	for affine in [false, true]:
		for grid in GRIDS:
			# One material per surface, keeping each brush's own albedo texture:
			# a single shared texture repaints the whole station and makes every
			# comparison meaningless.
			for mi in targets:
				var mat := PS1Geometry.make_material(_texture_of(mi), affine, true)
				mat.set_shader_parameter(&"snap_resolution", grid if grid.x > 0.0 else Vector2(1e6, 1e6))
				mat.set_shader_parameter(&"snap_amount", 1.0 if grid.x > 0.0 else 0.0)
				mat.set_shader_parameter(&"albedo_color", Color.WHITE)
				_apply(mi, mat)
			var img := await _frozen_capture()
			print("PS1STATION affine=%s grid=%dx%d changed=%.4f luma=%.1f" % [
				affine, int(grid.x), int(grid.y), _changed(_base, img), _mean(img)])
	for mi in targets:
		if mi is CSGShape3D:
			(mi as CSGShape3D).material = null
		else:
			(mi as MeshInstance3D).material_override = null


func _frozen_capture() -> Image:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	return get_viewport().get_texture().get_image()


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
