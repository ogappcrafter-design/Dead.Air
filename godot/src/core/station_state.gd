extends Node
## StationState — Autoload tracking shift progression, degradation, and wrongness events.
## Registered as "StationState" in project.godot autoloads.

signal shift_changed(shift_number: int)

## E1 trigger time: 02:15 = 135 seconds into shift 2.
const E1_TRIGGER_TIME: float = 135.0

## E2 trigger time: 03:00 = 180 seconds into shift 2.
const E2_TRIGGER_TIME: float = 180.0

## Current shift number (starts at 1).
var shift_number: int = 1

## Elapsed seconds in current shift (for timing wrongness events).
var _shift_elapsed: float = 0.0

## Which wrongness events have already fired this shift.
var _wrongness_triggered: Dictionary = {}

## Registered degradation target nodes (keyed by string name).
var _degradation_nodes: Dictionary = {}

## Registered wrongness target nodes (keyed by string name).
var _wrongness_nodes: Dictionary = {}


func _process(delta: float) -> void:
	if shift_number >= 2:
		_shift_elapsed += delta
		_check_wrongness_events()


## Advance to the next shift. Applies degradation and resets timers.
func advance_shift() -> void:
	shift_number += 1
	_shift_elapsed = 0.0
	_wrongness_triggered.clear()
	_apply_degradation()
	shift_changed.emit(shift_number)


## Set the shift directly (used by save/load).
func set_shift(num: int) -> void:
	shift_number = num
	_shift_elapsed = 0.0
	_wrongness_triggered.clear()
	if num >= 2:
		_apply_degradation()
	shift_changed.emit(num)


## Register a degradation target node by key.
func register_degradation_node(key: String, node: Node) -> void:
	_degradation_nodes[key] = node


## Register a wrongness event target node by key.
func register_wrongness_node(key: String, node: Node) -> void:
	_wrongness_nodes[key] = node


## Apply Shift 1→2 visual degradation to registered nodes.
func _apply_degradation() -> void:
	# Coffee mug rotated 90°
	if _degradation_nodes.has("coffee_mug"):
		var mug: Node3D = _degradation_nodes["coffee_mug"]
		mug.rotation.y = deg_to_rad(90.0)

	# Chair angled 15°
	if _degradation_nodes.has("chair"):
		var chair: Node3D = _degradation_nodes["chair"]
		chair.rotation.y = deg_to_rad(15.0)

	# Second mug appears in back office (was hidden during Shift 1)
	if _degradation_nodes.has("second_mug"):
		var second_mug: Node3D = _degradation_nodes["second_mug"]
		second_mug.visible = true

	# CRT 1-frame glitch
	if _degradation_nodes.has("crt"):
		var crt: Node = _degradation_nodes["crt"]
		if crt.has_method("trigger_glitch_burst"):
			crt.trigger_glitch_burst(0.8, 0.1)


## Check for timed wrongness events during Shift 2+.
func _check_wrongness_events() -> void:
	# E1: Hallway light flickers 3x at 02:15
	if not _wrongness_triggered.has("E1") and _shift_elapsed >= E1_TRIGGER_TIME:
		_wrongness_triggered["E1"] = true
		_trigger_e1()

	# E2: Back office door handle jiggles + breathing sound at 03:00
	if not _wrongness_triggered.has("E2") and _shift_elapsed >= E2_TRIGGER_TIME:
		_wrongness_triggered["E2"] = true
		_trigger_e2()


## E1: Hallway light flickers 3 times.
func _trigger_e1() -> void:
	var light: OmniLight3D = _wrongness_nodes.get("hallway_light")
	if light == null:
		return
	var tween: Tween = create_tween()
	for _i in range(3):
		tween.tween_property(light, "light_energy", 0.0, 0.1)
		tween.tween_property(light, "light_energy", 1.0, 0.15)
		tween.tween_interval(0.3)


## E2: Back office door handle jiggles + breathing sound.
func _trigger_e2() -> void:
	var door: Node3D = _wrongness_nodes.get("office_door")
	if door != null:
		var tween: Tween = create_tween()
		for _i in range(4):
			tween.tween_property(door, "rotation:y", deg_to_rad(5.0), 0.08)
			tween.tween_property(door, "rotation:y", 0.0, 0.08)
	# Breathing sound would play via AudioBusManager if an audio stream is available.
