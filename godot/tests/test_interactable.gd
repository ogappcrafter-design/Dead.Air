# gdlint:ignore=max-public-methods
## test_interactable.gd — Unit tests for Interactable base class and concrete subclasses.
## Tests: base defaults, signal emission, prompt/examine text, door lock logic,
## switch toggle, note read state, radio toggle, cassette/item pickup hide behavior.
extends RefCounted

var test_name: String = "Interactable"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_base_defaults"] = test_base_defaults()
	results["test_base_interact_emits_signal"] = test_base_interact_emits_signal()
	results["test_base_examine_emits_signal"] = test_base_examine_emits_signal()
	results["test_cassette_tape_prompt"] = test_cassette_tape_prompt()
	results["test_cassette_tape_pickup_hides"] = test_cassette_tape_pickup_hides()
	results["test_radio_toggle"] = test_radio_toggle()
	results["test_radio_prompt"] = test_radio_prompt()
	results["test_note_read_state"] = test_note_read_state()
	results["test_door_locked_blocks_interact"] = test_door_locked_blocks_interact()
	results["test_door_toggle"] = test_door_toggle()
	results["test_door_prompt_locked"] = test_door_prompt_locked()
	results["test_switch_toggle"] = test_switch_toggle()
	results["test_switch_prompt"] = test_switch_prompt()
	results["test_item_pickup_hides"] = test_item_pickup_hides()
	results["test_item_quantity_prompt"] = test_item_quantity_prompt()
	return results


# --- Interactable base class ---


func test_base_defaults() -> bool:
	var inter := Interactable.new()
	var checks: Array[bool] = [
		inter.can_interact() == true,
		inter.get_prompt_text() == "Interact",
		inter.get_examine_text() == "",
	]
	inter.free()
	for check in checks:
		if not check:
			return false
	return true


func test_base_interact_emits_signal() -> bool:
	var inter := Interactable.new()
	var signal_received := false
	inter.interacted.connect(func(_interactor: Node) -> void: signal_received = true)
	inter.interact(null)
	inter.free()
	return signal_received


func test_base_examine_emits_signal() -> bool:
	var inter := Interactable.new()
	var signal_received := false
	inter.examine_requested.connect(func(_interactor: Node) -> void: signal_received = true)
	inter.examine(null)
	inter.free()
	return signal_received


# --- CassetteTape ---


func test_cassette_tape_prompt() -> bool:
	var tape := CassetteTape.new()
	tape.tape_label = "Mixtape Vol. 3"
	var prompt := tape.get_prompt_text()
	tape.free()
	return prompt == "Pick up Mixtape Vol. 3"


func test_cassette_tape_pickup_hides() -> bool:
	var tape := CassetteTape.new()
	# Simulate the interact behavior — base class interact emits signal,
	# but CassetteTape overrides to hide self and disable collision
	# Since Area3D.visible defaults to true, check after interact
	tape.interact(null)
	var checks: Array[bool] = [
		tape.visible == false,
	]
	tape.free()
	for check in checks:
		if not check:
			return false
	return true


# --- RadioInteractable ---


func test_radio_toggle() -> bool:
	var radio := RadioInteractable.new()
	radio.is_powered = false
	radio.interact(null)
	var after_first := radio.is_powered == true
	radio.interact(null)
	var after_second := radio.is_powered == false
	var count_ok := radio.interaction_count == 2
	radio.free()
	return after_first and after_second and count_ok


func test_radio_prompt() -> bool:
	var radio := RadioInteractable.new()
	var prompt := radio.get_prompt_text()
	radio.free()
	return prompt == "Turn on radio"


# --- NoteInteractable ---


func test_note_read_state() -> bool:
	var note := NoteInteractable.new()
	note.note_title = "Scrawled Note"
	note.note_content = "Something lurks in the static."
	var was_unread := note.is_read == false
	note.interact(null)
	var is_now_read := note.is_read == true
	var examine := note.get_examine_text()
	note.free()
	return (
		was_unread
		and is_now_read
		and examine.contains("Scrawled Note")
		and examine.contains("Something lurks")
	)


# --- DoorInteractable ---


func test_door_locked_blocks_interact() -> bool:
	var door := DoorInteractable.new()
	door.is_locked = true
	door.is_open = false
	var can := door.can_interact()
	door.interact(null)
	var still_closed := door.is_open == false
	door.free()
	return can == false and still_closed


func test_door_toggle() -> bool:
	var door := DoorInteractable.new()
	door.is_locked = false
	door.is_open = false
	door.interact(null)
	var after_first := door.is_open == true
	door.interact(null)
	var after_second := door.is_open == false
	door.free()
	return after_first and after_second


func test_door_prompt_locked() -> bool:
	var door := DoorInteractable.new()
	door.is_locked = true
	door.locked_message = "It won't budge."
	door.door_name = "Cellar"
	var prompt := door.get_prompt_text()
	door.free()
	return prompt == "It won't budge."


# --- SwitchInteractable ---


func test_switch_toggle() -> bool:
	var sw := SwitchInteractable.new()
	sw.is_on = false
	sw.interact(null)
	var after_first := sw.is_on == true
	sw.interact(null)
	var after_second := sw.is_on == false
	sw.free()
	return after_first and after_second


func test_switch_prompt() -> bool:
	var sw := SwitchInteractable.new()
	sw.switch_name = "Generator"
	sw.is_on = false
	var prompt := sw.get_prompt_text()
	sw.free()
	return prompt == "Turn on generator"


# --- ItemInteractable ---


func test_item_pickup_hides() -> bool:
	var item := ItemInteractable.new()
	item.item_name = "Batteries"
	item.interact(null)
	var checks: Array[bool] = [
		item.visible == false,
	]
	item.free()
	for check in checks:
		if not check:
			return false
	return true


func test_item_quantity_prompt() -> bool:
	var item := ItemInteractable.new()
	item.item_name = "Batteries"
	item.quantity = 3
	var prompt := item.get_prompt_text()
	item.free()
	return prompt.contains("Batteries") and prompt.contains("3")
