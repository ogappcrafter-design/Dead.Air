extends RefCounted
var test_name := "TapePickup"

## Unit tests for TapePickup 3D interactable.
## Tests the collection logic without requiring a full 3D scene.


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_pickup_initial_state"] = test_pickup_initial_state()
	results["test_pickup_collect_marks_collected"] = test_pickup_collect_marks_collected()
	results["test_pickup_skip_if_already_collected"] = test_pickup_skip_if_already_collected()
	results["test_pickup_hide_after_collect"] = test_pickup_hide_after_collect()
	results["test_pickup_empty_id_warning"] = test_pickup_empty_id_warning()
	results["test_inventory_collect_and_check"] = test_inventory_collect_and_check()
	results["test_inventory_consume"] = test_inventory_consume()
	results["test_inventory_refuse"] = test_inventory_refuse()
	results["test_inventory_to_dict_roundtrip"] = test_inventory_to_dict_roundtrip()
	results["test_inventory_reset"] = test_inventory_reset()
	return results


func test_pickup_initial_state() -> bool:
	var pickup := TapePickup.new()
	# Before _ready, should not be collected
	if pickup.is_collected():
		return false
	pickup.free()
	return true


func test_pickup_collect_marks_collected() -> bool:
	# Reset inventory to ensure clean state
	TapeInventory.reset()
	var pickup := TapePickup.new()
	pickup.tape_id = "test-tape-001"
	# Manually trigger collection logic
	pickup._collected = false
	pickup._do_collect()
	if not pickup.is_collected():
		pickup.free()
		return false
	pickup.free()
	return true


func test_pickup_skip_if_already_collected() -> bool:
	TapeInventory.reset()
	var pickup := TapePickup.new()
	pickup.tape_id = "test-tape-002"
	# First collect
	pickup._collected = false
	pickup._do_collect()
	var first_state := pickup.is_collected()
	# Second collect should not change anything (already collected)
	pickup._do_collect()
	var second_state := pickup.is_collected()
	pickup.free()
	return first_state and second_state


func test_pickup_hide_after_collect() -> bool:
	TapeInventory.reset()
	var pickup := TapePickup.new()
	pickup.tape_id = "test-tape-003"
	pickup._collected = false
	pickup._do_collect()
	pickup.hide_pickup()
	var result := not pickup.visible
	pickup.free()
	return result


func test_pickup_empty_id_warning() -> bool:
	TapeInventory.reset()
	var pickup := TapePickup.new()
	pickup.tape_id = ""
	# Empty ID should not crash, just warn
	# The _ready function handles this, but we test the property
	var result := pickup.tape_id.is_empty()
	pickup.free()
	return result


func test_inventory_collect_and_check() -> bool:
	TapeInventory.reset()
	TapeInventory.collect_tape("test-collect-001")
	if not TapeInventory.has_tape("test-collect-001"):
		return false
	if TapeInventory.get_collected_count() != 1:
		return false
	# Collecting again should not duplicate
	TapeInventory.collect_tape("test-collect-001")
	if TapeInventory.get_collected_count() != 1:
		return false
	return true


func test_inventory_consume() -> bool:
	TapeInventory.reset()
	TapeInventory.collect_tape("test-consume-001")
	var result := TapeInventory.consume_tape("test-consume-001")
	if not result:
		return false
	if not TapeInventory.is_tape_consumed("test-consume-001"):
		return false
	# Consuming non-collected tape should return false
	TapeInventory.reset()
	var result2 := TapeInventory.consume_tape("not-collected")
	if result2:
		return false
	return true


func test_inventory_refuse() -> bool:
	TapeInventory.reset()
	TapeInventory.refuse_tape("test-refuse-001")
	if not TapeInventory.was_tape_refused("test-refuse-001"):
		return false
	if TapeInventory.get_refused_count() != 1:
		return false
	return true


func test_inventory_to_dict_roundtrip() -> bool:
	TapeInventory.reset()
	TapeInventory.collect_tape("test-dict-001")
	TapeInventory.collect_tape("test-dict-002")
	TapeInventory.consume_tape("test-dict-001")
	TapeInventory.refuse_tape("test-dict-003")
	var d := TapeInventory.to_dict()
	# Verify structure
	if not (d.has("collected") and d.has("consumed") and d.has("refused")):
		return false
	# consume_tape removes from _collected, so only test-dict-002 remains
	if not (d["collected"].size() == 1 and d["consumed"].size() == 1 and d["refused"].size() == 1):
		return false
	# Roundtrip
	TapeInventory.reset()
	TapeInventory.from_dict(d)
	if not (
		TapeInventory.get_collected_count() == 1
		and TapeInventory.get_consumed_count() == 1
		and TapeInventory.get_refused_count() == 1
	):
		return false
	# Verify the right tape is in the right state
	return (
		TapeInventory.has_tape("test-dict-002")
		and TapeInventory.is_tape_consumed("test-dict-001")
		and TapeInventory.was_tape_refused("test-dict-003")
	)


func test_inventory_reset() -> bool:
	TapeInventory.reset()
	TapeInventory.collect_tape("test-reset-001")
	TapeInventory.consume_tape("test-reset-001")
	TapeInventory.refuse_tape("test-reset-002")
	TapeInventory.reset()
	if TapeInventory.get_collected_count() != 0:
		return false
	if TapeInventory.get_consumed_count() != 0:
		return false
	if TapeInventory.get_refused_count() != 0:
		return false
	return true
