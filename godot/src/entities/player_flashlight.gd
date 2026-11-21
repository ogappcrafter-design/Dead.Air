class_name PlayerFlashlight
extends Node3D

## DEA-187: Handheld flashlight with a finite battery.
##
## Player creates this node in code (no .tscn surgery). The SpotLight3D is
## built here and toggled by the "flashlight" action. The battery drains only
## while the light is ON, never recharges, and at 0 the light switches off and
## refuses to turn back on.
##
## While ON the flashlight reports a visibility multiplier that the Suit reads
## through Player.get_visibility_multiplier(), widening its effective detection
## range — one detection system, not a second one.

## Emitted whenever the battery level changes (0-100). HUD hook.
signal battery_changed(level: float)

## Emitted when the light switches on/off.
signal toggled(on: bool)

## Full battery charge.
const BATTERY_MAX: float = 100.0

## Drain rate: 100 -> 0 over 90 seconds of ON time.
const BATTERY_DRAIN_PER_SEC: float = BATTERY_MAX / 90.0

## Spot light reach in metres.
const LIGHT_RANGE: float = 14.0

## Spot light cone half-angle in degrees.
const LIGHT_ANGLE: float = 25.0

## Spot light energy.
const LIGHT_ENERGY: float = 3.0

## Detection-range multiplier the Suit applies while the light is ON.
const VISIBILITY_MULTIPLIER: float = 1.8

## Where the beam sits relative to the player origin (roughly chest height,
## slightly to the right, matching the player's forward -Z).
@export var light_offset: Vector3 = Vector3(0.2, 1.4, 0.0)

## Current battery level (0-100).
var battery: float = BATTERY_MAX

## Whether the light is currently on.
var is_on: bool = false

var _light: SpotLight3D

func _ready() -> void:
	_build_light()

func _process(delta: float) -> void:
	if _is_toggle_pressed():
		toggle()
	if is_on:
		_drain(delta)

## Build the SpotLight3D in code so player scenes need no changes.
func _build_light() -> void:
	if _light != null:
		return
	_light = SpotLight3D.new()
	_light.name = "SpotLight"
	_light.position = light_offset
	_light.light_energy = LIGHT_ENERGY
	_light.spot_range = LIGHT_RANGE
	_light.spot_angle = LIGHT_ANGLE
	_light.shadow_enabled = false
	_light.visible = is_on
	add_child(_light)

func _is_toggle_pressed() -> bool:
	var im: Node = get_node_or_null("/root/InputManager")
	if im != null and im.has_method("is_action_just_pressed"):
		return im.is_action_just_pressed("flashlight")
	return Input.is_action_just_pressed("flashlight")

## Flip the light. Returns false when the battery is empty and the light
## refuses to come on.
func toggle() -> bool:
	return set_on(not is_on)

## Switch the light on/off. Turning on at 0 battery is refused.
func set_on(on: bool) -> bool:
	if on and battery <= 0.0:
		return false
	if on == is_on:
		return true
	is_on = on
	if _light != null:
		_light.visible = is_on
	toggled.emit(is_on)
	return true

func _drain(delta: float) -> void:
	var before: float = battery
	battery = maxf(0.0, battery - BATTERY_DRAIN_PER_SEC * delta)
	if battery <= 0.0:
		battery = 0.0
		set_on(false)
	if not is_equal_approx(battery, before):
		battery_changed.emit(battery)

## Detection-range multiplier read by Suit._get_effective_range().
func get_visibility_multiplier() -> float:
	return VISIBILITY_MULTIPLIER if is_on else 1.0

func get_battery() -> float:
	return battery

## Set the battery level directly (save/load, tests).
func set_battery(value: float) -> void:
	battery = clampf(value, 0.0, BATTERY_MAX)
	if battery <= 0.0:
		set_on(false)
	battery_changed.emit(battery)

func get_light() -> SpotLight3D:
	return _light
