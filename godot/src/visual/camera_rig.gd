class_name CameraRig
extends Camera3D

## DEA-108: The actual camera that renders the scene.
## Holds a reference to the current CameraAngle and applies semi-fixed
## tracking behavior — subtle pan/zoom within the angle's max range.
##
## Per acceptance criteria:
## - Semi-fixed: subtle pan/zoom within range (max 15°)
## - Right Stick/Mouse: unused (no free look)
## - Player movement relative to screen, not camera

## Current target angle (set by CameraManager).
var current_angle: CameraAngle = null

## Previous angle (for blending during transitions).
var previous_angle: CameraAngle = null

## Transition timer (seconds). 0 = not transitioning.
var _transition_time: float = 0.0
var _transition_duration: float = 0.75

## Target player node for tracking.
var _target: Node3D = null

## Base transform (the "fixed" part of semi-fixed).
var _base_transform: Transform3D = Transform3D.IDENTITY

## Current pan/tilt offset in degrees.
var _pan_offset: float = 0.0
var _tilt_offset: float = 0.0

func _ready() -> void:
	# Make this the current camera
	current = true

func set_target(target: Node3D) -> void:
	_target = target

func transition_to(angle: CameraAngle, duration: float = 0.75) -> void:
	if angle == null:
		return
	previous_angle = current_angle
	current_angle = angle
	_transition_duration = duration
	_transition_time = duration
	# Snap base transform to the angle's configured position/rotation
	_base_transform = Transform3D(
		Basis.from_euler(angle.rotation_degrees * deg_to_rad(1.0)),
		angle.position
	)
	# Set FOV
	fov = angle.fov
	# Apply DOF if enabled
	if angle.use_dof:
		attributes.dof_blur_far_enabled = true
		attributes.dof_blur_far_distance = angle.dof_focus_distance
		attributes.dof_blur_far_amount = angle.dof_focus_length
	else:
		attributes.dof_blur_far_enabled = false

func _process(delta: float) -> void:
	if current_angle == null:
		return

	# Handle transition (snap to new angle — the static effect is handled by StaticTransition)
	if _transition_time > 0.0:
		_transition_time -= delta
		# During transition, blend from previous to current
		var t: float = 1.0 - (_transition_time / _transition_duration)
		t = clamp(t, 0.0, 1.0)
		# Smooth ease-in-out
		t = t * t * (3.0 - 2.0 * t)
		if previous_angle != null:
			var prev_xform: Transform3D = Transform3D(
				Basis.from_euler(previous_angle.rotation_degrees * deg_to_rad(1.0)),
				previous_angle.position
			)
			global_transform = prev_xform.interpolate_with(_base_transform, t)
		else:
			global_transform = _base_transform
		return

	# Semi-fixed tracking: subtle pan/tilt based on player position
	if _target != null and current_angle.tracking_strength > 0.0:
		_semi_fixed_tracking(delta)
	else:
		# Fully fixed — just maintain base transform
		global_transform = _base_transform

func _semi_fixed_tracking(delta: float) -> void:
	# Get direction from camera to player in the camera's local space
	var to_player: Vector3 = _target.global_position - _base_transform.origin
	var local_dir: Vector3 = _base_transform.basis.inverse() * to_player

	# Normalize to screen-space-ish offsets
	# X = left/right (pan), Y = up/down (tilt), Z = forward
	var pan_factor: float = 0.0
	var tilt_factor: float = 0.0

	# Use the horizontal angle to the player for pan
	if abs(local_dir.x) > 0.01:
		pan_factor = clamp(local_dir.x / 10.0, -1.0, 1.0)

	# Use vertical angle for tilt
	if abs(local_dir.y) > 0.01:
		tilt_factor = clamp(local_dir.y / 10.0, -1.0, 1.0)

	# Apply tracking strength and max range
	var target_pan: float = pan_factor * current_angle.max_pan_degrees * current_angle.tracking_strength
	var target_tilt: float = tilt_factor * current_angle.max_tilt_degrees * current_angle.tracking_strength

	# Lerp toward target for smooth motion
	var lerp_speed: float = current_angle.tracking_lerp_speed * delta
	_pan_offset = lerp(_pan_offset, target_pan, lerp_speed)
	_tilt_offset = lerp(_tilt_offset, target_tilt, lerp_speed)

	# Build the semi-fixed transform: base + pan/tilt offset
	var offset_basis: Basis = Basis.from_euler(
		Vector3(
			_tilt_offset * deg_to_rad(1.0),
			_pan_offset * deg_to_rad(1.0),
			0.0
		)
	)
	global_transform = Transform3D(
		_base_transform.basis * offset_basis,
		_base_transform.origin
	)

func is_transitioning() -> bool:
	return _transition_time > 0.0
