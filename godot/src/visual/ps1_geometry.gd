class_name PS1Geometry
extends RefCounted

## DEA-175: helpers around ps1_geometry.gdshader.
##
## The shader does the work on the GPU; these mirror its maths so snapping is
## checkable without a device, and provide the material builder used by scenes.

const SHADER_PATH := "res://assets/shaders/ps1_geometry.gdshader"
const DEFAULT_SNAP := Vector2(160.0, 120.0)


## Quantise an NDC coordinate to the vertex grid the shader uses.
static func snap_ndc(ndc: Vector2, grid: Vector2 = DEFAULT_SNAP) -> Vector2:
	if grid.x <= 0.0 or grid.y <= 0.0:
		return ndc
	return (ndc * grid).round() / grid


## Blend between unsnapped and snapped NDC, matching the shader's mix().
static func snap_blend(ndc: Vector2, amount: float, grid: Vector2 = DEFAULT_SNAP) -> Vector2:
	return ndc.lerp(snap_ndc(ndc, grid), clampf(amount, 0.0, 1.0))


## `triplanar` matches the station's world-mapped architecture materials.
## Art-direction defaults measured on the real station scene
## (tests/visual_driver_ps1_station.gd). At the 320x240 internal resolution a
## 160x120 transform grid changes 11.9% of pixels frame-to-frame; 320x240
## changes 0.18%, i.e. it is invisible and not worth the vertex cost.
const STATION_SNAP := Vector2(160.0, 120.0)
## Station architecture is world-triplanar, so affine UVs are a wrong answer
## there; props keep ordinary UVs and are the only place affine is correct.
const STATION_AFFINE := false
## Props keep their own UV mapping, so affine warping is the authentic PS1
## treatment for them; measured on the booth mug (see the station rig).
const PROP_AFFINE := true
## Snapping is tuned but off by default: at 160x120 the station measured ~38%
## brighter than undressed because vertices move while normals do not. Ship the
## grid, flip this on when the art pass accepts the lighting shift.
const STATION_SNAP_ENABLED := false


## Master switch so the whole pass can be turned off (and measured against).
static var dressing_enabled := true


## Material for one station surface, copied from the mapping the surface used.
## Architecture brushes are world-triplanar and must stay perspective-correct;
## props carry normal UVs and get the affine treatment.
static func make_surface_material(texture: Texture2D, affine: bool = STATION_AFFINE, triplanar: bool = true) -> ShaderMaterial:
	var mat := make_material(texture, affine, triplanar)
	mat.set_shader_parameter(&"snap_resolution", STATION_SNAP)
	mat.set_shader_parameter(&"snap_amount", 1.0 if STATION_SNAP_ENABLED else 0.0)
	return mat


static func surface_material(n: Node) -> BaseMaterial3D:
	var m: Material = null
	if n is CSGShape3D:
		m = (n as CSGShape3D).material
	elif n is MeshInstance3D:
		m = (n as MeshInstance3D).material_override
		if m == null and (n as MeshInstance3D).mesh != null:
			m = (n as MeshInstance3D).mesh.surface_get_material(0)
	return m as BaseMaterial3D


## True when a node already had an albedo texture to carry over. Untextured
## brushes are skipped: swapping them would repaint the room flat.
static func surface_texture(n: Node) -> Texture2D:
	var m := surface_material(n)
	return m.albedo_texture if m != null else null


## The shader settings a given surface should get, derived from how that
## surface was already mapped.
static func surface_settings(n: Node) -> Dictionary:
	var m := surface_material(n)
	var triplanar: bool = m != null and m.uv1_triplanar
	return {
		"triplanar": triplanar,
		"affine": not triplanar,
	}


## Apply the tuned PS1 material to every textured surface under root.
## Returns how many nodes were dressed.
static func dress_surfaces(root: Node) -> int:
	if not dressing_enabled:
		return 0
	var count := 0
	for n in root.find_children("*", "MeshInstance3D", true, false):
		var tex := surface_texture(n)
		if tex != null:
			var cfg := surface_settings(n)
			(n as MeshInstance3D).material_override = make_surface_material(tex, cfg["affine"], cfg["triplanar"])
			count += 1
	for n in root.find_children("*", "CSGShape3D", true, false):
		var tex := surface_texture(n)
		if tex != null:
			var cfg := surface_settings(n)
			(n as CSGShape3D).material = make_surface_material(tex, cfg["affine"], cfg["triplanar"])
			count += 1
	return count


static func make_material(texture: Texture2D = null, affine: bool = false, triplanar: bool = false) -> ShaderMaterial:
	var shader: Shader = load(SHADER_PATH)
	if shader == null:
		push_error("PS1Geometry: failed to load shader at %s" % SHADER_PATH)
		return null
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter(&"affine_uv", affine)
	material.set_shader_parameter(&"use_triplanar", triplanar)
	if texture != null:
		material.set_shader_parameter(&"albedo_texture", texture)
	return material
