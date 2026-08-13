class_name Interactable
extends Area3D
## Base class for all interactable objects in the game.
## Override virtual methods in subclasses to define behavior.
## Subclasses must add a CollisionShape3D child for raycast detection.

signal interacted(interactor: Node)
signal examine_requested(interactor: Node)


func _ready() -> void:
	add_to_group("interactable")


## Whether this interactable can currently be interacted with.
func can_interact() -> bool:
	return true


## Called when the player interacts with this object. Override in subclasses.
func interact(interactor: Node) -> void:
	interacted.emit(interactor)


## Called when the player examines this object. Override in subclasses.
func examine(interactor: Node) -> void:
	examine_requested.emit(interactor)


## Returns the prompt text shown when the player looks at this object.
func get_prompt_text() -> String:
	return "Interact"


## Returns the examine text shown when the player examines this object.
func get_examine_text() -> String:
	return ""
