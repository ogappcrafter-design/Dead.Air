## note_interactable.gd — Readable note/journal entry.
class_name NoteInteractable extends Interactable

@export var note_title: String = "Untitled Note"
@export_multiline var note_content: String = "The ink has faded beyond readability."
@export var is_read: bool = false


func can_interact() -> bool:
	return true


func interact(interactor: Node) -> void:
	is_read = true
	emit_signal("interacted", interactor)


func get_prompt_text() -> String:
	return "Read note"


func get_examine_text() -> String:
	return "%s\n\n%s" % [note_title, note_content]
