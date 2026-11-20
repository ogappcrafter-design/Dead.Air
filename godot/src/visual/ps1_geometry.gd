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


static func make_material(texture: Texture2D = null, affine: bool = false) -> ShaderMaterial:
	var shader: Shader = load(SHADER_PATH)
	if shader == null:
		push_error("PS1Geometry: failed to load shader at %s" % SHADER_PATH)
		return null
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter(&"affine_uv", affine)
	if texture != null:
		material.set_shader_parameter(&"albedo_texture", texture)
	return material
