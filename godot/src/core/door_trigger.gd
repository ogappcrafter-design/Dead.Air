class_name DoorTrigger
extends Area3D

## Door trigger that teleports the player to a target position when entered.
## Used for room-to-room transitions in the station.
## The camera zone system handles camera switching automatically when the
## player enters the destination room's CameraZone.

## World-space position to teleport the player to.
@export var target_position: Vector3

## Cooldown in seconds after triggering to prevent immediate re-triggering.
@export var cooldown: float = 1.0

var _cooldown_timer: float = 0.0


func _ready() -> void:
	monitoring = true
	if collision_mask == 0:
		collision_mask = 1
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if _cooldown_timer > 0.0:
		_cooldown_timer -= delta


func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if _cooldown_timer > 0.0:
		return
	_cooldown_timer = cooldown
	# Teleport on next frame to let physics update settle
	call_deferred("_teleport", body)


func _teleport(body: Node3D) -> void:
	body.global_position = target_position
