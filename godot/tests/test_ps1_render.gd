## test_ps1_render.gd — Tests for DEA-174 (320x240 internal resolution) and
## DEA-175 (vertex snapping + affine UV geometry shader).
extends RefCounted

var test_name: String = "PS1Render"

const SHADER_PATH := "res://assets/shaders/ps1_geometry.gdshader"


func run_tests() -> Dictionary:
	var results := {}

	# --- DEA-174: resolution mode ---
	results["test_internal_size_is_320x240"] = RetroResolution.INTERNAL_SIZE == Vector2i(320, 240)
	results["test_internal_size_is_4_3"] = RetroResolution.is_4_3(RetroResolution.INTERNAL_SIZE)
	results["test_16_9_is_not_4_3"] = not RetroResolution.is_4_3(Vector2i(1920, 1080))

	# 1920x1080 window: integer scale is limited by height => 4x => 1280x960.
	results["test_integer_presented_size"] = RetroResolution.presented_size(Vector2i(1920, 1080)) == Vector2i(1280, 960)
	results["test_integer_scale_never_below_one"] = RetroResolution.presented_size(Vector2i(100, 100)) == Vector2i(320, 240)
	results["test_fractional_presented_size"] = RetroResolution.presented_size(Vector2i(960, 720), RetroResolution.INTERNAL_SIZE, false) == Vector2i(960, 720)

	var node: RetroResolution = RetroResolution.new()
	Engine.get_main_loop().root.add_child(node)
	var window := node.get_window()
	results["test_window_uses_viewport_scale"] = window.content_scale_mode == Window.CONTENT_SCALE_MODE_VIEWPORT
	results["test_window_internal_size"] = window.content_scale_size == Vector2i(320, 240)
	results["test_window_integer_stretch"] = window.content_scale_stretch == Window.CONTENT_SCALE_STRETCH_INTEGER
	results["test_window_keeps_aspect"] = window.content_scale_aspect == Window.CONTENT_SCALE_ASPECT_KEEP
	node.enabled = false
	results["test_disable_restores_scale"] = window.content_scale_mode == Window.CONTENT_SCALE_MODE_DISABLED \
		and window.content_scale_size == Vector2i.ZERO
	node.enabled = true
	results["test_reenable_restores_size"] = window.content_scale_size == Vector2i(320, 240)
	node.get_parent().remove_child(node)
	node.free()
	# Leave the suite's window the way the engine started it.
	window.content_scale_size = Vector2i.ZERO
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED

	# --- HUD readability at 320x240 ---
	var hc: GDScript = load("res://src/ui/high_contrast_manager.gd")
	results["test_hud_floor_raises_tiny_fonts"] = hc.readable_font_size(6, true) == 10
	results["test_hud_floor_keeps_large_fonts"] = hc.readable_font_size(18, true) == 18
	results["test_hud_floor_inactive_at_full_res"] = hc.readable_font_size(6, false) == 6

	# --- station art-direction defaults (measured) ---
	results["test_station_snap_grid"] = PS1Geometry.STATION_SNAP == Vector2(160, 120)
	results["test_station_affine_off"] = PS1Geometry.STATION_AFFINE == false
	var surf := PS1Geometry.make_surface_material(null)
	results["test_surface_material_snap_off_by_default"] = float(surf.get_shader_parameter("snap_amount")) == 0.0
	results["test_surface_material_keeps_tuned_grid"] = surf.get_shader_parameter("snap_resolution") == PS1Geometry.STATION_SNAP
	results["test_surface_material_triplanar"] = bool(surf.get_shader_parameter("use_triplanar")) == true
	results["test_untextured_surface_skipped"] = PS1Geometry.surface_texture(Node3D.new()) == null

	# --- dressing rules: mapping decides the treatment ---
	var world_brush := CSGBox3D.new()
	var world_mat := StandardMaterial3D.new()
	world_mat.albedo_texture = Texture2D.new()
	world_mat.uv1_triplanar = true
	world_brush.material = world_mat
	var world_cfg: Dictionary = PS1Geometry.surface_settings(world_brush)
	results["test_architecture_stays_perspective"] = world_cfg["affine"] == false and world_cfg["triplanar"] == true
	var prop := MeshInstance3D.new()
	prop.mesh = BoxMesh.new()
	var prop_mat := StandardMaterial3D.new()
	prop_mat.albedo_texture = Texture2D.new()
	prop.mesh.surface_set_material(0, prop_mat)
	var prop_cfg: Dictionary = PS1Geometry.surface_settings(prop)
	results["test_prop_gets_affine"] = prop_cfg["affine"] == true and prop_cfg["triplanar"] == false
	results["test_prop_affine_constant"] = PS1Geometry.PROP_AFFINE == true
	# dress_surfaces walks children, so mount the prop under a holder.
	var holder := Node3D.new()
	holder.add_child(prop)
	PS1Geometry.dressing_enabled = false
	results["test_dressing_switch_off"] = PS1Geometry.dress_surfaces(holder) == 0
	PS1Geometry.dressing_enabled = true
	results["test_dressing_switch_on"] = PS1Geometry.dress_surfaces(holder) == 1
	world_brush.free()
	holder.free()

	results["test_canvas_filter_is_nearest"] = int(ProjectSettings.get_setting("rendering/textures/canvas_textures/default_texture_filter", -1)) == 0

	# --- DEA-175: geometry shader ---
	var shader: Shader = load(SHADER_PATH)
	results["test_geometry_shader_loads"] = shader is Shader
	var uniforms := {}
	if shader != null:
		for u in shader.get_shader_uniform_list():
			uniforms[u.name] = true
	results["test_geometry_has_snap_uniforms"] = uniforms.has(&"snap_resolution") and uniforms.has(&"snap_amount")
	results["test_geometry_has_affine_toggle"] = uniforms.has(&"affine_uv")

	# Snapping maths mirrors the shader: quantise NDC to the grid.
	var grid := Vector2(160.0, 120.0)
	results["test_snap_quantises"] = PS1Geometry.snap_ndc(Vector2(0.37, -0.61), grid) == Vector2(roundf(0.37 * 160.0) / 160.0, roundf(-0.61 * 120.0) / 120.0)
	results["test_snap_is_stable_on_grid"] = is_equal_approx(PS1Geometry.snap_ndc(Vector2(0.5, 0.5), grid).x, 0.5)
	results["test_snap_amount_zero_is_identity"] = PS1Geometry.snap_blend(Vector2(0.37, -0.61), 0.0, grid) == Vector2(0.37, -0.61)
	results["test_snap_amount_one_equals_snap"] = PS1Geometry.snap_blend(Vector2(0.37, -0.61), 1.0, grid) == PS1Geometry.snap_ndc(Vector2(0.37, -0.61), grid)
	results["test_snap_bounded_by_half_cell"] = absf(PS1Geometry.snap_ndc(Vector2(0.613, 0.417), grid).x - 0.613) <= 0.5 / grid.x + 0.000001
	results["test_snap_no_grid_is_identity"] = PS1Geometry.snap_ndc(Vector2(0.3, 0.2), Vector2.ZERO) == Vector2(0.3, 0.2)

	var mat := PS1Geometry.make_material(null, true)
	results["test_material_built"] = mat is ShaderMaterial and mat.shader == shader
	results["test_material_affine_set"] = mat != null and bool(mat.get_shader_parameter(&"affine_uv")) == true

	return results
