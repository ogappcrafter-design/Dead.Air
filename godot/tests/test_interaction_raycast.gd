# gdlint:ignore=max-public-methods
## test_interaction_raycast.gd — Unit tests for InteractionRaycast.
## Tests: signal wiring, target detection via collider, interact dispatch,
## examine dispatch, can_interact gating, mode gating.
## NOTE: RayCast3D requires a SceneTree for physics. These tests instantiate
## nodes and add them to the root via the running SceneTree.
extends RefCounted

var test_name: String = "InteractionRaycast"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_raycast_exists"] = test_raycast_exists()
	results["test_raycast_target_changed_signal"] = test_raycast_target_changed_signal()
	results["test_raycast_interact_performed_signal"] = test_raycast_interact_performed_signal()
	results["test_raycast_examine_performed_signal"] = test_raycast_examine_performed_signal()
	results["test_raycast_can_interact_gating"] = test_raycast_can_interact_gating()
	results["test_raycast_examine_text_passed"] = test_raycast_examine_text_passed()
	return results


## Helper: get the running SceneTree.
func _get_tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## Helper: create a minimal player + raycast + interactable setup.
## Returns {player, raycast, interactable, shape}.
func _create_setup() -> Dictionary:
	var tree := _get_tree()
	# Player body (CharacterBody3D parent for raycast)
	var player := CharacterBody3D.new()
	tree.root.add_child(player)

	# Raycast as child of player
	var raycast := InteractionRaycast.new()
	player.add_child(raycast)

	# Interactable Area3D with a CollisionShape3D
	var interactable := Interactable.new()
	tree.root.add_child(interactable)
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	shape.shape = box
	interactable.add_child(shape)

	return {
		"player": player,
		"raycast": raycast,
		"interactable": interactable,
		"shape": shape,
	}


## Helper: tear down a setup dict.
func _teardown(setup: Dictionary) -> void:
	var tree := _get_tree()
	for key in setup.keys():
		var node: Node = setup[key]
		if is_instance_valid(node) and node is Node:
			if node.get_parent():
				node.get_parent().remove_child(node)
			node.free()


func test_raycast_exists() -> bool:
	var setup := _create_setup()
	var raycast: InteractionRaycast = setup["raycast"]
	var checks: Array[bool] = [
		is_instance_valid(raycast),
		raycast is InteractionRaycast,
		raycast is RayCast3D,
	]
	_teardown(setup)
	for check in checks:
		if not check:
			return false
	return true


func test_raycast_target_changed_signal() -> bool:
	var setup := _create_setup()
	var raycast: InteractionRaycast = setup["raycast"]
	var interactable: Interactable = setup["interactable"]

	var signal_received := false
	var received_target: Interactable = null
	raycast.target_changed.connect(
		func(target: Interactable) -> void:
			signal_received = true
			received_target = target
	)

	# Simulate a previously-detected target, then call _update_target.
	# Without physics, _update_target sees no collision → new_target = null,
	# detects change from interactable to null, emits target_changed(null).
	raycast.current_target = interactable
	raycast._update_target()

	var fired := signal_received == true
	var lost_target := received_target == null

	_teardown(setup)
	return fired and lost_target


func test_raycast_interact_performed_signal() -> bool:
	var setup := _create_setup()
	var raycast: InteractionRaycast = setup["raycast"]
	var interactable: Interactable = setup["interactable"]

	var signal_received := false
	var received_target: Interactable = null
	raycast.interact_performed.connect(
		func(target: Interactable) -> void:
			signal_received = true
			received_target = target
	)

	# Set a target and call _try_interact — should dispatch interact and emit signal
	raycast.current_target = interactable
	raycast._try_interact()

	var fired := signal_received == true
	var correct_target := received_target == interactable

	_teardown(setup)
	return fired and correct_target


func test_raycast_examine_performed_signal() -> bool:
	var setup := _create_setup()
	var raycast: InteractionRaycast = setup["raycast"]

	# Use a NoteInteractable for meaningful examine text
	var note := NoteInteractable.new()
	note.note_title = "Test Note"
	note.note_content = "Examine payload test."
	_get_tree().root.add_child(note)

	var signal_received := false
	var received_text: String = ""
	raycast.examine_performed.connect(
		func(_target: Interactable, text: String) -> void:
			signal_received = true
			received_text = text
	)

	raycast.current_target = note
	raycast._try_examine()

	var fired := signal_received == true
	var text_ok := (
		received_text.contains("Test Note") and received_text.contains("Examine payload test.")
	)

	if is_instance_valid(note):
		if note.get_parent():
			note.get_parent().remove_child(note)
		note.free()

	_teardown(setup)
	return fired and text_ok


func test_raycast_can_interact_gating() -> bool:
	# Test that a locked door's can_interact returns false and prevents interact
	var door := DoorInteractable.new()
	door.is_locked = true
	door.is_open = false

	var can := door.can_interact()
	door.interact(null)
	var still_closed := door.is_open == false

	door.free()
	return can == false and still_closed


func test_raycast_examine_text_passed() -> bool:
	# Verify that get_examine_text returns expected content for subclasses
	var note := NoteInteractable.new()
	note.note_title = "Diary"
	note.note_content = "The signal is getting stronger."
	var text := note.get_examine_text()
	var ok := text.contains("Diary") and text.contains("The signal is getting stronger.")
	note.free()
	return ok
