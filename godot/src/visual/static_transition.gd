class_name StaticTransition
extends CanvasLayer

## DEA-108 / DEA-144: Brief static/scanline overlay during camera cuts.
## Per DEA-144: 0.3–0.5 sec cut with brief static effect (0.4s default).
##
## Uses a ColorRect + shader for a TV static effect that fades in/out
## over the transition duration.

var _rect: ColorRect
var _shader_mat: ShaderMaterial
var _timer: float = 0.0
var _duration: float = 0.0
var _playing: bool = false


func _ready() -> void:
	# Layer above everything
	layer = 100

	# Build shader
	var shader: Shader = Shader.new()
	shader.code = _get_shader_code()
	_shader_mat = ShaderMaterial.new()
	_shader_mat.shader = shader

	# Full-screen ColorRect
	_rect = ColorRect.new()
	_rect.material = _shader_mat
	_rect.anchors_preset = Control.PRESET_FULL_RECT
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_rect)

	# Start hidden
	_rect.visible = false


func _get_shader_code() -> String:
	return """
shader_type canvas_item;

uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float scanline_strength : hint_range(0.0, 1.0) = 0.5;
uniform float time_scale = 1.0;

float rand(vec2 co) {
	return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 uv = UV;
	
	// Scanline distortion
	float scanline = sin(uv.y * 800.0 + TIME * 10.0 * time_scale) * 0.04 * scanline_strength;
	uv.x += scanline * intensity;
	
	// Static noise
	float noise = rand(uv + fract(TIME * time_scale)) * intensity;
	
	// Random horizontal shift bands
	float band = step(0.98, rand(vec2(floor(uv.y * 30.0), floor(TIME * 20.0 * time_scale))));
	uv.x += band * 0.05 * intensity;
	
	// Sample texture with distortion
	vec4 color = texture(TEXTURE, uv);
	
	// Mix with static
	color.rgb = mix(color.rgb, vec3(noise), intensity * 0.7);
	
	// Scanline darkening
	color.rgb *= 1.0 - scanline_strength * intensity * 0.3;
	
	COLOR = color;
}
"""


func play(duration: float) -> void:
	_duration = duration
	_timer = duration
	_playing = true
	_rect.visible = true
	_shader_mat.set_shader_parameter("intensity", 1.0)
	_shader_mat.set_shader_parameter("scanline_strength", 0.7)


func _process(delta: float) -> void:
	if not _playing:
		return

	_timer -= delta
	if _timer <= 0.0:
		_playing = false
		_rect.visible = false
		_shader_mat.set_shader_parameter("intensity", 0.0)
		return

	# Fade: full intensity at start, fade out over last 40% of duration
	var t: float = _timer / _duration
	var intensity: float = 1.0
	if t < 0.4:
		intensity = t / 0.4
	_shader_mat.set_shader_parameter("intensity", intensity)
	_shader_mat.set_shader_parameter("scanline_strength", 0.7)
