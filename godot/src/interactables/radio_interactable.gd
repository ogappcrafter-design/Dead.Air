## radio_interactable.gd — Interactable radio set for tuning/broadcast.
class_name RadioInteractable extends Interactable

@export var station_name: String = "Unknown Station"
@export var is_powered: bool = false
@export var current_frequency: float = 98.7
@export var interaction_count: int = 0


func can_interact() -> bool:
	return true


func interact(interactor: Node) -> void:
	interaction_count += 1
	is_powered = !is_powered
	emit_signal("interacted", interactor)


func get_prompt_text() -> String:
	if is_powered:
		return "Turn off radio"
	return "Turn on radio"


func get_examine_text() -> String:
	var status: String = "silent" if not is_powered else "humming at %.1f FM" % current_frequency
	return (
		'A bulky analog radio set.\nIt\'s currently %s.\nThe dial reads "%s".'
		% [status, station_name]
	)
