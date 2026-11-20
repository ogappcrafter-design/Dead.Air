extends Node3D
## Visual A/B driver for DEA-175 (ps1_geometry.gdshader).
## Renders one steeply-angled checker quad three ways — perspective-correct,
## affine UV, and vertex-snapped — then compares the frames numerically so the
## shader is proven by pixels rather than by compilation.
## Usage: xvfb-run -a godot --path godot res://tests/visual_driver_ps1.tscn

const OUT_DIR := "screenshot"
const WIN := Vector2i(640, 480)
## Low grid + steep quad so snapping and affine distortion are unmistakable.
const SNAP_GRID := Vector2(24.0, 18.0)

var _quad: MeshInstance3D
var _mat: ShaderMaterial
var _frames := {}
var _viewport: SubViewport


func _ready() -> void:
	get_window().size = WIN
	DirAccess.open("user://").make_dir(OUT_DIR)
	DirAccess.open("res://").make_dir(OUT_DIR)
	_build()
	await _capture_all()
	_report()
	get_tree().quit()


func _build() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(640, 480)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.own_world_3d = true
	add_child(vp)
	_viewport = vp

	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.02, 0.02, 0.04)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.9, 0.9, 0.9)
	e.ambient_light_energy = 1.0
	env.environment = e
	vp.add_child(env)

	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35.0, -30.0, 0.0)
	light.light_energy = 1.2
	vp.add_child(light)

	var cam := Camera3D.new()
	cam.position = Vector3(0.0, 0.0, 3.0)
	cam.fov = 70.0
	vp.add_child(cam)
	cam.make_current()

	_quad = MeshInstance3D.new()
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(6.0, 6.0)
	mesh.subdivide_width = 4
	mesh.subdivide_depth = 4
	_quad.mesh = mesh
	# Angled away from the camera: perspective foreshortening is extreme here,
	# which is exactly where affine interpolation must diverge.
	# PlaneMesh is born horizontal; tip it toward the camera, then yaw it so the
	# left and right edges sit at very different depths.
	_quad.rotation_degrees = Vector3(72.0, 45.0, 0.0)
	vp.add_child(_quad)

	_mat = PS1Geometry.make_material(_checker(256), false)
	_mat.set_shader_parameter(&"snap_amount", 0.0)
	_quad.material_override = _mat


func _checker(size: int) -> ImageTexture:
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var cell := size / 8
	for y in range(size):
		for x in range(size):
			var on := ((x / cell) + (y / cell)) % 2 == 0
			img.set_pixel(x, y, Color(0.9, 0.75, 0.2) if on else Color(0.1, 0.15, 0.35))
	return ImageTexture.create_from_image(img)


func _capture_all() -> void:
	# A: perspective-correct (shipping default).
	_mat.set_shader_parameter(&"affine_uv", false)
	_mat.set_shader_parameter(&"snap_amount", 0.0)
	_frames["perspective"] = await _snap_shot("ps1_a_perspective.png")
	var plain := StandardMaterial3D.new()
	plain.albedo_color = Color(1, 0, 1)
	plain.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_quad.material_override = plain
	var probe: Image = await _snap_shot("ps1_probe_plain.png")
	print("PS1AB probe_plain_coverage=%.3f mean=%.1f" % [_coverage(probe), _mean_luma(probe)])
	_quad.material_override = _mat

	# B: affine UV, no snapping.
	_mat.set_shader_parameter(&"affine_uv", true)
	_frames["affine"] = await _snap_shot("ps1_b_affine.png")

	# C: affine plus aggressive vertex snapping.
	_mat.set_shader_parameter(&"snap_resolution", SNAP_GRID)
	_mat.set_shader_parameter(&"snap_amount", 1.0)
	_frames["snapped"] = await _snap_shot("ps1_c_snapped.png")


func _snap_shot(file: String) -> Image:
	# Two draws so the material change is certain to be on screen.
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := _viewport.get_texture().get_image()
	img.save_png("res://" + OUT_DIR + "/" + file)
	return img


func _report() -> void:
	var a: Image = _frames["perspective"]
	var b: Image = _frames["affine"]
	var c: Image = _frames["snapped"]
	var mean_a := _mean_luma(a)
	var coverage_a := _coverage(a)
	print("PS1AB frame=%dx%d mean_luma=%.1f coverage=%.3f" % [a.get_width(), a.get_height(), mean_a, coverage_a])
	print("PS1AB affine_changed=%.3f affine_coverage=%.3f" % [_changed(a, b), _coverage(b)])
	print("PS1AB snap_changed=%.4f snap_coverage=%.3f" % [_changed(a, c), _coverage(c)])
	print("PS1AB %s" % ("PASS" if _verdict(a, b, c) else "FAIL"))


func _verdict(a: Image, b: Image, c: Image) -> bool:
	# The scene must actually draw.
	if _mean_luma(a) < 5.0:
		return false
	# Affine interpolation has to visibly differ from perspective-correct UVs...
	var affine_delta := _changed(a, b)
	if affine_delta < 0.02:
		return false
	# ...without destroying silhouette coverage (that would mean broken geometry).
	if absf(_coverage(b) - _coverage(a)) > 0.15 or absf(_coverage(c) - _coverage(a)) > 0.15:
		return false
	# Snapping must move edges, but only slightly.
	var snap_delta := _changed(a, c)
	return snap_delta > 0.0005 and snap_delta < 0.25


func _mean_luma(img: Image) -> float:
	var total := 0.0
	var px := img.get_width() * img.get_height()
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var col := img.get_pixel(x, y)
			total += (col.r + col.g + col.b) / 3.0
	return total / maxf(1.0, float(px) / 4.0) * 255.0


## Fraction of sampled pixels brighter than the background: the quad's silhouette.
func _coverage(img: Image) -> float:
	var hits := 0
	var samples := 0
	for y in range(0, img.get_height(), 2):
		for x in range(0, img.get_width(), 2):
			var col := img.get_pixel(x, y)
			samples += 1
			if (col.r + col.g + col.b) / 3.0 > 0.06:
				hits += 1
	return float(hits) / maxf(1.0, float(samples))


func _changed(a: Image, b: Image) -> float:
	var diff := 0
	var samples := 0
	for y in range(0, min(a.get_height(), b.get_height()), 2):
		for x in range(0, min(a.get_width(), b.get_width()), 2):
			samples += 1
			var ca := a.get_pixel(x, y)
			var cb := b.get_pixel(x, y)
			if absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b) > 0.05:
				diff += 1
	return float(diff) / maxf(1.0, float(samples))
