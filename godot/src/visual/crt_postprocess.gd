class_name CRTPostProcess
extends CanvasLayer

# ============================================================================
# CRT Post-Process Controller — DEA-107
# Manages a CanvasItem shader material for CRT post-processing.
# Reads DreadComposure + SignalStrength and updates shader parameters
# in real-time to degrade the CRT visual based on game state.
# ============================================================================

# --- Color Constants (from DEA-107 spec) ---
const COLOR_BG: Color = Color("#0A0A0A")
const COLOR_AMBER: Color = Color("#FFA500")
const COLOR_GREEN: Color = Color("#00FF41")
const COLOR_RED: Color = Color("#FF3300")
const COLOR_WHITE: Color = Color("#FFFFFF")

# --- Thresholds ---
const DREAD_DESAT_THRESHOLD: float = 50.0
const DREAD_SEVERE_THRESHOLD: float = 75.0
const COMPOSITION_GLITCH_THRESHOLD: float = 40.0
const COMPOSITION_SEVERE_THRESHOLD: float = 20.0

# --- Exported references ---
@export var dread_composure: DreadComposure
@export var signal_strength: SignalStrength
@export var shader_path: String = "res://assets/shaders/crt_postprocess.gdshader"

# --- Internal ---
var _shader_material: ShaderMaterial
var _texture_rect: ColorRect
var _time_accum: float = 0.0
var _param_overrides: Dictionary = {}


func _ready() -> void:
	_setup_post_process()


func _setup_post_process() -> void:
	# Create ColorRect to cover the screen as the shader carrier
	_texture_rect = ColorRect.new()
	_texture_rect.color = Color.WHITE
	_texture_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_texture_rect.set_anchors_preset(Control.PRESET_FULL_RECT)

	# Load shader and create material
	var shader: Shader = load(shader_path)
	if shader == null:
		push_error("CRTPostProcess: Failed to load shader at %s" % shader_path)
		return

	_shader_material = ShaderMaterial.new()
	_shader_material.shader = shader
	_texture_rect.material = _shader_material

	# Add as overlay on this canvas layer
	add_child(_texture_rect)

	# Initialize shader parameters
	_apply_all_params()


func _process(delta: float) -> void:
	_time_accum += delta
	# Decrement override timers
	var expired: Array[String] = []
	for param in _param_overrides:
		_param_overrides[param]["remaining"] -= delta
		if _param_overrides[param]["remaining"] <= 0.0:
			expired.append(param)
	for param in expired:
		_param_overrides.erase(param)
	_apply_all_params()


static func compute_params(
	dread: float, composure: float, signal_val: float, in_safe_room: bool
) -> Dictionary:
	# Safe room: healthy CRT — reset all degradation
	if in_safe_room:
		dread = 0.0
		composure = 100.0

	# --- Compute parameter values ---

	# Scanlines: opacity scales from 0.15 (normal) to 0.35 (low composure)
	var scanline_opacity: float = lerp(0.15, 0.35, 1.0 - (composure / 100.0))

	# Vertical roll speed activates at dread > 50
	var roll_speed: float = 0.0
	if dread > DREAD_DESAT_THRESHOLD:
		roll_speed = (dread - DREAD_DESAT_THRESHOLD) / 50.0 * 5.0

	# Phosphor glow: intensity 0.3 → 0.6, color amber → red at dread > 75
	var bloom_intensity: float = lerp(0.3, 0.6, dread / 100.0)
	var phosphor: Color = COLOR_AMBER
	var alert_blend: float = 0.0
	if dread > DREAD_SEVERE_THRESHOLD:
		alert_blend = (dread - DREAD_SEVERE_THRESHOLD) / 25.0
		phosphor = COLOR_AMBER.lerp(COLOR_RED, alert_blend)

	# Curvature: 0.02 normal → 0.06 at composure < 20
	var curvature: float = lerp(0.02, 0.06, 1.0 - (composure / 100.0))

	# Flicker: base ±0.02, scales with dread
	var flicker_intensity: float = 0.02
	var flicker_speed: float = 60.0
	if dread > DREAD_DESAT_THRESHOLD:
		flicker_intensity = 0.02 + (dread - DREAD_DESAT_THRESHOLD) / 100.0 * 0.13
	if dread > DREAD_SEVERE_THRESHOLD:
		flicker_intensity = 0.15 + (dread - DREAD_SEVERE_THRESHOLD) / 100.0 * 0.05

	# Glitch: activates at composure < 40
	var glitch_intensity: float = 0.0
	var glitch_shift_max: float = 0.0
	var color_split: float = 0.0
	var tear_intensity: float = 0.0
	if composure < COMPOSITION_GLITCH_THRESHOLD:
		var glitch_factor: float = 1.0 - (composure / COMPOSITION_GLITCH_THRESHOLD)
		glitch_intensity = glitch_factor
		glitch_shift_max = lerp(2.0, 8.0, glitch_factor)
		color_split = 1.0 + glitch_factor  # 1-2px offset

	# Tear: full-frame tear at composure < 20
	if composure < COMPOSITION_SEVERE_THRESHOLD:
		tear_intensity = 1.0 - (composure / COMPOSITION_SEVERE_THRESHOLD)

	# Vignette: intensity 0.3 → 0.6 at dread > 75
	var vignette_intensity: float = 0.3
	if dread > DREAD_SEVERE_THRESHOLD:
		vignette_intensity = lerp(0.3, 0.6, (dread - DREAD_SEVERE_THRESHOLD) / 25.0)

	# Noise density: (100 - signal) / 100
	var noise_density: float = (100.0 - signal_val) / 100.0

	# Desaturation: 0% normal, 15% at dread > 50, 35% at dread > 75
	var desaturation: float = 0.0
	if dread > DREAD_DESAT_THRESHOLD:
		desaturation = 0.15
	if dread > DREAD_SEVERE_THRESHOLD:
		desaturation = 0.35

	# Color inversion at composure < 20
	var inversion_amount: float = 0.0
	if composure < COMPOSITION_SEVERE_THRESHOLD:
		inversion_amount = 1.0 - (composure / COMPOSITION_SEVERE_THRESHOLD)

	# Tint color: amber normal, shifts to red at high dread
	var tint_color: Color = COLOR_AMBER
	if dread > DREAD_SEVERE_THRESHOLD:
		tint_color = COLOR_AMBER.lerp(COLOR_RED, (dread - DREAD_SEVERE_THRESHOLD) / 25.0)

	return {
		"signal_strength": signal_val,
		"dread_level": dread,
		"composure_level": composure,
		"scanline_opacity": scanline_opacity,
		"scanline_roll_speed": roll_speed,
		"bloom_intensity": bloom_intensity,
		"bloom_radius": 4.0,
		"phosphor_color": Vector3(phosphor.r, phosphor.g, phosphor.b),
		"curvature_amount": curvature,
		"flicker_intensity": flicker_intensity,
		"flicker_speed": flicker_speed,
		"glitch_intensity": glitch_intensity,
		"glitch_shift_max": glitch_shift_max,
		"color_split_offset": color_split,
		"tear_intensity": tear_intensity,
		"vignette_inner": 0.3,
		"vignette_outer": 0.8,
		"vignette_intensity": vignette_intensity,
		"noise_density": noise_density,
		"desaturation_amount": desaturation,
		"tint_color": Vector3(tint_color.r, tint_color.g, tint_color.b),
		"alert_color": Vector3(COLOR_RED.r, COLOR_RED.g, COLOR_RED.b),
		"alert_blend": alert_blend,
		"inversion_amount": inversion_amount,
	}


func _apply_all_params() -> void:
	if _shader_material == null:
		return

	# Read game state from integration points
	var dread: float = 0.0
	var composure: float = 100.0
	var signal_val: float = 80.0
	var in_safe_room: bool = false

	if dread_composure != null:
		dread = dread_composure.dread
		composure = dread_composure.composure
		in_safe_room = dread_composure.in_safe_room

	if signal_strength != null:
		signal_val = signal_strength.signal_value

	var params: Dictionary = compute_params(dread, composure, signal_val, in_safe_room)

	# Apply active overrides (one-shot effects from trigger_roll / trigger_glitch_burst)
	for param_name in _param_overrides:
		if param_name in params:
			params[param_name] = _param_overrides[param_name]["value"]

	# Set shader parameters
	for key in params:
		_shader_material.set_shader_parameter(key, params[key])

	# Set screen resolution from viewport
	var vp: Viewport = get_viewport()
	if vp != null:
		_shader_material.set_shader_parameter("screen_resolution", vp.get_visible_rect().size)

	_shader_material.set_shader_parameter("time_sec", _time_accum)


# ============================================================================
# Public API: direct parameter control for external systems
# ============================================================================


func get_shader_material() -> ShaderMaterial:
	return _shader_material


func set_param(name: String, value: Variant) -> void:
	if _shader_material != null:
		_shader_material.set_shader_parameter(name, value)


func get_param(name: String) -> Variant:
	if _shader_material != null:
		return _shader_material.get_shader_parameter(name)
	return null


# Trigger a one-shot vertical roll (stingers, wrongness events)
func trigger_roll(duration: float = 1.0, speed: float = 8.0) -> void:
	_param_overrides["scanline_roll_speed"] = {"value": speed, "remaining": duration}


# Force glitch burst (for scripted events)
func trigger_glitch_burst(intensity: float = 1.0, duration: float = 0.3) -> void:
	_param_overrides["glitch_intensity"] = {"value": intensity, "remaining": duration}
	_param_overrides["tear_intensity"] = {"value": intensity * 0.5, "remaining": duration}
