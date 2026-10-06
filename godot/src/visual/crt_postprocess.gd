class_name CRTPostProcess
extends CanvasLayer

# ============================================================================
# CRT Post-Process Controller — DEA-107 / DEA-145
# Manages a CanvasItem shader material for CRT post-processing.
# Reads DreadComposure + SignalStrength and updates shader parameters
# in real-time to degrade the CRT visual based on game state.
# DEA-145: spec thresholds, per-shift permanent degradation baseline,
# and hide mode API. (Supersedes the removed CRTController autoload.)
# ============================================================================

# --- Color Constants (from DEA-107 spec) ---
const COLOR_BG: Color = Color("#0A0A0A")
const COLOR_AMBER: Color = Color("#FFA500")
const COLOR_GREEN: Color = Color("#00FF41")
const COLOR_RED: Color = Color("#FF3300")
const COLOR_WHITE: Color = Color("#FFFFFF")

# --- Thresholds (DEA-145 spec) ---
# Composure: <50 mild flicker, <30 scanline drift, <20 severe, <10 inversion+RGB swap
const COMPOSURE_FLICKER: float = 50.0
const COMPOSURE_DRIFT: float = 30.0
const COMPOSURE_SEVERE: float = 20.0
const COMPOSURE_INVERSION: float = 10.0
# Signal: <50 noise, <30 heavy static, <10 near-total
const SIGNAL_NOISE: float = 50.0
const SIGNAL_HEAVY: float = 30.0
const SIGNAL_NEAR_TOTAL: float = 10.0
# Dread: >40 vignette, >60 CA, >80 image breaks
const DREAD_VIGNETTE: float = 40.0
const DREAD_CA: float = 60.0
const DREAD_BREAK: float = 80.0

# --- Exported references ---
@export var dread_composure: DreadComposure
@export var signal_strength: SignalStrength
@export var shader_path: String = "res://assets/shaders/crt_postprocess.gdshader"

# --- Internal ---
var _shader_material: ShaderMaterial
var _texture_rect: ColorRect
var _time_accum: float = 0.0
var _param_overrides: Dictionary = {}
var _degradation: float = 0.0  # Per-shift permanent degradation (DEA-145)

# --- Hide mode (DEA-145) ---
# When false: CRT turns off — this layer hides and only meters on other
# canvas layers stay visible. Driven by the hide mechanic (DEA-119) via
# PhaseManager's HIDE mode context.
var _crt_visible: bool = true

# DEA-146: Accessibility modifiers applied after normal params each frame.
# Keys: "shake_mult" (float), "flash_reduction" (bool), "static_mult" (float),
#        "vignette_off" (bool), "crt_off" (bool)
var _accessibility_mods: Dictionary = {}


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
	# Hide mode: CRT off entirely, only meters visible (DEA-145)
	if not _crt_visible:
		return
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
	dread: float, composure: float, signal_val: float, in_safe_room: bool,
	degradation: float = 0.0
) -> Dictionary:
	# Safe room: healthy CRT — reset dread and composure (NOT signal)
	if in_safe_room:
		dread = 0.0
		composure = 100.0

	# Degradation acts as a baseline amplifier (0.0 = pristine, 0.85 = barely holding)
	# It shifts effective composure down and dread up to simulate permanent wear.
	var deg_composure: float = composure - degradation * 40.0
	var deg_dread: float = dread + degradation * 20.0
	deg_composure = clampf(deg_composure, 0.0, 100.0)
	deg_dread = clampf(deg_dread, 0.0, 100.0)

	# --- Composure-driven degradation ---

	# Scanlines: opacity scales from 0.15 (normal) to 0.35 (low composure)
	var scanline_opacity: float = lerp(0.15, 0.35, 1.0 - (deg_composure / 100.0))

	# Vertical roll speed: activates at dread > 50 (scaled by degradation)
	var roll_speed: float = 0.0
	if deg_dread > 50.0:
		roll_speed = (deg_dread - 50.0) / 50.0 * 5.0

	# Phosphor glow: intensity 0.3 → 0.6, color amber → red at high dread
	var bloom_intensity: float = lerp(0.3, 0.6, deg_dread / 100.0)
	var phosphor: Color = COLOR_AMBER
	var alert_blend: float = 0.0
	if deg_dread > DREAD_CA:
		alert_blend = (deg_dread - DREAD_CA) / 40.0
		phosphor = COLOR_AMBER.lerp(COLOR_RED, alert_blend)

	# Curvature: 0.02 normal → 0.06 at composure < 20
	var curvature: float = lerp(0.02, 0.06, 1.0 - (deg_composure / 100.0))

	# Flicker: <50 mild, scales with dread and degradation
	var flicker_intensity: float = 0.02
	var flicker_speed: float = 60.0
	if deg_composure < COMPOSURE_FLICKER:
		flicker_intensity = lerp(0.02, 0.08, 1.0 - (deg_composure / COMPOSURE_FLICKER))
	if deg_composure < COMPOSURE_SEVERE:
		flicker_intensity = lerp(flicker_intensity, 0.2, 1.0 - (deg_composure / COMPOSURE_SEVERE))
	if deg_dread > 50.0:
		flicker_intensity += (deg_dread - 50.0) / 100.0 * 0.05

	# Glitch: activates at composure < 20 (severe)
	var glitch_intensity: float = 0.0
	var glitch_shift_max: float = 0.0
	var color_split: float = 0.0
	var tear_intensity: float = 0.0
	if deg_composure < COMPOSURE_SEVERE:
		var glitch_factor: float = 1.0 - (deg_composure / COMPOSURE_SEVERE)
		glitch_intensity = glitch_factor
		glitch_shift_max = lerp(2.0, 8.0, glitch_factor)
		color_split = 1.0 + glitch_factor
		tear_intensity = glitch_factor * 0.7

	# Scanline drift: activates at composure < 30
	var signal_scanline_drift: float = 0.0
	if deg_composure < COMPOSURE_DRIFT:
		signal_scanline_drift = (1.0 - (deg_composure / COMPOSURE_DRIFT)) * 1.5
	# Also signal-driven drift (persists in safe rooms)
	var signal_factor: float = (100.0 - signal_val) / 100.0
	signal_scanline_drift = maxf(signal_scanline_drift, signal_factor * 2.0)

	# Vignette: >40 dread intensifies, >80 image breaks apart
	var vignette_intensity: float = 0.3
	if deg_dread > DREAD_VIGNETTE:
		vignette_intensity = lerp(0.3, 0.5, (deg_dread - DREAD_VIGNETTE) / 60.0)
	if deg_dread > DREAD_BREAK:
		vignette_intensity = lerp(0.5, 0.8, (deg_dread - DREAD_BREAK) / 20.0)

	# Noise density: signal-driven. <50 increased, <30 heavy, <10 near-total
	var noise_density: float = 0.05
	if signal_val < SIGNAL_NOISE:
		noise_density = lerp(0.05, 0.3, 1.0 - (signal_val / SIGNAL_NOISE))
	if signal_val < SIGNAL_HEAVY:
		noise_density = lerp(noise_density, 0.6, 1.0 - (signal_val / SIGNAL_HEAVY))
	if signal_val < SIGNAL_NEAR_TOTAL:
		noise_density = lerp(noise_density, 0.95, 1.0 - (signal_val / SIGNAL_NEAR_TOTAL))
	# Degradation adds baseline noise
	noise_density += degradation * 0.1
	noise_density = clampf(noise_density, 0.0, 1.0)

	# Desaturation: dread > 50 mild, > 75 severe
	var desaturation: float = 0.0
	if deg_dread > 50.0:
		desaturation = 0.15
	if deg_dread > 75.0:
		desaturation = 0.35
	# Degradation adds baseline desaturation
	desaturation += degradation * 0.1
	desaturation = clampf(desaturation, 0.0, 0.8)

	# Color inversion at composure < 10 (DEA-145: was <20, now <10)
	var inversion_amount: float = 0.0
	if deg_composure < COMPOSURE_INVERSION:
		inversion_amount = 1.0 - (deg_composure / COMPOSURE_INVERSION)

	# RGB swap (text corruption) at composure < 10 (DEA-145)
	var rgb_swap_amount: float = 0.0
	if deg_composure < COMPOSURE_INVERSION:
		rgb_swap_amount = 1.0 - (deg_composure / COMPOSURE_INVERSION)
		rgb_swap_amount = clampf(rgb_swap_amount * 0.7, 0.0, 0.7)  # Cap to avoid full garble

	# Tint color: amber normal, shifts to red at high dread
	var tint_color: Color = COLOR_AMBER
	if deg_dread > DREAD_CA:
		tint_color = COLOR_AMBER.lerp(COLOR_RED, (deg_dread - DREAD_CA) / 40.0)

	# --- Signal-driven radial CA (DEA-142 uniform, now driven by DEA-145) ---
	var ca_radial_amount: float = signal_factor * 4.0
	if deg_dread > DREAD_CA:
		ca_radial_amount += (deg_dread - DREAD_CA) / 40.0 * 3.0

	return {
		"signal_strength": signal_val,
		"dread_level": deg_dread,
		"composure_level": deg_composure,
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
		"rgb_swap_amount": rgb_swap_amount,
		"ca_radial_amount": ca_radial_amount,
		"signal_scanline_drift": signal_scanline_drift,
	}


func _apply_all_params() -> void:
	if _shader_material == null:
		return

	# DEA-145: pull per-shift permanent degradation from the autoload
	var deg_node := get_node_or_null("/root/CRTDegradation")
	if deg_node != null and deg_node.has_method("get_permanent_degradation"):
		_degradation = deg_node.get_permanent_degradation()

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

	var params: Dictionary = compute_params(dread, composure, signal_val, in_safe_room, _degradation)

	# Apply active overrides (one-shot effects from trigger_roll / trigger_glitch_burst)
	for param_name in _param_overrides:
		if param_name in params:
			params[param_name] = _param_overrides[param_name]["value"]

	# Set shader parameters
	for key in params:
		_shader_material.set_shader_parameter(key, params[key])

	# DEA-146: Apply accessibility modifiers on top of normal params
	_apply_accessibility_mods()

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


# Set per-shift permanent degradation level (DEA-145)
func set_degradation(level: float) -> void:
	_degradation = clampf(level, 0.0, 1.0)


# Get per-shift permanent degradation level (DEA-145)
func get_degradation() -> float:
	return _degradation


# Trigger a one-shot vertical roll (stingers, wrongness events)
func trigger_roll(duration: float = 1.0, speed: float = 8.0) -> void:
	_param_overrides["scanline_roll_speed"] = {"value": speed, "remaining": duration}


# Force glitch burst (for scripted events)
func trigger_glitch_burst(intensity: float = 1.0, duration: float = 0.3) -> void:
	_param_overrides["glitch_intensity"] = {"value": intensity, "remaining": duration}
	_param_overrides["tear_intensity"] = {"value": intensity * 0.5, "remaining": duration}


# ============================================================================
# Hide mode API (DEA-145)
# ============================================================================


## Turn the CRT off (or back on). When off, this layer hides — only meters
## on other canvas layers stay visible. Intended consumer: the hide mechanic
## (DEA-119) via PhaseManager's HIDE mode context.
func set_crt_visible(crt_visible: bool) -> void:
	_crt_visible = crt_visible
	visible = _crt_visible


## Whether the CRT is currently visible (hide mode off).
func is_crt_visible() -> bool:
	return _crt_visible


# ============================================================================
# DEA-146: Accessibility modifier API
# ============================================================================


## Set accessibility modifiers. Pass a Dictionary with any of:
## "shake_mult": float (0.0-1.0) — scales roll speed
## "flash_reduction": bool — eliminates roll, cuts flicker speed 75%
## "static_mult": float (0.0-1.0) — scales noise density
## "vignette_off": bool — sets vignette intensity to 0
## "crt_off": bool — hides the CRT overlay entirely
func set_accessibility_mods(mods: Dictionary) -> void:
	_accessibility_mods = mods
	if _texture_rect != null:
		_texture_rect.visible = not mods.get("crt_off", false)


## Get the current accessibility modifiers.
func get_accessibility_mods() -> Dictionary:
	return _accessibility_mods


## Apply accessibility modifiers to shader parameters after normal computation.
func _apply_accessibility_mods() -> void:
	if _shader_material == null or _accessibility_mods.is_empty():
		return

	if _accessibility_mods.get("crt_off", false):
		if _texture_rect != null:
			_texture_rect.visible = false
		return

	if _texture_rect != null:
		_texture_rect.visible = true

	# Camera shake reduction: scale roll speed
	if _accessibility_mods.has("shake_mult"):
		var shake_mult: float = _accessibility_mods["shake_mult"]
		var roll: float = _shader_material.get_shader_parameter("scanline_roll_speed")
		_shader_material.set_shader_parameter("scanline_roll_speed", roll * shake_mult)

	# Screen flash reduction: eliminate roll, cut flicker speed 75%
	if _accessibility_mods.get("flash_reduction", false):
		_shader_material.set_shader_parameter("scanline_roll_speed", 0.0)
		var flicker: float = _shader_material.get_shader_parameter("flicker_speed")
		_shader_material.set_shader_parameter("flicker_speed", flicker * 0.25)
		var flicker_i: float = _shader_material.get_shader_parameter("flicker_intensity")
		_shader_material.set_shader_parameter("flicker_intensity", flicker_i * 0.25)

	# Static reduction: cut noise density by the given multiplier
	if _accessibility_mods.has("static_mult"):
		var static_mult: float = _accessibility_mods["static_mult"]
		var noise: float = _shader_material.get_shader_parameter("noise_density")
		_shader_material.set_shader_parameter("noise_density", noise * static_mult)

	# Vignette reduction: eliminate vignette
	if _accessibility_mods.get("vignette_off", false):
		_shader_material.set_shader_parameter("vignette_intensity", 0.0)
