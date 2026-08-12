extends Node

## DEA-108: Cross-scene camera coordinator.
## Registered as an autoload. Manages the single CameraRig instance,
## handles zone transitions, and fires the static transition effect.
##
## Per acceptance criteria:
## - Camera shifts when player crosses trigger planes
## - Camera transition: 0.5-1.0 sec cut with brief static effect

## Emitted when a zone transition starts. Args: new_angle_id, old_angle_id
signal camera_transition_started(new_id: String, old_id: String)

## Emitted when a zone transition completes.
signal camera_transition_completed(angle_id: String)

## The active CameraRig (created or assigned at runtime).
var _rig: CameraRig = null

## Currently active zone.
var _active_zone: CameraZone = null

## Static transition effect layer.
var _static_effect: StaticTransition = null

## Transition duration in seconds (0.5–1.0 per spec).
const TRANSITION_DURATION: float = 0.75

func _ready() -> void:
	# Create the static transition CanvasLayer
	_static_effect = StaticTransition.new()
	_static_effect.name = "StaticTransition"
	add_child(_static_effect)

func set_rig(rig: CameraRig) -> void:
	_rig = rig

func set_player(player: Node3D) -> void:
	if _rig != null:
		_rig.set_target(player)

func register_zone(zone: CameraZone) -> void:
	# Connect zone signals
	if not zone.zone_entered.is_connected(_on_zone_entered):
		zone.zone_entered.connect(_on_zone_entered)
	if not zone.zone_exited.is_connected(_on_zone_exited):
		zone.zone_exited.connect(_on_zone_exited)

func _on_zone_entered(zone: CameraZone) -> void:
	if zone.zone_priority < _get_active_priority():
		# Lower priority — ignore
		return

	var old_id: String = ""
	if _active_zone != null and _active_zone.camera_angle != null:
		old_id = _active_zone.camera_angle.angle_id

	_active_zone = zone

	if zone.camera_angle == null:
		push_warning("CameraZone %s has no camera_angle assigned" % zone.name)
		return

	# Start transition
	if zone.use_transition and _static_effect != null:
		_static_effect.play(TRANSITION_DURATION)

	if _rig != null:
		_rig.transition_to(zone.camera_angle, TRANSITION_DURATION)

	camera_transition_started.emit(zone.camera_angle.angle_id, old_id)

	# Schedule completion signal
	var timer: SceneTreeTimer = get_tree().create_timer(TRANSITION_DURATION)
	timer.timeout.connect(func(): camera_transition_completed.emit(zone.camera_angle.angle_id))

func _on_zone_exited(zone: CameraZone) -> void:
	# Don't immediately switch — only switch when entering another zone.
	# This matches RE-style: you're always in SOME camera angle.
	pass

func _get_active_priority() -> int:
	if _active_zone == null:
		return -1
	return _active_zone.zone_priority

func get_active_angle_id() -> String:
	if _active_zone != null and _active_zone.camera_angle != null:
		return _active_zone.camera_angle.angle_id
	return ""
