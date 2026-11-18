extends RefCounted

# ============================================================================
# Test Suite: AmbientLife — drifting particles, light flicker, emissive pulse
# Verifies the ambient motion layer that keeps scenes from reading static.
# ============================================================================

var test_name: String = "AmbientLife"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_script_loads"] = test_script_loads()
	results["test_presets_configure_modes"] = test_presets_configure_modes()
	results["test_particles_node_created"] = await test_particles_node_created()
	results["test_flicker_modulates_light"] = await test_flicker_modulates_light()
	results["test_follow_target_moves_node"] = await test_follow_target_moves_node()
	results["test_world_space_particles_when_following"] = await test_world_space_particles_when_following()
	return results


func test_script_loads() -> bool:
	return AmbientLife != null


func test_presets_configure_modes() -> bool:
	var interior := AmbientLife.for_interior()
	var liminal := AmbientLife.for_liminal()
	var ash := AmbientLife.for_ash()
	var static_p := AmbientLife.for_static()
	if interior.mode != AmbientLife.ParticleMode.DUST: return false
	if liminal.mode != AmbientLife.ParticleMode.FOG: return false
	if ash.mode != AmbientLife.ParticleMode.ASH: return false
	if static_p.mode != AmbientLife.ParticleMode.STATIC: return false
	if interior.particle_amount <= 0 or ash.particle_amount <= interior.particle_amount: return false
	interior.free(); liminal.free(); ash.free(); static_p.free()
	return true


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


func test_particles_node_created() -> bool:
	var a := AmbientLife.for_interior()
	_tree().root.add_child(a)
	await _tree().process_frame
	await _tree().process_frame
	var p := a.get_node_or_null("AmbientParticles")
	var ok := p is GPUParticles3D and p.process_material is ParticleProcessMaterial
	if ok:
		var pm := p.process_material as ParticleProcessMaterial
		ok = pm.emission_shape == ParticleProcessMaterial.EMISSION_SHAPE_BOX
	a.queue_free()
	return ok


func test_flicker_modulates_light() -> bool:
	var light := OmniLight3D.new()
	light.light_energy = 2.0
	_tree().root.add_child(light)
	var a := AmbientLife.new()
	a.mode = AmbientLife.ParticleMode.DUST
	a.flicker_lights = [light]
	a.flicker_depth = 1.0
	a.flicker_speed = 4.0
	_tree().root.add_child(a)
	var lo := 999.0
	var hi := -1.0
	for i in range(40):
		await _tree().process_frame
		lo = minf(lo, light.light_energy)
		hi = maxf(hi, light.light_energy)
	var varied := hi - lo > 0.2
	light.queue_free()
	a.queue_free()
	return varied


func test_follow_target_moves_node() -> bool:
	var target := Node3D.new()
	target.name = "FollowTarget"
	_tree().root.add_child(target)
	target.global_position = Vector3(0, 0, 0)
	var a := AmbientLife.for_ash()
	a.follow_target = target
	a.follow_height = 0.0
	a.follow_lerp = 10.0
	_tree().root.add_child(a)
	for i in range(3):
		await _tree().process_frame
	target.global_position = Vector3(10, 0, 0)
	for i in range(40):
		await _tree().process_frame
	var moved := a.global_position.x > 5.0
	target.queue_free()
	a.queue_free()
	return moved


func test_world_space_particles_when_following() -> bool:
	var target := Node3D.new()
	_tree().root.add_child(target)
	var a := AmbientLife.for_ash()
	a.follow_target = target
	_tree().root.add_child(a)
	await _tree().process_frame
	await _tree().process_frame
	var p := a.get_node_or_null("AmbientParticles") as GPUParticles3D
	var ok := p != null and not p.local_coords
	target.queue_free()
	a.queue_free()
	return ok
