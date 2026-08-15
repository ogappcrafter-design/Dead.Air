extends Node

## DEA-108 / DEA-144: Cross-scene camera coordinator.
## Registered as an autoload. Manages the active CameraRig instance,
## handles zone transitions, and fires the static transition effect.
##
## DEA-144 additions:
## - Supports rig+index workflow: zones can reference a CameraRig + index
## - Transition duration 0.3–0.5s (0.4 default)
## - Backward compatible with DEA-108 single-angle zones

## Emitted when a zone transition starts. Args: new_angle_id, old_angle_id
signal camera_transition_started(new_id: String, old_id: String)

## Emitted when a zone transition completes.
signal camera_transition_completed(angle_id: String)

## Transition duration in seconds (0.3–0.5 per DEA-144 spec).
const TRANSITION_DURATION: float = 0.4

## The active CameraRig (created or assigned at runtime).
var _rig: CameraRig = null

## Currently active zone.
var _active_zone: CameraZone = null

## Static transition effect layer.
var _static_effect: StaticTransition = null

## Player reference for tracking — propagated to rigs on switch.
var _player: Node3D = null


func _ready() -> void:
	# Create the static transition CanvasLayer
	_static_effect = StaticTransition.new()
	_static_effect.name = "StaticTransition"
	add_child(_static_effect)


func set_rig(rig: CameraRig) -> void:
	_rig = rig
	_rig.make_current()
	if _player != null:
		_rig.set_target(_player)


func set_player(player: Node3D) -> void:
	_player = player
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
	if _active_zone != null:
		old_id = _get_zone_angle_id(_active_zone)

	# DEA-144: rig+index workflow (preferred) or legacy camera_angle fallback
	var use_rig := zone.camera_rig != null
	var new_id: String = ""

	if use_rig:
		if zone.camera_index < 0 or zone.camera_index >= zone.camera_rig.angles.size():
			push_warning(
				(
					"CameraZone %s: camera_index %d out of range (rig has %d angles)"
					% [zone.name, zone.camera_index, zone.camera_rig.angles.size()]
				)
			)
			return
		# Switch to the zone's rig if different from current
		if _rig != zone.camera_rig:
			_rig = zone.camera_rig
			_rig.make_current()
			if _player != null:
				_rig.set_target(_player)
		new_id = zone.camera_rig.get_angle_id(zone.camera_index)
	elif zone.camera_angle != null:
		new_id = zone.camera_angle.angle_id
	else:
		push_warning("CameraZone %s has no camera_rig or camera_angle assigned" % zone.name)
		return

	_active_zone = zone

	# Start transition
	if zone.use_transition and _static_effect != null:
		_static_effect.play(TRANSITION_DURATION)

	if _rig != null:
		if use_rig:
			_rig.transition_to_index(zone.camera_index, TRANSITION_DURATION)
		else:
			_rig.transition_to(zone.camera_angle, TRANSITION_DURATION)

	camera_transition_started.emit(new_id, old_id)

	# Schedule completion signal
	var timer: SceneTreeTimer = get_tree().create_timer(TRANSITION_DURATION)
	timer.timeout.connect(func(): camera_transition_completed.emit(new_id))


func _on_zone_exited(_zone: CameraZone) -> void:
	# Don't immediately switch — only switch when entering another zone.
	# This matches RE-style: you're always in SOME camera angle.
	pass


func _get_zone_angle_id(zone: CameraZone) -> String:
	if (
		zone.camera_rig != null
		and zone.camera_index >= 0
		and zone.camera_index < zone.camera_rig.angles.size()
	):
		return zone.camera_rig.get_angle_id(zone.camera_index)
	if zone.camera_angle != null:
		return zone.camera_angle.angle_id
	return ""


func _get_active_priority() -> int:
	if _active_zone == null:
		return -1
	return _active_zone.zone_priority


func get_active_angle_id() -> String:
	if _active_zone != null:
		return _get_zone_angle_id(_active_zone)
	return ""
