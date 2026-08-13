## test_night_integration.gd
## Integration test for night_shift.tscn scene wiring.
## Verifies all systems are present and properly connected.
## Pattern: extends RefCounted, run_tests() returns Dictionary of {test_name: bool}
extends RefCounted

var test_name: String = "night_integration"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_scene_loads"] = test_scene_loads()
	results["test_station_present"] = test_station_present()
	results["test_radio_console_present"] = test_radio_console_present()
	results["test_hud_present"] = test_hud_present()
	results["test_shift_stub_present"] = test_shift_stub_present()
	results["test_degradation_stub_present"] = test_degradation_stub_present()
	results["test_game_director_present"] = test_game_director_present()
	results["test_director_has_wiring_method"] = test_director_has_wiring_method()
	results["test_autoloads_available"] = test_autoloads_available()
	results["test_scene_tree_structure"] = test_scene_tree_structure()
	return results


# --- Individual Tests ---


func test_scene_loads() -> bool:
	var scene: PackedScene = _load_night_shift()
	return scene != null


func test_station_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var station: Node = instance.get_node_or_null("StationEnvironment")
	var valid: bool = station != null
	instance.queue_free()
	return valid


func test_radio_console_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var radio: Node = instance.get_node_or_null("RadioConsole")
	var valid: bool = radio != null
	instance.queue_free()
	return valid


func test_hud_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var hud: Node = instance.get_node_or_null("HUD")
	var valid: bool = hud != null and hud is Control
	instance.queue_free()
	return valid


func test_shift_stub_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var stub: Node = instance.get_node_or_null("ShiftController")
	var valid: bool = stub != null and stub.has_method("start_shift")
	instance.queue_free()
	return valid


func test_degradation_stub_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var stub: Node = instance.get_node_or_null("StationDegradation")
	var valid: bool = stub != null and stub.has_method("set_degradation")
	instance.queue_free()
	return valid


func test_game_director_present() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var director: Node = instance.get_node_or_null("GameDirector")
	var valid: bool = director != null and director.has_method("start_night_shift")
	instance.queue_free()
	return valid


func test_director_has_wiring_method() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	var director: Node = instance.get_node_or_null("GameDirector")
	if director == null:
		instance.queue_free()
		return false
	var has_api: bool = (
		director.has_method("is_wiring_complete")
		and director.has_method("start_night_shift")
		and director.has_method("end_night_shift")
	)
	if not has_api:
		instance.queue_free()
		return false
	director.start_night_shift(3)
	var shift_ok: bool = director.get_shift_number() == 3
	instance.queue_free()
	return shift_ok


func test_autoloads_available() -> bool:
	# Verify key autoloads are registered
	var call_mgr: Node = get_node_or_null("/root/CallManager")
	var phase_mgr: Node = get_node_or_null("/root/PhaseManager")
	var save_mgr: Node = get_node_or_null("/root/SaveManager")
	var tape_inv: Node = get_node_or_null("/root/TapeInventory")
	var abm: Node = get_node_or_null("/root/AudioBusManager")
	return (
		call_mgr != null
		and phase_mgr != null
		and save_mgr != null
		and tape_inv != null
		and abm != null
	)


func test_scene_tree_structure() -> bool:
	var scene: PackedScene = _load_night_shift()
	if scene == null:
		return false
	var instance: Node = scene.instantiate()
	if instance == null:
		return false
	# Verify root is Node3D
	var valid: bool = instance is Node3D
	# Verify expected children exist
	var expected: Array[String] = ["StationEnvironment", "RadioConsole", "HUD", "GameDirector"]
	for child_name in expected:
		if instance.get_node_or_null(child_name) == null:
			valid = false
			break
	instance.queue_free()
	return valid


# --- Helpers ---


func _load_night_shift() -> PackedScene:
	return _load_night_shift()


func get_node_or_null(path: String) -> Node:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		return tree.root.get_node_or_null(path)
	return null
