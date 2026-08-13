## cassette_tape.gd — Interactable cassette tape pickup.
class_name CassetteTape extends Interactable

@export var tape_id: String = ""
@export var tape_label: String = "Unlabeled Tape"
@export var pickup_message: String = "Picked up tape"


func can_interact() -> bool:
	return true


func interact(interactor: Node) -> void:
	emit_signal("interacted", interactor)
	# Hide self on pickup — tape goes into inventory
	visible = false
	if has_node("CollisionShape3D"):
		$CollisionShape3D.set_deferred("disabled", true)


func get_prompt_text() -> String:
	return "Pick up %s" % tape_label


func get_examine_text() -> String:
	if tape_label.is_empty():
		return "A worn cassette tape. The label has peeled off.\nYou can barely make out the markings."
	return 'A cassette tape labeled "%s".\nThe tape inside looks intact.' % tape_label
