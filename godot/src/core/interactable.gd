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


## DEA-193: Returns the examine mode for the close-up system: "prop", "tape", "note", "photo", "text".
## Defaults to text-only: doors, switches, and radios have no close-up mesh and
## should not fall back to the placeholder prop cube.
func get_examine_mode() -> String:
	return "text"


## DEA-193: Returns the title for the examine close-up view.
func get_examine_title() -> String:
	return get_prompt_text()


## DEA-193: Returns the detailed content text for the examine close-up view.
func get_examine_content() -> String:
	return get_examine_text()
