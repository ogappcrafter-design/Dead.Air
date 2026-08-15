@tool
class_name CameraZone
extends Area3D

## DEA-108 / DEA-144: Trigger volume that switches the active camera angle
## when the player enters it. Place one CameraZone per room/area.
##
## Per DEA-144 acceptance criteria:
## - Trigger zones map to specific camera position index for that room
## - Camera angles predefined per room (not player-controlled)
## - Zones reference rig + camera index (new workflow)
##   OR single camera_angle (legacy workflow — backward compatible)

## Signal fired when player enters this zone.
signal zone_entered(zone: CameraZone)

## Signal fired when player exits this zone.
signal zone_exited(zone: CameraZone)

## The CameraRig this zone belongs to (new DEA-144 workflow).
## If set, camera_index is used to select from the rig's angles array.
@export var camera_rig: CameraRig

## Index into the rig's angles array (0-2 for 1-3 angles per room).
## Only used when camera_rig is set.
@export_range(0, 2, 1) var camera_index: int = 0

## The camera angle to use when the player is inside this zone (legacy workflow).
## Used when camera_rig is not set. Backward compatible with DEA-108.
@export var camera_angle: CameraAngle

## Optional: a second angle for "semi-fixed" alternate views.
## If set, CameraRig will blend between angle and alternate_angle
## based on player position within the zone.
@export var alternate_angle: CameraAngle

## If true, crossing into this zone triggers a static transition cut.
## Per DEA-144: 0.3–0.5 sec cut with brief static effect (0.4s default).
@export var use_transition: bool = true

## Priority for overlapping zones (higher wins).
@export_range(0, 10, 1) var zone_priority: int = 0

var _is_active: bool = false


func _ready() -> void:
	# Ensure monitoring is on
	monitoring = true
	# Only detect bodies (player), not other areas
	match collision_mask:
		0:
			# Default to layer 1 if not set
			collision_mask = 1
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)


func _on_body_entered(body: Node3D) -> void:
	if not _is_player(body):
		return
	_is_active = true
	zone_entered.emit(self)


func _on_body_exited(body: Node3D) -> void:
	if not _is_player(body):
		return
	_is_active = false
	zone_exited.emit(self)


func _is_player(body: Node3D) -> bool:
	# Check by group membership (player should be in "player" group)
	return body.is_in_group("player")


func is_active() -> bool:
	return _is_active
