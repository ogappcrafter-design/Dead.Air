extends RefCounted
## test_phase3_collectors_tape.gd — Tests for the Collector's Tape side
## puzzle (DEA-126). Verifies: puzzle requires LOST band + House B entry,
## reveal fires hidden signal + shadow, dig yields tape-010, completion
## tracked, reset clears state.

var test_name: String = "Phase3CollectorsTape"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_puzzle_starts_inactive"] = await test_puzzle_starts_inactive()
	results["test_reveal_requires_lost_band"] = await test_reveal_requires_lost_band()
	results["test_reveal_fires_signal_and_shadow"] = await test_reveal_fires_signal_and_shadow()
	results["test_dig_yields_tape"] = await test_dig_yields_tape()
	results["test_dig_only_once"] = await test_dig_only_once()
	results["test_tape_in_inventory"] = await test_tape_in_inventory()
	results["test_reset_clears_state"] = await test_reset_clears_state()
	return results


func _make_puzzle() -> Node:
	var puzzle := CollectorsTapePuzzle.new()
	puzzle.name = "Puzzle"
	# Standalone instantiation has no scene props; provide a shadow node so
	# the manifestation check exercises the same path as in-game.
	var shadow := Node3D.new()
	shadow.name = "CollectorShadow"
	shadow.visible = false
	puzzle.add_child(shadow)
	(Engine.get_main_loop() as SceneTree).root.add_child(puzzle)
	# Wait for deferred setup.
	for i in 3:
		await (Engine.get_main_loop() as SceneTree).process_frame
	return puzzle


func _cleanup(puzzle: Node) -> void:
	if puzzle and is_instance_valid(puzzle):
		puzzle._reset_for_testing()
		puzzle.queue_free()
	# Reset band state and inventory between tests.
	var bc := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("BandController")
	if bc and bc.has_method("lock_all_bands"):
		bc.lock_all_bands()
	var inv := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("TapeInventory")
	if inv and inv.has_method("reset"):
		inv.reset()


func test_puzzle_starts_inactive() -> bool:
	var puzzle: Node = await _make_puzzle()
	var ok: bool = not puzzle.is_revealed()
	ok = ok and not puzzle.is_signal_playing()
	ok = ok and not puzzle.is_shadow_visible()
	ok = ok and not puzzle.is_tape_taken()
	_cleanup(puzzle)
	return ok


func test_reveal_requires_lost_band() -> bool:
	var puzzle: Node = await _make_puzzle()
	# House entered but no LOST band: no reveal.
	puzzle.set_house_entered(true)
	puzzle.force_reveal_for_testing()  # only sets house_entered + check
	var ok: bool = not puzzle.is_revealed()  # LOST not unlocked => no reveal
	_cleanup(puzzle)
	return ok


func test_reveal_fires_signal_and_shadow() -> bool:
	var puzzle: Node = await _make_puzzle()
	var bc := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("BandController")
	if bc and bc.has_method("unlock_band"):
		bc.unlock_band(2)  # LOST
	if bc:
		bc.set_active_band(2)
	var got_reveal := [false]
	puzzle.puzzle_revealed.connect(func(): got_reveal[0] = true)
	puzzle.set_house_entered(true)
	var ok: bool = puzzle.is_revealed() and got_reveal[0]
	ok = ok and puzzle.is_signal_playing()
	ok = ok and puzzle.is_shadow_visible()
	_cleanup(puzzle)
	return ok


func test_dig_yields_tape() -> bool:
	var puzzle: Node = await _make_puzzle()
	puzzle._house_entered = true
	puzzle._revealed = true
	var got_tape := [""]
	puzzle.tape_dug_up.connect(func(id: String): got_tape[0] = id)
	puzzle.force_dig_for_testing()
	var ok: bool = got_tape[0] == "tape-010"
	ok = ok and puzzle.is_tape_taken()
	ok = ok and puzzle.is_completed()
	_cleanup(puzzle)
	return ok


func test_dig_only_once() -> bool:
	var puzzle: Node = await _make_puzzle()
	puzzle._house_entered = true
	puzzle._revealed = true
	puzzle.force_dig_for_testing()
	puzzle.force_dig_for_testing()  # second attempt must be a no-op
	var ok: bool = puzzle.is_tape_taken()
	ok = ok and puzzle.is_completed()
	# Inventory count should reflect only one tape-010.
	var inv := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("TapeInventory")
	if inv and inv.has_method("get_collected_count"):
		ok = ok and inv.get_collected_count() == 1
	_cleanup(puzzle)
	return ok


func test_tape_in_inventory() -> bool:
	var puzzle: Node = await _make_puzzle()
	puzzle._house_entered = true
	puzzle._revealed = true
	puzzle.force_dig_for_testing()
	var inv := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("TapeInventory")
	var ok: bool = false
	if inv and inv.has_method("has_tape"):
		ok = inv.has_tape("tape-010")
	_cleanup(puzzle)
	return ok


func test_reset_clears_state() -> bool:
	var puzzle: Node = await _make_puzzle()
	puzzle._house_entered = true
	puzzle._revealed = true
	puzzle.force_dig_for_testing()
	puzzle._reset_for_testing()
	var ok: bool = not puzzle.is_revealed()
	ok = ok and not puzzle.is_signal_playing()
	ok = ok and not puzzle.is_shadow_visible()
	ok = ok and not puzzle.is_tape_taken()
	ok = ok and not puzzle.is_completed()
	_cleanup(puzzle)
	return ok
