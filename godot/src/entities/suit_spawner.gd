# suit_spawner.gd — Phase-based spawn manager for The Suits (DEA-125)
# Source: GDD spawn rules + captain's intent.
#
# Spawn counts per phase:
#   Phase 2 (The Break): 1 suit, 1 encounter (Segment 2C tutorial).
#   Phase 3 Liminal Space: 2 suits, periodic.
#   Phase 3 Bunker: 3 suits, frequent.
#   Phase 4 (The Descent): 0 suits (something worse).
class_name SuitSpawner
extends Node

## Emitted when a suit is spawned.
signal suit_spawned(suit: Suit)

## Emitted when all suits are despawned (e.g. on phase change to Phase 4).
signal all_despawned

## Phase → number of suits to spawn.
const PHASE_SUIT_COUNT: Dictionary = {
	PhaseEnums.Phase.PHASE_1_STATION: 0,
	PhaseEnums.Phase.PHASE_2_BREAK: 1,
	PhaseEnums.Phase.PHASE_3_JOURNEY: 2,  # Phase 3 base; Bunker location override raises to 3.
	PhaseEnums.Phase.PHASE_4_DESCENT: 0,
}

## Bunker location override: 3 suits when in the Bunker (Phase 3, Location 4).
const BUNKER_SUIT_COUNT: int = 3

## Currently active suits.
var _active_suits: Array[Suit] = []

## Reference to the PhaseManager autoload.
var _phase_manager: Node = null

## Reference to DreadComposure for aggregated entity_nearby/hiding_detected flags.
var _dread_composure: DreadComposure = null

## Reference to SignalStrength for entity-count-driven signal drain.
var _signal_strength: Node = null

## Current phase (cached from PhaseManager).
var _current_phase: int = PhaseEnums.Phase.PHASE_1_STATION

## Current location index within Phase 3 (0-4). Location 4 = Bunker.
var _current_location: int = 0


func _ready() -> void:
	_phase_manager = get_tree().root.get_node_or_null("/root/PhaseManager")
	if _phase_manager != null and _phase_manager.has_signal("phase_changed"):
		_phase_manager.phase_changed.connect(_on_phase_changed)
	_dread_composure = _find_dread_composure()


func _find_dread_composure() -> DreadComposure:
	var root := get_tree().current_scene
	if root == null:
		root = get_tree().root
	if root == null:
		return null
	return _find_node_recursive(root) as DreadComposure


func _find_node_recursive(node: Node) -> Node:
	if node.is_class("DreadComposure") or node.get_class() == "DreadComposure":
		return node
	if node.has_method("get_script") and node.get_script() != null:
		var script = node.get_script()
		if script.has_method("get_global_name") and script.get_global_name() == "DreadComposure":
			return node
	for child in node.get_children():
		var found = _find_node_recursive(child)
		if found != null:
			return found
	return null


func _physics_process(_delta: float) -> void:
	if _dread_composure == null and not _active_suits.is_empty():
		for suit in _active_suits:
			if suit != null and is_instance_valid(suit):
				_dread_composure = suit.get_dread_composure()
				if _dread_composure != null:
					break
	if _dread_composure == null:
		return
	# Resolve SignalStrength from first active suit (same pattern as DreadComposure).
	if _signal_strength == null and not _active_suits.is_empty():
		for suit in _active_suits:
			if suit != null and is_instance_valid(suit):
				_signal_strength = suit.get_signal_strength()
				if _signal_strength != null:
					break
	var any_nearby := false
	var any_hiding := false
	var nearby_count := 0
	for suit in _active_suits:
		if suit == null or not is_instance_valid(suit):
			continue
		if not suit.is_active():
			continue
		if suit.is_entity_nearby():
			any_nearby = true
			nearby_count += 1
		if suit.is_hiding_detected():
			any_hiding = true
	_dread_composure.entity_nearby = any_nearby
	_dread_composure.hiding_detected = any_hiding
	# Drive signal drain: entity count = number of suits in APPROACH within range.
	if _signal_strength != null and _signal_strength.has_method("set_entity_count"):
		_signal_strength.set_entity_count(nearby_count)


## Returns the number of suits that should be active for the current phase/location.
func get_target_count(phase: int = _current_phase, location: int = _current_location) -> int:
	if phase == PhaseEnums.Phase.PHASE_4_DESCENT:
		return 0
	if phase == PhaseEnums.Phase.PHASE_3_JOURNEY and location == 3:
		return BUNKER_SUIT_COUNT  # Bunker = 3 suits.
	return PHASE_SUIT_COUNT.get(phase, 0)


## Spawns the configured number of suits for the current phase.
## Each suit_scene is instantiated and added as a child of this spawner.
func spawn_for_phase(
	suit_scene: PackedScene, patrol_sets: Array = [], safe_areas: Array[Vector3] = []
) -> Array[Suit]:
	# Despawn existing suits first.
	despawn_all()
	var count := get_target_count()
	var spawned: Array[Suit] = []
	for i in range(count):
		var suit := suit_scene.instantiate() as Suit
		if suit == null:
			push_error("SuitSpawner: suit_scene did not instantiate a Suit")
			continue
		add_child(suit)
		# Assign patrol points if provided.
		if i < patrol_sets.size():
			suit.set_patrol_points(patrol_sets[i])
		# Assign safe areas for relocation.
		if not safe_areas.is_empty():
			suit.set_safe_areas(safe_areas)
		suit.spawn_at(0)
		spawned.append(suit)
		suit_spawned.emit(suit)
	_active_suits = spawned
	return spawned


## Despawns all active suits (e.g. when entering Phase 4).
func despawn_all() -> void:
	for suit in _active_suits:
		if suit != null and is_instance_valid(suit):
			suit.despawn()
			suit.queue_free()
	_active_suits.clear()
	# Reset signal drain: no suits nearby.
	if _signal_strength != null and _signal_strength.has_method("set_entity_count"):
		_signal_strength.set_entity_count(0)
	all_despawned.emit()


## Returns the list of currently active suits.
func get_active_suits() -> Array[Suit]:
	return _active_suits


## Sets the current location index (called by level transitions in Phase 3).
func set_location(location_index: int) -> void:
	_current_location = location_index


## Returns the current phase.
func get_current_phase() -> int:
	return _current_phase


## Phase change handler — adjust suit count on phase transitions.
func _on_phase_changed(_old_phase: int, new_phase: int) -> void:
	_current_phase = new_phase
	if new_phase == PhaseEnums.Phase.PHASE_4_DESCENT:
		# Phase 4: no suits (something worse).
		despawn_all()


## Set the current phase directly (for testing without PhaseManager autoload).
func set_phase(phase: int) -> void:
	_current_phase = phase


## Set DreadComposure reference (for testing / manual wiring).
func set_dread_composure(dc: DreadComposure) -> void:
	_dread_composure = dc
