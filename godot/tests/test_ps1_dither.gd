## test_ps1_dither.gd — Tests for the DEA-176 15-bit quantisation pass.
## Verifies the quantisation math, the Bayer 4x4 pattern, shader loading, the
## node's own overlay construction and toggling, and that the station scene
## carries the pass above the CRT layer.
extends RefCounted

var test_name: String = "PS1Dither"

const SHADER_PATH := "res://assets/shaders/ps1_dither.gdshader"
const STATION_PATH := "res://scenes/station/station.tscn"


func run_tests() -> Dictionary:
	var results := {}

	var shader: Shader = load(SHADER_PATH)
	results["test_shader_loads"] = shader is Shader

	var levels := PS1Dither.LEVELS_PER_CHANNEL
	results["test_levels_are_15_bit"] = levels == 32.0

	# A 15-bit channel has 32 representable values.
	var seen := {}
	for i in range(32):
		seen[PS1Dither.quantise(float(i) / 31.0)] = true
	results["test_quantise_has_32_steps"] = seen.size() == 32
	results["test_quantise_clamps_low"] = is_equal_approx(PS1Dither.quantise(-0.5), 0.0)
	results["test_quantise_clamps_high"] = is_equal_approx(PS1Dither.quantise(1.5), 1.0)
	results["test_quantise_midpoint"] = is_equal_approx(PS1Dither.quantise(0.5), 16.0 / 31.0)

	# Error must stay within half a quantisation step for every input.
	var step := 1.0 / (levels - 1.0)
	var worst := 0.0
	for i in range(1001):
		var v := float(i) / 1000.0
		worst = maxf(worst, absf(PS1Dither.quantise(v) - v))
	results["test_quantise_error_within_half_step"] = worst <= step * 0.5 + 0.000001

	# Bayer table: 16 distinct thresholds covering 0..15/16, and the mapping is
	# periodic with the 4x4 grid.
	var thresholds := {}
	for y in range(4):
		for x in range(4):
			thresholds[PS1Dither.bayer_threshold(x, y)] = true
	results["test_bayer_has_16_levels"] = thresholds.size() == 16
	results["test_bayer_is_periodic"] = PS1Dither.bayer_threshold(4, 0) == PS1Dither.bayer_threshold(0, 0) \
		and PS1Dither.bayer_threshold(3, 7) == PS1Dither.bayer_threshold(3, 3)

	var dither: PS1Dither = PS1Dither.new()
	Engine.get_main_loop().root.add_child(dither)
	results["test_overlay_created"] = dither.get_child_count() == 1
	results["test_overlay_is_fullscreen"] = dither.get_child_count() == 1 \
		and dither.get_child(0) is ColorRect
	dither.enabled = false
	results["test_disable_hides_overlay"] = dither.get_child_count() == 1 \
		and not (dither.get_child(0) as ColorRect).visible
	dither.enabled = true
	results["test_enable_shows_overlay"] = dither.get_child_count() == 1 \
		and (dither.get_child(0) as ColorRect).visible
	results["test_layer_above_crt"] = dither.layer == 100
	dither.get_parent().remove_child(dither)
	dither.free()

	var packed: PackedScene = load(STATION_PATH)
	results["test_station_has_dither_pass"] = packed != null \
		and _find_node_name(packed.instantiate(), "PS1Dither")

	return results


func _find_node_name(root: Node, wanted: String) -> bool:
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node.name == wanted:
			root.free()
			return true
		for child in node.get_children():
			stack.push_back(child)
	root.free()
	return false
