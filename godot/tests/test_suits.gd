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
	return results


## Build a Suit with deterministic state for testing.
func _make_suit(patrol_points: Array[Vector3] = [], safe_areas: Array[Vector3] = []) -> Suit:
	var suit := Suit.new()
	suit.name = "TestSuit"
	suit.set_rng_seed(42)
	if not patrol_points.is_empty():
		suit.set_patrol_points(patrol_points)
	if not safe_areas.is_empty():
		suit.set_safe_areas(safe_areas)
	# Fake player node for detection tests.
	var player := CharacterBody3D.new()
	player.name = "Player"
	player.global_position = Vector3(100, 0, 100)  # Far away by default.
	player.add_to_group("player")
	suit.set_player(player)
	# DreadComposure for composure/relocate tests.
	var dc := DreadComposure.new()
	dc.set_rng_seed(42)
	suit.set_dread_composure(dc)
	return suit


## Simulate physics processing for a suit without adding it to the scene tree.
func _simulate(suit: Suit, delta: float, frames: int = 1) -> void:
	for i in range(frames):
		suit._physics_process(delta)


# --- State Machine Tests ---


func test_initial_state_idle() -> bool:
	var suit := _make_suit()
	# Without patrol points, _ready doesn't auto-start patrol. But we're not
	# in the scene tree, so _ready isn't called. Initial state is IDLE.
	return suit.get_state() == Suit.State.IDLE


func test_spawn_at_sets_patrol() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0), Vector3(5, 0, 0)])
	suit.spawn_at(0)
	return suit.get_state() == Suit.State.PATROL and suit.is_active()


func test_patrol_cycles_waypoints() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0), Vector3(3, 0, 0)])
	suit.spawn_at(0)
	# Move toward second waypoint — simulate enough frames to reach it.
	_simulate(suit, 0.1, 100)
	# Should have moved from (0,0,0) toward (3,0,0), then cycle back.
	var pos := suit.global_position
	return pos.distance_to(Vector3(3, 0, 0)) < 1.0 or pos.distance_to(Vector3(0, 0, 0)) < 1.0


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
	_simulate(suit, 0.1, 40)
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
	return suit.get_state() == Suit.State.APPROACH


# --- Despawn Tests ---


func test_despawn_sets_idle() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.despawn()
	return suit.get_state() == Suit.State.IDLE and not suit.is_active()


# --- Hidden Player Tests ---


func test_hidden_player_undetectable() -> bool:
	var suit := _make_suit([Vector3(0, 0, 0)])
	suit.spawn_at(0)
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	# Wire a PhaseManager in HIDE mode so the Suit reads _hiding = true.
	var pm := PhaseManager.new()
	pm.set_mode(PhaseEnums.ModeContext.HIDE)
	suit.set_phase_manager(pm)
	# Place player 3m away (within 5m patrol range).
	suit._player.global_position = Vector3(0, 0, -3)
	# Player is not making noise (signal strength is null, velocity is zero).
	_simulate(suit, 0.1, 50)
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
