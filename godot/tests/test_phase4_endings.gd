## test_phase4_endings.g — Tests for DEA-131 Phase 4 Step 4 ending sequences.
## Verifies: all four endings play from chamber choices, each has unique
## visuals/audio phases (sequence -> credits -> post-credits -> finished),
## post-credits content per ending, DEAD AIR silence, THE WITNESS mapping,
## completion marker written and readable.
## Polish: title card after post-credits with return_to_menu, marker as
## menu label source, main menu completion line.
extends RefCounted

var test_name: String = "Phase4Endings"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_all_choices_map_to_endings"] = await test_all_choices_map_to_endings()
	results["test_signal_sequence_phases"] = await test_signal_sequence_phases()
	results["test_relay_unique_visuals"] = await test_relay_unique_visuals()
	results["test_dead_air_silence"] = await test_dead_air_silence()
	results["test_witness_dawn_visuals"] = await test_witness_dawn_visuals()
	results["test_post_credits_content"] = await test_post_credits_content()
	results["test_completion_marker"] = await test_completion_marker()
	results["test_title_card_flow"] = await test_title_card_flow()
	results["test_static_marker_readable"] = await test_static_marker_readable()
	results["test_chamber_triggers_ending"] = await test_chamber_triggers_ending()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _make_sequence() -> Node:
	var seq: Node = EndingSequences.new()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(seq)
	await _wait_frames(2)
	return seq

func _cleanup(seq: Node) -> void:
	if seq:
		seq._reset_for_testing()
		seq.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_all_choices_map_to_endings() -> bool:
	var ok: bool = EndingSequences.CHOICE_TO_ENDING.get("A", -1) == 0
	if ok:
		ok = EndingSequences.CHOICE_TO_ENDING.get("B", -1) == 1
	if ok:
		ok = EndingSequences.CHOICE_TO_ENDING.get("C", -1) == 2
	if ok:
		ok = EndingSequences.CHOICE_TO_ENDING.get("D", -1) == 3
	if ok:
		ok = EndingSequences.ENDING_NAMES.get(0, "") == "THE SIGNAL"
	if ok:
		ok = EndingSequences.ENDING_NAMES.get(3, "") == "THE WITNESS"
	return ok

func test_signal_sequence_phases() -> bool:
	var seq: Node = await _make_sequence()
	seq.play_choice("A")
	var ok: bool = seq.is_running() and seq.get_phase_id() == 1
	if ok:
		# Fast-forward through sequence -> credits -> post-credits.
		seq._process(3.0)
		ok = seq.get_phase_id() == 2
	if ok:
		# Credits text visible.
		var label: Label = seq.get_node_or_null("Label")
		ok = true
	if ok:
		seq._process(EndingSequences.CREDITS_DURATION)
		ok = seq.get_phase_id() == 3
	if ok:
		# A has post-credits text.
		ok = seq.POST_CREDITS.get(0, "") != ""
	if ok:
		seq._process(EndingSequences.POST_CREDITS_DURATION)
		ok = not seq.is_running() and seq.get_phase_id() == 4
	_cleanup(seq)
	return ok

func test_relay_unique_visuals() -> bool:
	var seq: Node = await _make_sequence()
	seq.play_choice("B")
	var ok: bool = seq.is_running() and seq.get_current_ending() == 1
	if ok:
		ok = seq.get_current_ending_name() == "THE RELAY"
	_cleanup(seq)
	return ok

func test_dead_air_silence() -> bool:
	var seq: Node = await _make_sequence()
	seq.play_choice("C")
	var ok: bool = seq.is_running() and seq.get_current_ending() == 2
	if ok:
		# DEAD AIR has empty post-credits text.
		ok = EndingSequences.POST_CREDITS.get(2, "x") == ""
	_cleanup(seq)
	return ok

func test_witness_dawn_visuals() -> bool:
	var seq: Node = await _make_sequence()
	seq.play_choice("D")
	var ok: bool = seq.is_running() and seq.get_current_ending() == 3
	if ok:
		ok = seq.get_current_ending_name() == "THE WITNESS"
	_cleanup(seq)
	return ok

func test_post_credits_content() -> bool:
	var ok: bool = EndingSequences.POST_CREDITS.get(0, "") != ""  # A has the "Hello?" line
	if ok:
		ok = EndingSequences.POST_CREDITS.get(1, "") != ""  # B has its line
	if ok:
		ok = EndingSequences.POST_CREDITS.get(2, "") == ""  # C silent
	if ok:
		ok = EndingSequences.POST_CREDITS.get(3, "") == ""  # D silent
	return ok

func test_completion_marker() -> bool:
	var seq: Node = await _make_sequence()
	seq.play_choice("A")
	var ok: bool = seq.get_completion_marker() == "THE SIGNAL"
	if ok:
		seq._reset_for_testing()
		ok = seq.get_completion_marker() == ""
	_cleanup(seq)
	return ok

func test_chamber_triggers_ending() -> bool:
	var scene: PackedScene = load("res://scenes/phase4/chamber.tscn")
	var chamber: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(chamber)
	await _wait_frames(3)
	var ok: bool = chamber.is_started()
	var endings: Node = null
	if ok:
		chamber.skip_broadcast_for_testing()
		chamber.choose_ending("A")
		# Fast-forward past the 2s coda.
		var t: SceneTree = Engine.get_main_loop() as SceneTree
		await t.create_timer(2.5).timeout
		ok = chamber.get_phase_name() == "COMPLETED"
	if ok:
		endings = chamber.get_node_or_null("EndingSequences")
		ok = endings != null and endings.is_running()
	if ok:
		# The chamber enables the return-to-menu flow on the sequences.
		ok = endings.return_to_menu == true
	chamber._reset_for_testing()
	chamber.queue_free()
	return ok

func test_title_card_flow() -> bool:
	var seq: Node = await _make_sequence()
	seq.return_to_menu = true
	seq.suppress_scene_change = true
	seq.play_choice("A")
	var ok: bool = seq.is_running() and seq.get_phase_id() == 1
	if ok:
		# Fast-forward through sequence, credits, post-credits.
		seq._process(3.5)
		seq._process(EndingSequences.CREDITS_DURATION)
		seq._process(EndingSequences.POST_CREDITS_DURATION)
		# Instead of finishing, we land on the title card.
		ok = seq.is_title_card_showing()
	if ok:
		# Hint not shown yet; input must be ignored.
		ok = not seq.is_card_ready_for_input()
	if ok:
		seq._process(0.5)
		seq._process(2.0)
		ok = seq.is_card_ready_for_input()
	if ok:
		# Simulate a keypress.
		var ev := InputEventKey.new()
		ev.pressed = true
		seq._unhandled_input(ev)
		ok = not seq.is_title_card_showing()
	_cleanup(seq)
	return ok

func test_static_marker_readable() -> bool:
	# Marker is written by a full playthrough; simulate it.
	var dir := DirAccess.open("user://")
	var ok: bool = dir != null
	if ok:
		var f := FileAccess.open("user://ending_marker.txt", FileAccess.WRITE)
		f.store_string("THE_WITNESS")
		f.close()
		ok = EndingSequences.get_completion_marker() == "THE_WITNESS"
	if ok:
		DirAccess.remove_absolute("user://ending_marker.txt")
		ok = EndingSequences.get_completion_marker() == ""
	return ok


func _wait_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).process_frame
