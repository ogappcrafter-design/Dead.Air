extends Node3D
## DEA-175 art-direction rig: measures the ps1_geometry shader on the real
## station scene so snap_resolution and affine usage are chosen from pixels.
## Usage: xvfb-run -a godot --rendering-method gl_compatibility --path godot res://tests/visual_driver_ps1_station.tscn
##
## The tree stays unpaused: CSG brushes only rebuild their mesh in _process, so
## pausing freezes the geometry and every setting measures the same stale mesh.
## Ambient motion is disabled node-by-node instead.

const STATION := "res://scenes/station/station.tscn"
const GRIDS := [Vector2(0.0, 0.0), Vector2(160.0, 120.0), Vector2(320.0, 240.0), Vector2(640.0, 480.0)]

var _base: Image


func _ready() -> void:
	get_window().size = Vector2i(640, 480)
	var retro := get_node_or_null("/root/RetroResolutionManager")
	if retro != null:
		retro.enabled = false
	var station: Node = load(STATION).instantiate()
	add_child(station)
	_still(station)
	var cam := Camera3D.new()
	cam.position = Vector3(0.6, 1.6, 1.8)
	cam.rotation_degrees = Vector3(-6.0, 18.0, 0.0)
	add_child(cam)
	cam.make_current()
	for _i in range(10):
		await get_tree().process_frame
	_base = await _capture()
	print("PS1STATION base luma=%.1f sum=%d" % [_mean(_base), _sum(_base)])
	await _sweep(station)
	get_tree().quit()


## Kill animated content so a frame delta is the shader, not the noise.
func _still(root: Node) -> void:
	for n in root.find_children("*", "GPUParticles3D", true, false):
		(n as GPUParticles3D).emitting = false
	for n in root.find_children("*", "AnimationPlayer", true, false):
		(n as AnimationPlayer).stop()
	for n in root.find_children("*", "CanvasLayer", true, false):
		(n as CanvasLayer).visible = false
	for n in root.find_children("*", "", true, false):
		if n.get_script() != null and String(n.get_script().resource_path).ends_with("ambient_life.gd"):
			(n as Node).set_process(false)


func _targets(node: Node) -> Array[Node]:
	var out: Array[Node] = []
	for child in node.find_children("*", "MeshInstance3D", true, false):
		if (child as MeshInstance3D).mesh != null:
			out.append(child)
	for child in node.find_children("*", "CSGShape3D", true, false):
		out.append(child)
	return out


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


func _apply(n: Node, mat: Material) -> void:
	if n is CSGShape3D:
		(n as CSGShape3D).material = mat
	else:
		(n as MeshInstance3D).material_override = mat


func _sweep(station: Node) -> void:
	var targets := _targets(station)
	var tex := 0
	for mi in targets:
		if _texture_of(mi) != null:
			tex += 1
	print("PS1STATION targets=%d textured=%d" % [targets.size(), tex])
	var prev := _base
	for affine in [false, true]:
		for grid in GRIDS:
			# One material per surface, each keeping its own albedo texture.
			for mi in targets:
				var mat := PS1Geometry.make_material(_texture_of(mi), affine, true)
				var snapped: bool = grid.x > 0.0
				mat.set_shader_parameter(&"snap_resolution", grid if snapped else Vector2(1e6, 1e6))
				mat.set_shader_parameter(&"snap_amount", 1.0 if snapped else 0.0)
				_apply(mi, mat)
			var img := await _capture()
			print("PS1STATION affine=%s grid=%dx%d vs_base=%.4f vs_prev=%.4f luma=%.1f sum=%d" % [
				affine, int(grid.x), int(grid.y), _changed(_base, img), _changed(prev, img),
				_mean(img), _sum(img)])
			prev = img
	for mi in targets:
		if mi is CSGShape3D:
			(mi as CSGShape3D).material = null
		else:
			(mi as MeshInstance3D).material_override = null


func _capture() -> Image:
	# Give CSG a rebuild frame, then wait for a completed draw.
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	return get_viewport().get_texture().get_image()


func _sum(img: Image) -> int:
	var s := 0
	for y in range(0, img.get_height(), 8):
		for x in range(0, img.get_width(), 8):
			var c := img.get_pixel(x, y)
			s += int(c.r * 255.0) + int(c.g * 255.0) + int(c.b * 255.0)
	return s


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
