## test_phase3_liminal_space.gd — Tests for DEA-123 Location 3 "The Liminal Space".
## Verifies: LIMINAL dominant/stable, LIVING+LOST flicker/decay, three-door
## puzzle (band+proximity), Suit spawning/patrol, detection (composure -30 +
## relocation), safe room entry/save/tone, bunker departure completes,
## reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase3LiminalSpace"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_liminal_dominant_stable"] = await test_liminal_dominant_stable()
	results["test_flicker_decays_on_other_bands"] = await test_flicker_decays_on_other_bands()
	results["test_door_requires_band_and_proximity"] = await test_door_requires_band_and_proximity()
	results["test_all_three_doors_complete_puzzle"] = await test_all_three_doors_complete_puzzle()
	results["test_suit_spawns_after_delay"] = await test_suit_spawns_after_delay()
	results["test_detection_costs_composure_and_relocates"] = await test_detection_costs_composure_and_relocates()
	results["test_safe_room_entry_and_save"] = await test_safe_room_entry_and_save()
	results["test_safe_room_exit_resumes"] = await test_safe_room_exit_resumes()
	results["test_bunker_door_completes"] = await test_bunker_door_completes()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase3/liminal_space.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_liminal_dominant_stable() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		# Starts on LIMINAL with strong signal.
		ok = segment.get_radio_signal() >= 65.0
	if ok:
		# Stays strong over time.
		for i in range(10):
			segment._process(0.5)
		ok = segment.get_radio_signal() >= 65.0
	_cleanup_segment(segment)
	return ok

func test_flicker_decays_on_other_bands() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.tune_for_testing(0)  # LIVING
	segment._process(0.016)
	var early: float = segment.get_radio_signal()
	var ok: bool = early > 0.0
	if ok:
		# Signal decays over time.
		for i in range(20):
			segment._process(0.5)
		var late: float = segment.get_radio_signal()
		ok = late < early
	if ok:
		# Floor: never hits absolute zero while tuned.
		for i in range(30):
			segment._process(0.5)
		ok = segment.get_radio_signal() >= 5.0
	_cleanup_segment(segment)
	return ok

func test_door_requires_band_and_proximity() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_door_found("neighborhood")
	if ok:
		# Proximity without the band: nothing.
		segment.place_player_at_door_for_testing("neighborhood")
		segment._process(0.016)
		ok = not segment.is_door_found("neighborhood")
	if ok:
		# Band without proximity: nothing.
		segment.tune_for_testing(0)
		segment.tune_for_testing(1)
		segment._process(0.016)
		ok = not segment.is_door_found("neighborhood")
	if ok:
		# Band + proximity: found.
		segment.tune_for_testing(0)
		segment.place_player_at_door_for_testing("neighborhood")
		segment._process(0.016)
		ok = segment.is_door_found("neighborhood")
	_cleanup_segment(segment)
	return ok

func test_all_three_doors_complete_puzzle() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_puzzle := [false]
	segment.puzzle_completed.connect(func() -> void: got_puzzle[0] = true)
	var ok: bool = true
	var order := [["neighborhood", 0], ["bunker", 2], ["safe", 1]]
	for entry in order:
		segment.tune_for_testing(entry[1])
		segment.place_player_at_door_for_testing(entry[0])
		segment._process(0.016)
		ok = ok and segment.is_door_found(entry[0])
	if ok:
		ok = got_puzzle[0]
	_cleanup_segment(segment)
	return ok

func test_suit_spawns_after_delay() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.get_suits_spawned() == 0
	if ok:
		# Simulate the delay.
		segment._suit_timer = segment.FIRST_SUIT_DELAY + 1.0
		segment._process(0.016)
		ok = segment.get_suits_spawned() == 1
	if ok:
		ok = segment.get_active_suit() != null
	if ok:
		ok = segment.get_phase_name() == "HUNTED"
	_cleanup_segment(segment)
	return ok

func test_detection_costs_composure_and_relocates() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var before: float = segment.get_composure()
	var got_detect := [false]
	var got_relocate := [false]
	segment.suit_detected_player.connect(func() -> void: got_detect[0] = true)
	segment.player_relocated_by_suit.connect(func() -> void: got_relocate[0] = true)
	segment.spawn_suit_for_testing()
	# Put the suit right on the player.
	var suit = segment.get_active_suit()
	suit.global_position = segment.get_player().global_position
	segment._process(0.016)
	var ok: bool = got_detect[0]
	if ok:
		var after: float = segment.get_composure()
		ok = after <= before - 25.0
	if ok:
		ok = got_relocate[0]
	_cleanup_segment(segment)
	return ok

func test_safe_room_entry_and_save() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_enter := [false]
	var got_save := [false]
	segment.entered_safe_room.connect(func() -> void: got_enter[0] = true)
	segment.saved_in_safe_room.connect(func() -> void: got_save[0] = true)
	segment.force_safe_room_for_testing()
	var ok: bool = got_enter[0] and segment.get_phase_name() == "SAFE_ROOM"
	if ok:
		await _wait_frames(2)
		ok = got_save[0]
	if ok:
		var sm: Node = segment._autoload("SaveManager")
		ok = sm and sm.is_tape_used("liminal_safe_1")
	_cleanup_segment(segment)
	return ok

func test_safe_room_exit_resumes() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_safe_room_for_testing()
	var ok: bool = segment.get_phase_name() == "SAFE_ROOM"
	if ok:
		# Walk out of the safe room.
		var player = segment.get_player()
		player.global_position = Vector3(0, 0.5, 4)
		segment._process(0.016)
		ok = segment.get_phase_name() == "EXPLORE"
	_cleanup_segment(segment)
	return ok

func test_bunker_door_completes() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_complete := [false]
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	# Find the bunker door first.
	segment.tune_for_testing(2)
	segment.place_player_at_door_for_testing("bunker")
	segment._process(0.016)
	var ok: bool = segment.is_door_found("bunker")
	if ok:
		# Then walk into it.
		segment.place_player_at_door_for_testing("bunker")
		var door: Node3D = segment._doors["bunker"]
		var area: Area3D = door.get_node("Area")
		segment._on_door_area_entered(segment.get_player(), "bunker")
		ok = segment.get_phase_name() == "DEPARTED"
	if ok:
		segment._process(0.016)
		ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_reset_restores_phase1() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment._reset_for_testing()
	var ok: bool = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_1_STATION
	segment.queue_free()
	return ok

func _wait_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).process_frame
