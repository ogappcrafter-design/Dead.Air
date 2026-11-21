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
##
## DEA-188: sprinting raises speed from move_speed to sprint_speed while
## stamina remains, drains stamina, regenerates it when not sprinting, and
## turns each footstep into a noise the Suits can hear (hear_noise) plus a
## small dread bump through DreadComposure.add_dread().

## ─── Stamina / sprint constants (DEA-188) ───────────────────────────────

## Full stamina pool.
const STAMINA_MAX: float = 100.0

## Drain rate: 100 -> 0 in 6 seconds of sprinting.
const STAMINA_DRAIN_PER_SEC: float = STAMINA_MAX / 6.0

## Regen rate: empty -> full in 4 seconds.
const STAMINA_REGEN_PER_SEC: float = STAMINA_MAX / 4.0

## After stamina hits 0, sprint stays locked until it recovers this far.
## Without the latch a single frame of regen would re-enable sprint at 0.
const SPRINT_REARM_STAMINA: float = 20.0

## Seconds between sprint footstep noise pulses.
const SPRINT_NOISE_INTERVAL: float = 0.4

## Radius (metres) of each sprint footstep noise.
const SPRINT_NOISE_RADIUS: float = 8.0

## Dread added per sprint footstep noise pulse.
const SPRINT_DREAD_PER_STEP: float = 0.5

## Emitted whenever stamina changes (0-100). HUD hook.
signal stamina_changed(stamina: float)

## Emitted on each sprint footstep noise pulse.
signal sprint_noise(position: Vector3, radius: float)

## ─── Exported tuning ────────────────────────────────────────────────────

## Movement speed in meters/second.
@export var move_speed: float = 3.0

## Sprint speed in meters/second (DEA-188).
@export var sprint_speed: float = 4.0

## Maximum stamina pool (DEA-188).
@export var stamina_max: float = STAMINA_MAX

## Radius of a sprint footstep noise in metres (DEA-188).
@export var sprint_noise_radius: float = SPRINT_NOISE_RADIUS

## Acceleration/deceleration smoothing.
@export_range(1.0, 20.0, 0.5) var acceleration: float = 10.0

## Current stamina (0-100).
var stamina: float = STAMINA_MAX

## The player body this component drives.
var _body: CharacterBody3D

## Reference to the active camera (set by CameraManager or fetched each frame).
var _camera: Camera3D

var _sprinting: bool = false
var _exhausted: bool = false
var _noise_timer: float = 0.0
var _dread_composure: DreadComposure = null

func _ready() -> void:
	_body = get_parent() as CharacterBody3D

func set_camera(cam: Camera3D) -> void:
	_camera = cam

## Override the DreadComposure source (tests / manual wiring). When unset the
## component resolves CallManager's live instance on first use.
func set_dread_composure(dc: DreadComposure) -> void:
	_dread_composure = dc

func _physics_process(delta: float) -> void:
	var input_vec: Vector2 = _read_movement()
	var wants_move: bool = input_vec.length() >= 0.01

	_update_stamina(delta, wants_move)

	if _body == null or _camera == null:
		return

	if not wants_move:
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
	var speed: float = sprint_speed if _sprinting else move_speed
	var target_velocity: Vector3 = move_dir * speed
	_body.velocity = _body.velocity.lerp(target_velocity, acceleration * delta)

	# Apply gravity
	if not _body.is_on_floor():
		_body.velocity.y -= 9.8 * delta

	_body.move_and_slide()

	# Rotate player to face movement direction
	if move_dir.length() > 0.01:
		var look_pos: Vector3 = _body.global_position + move_dir
		_body.look_at(look_pos, Vector3.UP)


## Read the movement vector. InputManager is an autoload (not an Engine
## singleton), so it is looked up by path; the direct-Input fallback keeps
## the component usable in bare scenes and tests.
func _read_movement() -> Vector2:
	var im: Node = get_node_or_null("/root/InputManager")
	if im != null and im.has_method("get_movement"):
		return im.get_movement()
	return Input.get_vector("move_left", "move_right", "move_up", "move_down")


## Sprint is held while the action is down. Routes through InputManager's
## is_action_held (which falls back to Input for non-hold actions) so the
## input layer stays the single owner of action state.
func _is_sprint_held() -> bool:
	var im: Node = get_node_or_null("/root/InputManager")
	if im != null and im.has_method("is_action_held"):
		return im.is_action_held("sprint")
	return Input.is_action_pressed("sprint")


## DEA-188: stamina drain / regen and sprint footstep noise.
func _update_stamina(delta: float, wants_move: bool) -> void:
	var before: float = stamina
	var wants_sprint: bool = (
		wants_move and not _exhausted and stamina > 0.0 and _is_sprint_held()
	)

	if wants_sprint:
		stamina = maxf(0.0, stamina - STAMINA_DRAIN_PER_SEC * delta)
		_sprinting = stamina > 0.0
		if not _sprinting:
			_exhausted = true
			_noise_timer = 0.0
		else:
			_noise_timer += delta
			while _noise_timer >= SPRINT_NOISE_INTERVAL:
				_noise_timer -= SPRINT_NOISE_INTERVAL
				_emit_sprint_noise()
	else:
		_sprinting = false
		_noise_timer = 0.0
		if stamina < stamina_max:
			stamina = minf(stamina_max, stamina + STAMINA_REGEN_PER_SEC * delta)
		if _exhausted and stamina >= SPRINT_REARM_STAMINA:
			_exhausted = false

	if not is_equal_approx(stamina, before):
		stamina_changed.emit(stamina)


## Broadcast one sprint footstep: every active Suit within the noise radius
## investigates, and the noise itself raises dread.
func _emit_sprint_noise() -> void:
	if _body == null:
		return
	var origin: Vector3 = _body.global_position
	sprint_noise.emit(origin, sprint_noise_radius)
	if get_tree() != null:
		for node in get_tree().get_nodes_in_group("suit"):
			if not node.has_method("hear_noise"):
				continue
			if node.has_method("is_active") and not node.is_active():
				continue
			node.hear_noise(origin, sprint_noise_radius)
	_add_dread(SPRINT_DREAD_PER_STEP)


func _add_dread(amount: float) -> void:
	var dc: DreadComposure = _get_dread_composure()
	if dc != null:
		dc.add_dread(amount)


func _get_dread_composure() -> DreadComposure:
	if _dread_composure != null:
		return _dread_composure
	var cm: Node = get_node_or_null("/root/CallManager")
	if cm != null and cm.has_method("get_dread_composure"):
		_dread_composure = cm.get_dread_composure()
	return _dread_composure


## ─── Public API (HUD / tests) ───────────────────────────────────────────


func is_sprinting() -> bool:
	return _sprinting


func is_exhausted() -> bool:
	return _exhausted


func get_stamina() -> float:
	return stamina


## Set stamina directly (save/load, pickups, tests).
func set_stamina(value: float) -> void:
	stamina = clampf(value, 0.0, stamina_max)
	if stamina <= 0.0:
		_exhausted = true
	elif stamina >= SPRINT_REARM_STAMINA:
		_exhausted = false
	stamina_changed.emit(stamina)
