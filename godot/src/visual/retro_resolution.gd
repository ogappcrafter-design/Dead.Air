class_name RetroResolution
extends Node

## DEA-174: PS1-era internal render resolution (320x240) upscaled to the window.
##
## Drives the root window's content scale so the 3D and 2D passes render into a
## 320x240 buffer and the result is stretched to the display with nearest
## sampling (the project's canvas default filter is nearest). Integer scaling is
## the default so pixels stay square instead of shearing into uneven rows.

const INTERNAL_SIZE := Vector2i(320, 240)
## 320x240 is 4:3; the manager warns rather than silently accepting 16:9.
const ASPECT := 4.0 / 3.0

@export var enabled: bool = true:
	set(value):
		enabled = value
		apply()

@export var internal_size: Vector2i = INTERNAL_SIZE:
	set(value):
		internal_size = value
		apply()

## Integer scaling only on multiples of the internal size; off means fractional
## stretch, which softens pixel edges unevenly.
@export var integer_scale: bool = true:
	set(value):
		integer_scale = value
		apply()


func _ready() -> void:
	apply()


## Push the current configuration onto the root window. Safe to call repeatedly;
## disabling restores the engine default (content scale disabled).
func apply() -> void:
	var window := get_window()
	if window == null:
		return
	if not enabled:
		window.content_scale_size = Vector2i.ZERO
		window.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
		return
	window.content_scale_size = internal_size
	window.content_scale_mode = Window.CONTENT_SCALE_MODE_VIEWPORT
	window.content_scale_stretch = (
		Window.CONTENT_SCALE_STRETCH_INTEGER if integer_scale
		else Window.CONTENT_SCALE_STRETCH_FRACTIONAL
	)
	window.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_KEEP


## Dimensions actually presented for a window of `window_size`, rounded down to
## the integer scale multiple (or the raw ratio when fractional scaling is on).
static func presented_size(window_size: Vector2i, internal: Vector2i = INTERNAL_SIZE, integer_scaling: bool = true) -> Vector2i:
	if internal.x <= 0 or internal.y <= 0:
		return window_size
	if integer_scaling:
		var factor := maxi(1, mini(window_size.x / internal.x, window_size.y / internal.y))
		return internal * factor
	var ratio := minf(float(window_size.x) / float(internal.x), float(window_size.y) / float(internal.y))
	return Vector2i(roundi(internal.x * ratio), roundi(internal.y * ratio))


static func is_4_3(size: Vector2i) -> bool:
	if size.y == 0:
		return false
	return is_equal_approx(float(size.x) / float(size.y), ASPECT)
