@tool
class_name CameraAngle
extends Resource

## DEA-108: Defines a single fixed/semi-fixed camera angle.
## One CameraAngle per room/zone. Assigned to CameraZone nodes.
##
## Per GDD: "Fixed/semi-fixed camera (RE-style)"
## Per acceptance criteria: semi-fixed pan/zoom within max 15° range.

## World position of the camera for this angle.
@export var position: Vector3 = Vector3.ZERO

## Euler rotation in degrees (Y-up, Z-forward Godot convention).
@export var rotation_degrees: Vector3 = Vector3.ZERO

## Field of view in degrees.
@export_range(30.0, 120.0, 1.0) var fov: float = 65.0

## Maximum pan offset in degrees the camera can drift to follow the player.
## Per acceptance criteria: max 15°.
@export_range(0.0, 30.0, 0.5) var max_pan_degrees: float = 15.0

## Maximum vertical tilt offset in degrees (usually smaller than pan).
@export_range(0.0, 15.0, 0.5) var max_tilt_degrees: float = 5.0

## How strongly the camera tracks the player (0 = fully fixed, 1 = max range).
@export_range(0.0, 1.0, 0.05) var tracking_strength: float = 0.5

## How fast the camera eases toward the tracking target.
@export_range(1.0, 20.0, 0.5) var tracking_lerp_speed: float = 4.0

## Optional: near/far DOF values for depth-of-field shots (GDD mentions shallow focus).
@export_group("Depth of Field")
@export var use_dof: bool = false
@export_range(0.1, 100.0, 0.1) var dof_focus_distance: float = 5.0
@export_range(0.1, 50.0, 0.1) var dof_focus_length: float =  2.0

## Identifier for debugging / GDD cross-reference (e.g. "BT1", "C5", "N2").
@export var angle_id: String = ""
