extends Node3D
## Isolating probe for the vertex-snap stage of ps1_geometry.gdshader.
## One quad, one grid, nothing else: if snapping cannot move this, it cannot
## move station geometry either, and the constant must stay off.

const TEX := "res://assets/textures/environment/asphalt_rough.jpg"


func _ready() -> void:
	get_window().size = Vector2i(640, 480)
	var cam := Camera3D.new()
	cam.position = Vector3(0.0, 0.0, 2.0)
	add_child(cam)
	cam.make_current()
	var quad := MeshInstance3D.new()
	quad.mesh = QuadMesh.new()
	quad.mesh.size = Vector2(1.6, 1.2)
	quad.position = Vector3(0.0, 0.0, 0.0)
	add_child(quad)
	var tex: Texture2D = load(TEX)
	var any := false
	for grid in [Vector2(8.0, 6.0), Vector2(160.0, 120.0), Vector2(320.0, 240.0)]:
		var off := await _shot(quad, tex, grid, false)
		var on := await _shot(quad, tex, grid, true)
		var delta := _changed(off, on)
		print("PS1SNAP grid=%dx%d luma_off=%.1f luma_on=%.1f changed=%.4f" % [
			int(grid.x), int(grid.y), _mean(off), _mean(on), delta])
		if _mean(off) > 5.0 and delta > 0.02:
			any = true
	print("PS1SNAP %s" % ("PASS" if any else "FAIL"))
	get_tree().quit()


func _shot(quad: MeshInstance3D, tex: Texture2D, grid: Vector2, snap: bool) -> Image:
	var mat := PS1Geometry.make_material(tex, false, false)
	mat.set_shader_parameter(&"snap_resolution", grid)
	mat.set_shader_parameter(&"snap_amount", 1.0 if snap else 0.0)
	quad.material_override = mat
	for _i in range(8):
		await get_tree().process_frame
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
