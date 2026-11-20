class_name PS1Dither
extends CanvasLayer

## DEA-176: 15-bit colour quantisation with ordered dithering.
##
## Sits above the CRT post-process layer and quantises the finished frame to
## 5 bits per channel (32 levels, the PS1's 15-bit framebuffer) after a Bayer
## 4x4 dither offset. Purely a presentation layer: it owns no game state and
## the accessibility manager can switch it off.

const SHADER_PATH := "res://assets/shaders/ps1_dither.gdshader"
## 5 bits per channel => 32 levels => 32768 colours.
const LEVELS_PER_CHANNEL := 32.0
const DITHER_GRID := 4

@export var enabled: bool = true:
	set(value):
		enabled = value
		_apply_enabled()

@export_range(2.0, 256.0, 1.0) var levels: float = LEVELS_PER_CHANNEL:
	set(value):
		levels = value
		_apply_param(&"levels", levels)

@export_range(0.0, 1.0, 0.01) var dither_strength: float = 1.0:
	set(value):
		dither_strength = value
		_apply_param(&"dither_strength", dither_strength)

var _rect: ColorRect
var _material: ShaderMaterial


func _ready() -> void:
	layer = 100
	_rect = ColorRect.new()
	_rect.name = "Quantise"
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shader: Shader = load(SHADER_PATH)
	if shader == null:
		push_error("PS1Dither: failed to load shader at %s" % SHADER_PATH)
		return
	_material = ShaderMaterial.new()
	_material.shader = shader
	_rect.material = _material
	add_child(_rect)
	_apply_param(&"levels", levels)
	_apply_param(&"dither_strength", dither_strength)
	_apply_enabled()


## Quantise a 0..1 channel value the same way the shader does, with no dither
## offset. Exposed so the quantisation step is checkable without a GPU.
static func quantise(value: float, level_count: float = LEVELS_PER_CHANNEL) -> float:
	var steps := maxf(level_count - 1.0, 1.0)
	return floorf(clampf(value, 0.0, 1.0) * steps + 0.5) / steps


## Bayer 4x4 threshold for a pixel coordinate, in 0..1. Matches the shader's
## BAYER4 table so tests can assert the dither pattern itself.
static func bayer_threshold(x: int, y: int) -> float:
	const BAYER4 := [
		0.0, 8.0, 2.0, 10.0,
		12.0, 4.0, 14.0, 6.0,
		3.0, 11.0, 1.0, 9.0,
		15.0, 7.0, 13.0, 5.0,
	]
	var cx := posmod(x, DITHER_GRID)
	var cy := posmod(y, DITHER_GRID)
	return BAYER4[cy * DITHER_GRID + cx] / 16.0


func _apply_enabled() -> void:
	if _rect == null:
		return
	_rect.visible = enabled


func _apply_param(name: StringName, value: float) -> void:
	if _material == null:
		return
	_material.set_shader_parameter(name, value)
