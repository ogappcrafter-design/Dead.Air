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

## Every zone registered for the scene currently loaded.
var _zones: Array[CameraZone] = []

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

## Drop the active zone and the registered zone list. Called when a new scene
## takes over the camera so a freed zone from the previous scene cannot win the
## priority check.
func reset() -> void:
	_active_zone = null
	_zones.clear()

func get_active_zone() -> CameraZone:
	return _active_zone

## Drop zones whose nodes were freed by a scene unload. A stale entry would let
## `activate_zone` touch a freed instance and keep a dead box eligible to win.
func _prune() -> void:
	var live: Array[CameraZone] = []
	for zone in _zones:
		if is_instance_valid(zone):
			live.append(zone)
	if live.size() != _zones.size():
		_zones = live

## Live registered zones, pruned first so a caller never sees a freed node.
func zones() -> Array[CameraZone]:
	_prune()
	return _zones


func register_zone(zone: CameraZone) -> void:
	# Connect zone signals
	if not zone.zone_entered.is_connected(_on_zone_entered):
		zone.zone_entered.connect(_on_zone_entered)
	if not zone.zone_exited.is_connected(_on_zone_exited):
		zone.zone_exited.connect(_on_zone_exited)
	if not _zones.has(zone):
		_zones.append(zone)

func _on_zone_entered(zone) -> void:
	if not is_instance_valid(zone):
		return
	_prune()
	activate_zone(zone)

## Enter `zone` as the active camera. `silent` skips the static cut and the
## blend — used for the angle the player spawns inside, where there is no
## transition to perform.
func activate_zone(zone, silent: bool = false) -> void:
	if zone == null or not is_instance_valid(zone):
		return
	_prune()
	if zone == _active_zone and is_instance_valid(zone):
		# Already the active angle; a second trigger must not re-cut.
		return
	if zone.zone_priority < _get_active_priority() and _active_zone_holds_player():
		# Lower priority — ignore. Only a zone the player is still standing in
		# may outrank the newcomer: a teleport or a lost exit signal otherwise
		# pins the camera to a box the player left long ago and the whole
		# scene's lower-priority angles become unreachable.
		return

	var old_id: String = ""
	if _active_zone != null and is_instance_valid(_active_zone) and _active_zone.camera_angle != null:
		old_id = _active_zone.camera_angle.angle_id

	_active_zone = zone

	if zone.camera_angle == null:
		push_warning("CameraZone %s has no camera_angle assigned" % zone.name)
		return

	var duration: float = 0.0 if silent else TRANSITION_DURATION

	# Start transition
	if not silent and zone.use_transition and _static_effect != null:
		_static_effect.play(duration)

	if _rig != null:
		_rig.transition_to(zone.camera_angle, duration)

	camera_transition_started.emit(zone.camera_angle.angle_id, old_id)

	if not silent:
		# Schedule completion signal. Capture the id, not the zone: the scene can
		# be freed (scene change, test cleanup) before the timer fires.
		var finished_id: String = zone.camera_angle.angle_id
		var timer: SceneTreeTimer = get_tree().create_timer(duration)
		timer.timeout.connect(func(): camera_transition_completed.emit(finished_id))

func _on_zone_exited(zone) -> void:
	if not is_instance_valid(zone):
		_prune()
		return
	if zone != _active_zone:
		return
	# Leaving the shot the camera was in: fall back to the best zone that still
	# contains the player. Priority only orders overlapping zones, so a close-up
	# box cannot hold the camera after the player has walked out of it.
	_active_zone = null
	var best: CameraZone = null
	for candidate in _zones:
		if not is_instance_valid(candidate):
			continue
		if candidate.get_overlapping_bodies().is_empty():
			continue
		if best == null or candidate.zone_priority > best.zone_priority:
			best = candidate
	if best != null:
		activate_zone(best)

## True while the active zone still reports the camera's player inside it.
## A zone with no overlapping body is stale, whatever its priority.
func _active_zone_holds_player() -> bool:
	if _active_zone == null or not is_instance_valid(_active_zone):
		return false
	var bodies: Array[Node3D] = _active_zone.get_overlapping_bodies()
	if bodies.is_empty():
		return false
	if _rig != null and _rig.get_target() != null:
		return bodies.has(_rig.get_target())
	return true


func _get_active_priority() -> int:
	if _active_zone == null or not is_instance_valid(_active_zone):
		_active_zone = null
		return -1
	return _active_zone.zone_priority

func get_active_angle_id() -> String:
	if _active_zone != null and is_instance_valid(_active_zone) and _active_zone.camera_angle != null:
		return _active_zone.camera_angle.angle_id
	return ""
