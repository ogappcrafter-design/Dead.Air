@tool
class_name CameraZone
extends Area3D

## DEA-108: Trigger volume that switches the active camera angle
## when the player enters it. Place one CameraZone per room/area.
##
## Per acceptance criteria:
## - Camera shifts when player crosses trigger planes
## - Camera angles predefined per room (not player-controlled)

## The camera angle to use when the player is inside this zone.
@export var camera_angle: CameraAngle

## Optional: a second angle for "semi-fixed" alternate views.
## If set, CameraRig will blend between angle and alternate_angle
## based on player position within the zone.
@export var alternate_angle: CameraAngle

## If true, crossing into this zone triggers a static transition cut.
## Per acceptance criteria: 0.5-1.0 sec cut with brief static effect.
@export var use_transition: bool = true

## Priority for overlapping zones (higher wins).
@export_range(0, 10, 1) var zone_priority: int = 0

## Signal fired when player enters this zone.
signal zone_entered(zone: CameraZone)

## Signal fired when player exits this zone.
signal zone_exited(zone: CameraZone)

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
