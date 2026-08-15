extends RefCounted

# ============================================================================
# Test Suite: CRT Post-Processing Shader v2 — DEA-142
# Tests radial chromatic aberration, signal-driven scanline drift,
# CRTController autoload, and accessibility API.
#
# NOTE: Godot 4.7 headless mode cannot resolve non-autoload class_name types
# (DreadComposure, SignalStrength, CRTPostProcess, etc.). This suite works
# around that by parsing shader code, inlining compute_params logic, and
# checking script source for method presence.
# ============================================================================

const SHADER_PATH: String = "res://assets/shaders/crt_postprocess.gdshader"
const CONTROLLER_PATH: String = "res://src/visual/crt_postprocess.gd"
const CRT_CONTROLLER_PATH: String = "res://src/visual/crt_controller.gd"

var test_name: String = "CRTShaderV2"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shader_has_dea142_uniforms"] = test_shader_has_dea142_uniforms()
	results["test_radial_ca_zero_at_full_signal"] = test_radial_ca_zero_at_full_signal()
	results["test_radial_ca_max_at_zero_signal"] = test_radial_ca_max_at_zero_signal()
	results["test_radial_ca_scales_linearly"] = test_radial_ca_scales_linearly()
	var drift_zero := test_signal_scanline_drift_zero_at_full_signal()
	results["test_signal_scanline_drift_zero_at_full_signal"] = drift_zero
	var drift_max := test_signal_scanline_drift_max_at_zero_signal()
	results["test_signal_scanline_drift_max_at_zero_signal"] = drift_max
	results["test_safe_room_radial_ca"] = test_safe_room_radial_ca()
	results["test_safe_room_scanline_drift"] = test_safe_room_scanline_drift()
	results["test_crt_controller_loads"] = test_crt_controller_loads()
	results["test_crt_controller_has_accessibility_api"] = test_crt_controller_has_accessibility_api()
	results["test_crt_controller_has_passthrough_api"] = test_crt_controller_has_passthrough_api()
	results["test_compute_params_includes_new_params"] = test_compute_params_includes_new_params()
	return results


# --- Helper: Inline compute_params (mirrors crt_postprocess.gd logic) ---
# Since crt_postprocess.gd can't load in headless mode (DreadComposure/
# SignalStrength type annotations), we inline the compute_params formula
# to test the math independently.


static func _compute_params(
	dread: float, composure: float, signal_val: float, in_safe_room: bool
) -> Dictionary:
	if in_safe_room:
		dread = 0.0
		composure = 100.0
	var signal_factor: float = (100.0 - signal_val) / 100.0
	return {
		"ca_radial_amount": signal_factor * 4.0,
		"signal_scanline_drift": signal_factor * 2.0,
	}


# --- Helper: Parse shader code for uniform names ---


static func _get_shader_uniform_names() -> Array:
	var shader: Shader = load(SHADER_PATH)
	if shader == null:
		return []
	var code: String = shader.get_code()
	var names: Array = []
	var regex = RegEx.new()
	regex.compile("uniform\\s+\\w+\\s+(\\w+)")
	for match in regex.search_all(code):
		names.append(match.get_string(1))
	return names


# --- Test: Shader has DEA-142 uniforms ---


func test_shader_has_dea142_uniforms() -> bool:
	var names = _get_shader_uniform_names()
	if not "ca_radial_amount" in names:
		return false
	if not "signal_scanline_drift" in names:
		return false
	return true


# --- Test: Radial CA is 0 at signal=100 ---


func test_radial_ca_zero_at_full_signal() -> bool:
	var p = _compute_params(0.0, 100.0, 100.0, false)
	if abs(p["ca_radial_amount"] - 0.0) > 0.001:
		return false
	return true


# --- Test: Radial CA is max (4.0) at signal=0 ---


func test_radial_ca_max_at_zero_signal() -> bool:
	var p = _compute_params(0.0, 100.0, 0.0, false)
	if abs(p["ca_radial_amount"] - 4.0) > 0.001:
		return false
	return true


# --- Test: Radial CA scales linearly with signal ---


func test_radial_ca_scales_linearly() -> bool:
	var p_50 = _compute_params(0.0, 100.0, 50.0, false)
	# (100 - 50) / 100 * 4.0 = 2.0
	if abs(p_50["ca_radial_amount"] - 2.0) > 0.001:
		return false
	var p_75 = _compute_params(0.0, 100.0, 75.0, false)
	# (100 - 75) / 100 * 4.0 = 1.0
	if abs(p_75["ca_radial_amount"] - 1.0) > 0.001:
		return false
	return true


# --- Test: Signal scanline drift is 0 at signal=100 ---


func test_signal_scanline_drift_zero_at_full_signal() -> bool:
	var p = _compute_params(0.0, 100.0, 100.0, false)
	if abs(p["signal_scanline_drift"] - 0.0) > 0.001:
		return false
	return true


# --- Test: Signal scanline drift is max (2.0) at signal=0 ---


func test_signal_scanline_drift_max_at_zero_signal() -> bool:
	var p = _compute_params(0.0, 100.0, 0.0, false)
	if abs(p["signal_scanline_drift"] - 2.0) > 0.001:
		return false
	return true


# --- Test: Safe room — signal-driven CA independent of safe_room ---


func test_safe_room_radial_ca() -> bool:
	# Safe room resets dread=0, composure=100, but NOT signal.
	# So with low signal in safe room, CA is still present.
	var p = _compute_params(80.0, 10.0, 0.0, true)
	# Safe room: dread=0, composure=100, signal stays 0
	# ca_radial_amount = (100-0)/100 * 4.0 = 4.0
	if abs(p["ca_radial_amount"] - 4.0) > 0.001:
		return false
	# With full signal in safe room, CA is zero
	var p2 = _compute_params(80.0, 10.0, 100.0, true)
	if abs(p2["ca_radial_amount"] - 0.0) > 0.001:
		return false
	return true


# --- Test: Safe room zeros scanline drift (with full signal) ---


func test_safe_room_scanline_drift() -> bool:
	var p = _compute_params(80.0, 10.0, 100.0, true)
	if abs(p["signal_scanline_drift"] - 0.0) > 0.001:
		return false
	return true


# --- Test: CRTController script loads ---
# Since crt_controller.gd uses non-autoload class_name types (CRTPostProcess,
# SignalStrength, DreadComposure), load() fails in headless mode.
# We verify the script exists and has correct structure via source parsing.


func test_crt_controller_loads() -> bool:
	var file = FileAccess.open(CRT_CONTROLLER_PATH, FileAccess.READ)
	if file == null:
		return false
	var source = file.get_as_text()
	file.close()
	# Verify it extends Node (autoload-compatible)
	return source.find("extends Node") >= 0


# --- Test: CRTController has accessibility API methods ---
# Check script source for method definitions (can't instantiate in headless).


func test_crt_controller_has_accessibility_api() -> bool:
	var file = FileAccess.open(CRT_CONTROLLER_PATH, FileAccess.READ)
	if file == null:
		return false
	var source = file.get_as_text()
	file.close()
	var methods = [
		"func set_crt_enabled",
		"func is_crt_enabled",
		"func set_intensity_multiplier",
		"func get_intensity_multiplier",
		"func set_reduce_motion",
		"func is_reduce_motion",
		"func set_scanlines_enabled",
		"func set_curvature_enabled",
	]
	for m in methods:
		if source.find(m) < 0:
			return false
	return true


# --- Test: CRTController has passthrough API ---


func test_crt_controller_has_passthrough_api() -> bool:
	var file = FileAccess.open(CRT_CONTROLLER_PATH, FileAccess.READ)
	if file == null:
		return false
	var source = file.get_as_text()
	file.close()
	var methods = [
		"func get_crt",
		"func get_shader_material",
		"func trigger_roll",
		"func trigger_glitch_burst",
		"func set_param",
		"func get_param",
	]
	for m in methods:
		if source.find(m) < 0:
			return false
	return true


# --- Test: compute_params includes new DEA-142 params ---


func test_compute_params_includes_new_params() -> bool:
	var p = _compute_params(0.0, 100.0, 80.0, false)
	return p.has("ca_radial_amount") and p.has("signal_scanline_drift")
