## test_visual_accessibility.gd — Tests for DEA-146 Visual Accessibility Options.
## Verifies: camera shake reduction levels, high contrast toggle, text size scales,
## screen flash reduction, static reduction, vignette reduction, CRT toggle,
## difficulty preset parameters, settings persistence, and CRT shader modifier mapping.
extends RefCounted

const EPS := 0.01

var test_name: String = "VisualAccessibility"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	# ─── Camera shake reduction ──────────────────────────────────
	results["camera_shake_levels_valid"] = _test_camera_shake_levels()
	results["camera_shake_multiplier_0"] = _test_shake_mult_0()
	results["camera_shake_multiplier_50"] = _test_shake_mult_50()
	results["camera_shake_multiplier_100"] = _test_shake_mult_100()
	results["camera_shake_set_clamps"] = _test_shake_set_clamps()
	results["camera_shake_signal"] = _test_shake_signal()

	# ─── Text size ───────────────────────────────────────────────
	results["text_size_scales"] = _test_text_size_scales()
	results["text_size_toggle"] = _test_text_size_toggle()
	results["text_size_default"] = _test_text_size_default()

	# ─── High contrast ───────────────────────────────────────────
	results["high_contrast_toggle"] = _test_high_contrast_toggle()
	results["high_contrast_default"] = _test_high_contrast_default()

	# ─── Screen flash reduction ─────────────────────────────────
	results["screen_flash_toggle"] = _test_screen_flash_toggle()
	results["screen_flash_default"] = _test_screen_flash_default()

	# ─── Static reduction ───────────────────────────────────────
	results["static_reduction_toggle"] = _test_static_reduction_toggle()
	results["static_reduction_default"] = _test_static_reduction_default()

	# ─── Vignette reduction ─────────────────────────────────────
	results["vignette_reduction_toggle"] = _test_vignette_reduction_toggle()
	results["vignette_reduction_default"] = _test_vignette_reduction_default()

	# ─── CRT toggle ──────────────────────────────────────────────
	results["crt_toggle"] = _test_crt_toggle()
	results["crt_default"] = _test_crt_default()

	# ─── Difficulty presets ─────────────────────────────────────
	results["difficulty_default"] = _test_difficulty_default()
	results["difficulty_easy_params"] = _test_difficulty_easy()
	results["difficulty_normal_params"] = _test_difficulty_normal()
	results["difficulty_hard_params"] = _test_difficulty_hard()
	results["difficulty_dead_air_params"] = _test_difficulty_dead_air()
	results["difficulty_no_saves"] = _test_difficulty_no_saves()
	results["difficulty_one_life"] = _test_difficulty_one_life()
	results["difficulty_toggle"] = _test_difficulty_toggle()

	# ─── CRT shader modifier mapping ────────────────────────────
	results["mods_no_settings"] = _test_mods_no_settings()
	results["mods_shake_50"] = _test_mods_shake_50()
	results["mods_shake_100"] = _test_mods_shake_100()
	results["mods_flash_reduction"] = _test_mods_flash_reduction()
	results["mods_static_reduction"] = _test_mods_static_reduction()
	results["mods_vignette_off"] = _test_mods_vignette_off()
	results["mods_crt_off"] = _test_mods_crt_off()
	results["mods_crt_off_short_circuits"] = _test_mods_crt_off_short_circuit()

	# ─── Settings persistence ───────────────────────────────────
	results["persistence_save_load"] = _test_persistence()
	results["persistence_defaults"] = _test_persistence_defaults()

	# ─── Reset ──────────────────────────────────────────────────
	results["reset_clears_visual_state"] = _test_reset_clears_state()

	# ─── Controller loads ───────────────────────────────────────
	results["controller_loads"] = _test_controller_loads()
	results["high_contrast_manager_loads"] = _test_hc_manager_loads()

	return results


# ─── Helper ────────────────────────────────────────────────────────


func _make_manager():
	var script = load("res://src/core/accessibility_manager.gd")
	if script == null:
		return null
	return script.new()


func _approx_eq(a: float, b: float, eps: float = EPS) -> bool:
	return abs(a - b) <= eps


# ─── Camera Shake Reduction Tests ──────────────────────────────────


func _test_camera_shake_levels() -> bool:
	return (
		AccessibilityManager.CAMERA_SHAKE_LEVELS.size() == 3
		and AccessibilityManager.CAMERA_SHAKE_LEVELS[0] == 0
		and AccessibilityManager.CAMERA_SHAKE_LEVELS[1] == 50
		and AccessibilityManager.CAMERA_SHAKE_LEVELS[2] == 100
	)


func _test_shake_mult_0() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_camera_shake_reduction(0)
	return _approx_eq(am.get_camera_shake_multiplier(), 1.0)


func _test_shake_mult_50() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_camera_shake_reduction(50)
	return _approx_eq(am.get_camera_shake_multiplier(), 0.5)


func _test_shake_mult_100() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_camera_shake_reduction(100)
	return _approx_eq(am.get_camera_shake_multiplier(), 0.0)


func _test_shake_set_clamps() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Invalid values snap to nearest valid level
	am.set_camera_shake_reduction(45)
	if am.camera_shake_reduction != 50:
		return false
	am.set_camera_shake_reduction(80)
	if am.camera_shake_reduction != 100:
		return false
	am.set_camera_shake_reduction(10)
	if am.camera_shake_reduction != 0:
		return false
	return true


func _test_shake_signal() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	var received: Dictionary = {"val": -1}
	am.camera_shake_reduction_changed.connect(func(val): received["val"] = val)
	am.set_camera_shake_reduction(100)
	return received["val"] == 100


# ─── Text Size Tests ────────────────────────────────────────────────


func _test_text_size_scales() -> bool:
	return (
		_approx_eq(AccessibilityManager.TEXT_SIZE_SCALES[AccessibilityManager.TextSize.SMALL], 1.0)
		and _approx_eq(
			AccessibilityManager.TEXT_SIZE_SCALES[AccessibilityManager.TextSize.MEDIUM], 1.25
		)
		and _approx_eq(
			AccessibilityManager.TEXT_SIZE_SCALES[AccessibilityManager.TextSize.LARGE], 1.5
		)
		and _approx_eq(
			AccessibilityManager.TEXT_SIZE_SCALES[AccessibilityManager.TextSize.EXTRA_LARGE], 2.0
		)
	)


func _test_text_size_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_text_size(AccessibilityManager.TextSize.LARGE)
	if am.text_size != AccessibilityManager.TextSize.LARGE:
		return false
	if not _approx_eq(am.get_text_size_scale(), 1.5):
		return false
	am.set_text_size(AccessibilityManager.TextSize.EXTRA_LARGE)
	return _approx_eq(am.get_text_size_scale(), 2.0)


func _test_text_size_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return am.text_size == AccessibilityManager.TextSize.SMALL


# ─── High Contrast Tests ───────────────────────────────────────────


func _test_high_contrast_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.high_contrast_mode:
		return false
	am.set_high_contrast_mode(true)
	if not am.high_contrast_mode:
		return false
	am.set_high_contrast_mode(false)
	return not am.high_contrast_mode


func _test_high_contrast_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return not am.high_contrast_mode


# ─── Screen Flash Reduction Tests ─────────────────────────────────


func _test_screen_flash_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.screen_flash_reduction:
		return false
	am.set_screen_flash_reduction(true)
	if not am.screen_flash_reduction:
		return false
	am.set_screen_flash_reduction(false)
	return not am.screen_flash_reduction


func _test_screen_flash_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return not am.screen_flash_reduction


# ─── Static Reduction Tests ────────────────────────────────────────


func _test_static_reduction_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.static_reduction:
		return false
	am.set_static_reduction(true)
	if not am.static_reduction:
		return false
	am.set_static_reduction(false)
	return not am.static_reduction


func _test_static_reduction_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return not am.static_reduction


# ─── Vignette Reduction Tests ──────────────────────────────────────


func _test_vignette_reduction_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if am.vignette_reduction:
		return false
	am.set_vignette_reduction(true)
	if not am.vignette_reduction:
		return false
	am.set_vignette_reduction(false)
	return not am.vignette_reduction


func _test_vignette_reduction_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return not am.vignette_reduction


# ─── CRT Toggle Tests ──────────────────────────────────────────────


func _test_crt_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	if not am.crt_enabled:
		return false
	am.set_crt_enabled(false)
	if am.crt_enabled:
		return false
	am.set_crt_enabled(true)
	return am.crt_enabled


func _test_crt_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return am.crt_enabled


# ─── Difficulty Preset Tests ────────────────────────────────────────


func _test_difficulty_default() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	return am.difficulty_preset == AccessibilityManager.DifficultyPreset.NORMAL


func _test_difficulty_easy() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.EASY)
	return (
		_approx_eq(am.get_difficulty_composure_decay_mult(), 0.5)
		and _approx_eq(am.get_difficulty_starting_dread(), 20.0)
		and _approx_eq(am.get_difficulty_save_freq_mult(), 1.5)
		and _approx_eq(am.get_difficulty_composure_start(), 100.0)
		and not am.is_one_life()
		and not am.is_no_saves()
	)


func _test_difficulty_normal() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.NORMAL)
	return (
		_approx_eq(am.get_difficulty_composure_decay_mult(), 1.0)
		and _approx_eq(am.get_difficulty_starting_dread(), 40.0)
		and _approx_eq(am.get_difficulty_save_freq_mult(), 1.0)
		and _approx_eq(am.get_difficulty_composure_start(), 100.0)
		and not am.is_one_life()
		and not am.is_no_saves()
	)


func _test_difficulty_hard() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.HARD)
	return (
		_approx_eq(am.get_difficulty_composure_decay_mult(), 1.25)
		and _approx_eq(am.get_difficulty_starting_dread(), 55.0)
		and _approx_eq(am.get_difficulty_save_freq_mult(), 0.7)
		and _approx_eq(am.get_difficulty_composure_start(), 100.0)
		and not am.is_one_life()
		and not am.is_no_saves()
	)


func _test_difficulty_dead_air() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.DEAD_AIR)
	return (
		_approx_eq(am.get_difficulty_composure_decay_mult(), 1.0)
		and _approx_eq(am.get_difficulty_starting_dread(), 70.0)
		and _approx_eq(am.get_difficulty_save_freq_mult(), 0.0)
		and _approx_eq(am.get_difficulty_composure_start(), 50.0)
	)


func _test_difficulty_no_saves() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.DEAD_AIR)
	return am.is_no_saves()


func _test_difficulty_one_life() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.DEAD_AIR)
	return am.is_one_life()


func _test_difficulty_toggle() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.HARD)
	if am.difficulty_preset != AccessibilityManager.DifficultyPreset.HARD:
		return false
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.EASY)
	return am.difficulty_preset == AccessibilityManager.DifficultyPreset.EASY


# ─── CRT Shader Modifier Mapping Tests ─────────────────────────────


func _test_mods_no_settings() -> bool:
	var mods := VisualAccessibilityController.compute_mods(0, false, false, false, true)
	return mods.is_empty()


func _test_mods_shake_50() -> bool:
	var mods := VisualAccessibilityController.compute_mods(50, false, false, false, true)
	return mods.has("shake_mult") and _approx_eq(mods["shake_mult"], 0.5)


func _test_mods_shake_100() -> bool:
	var mods := VisualAccessibilityController.compute_mods(100, false, false, false, true)
	return mods.has("shake_mult") and _approx_eq(mods["shake_mult"], 0.0)


func _test_mods_flash_reduction() -> bool:
	var mods := VisualAccessibilityController.compute_mods(0, true, false, false, true)
	return mods.get("flash_reduction", false) == true


func _test_mods_static_reduction() -> bool:
	var mods := VisualAccessibilityController.compute_mods(0, false, true, false, true)
	return mods.has("static_mult") and _approx_eq(mods["static_mult"], 0.5)


func _test_mods_vignette_off() -> bool:
	var mods := VisualAccessibilityController.compute_mods(0, false, false, true, true)
	return mods.get("vignette_off", false) == true


func _test_mods_crt_off() -> bool:
	var mods := VisualAccessibilityController.compute_mods(0, false, false, false, false)
	return mods.get("crt_off", false) == true


func _test_mods_crt_off_short_circuit() -> bool:
	# When CRT is off, other mods are not included (short-circuit)
	var mods := VisualAccessibilityController.compute_mods(100, true, true, true, false)
	return mods.size() == 1 and mods.has("crt_off")


# ─── Persistence Tests ────────────────────────────────────────────


func _test_persistence() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Set non-default visual state
	am.set_camera_shake_reduction(100)
	am.set_high_contrast_mode(true)
	am.set_text_size(AccessibilityManager.TextSize.LARGE)
	am.set_screen_flash_reduction(true)
	am.set_static_reduction(true)
	am.set_vignette_reduction(true)
	am.set_crt_enabled(false)
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.DEAD_AIR)

	# Save
	am.save_settings()

	# Create fresh manager and load
	var am2 = _make_manager()
	if am2 == null:
		return false
	# _load_settings reads from the same SETTINGS_PATH
	am2._load_settings()

	return (
		am2.camera_shake_reduction == 100
		and am2.high_contrast_mode == true
		and am2.text_size == AccessibilityManager.TextSize.LARGE
		and am2.screen_flash_reduction == true
		and am2.static_reduction == true
		and am2.vignette_reduction == true
		and am2.crt_enabled == false
		and am2.difficulty_preset == AccessibilityManager.DifficultyPreset.DEAD_AIR
	)


func _test_persistence_defaults() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Clear saved settings file (write defaults then load fresh)
	am._reset_for_testing()
	am.save_settings()

	var am2 = _make_manager()
	if am2 == null:
		return false
	am2._load_settings()

	return (
		am2.camera_shake_reduction == 0
		and not am2.high_contrast_mode
		and am2.text_size == AccessibilityManager.TextSize.SMALL
		and not am2.screen_flash_reduction
		and not am2.static_reduction
		and not am2.vignette_reduction
		and am2.crt_enabled
		and am2.difficulty_preset == AccessibilityManager.DifficultyPreset.NORMAL
	)


# ─── Reset Test ────────────────────────────────────────────────────


func _test_reset_clears_state() -> bool:
	var am = _make_manager()
	if am == null:
		return false
	# Set non-default visual state
	am.set_camera_shake_reduction(100)
	am.set_high_contrast_mode(true)
	am.set_text_size(AccessibilityManager.TextSize.EXTRA_LARGE)
	am.set_screen_flash_reduction(true)
	am.set_static_reduction(true)
	am.set_vignette_reduction(true)
	am.set_crt_enabled(false)
	am.set_difficulty_preset(AccessibilityManager.DifficultyPreset.DEAD_AIR)

	# Reset
	am._reset_for_testing()

	# Verify all visual state is back to defaults
	return (
		am.camera_shake_reduction == 0
		and not am.high_contrast_mode
		and am.text_size == AccessibilityManager.TextSize.SMALL
		and not am.screen_flash_reduction
		and not am.static_reduction
		and not am.vignette_reduction
		and am.crt_enabled
		and am.difficulty_preset == AccessibilityManager.DifficultyPreset.NORMAL
	)


# ─── Controller Load Tests ─────────────────────────────────────────


func _test_controller_loads() -> bool:
	var script = load("res://src/visual/visual_accessibility_controller.gd")
	if script == null:
		return false
	var instance = script.new()
	var is_valid = instance != null and instance is Node
	instance.free()
	return is_valid


func _test_hc_manager_loads() -> bool:
	var script = load("res://src/ui/high_contrast_manager.gd")
	if script == null:
		return false
	var instance = script.new()
	var is_valid = instance != null and instance is Control
	instance.free()
	return is_valid
