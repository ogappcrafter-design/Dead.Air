## visual_driver_examine.gd — Captures screenshots of examine close-ups for DEA-193.
## Writes screenshots to user://screenshot/ and res://screenshot/:
## - dea193_tape_closeup.png (3D cassette tape with label, reels, and CRT description)
## - dea193_note_closeup.png (2D textured note paper with handwritten log entry)
extends SceneTree

const ExamineDisplayScene := preload("res://src/ui/examine_display.gd")
const CassetteTapeScene := preload("res://src/interactables/cassette_tape.gd")
const NoteInteractableScene := preload("res://src/interactables/note_interactable.gd")


func _init() -> void:
	_run_captures.call_deferred()


func _run_captures() -> void:
	# Ensure screenshot directories exist
	DirAccess.make_dir_recursive_absolute("user://screenshot")
	DirAccess.make_dir_recursive_absolute("res://screenshot")

	var examine: ExamineDisplay = ExamineDisplayScene.new()
	root.add_child(examine)

	# 1. Capture Cassette Tape Close-up
	var tape := CassetteTapeScene.new()
	tape.tape_id = "tape_001"
	tape.tape_label = "THE COLLECTOR'S TAPE — SHIFT 2"
	examine.show_examine(tape, "A heavy Maxell cassette. Side A has hand-written numbers inked in red.")
	examine._char_accum = examine._full_text.length()
	examine._label.text = examine._full_text
	examine.modulate.a = 1.0

	# Advance 3 frames for viewport rendering
	for i in 3:
		await process_frame

	_snap("dea193_tape_closeup")

	# 2. Capture Note Close-up
	var note := NoteInteractableScene.new()
	note.note_title = "STATION LOG — 03:14 AM"
	note.note_content = "To whoever takes over the night shift:\n\nDo not answer the telephone after 03:30 AM.\nThe caller id will say 'HAROLD', but Harold went into the pine woods last Tuesday and has not returned.\n\nKeep the radio tuned to 88.5 FM. The static is normal."
	examine.show_examine(note)
	examine._char_accum = examine._full_text.length()
	examine._label.text = examine._full_text
	examine.modulate.a = 1.0

	for i in 3:
		await process_frame

	_snap("dea193_note_closeup")

	print("[VisualDriver] Close-up screenshots captured successfully.")
	quit(0)


func _snap(filename: String) -> void:
	var img := root.get_texture().get_image()
	if img != null:
		var user_path := "user://screenshot/" + filename + ".png"
		var res_path := "res://screenshot/" + filename + ".png"
		img.save_png(user_path)
		img.save_png(res_path)
		print("[VisualDriver] Saved: ", user_path, " and ", res_path)
