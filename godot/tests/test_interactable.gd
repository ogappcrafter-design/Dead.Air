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
	results["test_cassette_save_point_stays"] = test_cassette_save_point_stays()
	results["test_cassette_save_point_prompt"] = test_cassette_save_point_prompt()
	results["test_cassette_save_point_spent"] = test_cassette_save_point_spent()
	results["test_cassette_save_point_uses_shift_id"] = test_cassette_save_point_uses_shift_id()
	results["test_cassette_save_point_reusable_next_shift"] = (
		test_cassette_save_point_reusable_next_shift()
	)
	results["test_cassette_save_point_disabled_shift"] = (
		test_cassette_save_point_disabled_shift()
	)
	results["test_cassette_empty_id_resolves_to_save_key"] = (
		test_cassette_empty_id_resolves_to_save_key()
	)
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
	var observed := {"fired": false}
	inter.interacted.connect(func(_interactor: Node) -> void: observed["fired"] = true)
	inter.interact(null)
	inter.free()
	return observed["fired"]


func test_base_examine_emits_signal() -> bool:
	var inter := Interactable.new()
	var observed := {"fired": false}
	inter.examine_requested.connect(func(_interactor: Node) -> void: observed["fired"] = true)
	inter.examine(null)
	inter.free()
	return observed["fired"]


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


func test_cassette_save_point_stays() -> bool:
	var tape := CassetteTape.new()
	# A safe-room save cassette saves on interaction and stays in the world.
	tape.is_save_point = true
	tape.interact(null)
	var checks: Array[bool] = [
		tape.visible == true,
		tape.can_interact() == true,
	]
	tape.free()
	for check in checks:
		if not check:
			return false
	return true


func test_cassette_save_point_spent() -> bool:
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.tape_label = "SPARE CASSETTE"
	# SaveManager consumes the tape after a successful save.
	tape.is_spent = true
	var checks: Array[bool] = [
		tape.can_interact() == false,
		tape.get_prompt_text() == "SPARE CASSETTE (used)",
	]
	tape.free()
	for check in checks:
		if not check:
			return false
	return true


func test_cassette_save_point_prompt() -> bool:
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.tape_label = "SPARE CASSETTE"
	var prompt := tape.get_prompt_text()
	tape.free()
	return prompt == "Save at SPARE CASSETTE"


func test_cassette_save_point_uses_shift_id() -> bool:
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.tape_id = "booth_save"
	tape.configure_save_shift(2)
	var shift_two := tape.get_save_id()
	tape.configure_save_shift(3)
	var shift_three := tape.get_save_id()
	tape.free()
	return shift_two == "booth_save_shift_2" and shift_three == "booth_save_shift_3"


func test_cassette_save_point_reusable_next_shift() -> bool:
	var base := "test_reuse_%d" % Time.get_ticks_usec()
	var save_data := SaveData.new()
	save_data.shift = 2
	var wrote := SaveManager.save_game(base + "_shift_2", save_data)
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.tape_id = base
	# In the tree so _refresh_spent can resolve the SaveManager autoload.
	Engine.get_main_loop().root.add_child(tape)
	tape.configure_save_shift(2)
	var restored_spent: bool = tape.is_spent and not tape.can_interact()
	tape.configure_save_shift(3)
	var available_in_three: bool = not tape.is_spent and tape.can_interact()
	tape.free()
	SaveManager.delete_save(base + "_shift_2")
	return wrote and restored_spent and available_in_three


func test_cassette_save_point_disabled_shift() -> bool:
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.tape_id = "test_disabled_%d" % Time.get_ticks_usec()
	tape.tape_label = "SPARE CASSETTE"
	tape.configure_save_shift(1, false)
	var disabled: bool = (
		not tape.can_interact() and tape.get_prompt_text() == "SPARE CASSETTE (no save)"
	)
	tape.configure_save_shift(2, true)
	var enabled: bool = (
		tape.can_interact() and tape.get_prompt_text() == "Save at SPARE CASSETTE"
	)
	tape.free()
	return disabled and enabled


func test_cassette_empty_id_resolves_to_save_key() -> bool:
	var tape := CassetteTape.new()
	tape.is_save_point = true
	tape.configure_save_shift(2)
	var resolved := tape.get_save_id()
	tape.free()
	return resolved == "auto_shift_2"


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
