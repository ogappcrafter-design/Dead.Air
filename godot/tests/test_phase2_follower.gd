## test_phase2_follower.gd — Tests for DEA-119 Segment 2C "The Follower".
## Verifies: dead air start (signal 0), presence phase begins with Suit
## approaching, hunt phase (tune to LIMINAL restores signal), house entry
## triggers hiding, breath hold tracked (5s max with forced exhale), window
## shadow sweep during pass, total silence during hiding (radio muted),
## follower passes and segment completes, reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase2Follower"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_dead_air_start"] = await test_dead_air_start()
	results["test_presence_suit_approaches"] = await test_presence_suit_approaches()
	results["test_hunt_signal_restored_by_tuning"] = await test_hunt_signal_restored_by_tuning()
	results["test_house_entry_starts_hiding"] = await test_house_entry_starts_hiding()
	results["test_hiding_mutes_all_buses"] = await test_hiding_mutes_all_buses()
	results["test_breath_hold_tracked"] = await test_breath_hold_tracked()
	results["test_window_shadow_sweep"] = await test_window_shadow_sweep()
	results["test_follower_passes_completes"] = await test_follower_passes_completes()
	results["test_hide_mode_entered"] = await test_hide_mode_entered()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase2/follower.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_dead_air_start() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "DEAD_AIR"
	if ok:
		# Signal must be 0 during dead air
		segment._process(0.016)
		var sig: float = segment.get_radio_signal()
		ok = sig <= 0.001
	if ok:
		ok = not segment.is_radio_restored()
	_cleanup_segment(segment)
	return ok

func test_presence_suit_approaches() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var suit = segment.get_suit()
	var ok: bool = suit != null
	if ok:
		# Force presence: run the dead air's transition by calling the phase directly
		segment._enter_phase(segment.Phase.PRESENCE)
		ok = segment.get_phase_name() == "PRESENCE"
	if ok:
		# Suit walks toward the player over time. The suit moves via its own
		# _physics_process (engine physics ticks), so drive it explicitly.
		var player = segment.get_player()
		var start_dist: float = suit.global_position.distance_to(player.global_position)
		for i in range(30):
			segment._process(0.1)
			suit._physics_process(0.1)
		var end_dist: float = suit.global_position.distance_to(player.global_position)
		ok = end_dist < start_dist
		if ok:
			ok = suit.visible
	_cleanup_segment(segment)
	return ok

func test_hunt_signal_restored_by_tuning() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	var ok: bool = segment.get_phase_name() == "HUNT"
	if ok:
		# Before tuning: signal 0
		ok = segment.get_radio_signal() <= 0.001
	if ok:
		# Tune to LIMINAL (band 1)
		var rt = segment.get_radio_tuner()
		rt.set_band(1)
		segment._process(0.016)
		ok = segment.is_radio_restored()
	if ok:
		var sig: float = segment.get_radio_signal()
		# HUNT: 55 minus proximity drain (0..35) — must be > 0 and <= 55
		ok = sig > 0.0 and sig <= 55.0
	_cleanup_segment(segment)
	return ok

func test_house_entry_starts_hiding() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	var got_hidden := [false]
	segment.hiding_started.connect(func() -> void: got_hidden[0] = true)
	segment.force_house_entry_for_testing()
	var ok: bool = got_hidden[0]
	if ok:
		ok = segment.is_hiding()
	if ok:
		ok = segment.is_silenced_for_hiding()
	_cleanup_segment(segment)
	return ok

func test_hiding_mutes_all_buses() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	segment.force_house_entry_for_testing()
	var ok: bool = segment.is_hiding()
	if ok:
		# RADIO_AMBIENT (2) must be muted too — total silence
		var idx: int = AudioServer.get_bus_index("RADIO_AMBIENT")
		ok = AudioServer.is_bus_mute(idx)
	_cleanup_segment(segment)
	return ok

func test_breath_hold_tracked() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	segment.force_house_entry_for_testing()
	var ok: bool = segment.is_hiding()
	if ok:
		# Simulate breath hold via the testing override (InputManager absent
		# in headless tests; override mirrors the held action).
		segment._breath_override_for_testing = true
		segment._process(0.016)
		ok = segment.is_breath_held()
	if ok:
		# After 5+ seconds, forced exhale fires (timer resets)
		segment._breath_timer = 5.5
		segment._process(0.016)
		# Timer reset
		ok = segment.get_breath_timer() < 5.0
	_cleanup_segment(segment)
	return ok

func test_window_shadow_sweep() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	segment.force_house_entry_for_testing()
	var ok: bool = segment.is_hiding()
	if ok:
		# Early in pass: shadow low
		segment._process(0.016)
		var early: float = segment.get_window_shadow_intensity()
		# Mid pass: shadow peaks
		segment._pass_timer = 6.0  # halfway
		segment._process(0.016)
		var mid: float = segment.get_window_shadow_intensity()
		ok = mid > early and mid > 0.9
	_cleanup_segment(segment)
	return ok

func test_follower_passes_completes() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	segment.force_house_entry_for_testing()
	var got_passed := [false]
	var got_complete := [false]
	segment.follower_passed.connect(func() -> void: got_passed[0] = true)
	segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	# Fast-forward the pass
	segment._pass_timer = 12.5
	segment._process(0.016)
	var ok: bool = segment.get_phase_name() == "PASSED"
	if ok:
		# Fast-forward the passed phase
		segment._pass_timer = 18.5
		segment._process(0.016)
		ok = got_complete[0]
	_cleanup_segment(segment)
	return ok

func test_hide_mode_entered() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.force_hunt_phase_for_testing()
	segment.force_house_entry_for_testing()
	var ok: bool = segment.is_hiding()
	if ok:
		ok = PhaseManager.get_mode() == PhaseEnums.ModeContext.HIDE
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
