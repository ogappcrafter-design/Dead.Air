## test_suits.gd — Unit tests for The Suits enemy entity (DEA-125).
## Tests: state machine transitions, detection ranges, dread scaling,
##        noise hearing, contact→relocate, spawn counts per phase.
extends RefCounted

var test_name: String = "SuitEntity"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_initial_state_idle"] = test_initial_state_idle()
	results["test_spawn_at_sets_patrol"] = test_spawn_at_sets_patrol()
	results["test_patrol_cycles_waypoints"] = test_patrol_cycles_waypoints()
	results["test_detection_patrol_range_5m"] = test_detection_patrol_range_5m()
	results["test_detection_investigate_range_10m"] = test_detection_investigate_range_10m()
	results["test_dread_increases_detection_range"] = test_dread_increases_detection_range()
	results["test_patrol_to_approach_on_detection"] = test_patrol_to_approach_on_detection()
	results["test_investigate_to_approach_on_detection"] = test_investigate_to_approach_on_detection()
	results["test_noise_triggers_investigate"] = test_noise_triggers_investigate()
	results["test_investigate_timeout_returns_to_patrol"] = (test_investigate_timeout_returns_to_patrol())
	results["test_approach_contact_triggers_relocate"] = test_approach_contact_triggers_relocate()
	results["test_relocate_sets_composure_to_zero"] = test_relocate_sets_composure_to_zero()
	results["test_relocate_teleports_player_to_safe_area"] = (test_relocate_teleports_player_to_safe_area())
	results["test_approach_to_search_when_player_lost"] = test_approach_to_search_when_player_lost()
	results["test_search_timeout_returns_to_patrol"] = test_search_timeout_returns_to_patrol()
	results["test_search_to_approach_on_redetection"] = test_search_to_approach_on_redetection()
	results["test_despawn_sets_idle"] = test_despawn_sets_idle()
	results["test_hidden_player_undetectable"] = test_hidden_player_undetectable()
	results["test_spawner_phase2_count"] = test_spawner_phase2_count()
	results["test_spawner_phase3_bunker_count"] = test_spawner_phase3_bunker_count()
	results["test_spawner_phase4_zero"] = test_spawner_phase4_zero()
	results["test_no_shadows_on_appearance"] = test_no_shadows_on_appearance()
	results["test_state_names_mapping"] = test_state_names_mapping()
	results["test_approach_stutter_freezes_position"] = test_approach_stutter_freezes_position()
	results["test_stutter_only_in_approach"] = test_stutter_only_in_approach()
	return results


## Build a Suit with deterministic state for testing.
## The suit and its fake player are added to the scene tree immediately:
## global_position only works on in-tree nodes, so off-tree positioning
## silently resets to the origin and breaks every distance-based check.
func _make_suit(patrol_points: Array[Vector3] = [], safe_areas: Array[Vector3] = []) -> Suit:
	var suit := Suit.new()
	suit.name = "TestSuit"
	suit.set_rng_seed(42)
	if not patrol_points.is_empty():
		suit.set_patrol_points(patrol_points)
	if not safe_areas.is_empty():
		suit.set_safe_areas(safe_areas)
	var tree := Engine.get_main_loop() as SceneTree
	# Fake player node for detection tests.
	var player := CharacterBody3D.new()
	player.name = "Player"
	player.add_to_group("player")
	tree.root.add_child(player)
	player.global_position = Vector3(100, 0, 100)  # Far away by default.
	suit.set_player(player)
	tree.root.add_child(suit)
	# _ready() resolved autoload references; re-assert the test doubles.
	# DreadComposure for composure/relocate tests.
	var dc := DreadComposure.new()
	dc.set_rng_seed(42)
	suit.set_dread_composure(dc)
	suit.set_player(player)
	return suit


## Cleanup helper: remove the suit and its player from the tree.
func _drop_suit(suit: Suit) -> void:
	if suit and is_instance_valid(suit):
		var player: Node3D = suit._player
		if player and is_instance_valid(player):
			player.queue_free()
		suit.queue_free()


## Simulate physics processing for a suit without adding it to the scene tree.
func _simulate(suit: Suit, delta: float, frames: int = 1) -> void:
	for i in range(frames):
		suit._physics_process(delta)


# --- State Machine Tests ---


func test_initial_state_idle() -> bool:
	var suit := _make_suit()
	# Without patrol points, _ready doesn't auto-start patrol. But we're not
	# in the scene tree, so _ready isn't called. Initial state is IDLE.
	_drop_suit(suit)
	return suit.get_state() == Suit.State.IDLE


func test_spawn_at_sets_patrol() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0), Vector3(5, 0, 0)])
	suit.spawn_at(0)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.PATROL and suit.is_active()


func test_patrol_cycles_waypoints() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0), Vector3(3, 0, 0)])
	suit.spawn_at(0)
	# Patrol for a full cycle (3m leg at 1 m/s = 30 steps per leg), sampling
	# each step: the suit must reach within 1m of the far waypoint at some
	# point and the waypoint index must flip — that is "cycling".
	var reached_far := false
	var index_flipped := false
	for i in range(120):
		suit._physics_process(0.1)
		if suit.global_position.distance_to(Vector3(3, 0, 0)) < 1.0:
			reached_far = true
		if suit._current_patrol_index == 1:
			index_flipped = true
	_drop_suit(suit)
	return reached_far and index_flipped


# --- Detection Tests ---


func test_detection_patrol_range_5m() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	# Place player 4m away in front (within 5m patrol range, in vision cone).
	suit._player.global_position = Vector3(0, 0, -4)
	suit._player.set_meta("facing", true)
	# Face the suit toward the player (looking down -Z).
	suit.global_rotation = Vector3.ZERO
	# Simulate detection lock (3 sec).
	_simulate(suit, 0.1, 40)  # 4 seconds of processing.
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH


func test_detection_investigate_range_10m() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	# Force INVESTIGATE state.
	suit.force_state(Suit.State.INVESTIGATE)
	suit._investigate_position = Vector3.ZERO
	# Place player 8m away (within 10m investigate range, within vision cone).
	suit._player.global_position = Vector3(0, 0, -8)
	# Simulate detection lock.
	_simulate(suit, 0.1, 40)  # 4 seconds.
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH


func test_dread_increases_detection_range() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	# Set dread to 100 → +10m detection range bonus.
	suit._dread_composure.set_dread(100.0)
	# Place player 7m away (beyond 5m base patrol range, within 5+10=15m effective).
	suit._player.global_position = Vector3(0, 0, -7)
	_simulate(suit, 0.1, 40)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH


# --- Transition Tests ---


func test_patrol_to_approach_on_detection() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit._player.global_position = Vector3(0, 0, -3)
	# Track state change via signal.
	var detected := {"fired": false}
	suit.player_detected.connect(func(_s): detected["fired"] = true)
	# Simulate just past the 3s detection lock: the state flips to APPROACH
	# but the approach walk hasn't reached contact distance yet (that would
	# trigger relocation and the test would read RELOCATE instead).
	_simulate(suit, 0.1, 32)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH and detected["fired"]


func test_investigate_to_approach_on_detection() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.INVESTIGATE)
	suit._investigate_position = Vector3.ZERO
	suit._player.global_position = Vector3(0, 0, -5)
	_simulate(suit, 0.1, 40)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH


func test_noise_triggers_investigate() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	var heard := {"fired": false, "pos": Vector3.ZERO}
	suit.noise_heard.connect(
		func(_s, pos):
			heard["fired"] = true
			heard["pos"] = pos
	)
	# Hear a noise 3m away.
	suit.hear_noise(Vector3(3, 0, 0), 5.0)
	suit._physics_process(0.1)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.INVESTIGATE and heard["fired"]


func test_investigate_timeout_returns_to_patrol() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.force_state(Suit.State.INVESTIGATE)
	suit._investigate_position = Vector3.ZERO
	# Player far away so no detection.
	suit._player.global_position = Vector3(100, 0, 100)
	# Simulate 11 seconds (investigate wait is 10s).
	_simulate(suit, 1.0, 11)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.PATROL


# --- Relocate Tests ---


func test_approach_contact_triggers_relocate() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)], [Vector3(50, 0, 50)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	suit._last_known_player_pos = Vector3.ZERO
	# Place player at contact distance (1m).
	suit._player.global_position = Vector3(0, 0, -0.5)
	var relocated := {"fired": false}
	suit.player_relocated.connect(func(_s): relocated["fired"] = true)
	suit._physics_process(0.1)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.RELOCATE and relocated["fired"]


func test_relocate_sets_composure_to_zero() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)], [Vector3(50, 0, 50)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	suit._last_known_player_pos = Vector3.ZERO
	suit._player.global_position = Vector3(0, 0, -0.5)
	# Set composure to 50 before contact.
	suit._dread_composure.set_composure(50.0)
	suit._physics_process(0.1)
	_drop_suit(suit)
	return abs(suit._dread_composure.composure - 0.0) < 0.01


func test_relocate_teleports_player_to_safe_area() -> bool:
	var safe := Vector3(50, 0, 50)
	var suit := _make_suit([Vector3(0, 0, 0)], [safe])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	suit._last_known_player_pos = Vector3.ZERO
	suit._player.global_position = Vector3(0, 0, -0.5)
	suit._physics_process(0.1)
	_drop_suit(suit)
	return suit._player.global_position.distance_to(safe) < 0.1


# --- Search Tests ---


func test_approach_to_search_when_player_lost() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	suit._last_known_player_pos = Vector3.ZERO
	# Player is far away and "hidden" (simulate by placing very far + no detection).
	suit._player.global_position = Vector3(1000, 0, 1000)
	# Simulate enough frames for the suit to reach last_known_pos and lose the player.
	_simulate(suit, 0.1, 50)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.SEARCH


func test_search_timeout_returns_to_patrol() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.force_state(Suit.State.SEARCH)
	suit._last_known_player_pos = Vector3.ZERO
	suit._player.global_position = Vector3(1000, 0, 1000)
	# Simulate 31 seconds (search time is 30s).
	_simulate(suit, 1.0, 31)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.PATROL


func test_search_to_approach_on_redetection() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.SEARCH)
	suit._last_known_player_pos = Vector3.ZERO
	# Place player within investigate detection range, in vision cone.
	suit._player.global_position = Vector3(0, 0, -5)
	_simulate(suit, 0.1, 40)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.APPROACH


# --- Despawn Tests ---


func test_despawn_sets_idle() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.despawn()
	_drop_suit(suit)
	return suit.get_state() == Suit.State.IDLE and not suit.is_active()


# --- Hidden Player Tests ---


func test_hidden_player_undetectable() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	# Wire a PhaseManager in HIDE mode so the Suit reads _hiding = true.
	# (PhaseManager is an autoload-only name; load the script directly.)
	var pm: Node = load("res://src/core/phase_manager.gd").new()
	pm.set_mode(PhaseEnums.ModeContext.HIDE)
	suit.set_phase_manager(pm)
	# Place player 3m away (within 5m patrol range).
	suit._player.global_position = Vector3(0, 0, -3)
	# Player is not making noise (signal strength is null, velocity is zero).
	_simulate(suit, 0.1, 50)
	_drop_suit(suit)
	return suit.get_state() == Suit.State.PATROL


# --- Spawner Tests ---


func test_spawner_phase2_count() -> bool:
	var spawner := SuitSpawner.new()
	spawner.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	return spawner.get_target_count() == 1


func test_spawner_phase3_bunker_count() -> bool:
	var spawner := SuitSpawner.new()
	spawner.set_phase(PhaseEnums.Phase.PHASE_3_JOURNEY)
	spawner.set_location(3)  # Bunker = location index 3 (0-based, Location 4).
	return spawner.get_target_count() == 3


func test_spawner_phase4_zero() -> bool:
	var spawner := SuitSpawner.new()
	spawner.set_phase(PhaseEnums.Phase.PHASE_4_DESCENT)
	return spawner.get_target_count() == 0


# --- Appearance Tests ---


func test_no_shadows_on_appearance() -> bool:
	# The Suits do not cast shadows — verified via the cast_shadows export default.
	var suit := Suit.new()
	return suit.cast_shadows == false


# --- State Names Tests ---


func test_state_names_mapping() -> bool:
	return (
		Suit.STATE_NAMES[Suit.State.IDLE] == "IDLE"
		and Suit.STATE_NAMES[Suit.State.PATROL] == "PATROL"
		and Suit.STATE_NAMES[Suit.State.INVESTIGATE] == "INVESTIGATE"
		and Suit.STATE_NAMES[Suit.State.APPROACH] == "APPROACH"
		and Suit.STATE_NAMES[Suit.State.SEARCH] == "SEARCH"
		and Suit.STATE_NAMES[Suit.State.RELOCATE] == "RELOCATE"
	)


# --- Visual Stutter Tests (DEA-147) ---


func test_approach_stutter_freezes_position() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3(0, 0, 5)
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	suit._last_known_player_pos = Vector3(0, 0, 0)
	suit._player.global_position = Vector3(0, 0, 3)
	# Force the stutter window to trigger immediately.
	suit._stutter_timer = 0.0
	var pos_before := suit.global_position
	suit._physics_process(0.1)
	var jumped := suit.global_position != pos_before
	# During the freeze window, movement stops.
	var frozen_ok := true
	if suit._stutter_freeze > 0.0:
		var pos_frozen := suit.global_position
		suit._physics_process(0.05)
		frozen_ok = suit.global_position == pos_frozen
	_drop_suit(suit)
	return jumped and frozen_ok


func test_stutter_only_in_approach() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0), Vector3(10, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	# In PATROL, stutter timers must never trigger the freeze branch.
	# Two ticks: the first flips the patrol index (suit already sits on
	# waypoint 0), the second actually moves toward waypoint 1.
	suit.force_state(Suit.State.PATROL)
	suit._stutter_timer = 0.0
	var pos_before := suit.global_position
	suit._physics_process(0.1)
	suit._physics_process(0.1)
	# Patrol keeps moving toward waypoints regardless of stutter logic.
	var still_moving := suit.global_position != pos_before
	# And the freeze flag was not set.
	_drop_suit(suit)
	return still_moving and suit._stutter_freeze == 0.0
