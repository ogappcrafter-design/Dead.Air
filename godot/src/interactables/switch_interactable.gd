## switch_interactable.gd — Toggle switch (light, power, valve).
class_name SwitchInteractable extends Interactable

signal switch_toggled(new_state: bool)

@export var is_on: bool = false
@export var switch_name: String = "Switch"
@export var on_label: String = "On"
@export var off_label: String = "Off"


func can_interact() -> bool:
	return true


func interact(interactor: Node) -> void:
	is_on = !is_on
	emit_signal("switch_toggled", is_on)
	emit_signal("interacted", interactor)


func get_prompt_text() -> String:
	var action: String = "Turn off" if is_on else "Turn on"
	return "%s %s" % [action, switch_name.to_lower()]


func get_examine_text() -> String:
	var state: String = on_label if is_on else off_label
	return "A %s.\nCurrent state: %s." % [switch_name.to_lower(), state]
