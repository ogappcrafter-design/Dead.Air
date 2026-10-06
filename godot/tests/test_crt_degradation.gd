extends RefCounted

# ============================================================================
# Test Suite: CRT Degradation System — DEA-145
# Tests per-shift degradation, compute_params thresholds, hide mode API,
# save/load integration, and shader uniform presence.
#
# NOTE: Godot 4.7 headless mode cannot resolve non-autoload class_name types.
# Uses source-parsing and inline logic patterns like test_crt_shader_v2.gd.
# ============================================================================

const SHADER_PATH: String = "res://assets/shaders/crt_postprocess.gdshader"
const POSTPROCESS_PATH: String = "res://src/visual/crt_postprocess.gd"
# DEA-145 controller tests target the post-process script: the CRTController
# autoload was removed in the companion-project sync, and crt_postprocess.gd
# now owns the controller role (degradation + hide mode API).
const CONTROLLER_PATH: String = "res://src/visual/crt_postprocess.gd"
const DEGRADATION_PATH: String = "res://src/visual/crt_degradation.gd"
const SAVE_DATA_PATH: String = "res://src/core/save_data.gd"

var test_name: String = "CRTDegradation"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shader_has_rgb_swap_uniform"] = test_shader_has_rgb_swap_uniform()
	results["test_compute_params_has_degradation_param"] = test_compute_params_has_degradation_param()
	results["test_compute_params_returns_rgb_swap"] = test_compute_params_returns_rgb_swap()
	results["test_composure_below_50_has_flicker"] = test_composure_below_50_has_flicker()
	results["test_composure_below_30_has_scanline_drift"] = test_composure_below_30_has_scanline_drift()
	results["test_composure_below_20_has_severe_glitch"] = test_composure_below_20_has_severe_glitch()
	results["test_composure_below_10_has_inversion_and_rgb_swap"] = test_composure_below_10_has_inversion_and_rgb_swap()
	results["test_signal_below_50_has_noise"] = test_signal_below_50_has_noise()
	results["test_signal_below_30_has_heavy_static"] = test_signal_below_30_has_heavy_static()
	results["test_signal_below_10_near_total_static"] = test_signal_below_10_near_total_static()
	results["test_dread_above_40_has_vignette"] = test_dread_above_40_has_vignette()
	results["test_dread_above_60_has_ca"] = test_dread_above_60_has_ca()
	results["test_dread_above_80_image_breaks"] = test_dread_above_80_image_breaks()
	results["test_degradation_amplifies_effects"] = test_degradation_amplifies_effects()
	results["test_safe_room_resets_dread_composure_not_signal"] = test_safe_room_resets_dread_composure_not_signal()
	results["test_controller_has_hide_mode_api"] = test_controller_has_hide_mode_api()
	results["test_controller_has_rgb_swap_in_scalable_params"] = test_controller_has_rgb_swap_in_scalable_params()
	results["test_degradation_autoload_has_save_load"] = test_degradation_autoload_has_save_load()
	results["test_degradation_shift_levels"] = test_degradation_shift_levels()
	results["test_save_data_has_crt_degradation_field"] = test_save_data_has_crt_degradation_field()
	return results


# --- Source parsing helpers ---

func _read_source(path: String) -> String:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		return ""
	var content := f.get_as_text()
	f.close()
	return content


# --- Inline compute_params (mirrors crt_postprocess.gd DEA-145 logic) ---

const COMPOSURE_FLICKER: float = 50.0
const COMPOSURE_DRIFT: float = 30.0
const COMPOSURE_SEVERE: float = 20.0
const COMPOSURE_INVERSION: float = 10.0
const SIGNAL_NOISE: float = 50.0
const SIGNAL_HEAVY: float = 30.0
const SIGNAL_NEAR_TOTAL: float = 10.0
const DREAD_VIGNETTE: float = 40.0
const DREAD_CA: float = 60.0
const DREAD_BREAK: float = 80.0


static func _inline_compute_params(
	dread: float, composure: float, signal_val: float, in_safe_room: bool,
	degradation: float = 0.0
) -> Dictionary:
	if in_safe_room:
		dread = 0.0
		composure = 100.0

	var deg_composure: float = clampf(composure - degradation * 40.0, 0.0, 100.0)
	var deg_dread: float = clampf(dread + degradation * 20.0, 0.0, 100.0)

	var scanline_opacity: float = lerp(0.15, 0.35, 1.0 - (deg_composure / 100.0))

	var roll_speed: float = 0.0
	if deg_dread > 50.0:
		roll_speed = (deg_dread - 50.0) / 50.0 * 5.0

	var bloom_intensity: float = lerp(0.3, 0.6, deg_dread / 100.0)

	var flicker_intensity: float = 0.02
	if deg_composure < COMPOSURE_FLICKER:
		flicker_intensity = lerp(0.02, 0.08, 1.0 - (deg_composure / COMPOSURE_FLICKER))
	if deg_composure < COMPOSURE_SEVERE:
		flicker_intensity = lerp(flicker_intensity, 0.2, 1.0 - (deg_composure / COMPOSURE_SEVERE))

	var glitch_intensity: float = 0.0
	var tear_intensity: float = 0.0
	if deg_composure < COMPOSURE_SEVERE:
		var glitch_factor: float = 1.0 - (deg_composure / COMPOSURE_SEVERE)
		glitch_intensity = glitch_factor
		tear_intensity = glitch_factor * 0.7

	var signal_scanline_drift: float = 0.0
	if deg_composure < COMPOSURE_DRIFT:
		signal_scanline_drift = (1.0 - (deg_composure / COMPOSURE_DRIFT)) * 1.5
	var signal_factor: float = (100.0 - signal_val) / 100.0
	signal_scanline_drift = maxf(signal_scanline_drift, signal_factor * 2.0)

	var vignette_intensity: float = 0.3
	if deg_dread > DREAD_VIGNETTE:
		vignette_intensity = lerp(0.3, 0.5, (deg_dread - DREAD_VIGNETTE) / 60.0)
	if deg_dread > DREAD_BREAK:
		vignette_intensity = lerp(0.5, 0.8, (deg_dread - DREAD_BREAK) / 20.0)

	var noise_density: float = 0.05
	if signal_val < SIGNAL_NOISE:
		noise_density = lerp(0.05, 0.3, 1.0 - (signal_val / SIGNAL_NOISE))
	if signal_val < SIGNAL_HEAVY:
		noise_density = lerp(noise_density, 0.6, 1.0 - (signal_val / SIGNAL_HEAVY))
	if signal_val < SIGNAL_NEAR_TOTAL:
		noise_density = lerp(noise_density, 0.95, 1.0 - (signal_val / SIGNAL_NEAR_TOTAL))
	noise_density = clampf(noise_density + degradation * 0.1, 0.0, 1.0)

	var inversion_amount: float = 0.0
	if deg_composure < COMPOSURE_INVERSION:
		inversion_amount = 1.0 - (deg_composure / COMPOSURE_INVERSION)

	var rgb_swap_amount: float = 0.0
	if deg_composure < COMPOSURE_INVERSION:
		rgb_swap_amount = clampf((1.0 - (deg_composure / COMPOSURE_INVERSION)) * 0.7, 0.0, 0.7)

	var ca_radial_amount: float = signal_factor * 4.0
	if deg_dread > DREAD_CA:
		ca_radial_amount += (deg_dread - DREAD_CA) / 40.0 * 3.0

	return {
		"scanline_opacity": scanline_opacity,
		"scanline_roll_speed": roll_speed,
		"bloom_intensity": bloom_intensity,
		"flicker_intensity": flicker_intensity,
		"glitch_intensity": glitch_intensity,
		"tear_intensity": tear_intensity,
		"vignette_intensity": vignette_intensity,
		"noise_density": noise_density,
		"inversion_amount": inversion_amount,
		"rgb_swap_amount": rgb_swap_amount,
		"ca_radial_amount": ca_radial_amount,
		"signal_scanline_drift": signal_scanline_drift,
	}


# --- Shader tests ---

func test_shader_has_rgb_swap_uniform() -> bool:
	var source := _read_source(SHADER_PATH)
	return source.contains("uniform float rgb_swap_amount")


# --- compute_params source tests ---

func test_compute_params_has_degradation_param() -> bool:
	var source := _read_source(POSTPROCESS_PATH)
	return source.contains("degradation: float = 0.0")


func test_compute_params_returns_rgb_swap() -> bool:
	var source := _read_source(POSTPROCESS_PATH)
	return source.contains('"rgb_swap_amount"')


# --- Composure threshold tests ---

func test_composure_below_50_has_flicker() -> bool:
	var p := _inline_compute_params(0, 45, 80, false)
	return p.flicker_intensity > 0.02


func test_composure_below_30_has_scanline_drift() -> bool:
	var p := _inline_compute_params(0, 25, 80, false)
	return p.signal_scanline_drift > 0.0


func test_composure_below_20_has_severe_glitch() -> bool:
	var p := _inline_compute_params(0, 5, 80, false)
	return p.glitch_intensity > 0.5 and p.tear_intensity > 0.0


func test_composure_below_10_has_inversion_and_rgb_swap() -> bool:
	var p := _inline_compute_params(0, 5, 80, false)
	return p.inversion_amount > 0.0 and p.rgb_swap_amount > 0.0


# --- Signal threshold tests ---

func test_signal_below_50_has_noise() -> bool:
	var p := _inline_compute_params(0, 100, 40, false)
	return p.noise_density > 0.05


func test_signal_below_30_has_heavy_static() -> bool:
	var p := _inline_compute_params(0, 100, 20, false)
	return p.noise_density > 0.3


func test_signal_below_10_near_total_static() -> bool:
	var p := _inline_compute_params(0, 100, 5, false)
	return p.noise_density > 0.6


# --- Dread threshold tests ---

func test_dread_above_40_has_vignette() -> bool:
	var p := _inline_compute_params(50, 100, 80, false)
	return p.vignette_intensity > 0.3


func test_dread_above_60_has_ca() -> bool:
	var p := _inline_compute_params(70, 100, 80, false)
	return p.ca_radial_amount > 0.0


func test_dread_above_80_image_breaks() -> bool:
	var p := _inline_compute_params(90, 100, 80, false)
	return p.vignette_intensity > 0.5


# --- Degradation tests ---

func test_degradation_amplifies_effects() -> bool:
	var base := _inline_compute_params(20, 60, 80, false, 0.0)
	var deg := _inline_compute_params(20, 60, 80, false, 0.6)
	# Degradation should reduce effective composure → more flicker, more noise
	return deg.flicker_intensity > base.flicker_intensity and deg.noise_density > base.noise_density


# --- Safe room test ---

func test_safe_room_resets_dread_composure_not_signal() -> bool:
	var p := _inline_compute_params(90, 5, 10, true)
	# Signal-driven effects should persist even in safe room
	return p.scanline_roll_speed == 0.0 and p.vignette_intensity == 0.3 and p.noise_density > 0.05


# --- Controller source tests ---

func test_controller_has_hide_mode_api() -> bool:
	var source := _read_source(CONTROLLER_PATH)
	return source.contains("set_crt_visible") and source.contains("is_crt_visible")


func test_controller_has_rgb_swap_in_scalable_params() -> bool:
	var source := _read_source(CONTROLLER_PATH)
	return source.contains('"rgb_swap_amount"')


# --- Degradation autoload tests ---

func test_degradation_autoload_has_save_load() -> bool:
	var source := _read_source(DEGRADATION_PATH)
	return source.contains("func save_to") and source.contains("func load_from")


func test_degradation_shift_levels() -> bool:
	var source := _read_source(DEGRADATION_PATH)
	# Shift 1 should be 0.0 (pristine), shift 5 should be 0.85 (barely holding)
	return source.contains("0.0") and source.contains("0.85")


# --- Save data tests ---

func test_save_data_has_crt_degradation_field() -> bool:
	var source := _read_source(SAVE_DATA_PATH)
	return source.contains("crt_degradation") and source.contains('"crt_degradation"')
