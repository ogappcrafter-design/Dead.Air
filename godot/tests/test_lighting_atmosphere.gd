class_name TestLightingAtmosphere
extends Node

## Test suite for DEA-178: Per-location lighting and atmosphere pass (fog, practicals, exposure)
## Verifies:
## 1. All station and phase scenes have a configured WorldEnvironment.
## 2. WorldEnvironment features: fog enabled with density, tonemap set to Filmic/ACES,
##    restrained glow enabled, and proper exposure.
## 3. Playable darkness budget (ambient light energy >= 0.5, no pitch-black rooms).
## 4. Practical lights exist in all locations with shadow casting enabled.
## 5. Color temperature distinctness across rooms and exterior phases.
## 6. Accessibility reduce-horror mode applies ambient boost, fog reduction, and clean restore.

const SCENE_PATHS: Array[String] = [
	"res://scenes/station/station.tscn",
	"res://scenes/station/booth.tscn",
	"res://scenes/station/hallway.tscn",
	"res://scenes/station/bathroom.tscn",
	"res://scenes/station/back_office.tscn",
	"res://scenes/station/rooftop.tscn",
	"res://scenes/phase2/threshold.tscn",
	"res://scenes/phase2/first_house.tscn",
	"res://scenes/phase2/follower.tscn",
	"res://scenes/phase2/static_sky.tscn",
	"res://scenes/phase3/highway.tscn",
	"res://scenes/phase3/neighborhood.tscn",
	"res://scenes/phase3/bunker.tscn",
	"res://scenes/phase3/liminal_space.tscn",
	"res://scenes/phase4/clearing.tscn",
	"res://scenes/phase4/staircase.tscn",
	"res://scenes/phase4/chamber.tscn",
]

var test_name: String = "LightingAtmosphere"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_all_scenes_have_world_environment"] = _test_all_scenes_have_world_environment()
	results["test_world_environments_have_required_features"] = _test_world_environments_have_required_features()
	results["test_darkness_budget_and_navigation"] = _test_darkness_budget_and_navigation()
	results["test_practical_lights_and_shadows"] = _test_practical_lights_and_shadows()
	results["test_color_temperature_distinctness"] = _test_color_temperature_distinctness()
	results["test_reduce_horror_atmosphere_modifiers"] = _test_reduce_horror_atmosphere_modifiers()
	results["test_accessibility_manager_reduce_horror_integration"] = _test_accessibility_manager_reduce_horror_integration()
	return results


func _find_node_by_type(node: Node, type_name: String) -> Node:
	if node.get_class() == type_name or (node.get_script() != null and node.get_script().get_global_name() == type_name):
		return node
	for child in node.get_children():
		var found := _find_node_by_type(child, type_name)
		if found != null:
			return found
	return null


func _find_all_lights(node: Node, out_lights: Array) -> void:
	if node is Light3D:
		out_lights.append(node)
	for child in node.get_children():
		_find_all_lights(child, out_lights)


# ─── Tests ────────────────────────────────────────────────────────────


func _test_all_scenes_have_world_environment() -> bool:
	for path in SCENE_PATHS:
		var scene: PackedScene = load(path)
		if scene == null:
			printerr("Failed to load scene: ", path)
			return false
		var inst: Node = scene.instantiate()
		var we := _find_node_by_type(inst, "WorldEnvironment") as WorldEnvironment
		if we == null or we.environment == null:
			printerr("Missing WorldEnvironment in: ", path)
			inst.queue_free()
			return false
		inst.queue_free()
	return true


func _test_world_environments_have_required_features() -> bool:
	for path in SCENE_PATHS:
		var scene: PackedScene = load(path)
		var inst: Node = scene.instantiate()
		var we := _find_node_by_type(inst, "WorldEnvironment") as WorldEnvironment
		if we != null and we.environment != null:
			var env := we.environment
			var has_fog := env.fog_enabled and env.fog_density > 0.0
			var has_glow := env.glow_enabled and env.glow_intensity > 0.0
			var has_tonemap := env.tonemap_mode == Environment.TONE_MAPPER_FILMIC or env.tonemap_mode == Environment.TONE_MAPPER_ACES
			var has_exposure := env.tonemap_exposure >= 1.0
			if not (has_fog and has_glow and has_tonemap and has_exposure):
				printerr("Invalid WE features in %s: fog=%s, glow=%s, tonemap=%s, exposure=%.2f" % [
					path.get_file(), str(has_fog), str(has_glow), str(has_tonemap), env.tonemap_exposure
				])
				inst.queue_free()
				return false
		inst.queue_free()
	return true


func _test_darkness_budget_and_navigation() -> bool:
	for path in SCENE_PATHS:
		var scene: PackedScene = load(path)
		var inst: Node = scene.instantiate()
		var we := _find_node_by_type(inst, "WorldEnvironment") as WorldEnvironment
		if we != null and we.environment != null:
			var env := we.environment
			var energy_ok := env.ambient_light_energy >= 0.5
			var color_not_pitch_black := (env.ambient_light_color.r + env.ambient_light_color.g + env.ambient_light_color.b) > 0.08
			if not (energy_ok and color_not_pitch_black):
				printerr("Under darkness budget in %s: energy=%.2f, color=%s" % [
					path.get_file(), env.ambient_light_energy, str(env.ambient_light_color)
				])
				inst.queue_free()
				return false
		inst.queue_free()
	return true


func _test_practical_lights_and_shadows() -> bool:
	for path in SCENE_PATHS:
		if path.ends_with("station.tscn"):
			continue
		var scene: PackedScene = load(path)
		var inst: Node = scene.instantiate()
		var lights: Array = []
		_find_all_lights(inst, lights)
		var has_shadow_light := false
		for l in lights:
			if (l as Light3D).shadow_enabled:
				has_shadow_light = true
				break
		if not has_shadow_light or lights.is_empty():
			printerr("No shadow light found in: ", path.get_file())
			inst.queue_free()
			return false
		inst.queue_free()
	return true


func _test_color_temperature_distinctness() -> bool:
	var booth_scene: PackedScene = load("res://scenes/station/booth.tscn")
	var hall_scene: PackedScene = load("res://scenes/station/hallway.tscn")
	var bath_scene: PackedScene = load("res://scenes/station/bathroom.tscn")
	var roof_scene: PackedScene = load("res://scenes/station/rooftop.tscn")

	var booth_inst: Node = booth_scene.instantiate()
	var hall_inst: Node = hall_scene.instantiate()
	var bath_inst: Node = bath_scene.instantiate()
	var roof_inst: Node = roof_scene.instantiate()

	var booth_env: Environment = (_find_node_by_type(booth_inst, "WorldEnvironment") as WorldEnvironment).environment
	var hall_env: Environment = (_find_node_by_type(hall_inst, "WorldEnvironment") as WorldEnvironment).environment
	var bath_env: Environment = (_find_node_by_type(bath_inst, "WorldEnvironment") as WorldEnvironment).environment
	var roof_env: Environment = (_find_node_by_type(roof_inst, "WorldEnvironment") as WorldEnvironment).environment

	var booth_warm := booth_env.ambient_light_color.r > booth_env.ambient_light_color.b
	var hall_cool := hall_env.ambient_light_color.b > hall_env.ambient_light_color.r
	var bath_green := bath_env.ambient_light_color.g >= bath_env.ambient_light_color.r
	var roof_indigo := roof_env.ambient_light_color.b > roof_env.ambient_light_color.r

	booth_inst.queue_free()
	hall_inst.queue_free()
	bath_inst.queue_free()
	roof_inst.queue_free()

	return booth_warm and hall_cool and bath_green and roof_indigo


func _test_reduce_horror_atmosphere_modifiers() -> bool:
	var base_ambient := 0.75
	var base_fog := 0.02

	var mods_off := VisualAccessibilityController.compute_atmosphere_mods(base_ambient, base_fog, false)
	if mods_off["active"] != false or mods_off["ambient_energy"] != base_ambient or mods_off["fog_density"] != base_fog:
		return false

	var mods_on := VisualAccessibilityController.compute_atmosphere_mods(base_ambient, base_fog, true)
	if mods_on["active"] != true or mods_on["ambient_energy"] <= base_ambient or mods_on["fog_density"] >= base_fog:
		return false

	var env := Environment.new()
	env.ambient_light_energy = base_ambient
	env.fog_density = base_fog
	env.tonemap_exposure = 1.0

	VisualAccessibilityController.apply_atmosphere_to_environment(env, true)
	if env.ambient_light_energy < 0.85 or env.fog_density >= base_fog or env.tonemap_exposure <= 1.0:
		return false

	VisualAccessibilityController.apply_atmosphere_to_environment(env, false)
	if not is_equal_approx(env.ambient_light_energy, base_ambient) or not is_equal_approx(env.fog_density, base_fog) or not is_equal_approx(env.tonemap_exposure, 1.0):
		return false

	return true


func _test_accessibility_manager_reduce_horror_integration() -> bool:
	if not AccessibilityManager:
		return false

	var orig_state: bool = AccessibilityManager.reduce_audio_horror
	AccessibilityManager.set_reduce_horror(true)
	var on_ok := AccessibilityManager.reduce_horror and AccessibilityManager.reduce_audio_horror

	AccessibilityManager.set_reduce_horror(false)
	var off_ok := (not AccessibilityManager.reduce_horror) and (not AccessibilityManager.reduce_audio_horror)

	AccessibilityManager.set_reduce_horror(orig_state)
	return on_ok and off_ok
