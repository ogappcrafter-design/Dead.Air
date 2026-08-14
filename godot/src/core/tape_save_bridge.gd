extends Node

## Autoload bridge that syncs TapeInventory state with SaveData.
## Listens to SaveManager.load_completed to restore TapeInventory from save.
## Provides helper functions to inject tape state into SaveData before saving.
## Does NOT modify SaveData or SaveManager — acts as external bridge.

signal tape_state_restored(tape_count: int)
signal tape_state_saved(tape_count: int)


func _ready() -> void:
	# Listen to load signal to restore inventory state
	SaveManager.load_completed.connect(_on_load_completed)
	SaveManager.save_completed.connect(_on_save_completed)


## Populate SaveData with current TapeInventory state before saving.
## Call this before SaveManager.save_game() to ensure tape state is included.
func apply_inventory_to_save_data(save_data: SaveData) -> void:
	save_data.tapes_collected = TapeInventory.get_collected_tapes()
	save_data.tapes_consumed = TapeInventory.get_consumed_tapes()
	# tapes_refused is not in SaveData, but tracked by TapeInventory internally
	# tapes_taken = total encountered
	save_data.tapes_taken = TapeInventory.get_total_encountered()


## Restore TapeInventory state from loaded SaveData.
func restore_inventory_from_save_data(save_data: SaveData) -> void:
	TapeInventory.reset()

	var data := {
		"collected": save_data.tapes_collected,
		"consumed": save_data.tapes_consumed,
		"refused": [],  # SaveData doesn't track refused tapes
	}

	# Load tape data from library for each collected tape
	var library := load("res://src/data/tapes.tres") as TapeLibrary
	if library:
		for tape_id in save_data.tapes_collected:
			var tape_data := library.get_tape_by_id(tape_id)
			if tape_data:
				TapeInventory.collect_tape(tape_id, tape_data, true)
			else:
				TapeInventory.collect_tape(tape_id, null, true)
	else:
		for tape_id in save_data.tapes_collected:
			TapeInventory.collect_tape(tape_id, null, true)

	# Mark consumed tapes
	for tape_id in save_data.tapes_consumed:
		TapeInventory.consume_tape(tape_id)

	# Emit restored count signal
	tape_state_restored.emit(TapeInventory.get_collected_count())


func _on_load_completed(save_data: SaveData) -> void:
	restore_inventory_from_save_data(save_data)


func _on_save_completed(_tape_id: String) -> void:
	tape_state_saved.emit(TapeInventory.get_collected_count())


## Check if a tape pickup should be visible (not yet collected).
func should_show_pickup(tape_id: String) -> bool:
	return not TapeInventory.has_tape(tape_id) and not TapeInventory.is_tape_consumed(tape_id)


## Get the save data dict for TapeInventory (for manual save integration).
func get_inventory_dict() -> Dictionary:
	return TapeInventory.to_dict()
