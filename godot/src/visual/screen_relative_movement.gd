class_name ScreenRelativeMovement
extends Node

## DEA-108: Converts player input to screen-relative movement.
## Per acceptance criteria: "Player movement relative to screen, not camera"
##
## In RE-style fixed cameras, pushing up on the stick moves the character
## "up" on the screen (away from camera in screen space), not "forward"
## relative to the camera's 3D forward vector.
##
## This component is added as a child of a CharacterBody3D (the player).
## It reads InputManager movement and applies velocity based on the
## active camera's screen-space orientation.

## Movement speed in meters/second.
@export var move_speed: float = 3.0

## Acceleration/deceleration smoothing.
@export_range(1.0, 20.0, 0.5) var acceleration: float = 10.0

## The player body this component drives.
var _body: CharacterBody3D

## Reference to the active camera (set by CameraManager or fetched each frame).
var _camera: Camera3D

func _ready() -> void:
	_body = get_parent() as CharacterBody3D

func set_camera(cam: Camera3D) -> void:
	_camera = cam

func _physics_process(delta: float) -> void:
	if _body == null or _camera == null:
		return

	# Get raw input from InputManager if available, otherwise direct Input.
	# InputManager is an autoload but may not be loaded during scene compilation
	# in all Godot versions, so we use runtime singleton lookup.
	var input_vec: Vector2 = Vector2.ZERO
	if Engine.has_singleton("InputManager"):
		var im: Object = Engine.get_singleton("InputManager")
		if im != null and im.has_method("get_movement"):
			input_vec = im.get_movement()
		else:
			input_vec = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	else:
		# Fallback: direct input (action names per project.godot input map)
		input_vec = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	if input_vec.length() < 0.01:
		# Decelerate to zero
		_body.velocity = _body.velocity.lerp(Vector3.ZERO, acceleration * delta)
		_body.move_and_slide()
		return

	# Get camera's right and forward vectors in the XZ plane
	var cam_right: Vector3 = _camera.global_transform.basis.x
	var cam_forward: Vector3 = -_camera.global_transform.basis.z

	# Project onto XZ plane (no vertical movement from input)
	cam_right.y = 0.0
	cam_forward.y = 0.0
	cam_right = cam_right.normalized()
	cam_forward = cam_forward.normalized()

	# Screen-relative: input Y (up/down on stick) maps to camera forward,
	# input X (left/right) maps to camera right.
	var move_dir: Vector3 = (cam_forward * input_vec.y) + (cam_right * input_vec.x)
	move_dir = move_dir.normalized()

	# Apply velocity with smoothing
	var target_velocity: Vector3 = move_dir * move_speed
	_body.velocity = _body.velocity.lerp(target_velocity, acceleration * delta)

	# Apply gravity
	if not _body.is_on_floor():
		_body.velocity.y -= 9.8 * delta

	_body.move_and_slide()

	# Rotate player to face movement direction
	if move_dir.length() > 0.01:
		var look_pos: Vector3 = _body.global_position + move_dir
		_body.look_at(look_pos, Vector3.UP)
