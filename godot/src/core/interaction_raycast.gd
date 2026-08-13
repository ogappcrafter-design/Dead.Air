class_name InteractionRaycast
extends RayCast3D
## RayCast3D that detects Interactable nodes in front of the player.
## Emits signals when the looked-at target changes and when interactions occur.
## Child of the Player node. Must be positioned at eye level in the scene.

signal target_changed(target: Interactable)
signal interact_performed(target: Interactable)
signal examine_performed(target: Interactable, text: String)

@export var interaction_range: float = 2.0
@export var examine_action: String = "examine"

var current_target: Interactable
var player: Node


func _ready() -> void:
	target_position = Vector3(0, 0, -interaction_range)
	collide_with_areas = true
	collide_with_bodies = false
	clear_exceptions()

	# Walk up to find the CharacterBody3D parent (the Player)
	var parent: Node = get_parent()
	while parent and not parent is CharacterBody3D:
		parent = parent.get_parent()
	player = parent

	# Connect interact via InputManager (mode-aware, active in EXPLORE)
	if InputManager != null:
		InputManager.action_triggered.connect(_on_action_triggered)


func _on_action_triggered(action: String, type: int) -> void:
	if action == "interact" and type == ControlEnums.ActionType.PRESS:
		_try_interact()


func _physics_process(_delta: float) -> void:
	# Only process in EXPLORE mode
	if PhaseManager == null or PhaseManager.get_mode() != PhaseEnums.ModeContext.EXPLORE:
		if current_target != null:
			current_target = null
			target_changed.emit(null)
		return

	force_raycast_update()
	_update_target()

	# Poll examine directly (not in InputManager's action list)
	if Input.is_action_just_pressed(examine_action) and current_target != null:
		_try_examine()


func _update_target() -> void:
	var new_target: Interactable = null
	if is_colliding():
		var collider: Object = get_collider()
		if collider is Interactable:
			new_target = collider as Interactable

	if new_target != current_target:
		current_target = new_target
		target_changed.emit(current_target)


func _try_interact() -> void:
	if current_target != null and current_target.can_interact():
		current_target.interact(player)
		interact_performed.emit(current_target)


func _try_examine() -> void:
	if current_target != null:
		var text: String = current_target.get_examine_text()
		current_target.examine(player)
		examine_performed.emit(current_target, text)


func get_current_target() -> Interactable:
	return current_target
