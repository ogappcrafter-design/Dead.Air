## door_interactable.gd — Door that opens/closes on interaction.
class_name DoorInteractable extends Interactable

signal door_state_changed(new_state: bool)

@export var is_open: bool = false
@export var is_locked: bool = false
@export var locked_message: String = "The door is locked."
@export var door_name: String = "Door"


func can_interact() -> bool:
	return not is_locked


func interact(interactor: Node) -> void:
	if is_locked:
		emit_signal("interacted", interactor)
		return
	is_open = !is_open
	emit_signal("door_state_changed", is_open)
	emit_signal("interacted", interactor)


func get_prompt_text() -> String:
	if is_locked:
		return locked_message
	if is_open:
		return "Close %s" % door_name.to_lower()
	return "Open %s" % door_name.to_lower()


func get_examine_text() -> String:
	var state: String = "locked" if is_locked else ("open" if is_open else "closed")
	return "A %s.\nIt's currently %s." % [door_name.to_lower(), state]
