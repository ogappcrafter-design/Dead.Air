extends RefCounted

# ============================================================================
# Test Suite: CRT Post-Processing Shader — DEA-107
# Tests shader file existence, parameter exposure, controller logic,
# and degradation mappings for dread/composure/signal.
# ============================================================================

const SHADER_PATH: String = "res://assets/shaders/crt_postprocess.gdshader"
const CONTROLLER_PATH: String = "res://src/visual/crt_postprocess.gd"

var test_name: String = "CRTShader"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shader_loads"] = test_shader_loads()
	results["test_shader_has_required_uniforms"] = test_shader_has_required_uniforms()
	results["test_controller_loads"] = test_controller_loads()
	results["test_controller_color_constants"] = test_controller_color_constants()
	results["test_controller_thresholds"] = test_controller_thresholds()
	var scan_test = test_scanline_opacity_scales_with_composure()
	results["test_scanline_opacity_scales_with_composure"] = scan_test
	results["test_curvature_scales_with_composure"] = test_curvature_scales_with_composure()
	results["test_noise_density_scales_with_signal"] = test_noise_density_scales_with_signal()
	results["test_desaturation_at_dread_thresholds"] = test_desaturation_at_dread_thresholds()
	results["test_glitch_activates_at_low_composure"] = test_glitch_activates_at_low_composure()
	results["test_bloom_intensity_scales_with_dread"] = test_bloom_intensity_scales_with_dread()
	results["test_vignette_scales_with_severe_dread"] = test_vignette_scales_with_severe_dread()
	results["test_color_inversion_at_low_composure"] = test_color_inversion_at_low_composure()
	results["test_phosphor_color_shifts_to_red"] = test_phosphor_color_shifts_to_red()
	results["test_roll_activates_at_dread_threshold"] = test_roll_activates_at_dread_threshold()
	results["test_alert_blend_at_severe_dread"] = test_alert_blend_at_severe_dread()
	results["test_safe_room_resets_degradation"] = test_safe_room_resets_degradation()
	results["test_controller_public_api"] = test_controller_public_api()
	return results


# --- Test: Shader loads correctly ---
func test_shader_loads() -> bool:
	var shader: Shader = load(SHADER_PATH)
	if shader == null:
		return false
	# Verify it has code and is a canvas_item shader by checking the mode
	return shader.code != "" and shader.get_mode() == Shader.MODE_CANVAS_ITEM


# --- Test: Shader has all required uniforms ---
func test_shader_has_required_uniforms() -> bool:
	# Headless-safe source parsing: the Shader class has no parameter-list
	# accessor, and RenderingServer queries deadlock under `--script`.
	# (Same pattern as test_crt_degradation.gd.)
	var f := FileAccess.open(SHADER_PATH, FileAccess.READ)
	if f == null:
		return false
	var source := f.get_as_text()
	f.close()
	var required: Array = [
		"signal_strength",
		"dread_level",
		"composure_level",
		"scanline_spacing",
		"scanline_opacity",
		"scanline_roll_speed",
		"bloom_intensity",
		"bloom_radius",
		"phosphor_color",
		"curvature_amount",
		"flicker_intensity",
		"flicker_speed",
		"glitch_intensity",
		"glitch_shift_max",
		"color_split_offset",
		"tear_intensity",
		"vignette_inner",
		"vignette_outer",
		"vignette_intensity",
		"noise_density",
		"desaturation_amount",
		"tint_color",
		"alert_color",
		"alert_blend",
		"inversion_amount",
		"rgb_swap_amount",
		"ca_radial_amount",
		"signal_scanline_drift",
		"time_sec",
		"screen_resolution",
	]
	for param in required:
		# Uniform declarations in the merged shader are float / vec3 / vec2.
		if not (
			source.contains("uniform float %s" % param)
			or source.contains("uniform vec3 %s" % param)
			or source.contains("uniform vec2 %s" % param)
		):
			return false
	return true


# --- Test: Controller script loads and instantiates ---
func test_controller_loads() -> bool:
	var script: GDScript = load(CONTROLLER_PATH)
	if script == null:
		return false
	var instance = script.new()
	var is_valid = instance != null and instance is CRTPostProcess
	instance.free()
	return is_valid


# --- Test: Color constants match spec ---
func test_controller_color_constants() -> bool:
	var instance = CRTPostProcess.new()
	var is_valid = (
		instance.COLOR_BG == Color("#0A0A0A")
		and instance.COLOR_AMBER == Color("#FFA500")
		and instance.COLOR_GREEN == Color("#00FF41")
		and instance.COLOR_RED == Color("#FF3300")
		and instance.COLOR_WHITE == Color("#FFFFFF")
	)
	instance.free()
	return is_valid


# --- Test: Threshold constants match spec (DEA-145) ---
func test_controller_thresholds() -> bool:
	var instance = CRTPostProcess.new()
	var is_valid = (
		instance.COMPOSURE_FLICKER == 50.0
		and instance.COMPOSURE_DRIFT == 30.0
		and instance.COMPOSURE_SEVERE == 20.0
		and instance.COMPOSURE_INVERSION == 10.0
		and instance.SIGNAL_NOISE == 50.0
		and instance.SIGNAL_HEAVY == 30.0
		and instance.SIGNAL_NEAR_TOTAL == 10.0
		and instance.DREAD_VIGNETTE == 40.0
		and instance.DREAD_CA == 60.0
		and instance.DREAD_BREAK == 80.0
	)
	instance.free()
	return is_valid


# --- Test: Scanline opacity scales 0.15 → 0.35 with composure ---
func test_scanline_opacity_scales_with_composure() -> bool:
	var p_full = CRTPostProcess.compute_params(0.0, 100.0, 80.0, false)
	if abs(p_full["scanline_opacity"] - 0.15) > 0.001:
		return false
	var p_none = CRTPostProcess.compute_params(0.0, 0.0, 80.0, false)
	if abs(p_none["scanline_opacity"] - 0.35) > 0.001:
		return false
	var p_mid = CRTPostProcess.compute_params(0.0, 50.0, 80.0, false)
	if abs(p_mid["scanline_opacity"] - 0.25) > 0.001:
		return false
	return true


# --- Test: Curvature scales 0.02 → 0.06 with composure ---
func test_curvature_scales_with_composure() -> bool:
	var p_full = CRTPostProcess.compute_params(0.0, 100.0, 80.0, false)
	if abs(p_full["curvature_amount"] - 0.02) > 0.001:
		return false
	var p_none = CRTPostProcess.compute_params(0.0, 0.0, 80.0, false)
	if abs(p_none["curvature_amount"] - 0.06) > 0.001:
		return false
	return true


# --- Test: Noise density tiers with signal (DEA-145) ---
func test_noise_density_scales_with_signal() -> bool:
	# Signal >= 50: quiet baseline
	var p_full = CRTPostProcess.compute_params(0.0, 100.0, 100.0, false)
	if abs(p_full["noise_density"] - 0.05) > 0.001:
		return false
	# Signal < 50: increased noise
	var p_low = CRTPostProcess.compute_params(0.0, 100.0, 40.0, false)
	if p_low["noise_density"] <= 0.05:
		return false
	# Signal < 30: heavy static
	var p_heavy = CRTPostProcess.compute_params(0.0, 100.0, 20.0, false)
	if p_heavy["noise_density"] <= 0.3:
		return false
	# Signal < 10: near-total static
	var p_near_total = CRTPostProcess.compute_params(0.0, 100.0, 5.0, false)
	if p_near_total["noise_density"] <= 0.6:
		return false
	return true


# --- Test: Desaturation at dread thresholds ---
func test_desaturation_at_dread_thresholds() -> bool:
	var p_low = CRTPostProcess.compute_params(0.0, 100.0, 80.0, false)
	if abs(p_low["desaturation_amount"] - 0.0) > 0.001:
		return false
	var p_mid = CRTPostProcess.compute_params(60.0, 100.0, 80.0, false)
	if abs(p_mid["desaturation_amount"] - 0.15) > 0.001:
		return false
	var p_high = CRTPostProcess.compute_params(80.0, 100.0, 80.0, false)
	if abs(p_high["desaturation_amount"] - 0.35) > 0.001:
		return false
	return true


# --- Test: Glitch activates at composure < 20 (DEA-145 severe threshold) ---
func test_glitch_activates_at_low_composure() -> bool:
	var p_high = CRTPostProcess.compute_params(0.0, 50.0, 80.0, false)
	if abs(p_high["glitch_intensity"] - 0.0) > 0.001:
		return false
	var p_mid = CRTPostProcess.compute_params(0.0, 10.0, 80.0, false)
	if abs(p_mid["glitch_intensity"] - 0.5) > 0.001:
		return false
	var p_low = CRTPostProcess.compute_params(0.0, 0.0, 80.0, false)
	if abs(p_low["glitch_intensity"] - 1.0) > 0.001:
		return false
	return true


# --- Test: Bloom intensity scales 0.3 → 0.6 with dread ---
func test_bloom_intensity_scales_with_dread() -> bool:
	var p_low = CRTPostProcess.compute_params(0.0, 100.0, 80.0, false)
	if abs(p_low["bloom_intensity"] - 0.3) > 0.001:
		return false
	var p_high = CRTPostProcess.compute_params(100.0, 100.0, 80.0, false)
	if abs(p_high["bloom_intensity"] - 0.6) > 0.001:
		return false
	return true


# --- Test: Vignette intensifies at dread > 40, breaks apart > 80 (DEA-145) ---
func test_vignette_scales_with_severe_dread() -> bool:
	var p_low = CRTPostProcess.compute_params(30.0, 100.0, 80.0, false)
	if abs(p_low["vignette_intensity"] - 0.3) > 0.001:
		return false
	var p_mid = CRTPostProcess.compute_params(50.0, 100.0, 80.0, false)
	if p_mid["vignette_intensity"] <= 0.3:
		return false
	var p_high = CRTPostProcess.compute_params(90.0, 100.0, 80.0, false)
	if p_high["vignette_intensity"] <= 0.5:
		return false
	return true


# --- Test: Color inversion at composure < 10 (DEA-145) ---
func test_color_inversion_at_low_composure() -> bool:
	var p_high = CRTPostProcess.compute_params(0.0, 30.0, 80.0, false)
	if abs(p_high["inversion_amount"] - 0.0) > 0.001:
		return false
	var p_mid = CRTPostProcess.compute_params(0.0, 5.0, 80.0, false)
	if abs(p_mid["inversion_amount"] - 0.5) > 0.001:
		return false
	var p_low = CRTPostProcess.compute_params(0.0, 0.0, 80.0, false)
	if abs(p_low["inversion_amount"] - 1.0) > 0.001:
		return false
	return true


# --- Test: Phosphor color shifts amber → red at dread > 75 ---
func test_phosphor_color_shifts_to_red() -> bool:
	var p_normal = CRTPostProcess.compute_params(0.0, 100.0, 80.0, false)
	var phosphor_normal: Vector3 = p_normal["phosphor_color"]
	var amber_vec: Vector3 = Vector3(
		CRTPostProcess.COLOR_AMBER.r, CRTPostProcess.COLOR_AMBER.g, CRTPostProcess.COLOR_AMBER.b
	)
	if phosphor_normal.distance_to(amber_vec) > 0.01:
		return false
	var p_severe = CRTPostProcess.compute_params(100.0, 100.0, 80.0, false)
	var phosphor_severe: Vector3 = p_severe["phosphor_color"]
	var red_vec: Vector3 = Vector3(
		CRTPostProcess.COLOR_RED.r, CRTPostProcess.COLOR_RED.g, CRTPostProcess.COLOR_RED.b
	)
	if phosphor_severe.distance_to(red_vec) > 0.01:
		return false
	# alert_blend should be 1.0 at dread=100
	if abs(p_severe["alert_blend"] - 1.0) > 0.001:
		return false
	return true


# --- Test: Roll activates at dread > 50 ---
func test_roll_activates_at_dread_threshold() -> bool:
	var p_low = CRTPostProcess.compute_params(30.0, 100.0, 80.0, false)
	if abs(p_low["scanline_roll_speed"] - 0.0) > 0.001:
		return false
	var p_high = CRTPostProcess.compute_params(100.0, 100.0, 80.0, false)
	if abs(p_high["scanline_roll_speed"] - 5.0) > 0.001:
		return false
	return true


# --- Test: Alert blend at high dread (activates > 60, DEA-145) ---
func test_alert_blend_at_severe_dread() -> bool:
	var p_below = CRTPostProcess.compute_params(55.0, 100.0, 80.0, false)
	if abs(p_below["alert_blend"] - 0.0) > 0.001:
		return false
	var p_100 = CRTPostProcess.compute_params(100.0, 100.0, 80.0, false)
	if abs(p_100["alert_blend"] - 1.0) > 0.001:
		return false
	return true


# --- Test: Safe room resets degradation ---
func test_safe_room_resets_degradation() -> bool:
	var p = CRTPostProcess.compute_params(80.0, 10.0, 20.0, true)
	# In safe room, dread resets to 0 and composure to 100
	if abs(p["dread_level"] - 0.0) > 0.001:
		return false
	if abs(p["composure_level"] - 100.0) > 0.001:
		return false
	# With dread=0 and composure=100, degradation should be at baseline
	if abs(p["desaturation_amount"] - 0.0) > 0.001:
		return false
	if abs(p["glitch_intensity"] - 0.0) > 0.001:
		return false
	if abs(p["inversion_amount"] - 0.0) > 0.001:
		return false
	return true


# --- Test: Controller has public API methods ---
func test_controller_public_api() -> bool:
	var instance = CRTPostProcess.new()
	var has_get = instance.has_method("get_shader_material")
	var has_set = instance.has_method("set_param")
	var has_get_param = instance.has_method("get_param")
	var has_trigger_roll = instance.has_method("trigger_roll")
	var has_trigger_burst = instance.has_method("trigger_glitch_burst")
	instance.free()
	return has_get and has_set and has_get_param and has_trigger_roll and has_trigger_burst
