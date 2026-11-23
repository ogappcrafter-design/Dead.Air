## cassette_tape.gd — Interactable cassette tape pickup.
class_name CassetteTape extends Interactable

## Safe-room save cassettes stay in the world and save on interaction.
## Pickup cassettes are consumed by interact() and never save.
@export var is_save_point: bool = false
@export var tape_id: String = ""
@export var tape_label: String = "Unlabeled Tape"
@export var pickup_message: String = "Picked up tape"

## Save cassettes are one-use per shift: SaveManager consumes the tape ID after
## a successful save, so a spent cassette stops offering the save action until
## the next shift gives it a fresh slot.
var is_spent: bool = false
# Shift whose save slot this save point uses. 0 keeps the base tape id.
var save_shift: int = 0
# Whether the current shift allows saving (GDD: Shifts 2-4 only).
var save_enabled: bool = true


func _ready() -> void:
	super()
	_refresh_spent()


## Point this save point at a shift's save slot and restore its spent state.
## The booth cassette is reusable per shift (GDD: Shifts 2-4).
func configure_save_shift(shift_number: int, save_available: bool = true) -> void:
	save_shift = maxi(shift_number, 0)
	save_enabled = save_available
	_refresh_spent()


## Effective SaveManager key. Save points get a per-shift slot so a save in one
## shift does not consume the cassette for the next; an empty tape_id resolves
## to the same "auto" key the save path uses.
func get_save_id() -> String:
	var base := tape_id if not tape_id.is_empty() else "auto"
	if is_save_point and save_shift > 0:
		return "%s_shift_%d" % [base, save_shift]
	return base


func mark_spent() -> void:
	is_spent = true


func _refresh_spent() -> void:
	is_spent = false
	if not is_save_point:
		return
	var save_mgr := get_node_or_null("/root/SaveManager")
	if save_mgr == null:
		return
	# A numbered-slot save writes slot_N, not this cassette's per-shift key, so
	# the tape's own index entry stays empty; the save path records the key as
	# spent instead. Either signal means this cassette already saved tonight.
	is_spent = bool(save_mgr.is_tape_used(get_save_id()))
	if (
		not is_spent
		and save_mgr.has_method("is_save_point_spent")
		and bool(save_mgr.is_save_point_spent(get_save_id()))
	):
		is_spent = true


func can_interact() -> bool:
	if is_save_point and not save_enabled:
		return false
	return not is_spent


func interact(interactor: Node) -> void:
	if not can_interact():
		return
	emit_signal("interacted", interactor)
	if is_save_point:
		return
	# Hide self on pickup — tape goes into inventory
	visible = false
	if has_node("CollisionShape3D"):
		$CollisionShape3D.set_deferred("disabled", true)


func get_prompt_text() -> String:
	if is_save_point:
		if not save_enabled:
			return "%s (no save)" % tape_label
		if is_spent:
			return "%s (used)" % tape_label
		return "Save at %s" % tape_label
	return "Pick up %s" % tape_label


func get_examine_text() -> String:
	if tape_label.is_empty():
		return "A worn cassette tape. The label has peeled off.\nYou can barely make out the markings."
	return 'A cassette tape labeled "%s".\nThe tape inside looks intact.' % tape_label


func get_examine_mode() -> String:
	return "tape"


func get_examine_title() -> String:
	return tape_label if not tape_label.is_empty() else "Cassette Tape"
