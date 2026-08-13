## item_interactable.gd — Generic pickup item (battery, key, supply).
class_name ItemInteractable extends Interactable

@export var item_id: String = ""
@export var item_name: String = "Unknown Item"
@export var item_description: String = "An unremarkable object."
@export var quantity: int = 1
@export var is_consumable: bool = false


func can_interact() -> bool:
	return true


func interact(interactor: Node) -> void:
	emit_signal("interacted", interactor)
	# Remove from world — item goes into inventory
	visible = false
	if has_node("CollisionShape3D"):
		$CollisionShape3D.set_deferred("disabled", true)


func get_prompt_text() -> String:
	if quantity > 1:
		return "Pick up %s (%d)" % [item_name, quantity]
	return "Pick up %s" % item_name


func get_examine_text() -> String:
	return "%s\n\n%s" % [item_name, item_description]
