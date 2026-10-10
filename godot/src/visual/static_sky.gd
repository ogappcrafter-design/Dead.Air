class_name StaticSky
extends MeshInstance3D

## Segment 2B "The Static Sky" — the night sky above the suburban road.
## Instead of stars: TV static. Faint, constant (DEA-118).
##
## A large plane with a procedural static shader: 24fps quantized noise,
## subtle brightness flicker, a slow vertical roll bar. Unshaded and
## cull_disabled so it reads from below.

const SHADER_CODE := """
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform float noise_scale = 240.0;
uniform float brightness : hint_range(0.0, 1.0) = 0.14;

float hash12(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void fragment() {
	vec2 uv = UV;
	// TV static updates in discrete frames (24 fps), not smoothly.
	float frame = floor(TIME * 24.0);
	float n = hash12(floor(uv * noise_scale) + vec2(frame, frame * 0.71));
	// Slow vertical roll bar (CRT tear), very faint.
	float roll = fract(uv.y * 0.5 + TIME * 0.11);
	float bar = smoothstep(0.0, 0.04, roll) * smoothstep(0.12, 0.05, roll);
	float lum = brightness * (0.3 + 0.7 * n) + bar * n * 0.06;
	vec3 col = mix(vec3(0.01, 0.02, 0.04), vec3(0.72, 0.76, 0.82), lum);
	ALBEDO = col;
	EMISSION = col * 0.45;
}
"""

## Plane size in world units (width, depth).
@export var sky_size := Vector2(160.0, 100.0)
## Height above the ground.
@export var sky_height := 26.0
## Static brightness (0 = invisible, 1 = blinding).
@export var static_brightness := 0.14


func _ready() -> void:
	var plane := PlaneMesh.new()
	plane.size = sky_size
	mesh = plane
	var mat := ShaderMaterial.new()
	var shader := Shader.new()
	shader.code = SHADER_CODE
	mat.shader = shader
	mat.set_shader_parameter("brightness", static_brightness)
	material_override = mat
	position = Vector3(position.x, sky_height, position.z)
	is_static_sky = true


## Marker flag for tests (set after successful build).
var is_static_sky: bool = false


## Brightness as seen by tests (shader param round-trip).
func get_static_brightness() -> float:
	var mat := material_override as ShaderMaterial
	if mat == null:
		return -1.0
	return mat.get_shader_parameter("brightness")
