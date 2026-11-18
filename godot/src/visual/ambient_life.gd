class_name AmbientLife
extends Node3D

## Ambient motion layer for a scene: drifting particles, flickering lights,
## and pulsing emissive surfaces. Drop into any scene (or add_child from a
## segment script) and tune the exports to the mood.
##
## This is what keeps a textured diorama from reading as a static photo:
## dust motes drift through light, fluorescents buzz and drop out, and
## emissive signs breathe.

enum ParticleMode { DUST, FOG, ASH, STATIC }

@export var mode: ParticleMode = ParticleMode.DUST
@export var volume := Vector3(8.0, 3.0, 8.0)   # emission box extents (full size)
@export var particle_color := Color(0.75, 0.8, 0.9, 0.28)
@export var particle_amount := 48
@export var particle_size := 0.02
@export var particle_lifetime := 9.0
@export var drift := Vector3(0.04, 0.015, 0.04)
@export var turbulence := 0.4

@export var flicker_lights: Array[Light3D] = []
@export var flicker_depth := 0.3        # 0 = steady, 1 = full dropout
@export var flicker_speed := 1.0

@export var pulse_targets: Array[GeometryInstance3D] = []
@export var pulse_depth := 0.25
@export var pulse_speed := 1.5

## Optional node to follow (usually the player): the particle volume recentres
## on it each frame so ambient motes exist wherever the player goes.
@export var follow_target: Node3D = null
@export var follow_height := 1.2
@export var follow_lerp := 4.0

var _base_light_energy: Dictionary = {}
var _base_emission: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _next_dropout := 0.0
var _dropout_until := 0.0
var _t := 0.0


func _ready() -> void:
	_rng.randomize()
	_build_particles()
	for light in flicker_lights:
		if is_instance_valid(light):
			_base_light_energy[light] = light.light_energy
	for target in pulse_targets:
		if is_instance_valid(target):
			var mat := _emissive_material(target)
			if mat != null:
				_base_emission[target] = mat.emission_energy_multiplier


func _process(delta: float) -> void:
	_t += delta
	if follow_target == null:
		# Lazy-acquire the player so segments only need add_child(AmbientLife...).
		follow_target = get_tree().get_first_node_in_group("player") as Node3D
	if follow_target != null and is_instance_valid(follow_target):
		var goal := follow_target.global_position + Vector3(0.0, follow_height, 0.0)
		global_position = global_position.lerp(goal, min(follow_lerp * delta, 1.0))
	_update_flicker()
	_update_pulse()


# --- particles -------------------------------------------------------------

func _build_particles() -> void:
	var p := GPUParticles3D.new()
	p.name = "AmbientParticles"
	p.amount = particle_amount
	p.lifetime = particle_lifetime
	p.local_coords = false
	p.visibility_aabb = AABB(-volume * 0.5 - Vector3.ONE, volume + Vector3.ONE * 2.0)

	var mat := ParticleProcessMaterial.new()
	mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	mat.emission_box_extents = volume * 0.5
	mat.direction = Vector3(0, 1, 0)
	mat.spread = 180.0
	mat.initial_velocity_min = 0.0
	mat.initial_velocity_max = _speed()
	mat.gravity = Vector3.ZERO
	mat.scale_min = _size_scale()
	mat.scale_max = _size_scale() * 1.6
	mat.color = particle_color
	# Linear drag so particles ease to a stop instead of drifting forever.
	mat.damping_min = 0.1
	mat.damping_max = 0.3
	# Organic wander.
	mat.turbulence_enabled = true
	mat.turbulence_noise_strength = turbulence
	mat.turbulence_noise_scale = 2.5
	mat.turbulence_noise_speed_random = 0.3
	mat.turbulence_influence_min = 0.05
	mat.turbulence_influence_max = 0.15
	# Fade in and out over the lifetime.
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 0))
	grad.set_color(1, Color(1, 1, 1, 0))
	grad.add_point(0.25, Color(1, 1, 1, 1))
	grad.add_point(0.75, Color(1, 1, 1, 1))
	var ramp := GradientTexture1D.new()
	ramp.gradient = grad
	mat.color_ramp = ramp
	p.process_material = mat

	var draw := _particle_draw_material()
	p.draw_pass_1 = draw
	add_child(p)


func _particle_draw_material() -> Mesh:
	# A soft round sprite built from a quad + radial-gradient texture would
	# need an asset; a tiny emissive sphere reads as a mote in the dark and
	# needs no texture. Scale is driven by the process material.
	var sphere := SphereMesh.new()
	sphere.radius = particle_size
	sphere.height = particle_size * 2.0
	sphere.radial_segments = 8
	sphere.rings = 4
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = particle_color
	m.emission_enabled = true
	m.emission = particle_color
	m.emission_energy_multiplier = 0.6
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	sphere.material = m
	return sphere


func _speed() -> float:
	match mode:
		ParticleMode.FOG: return 0.02
		ParticleMode.ASH: return 0.08
		ParticleMode.STATIC: return 0.15
		_: return 0.05


func _size_scale() -> float:
	match mode:
		ParticleMode.FOG: return particle_size * 4.0
		ParticleMode.ASH: return particle_size * 1.5
		ParticleMode.STATIC: return particle_size * 0.8
		_: return particle_size


# --- flicker ---------------------------------------------------------------

func _update_flicker() -> void:
	if flicker_lights.is_empty() or flicker_depth <= 0.0:
		return
	# Occasional hard dropout: a fluorescent stutters, then recovers.
	if _t >= _next_dropout:
		_next_dropout = _t + _rng.randf_range(2.0, 9.0) / max(flicker_speed, 0.1)
		_dropout_until = _t + _rng.randf_range(0.03, 0.18)
	var dropping := _t < _dropout_until
	for light in flicker_lights:
		if not is_instance_valid(light):
			continue
		var base: float = _base_light_energy.get(light, light.light_energy)
		if dropping:
			light.light_energy = base * (1.0 - flicker_depth) * _rng.randf_range(0.1, 0.6)
		else:
			# Layered sines stand in for a cheap noise flicker.
			var seed := float(light.get_instance_id() % 97)
			var n := sin(_t * 37.0 * flicker_speed + seed)
			n += 0.5 * sin(_t * 91.0 * flicker_speed + seed * 1.7)
			n += 0.25 * sin(_t * 7.3 * flicker_speed)
			var dip := clampf(0.5 + 0.5 * n, 0.0, 1.0)
			light.light_energy = base * (1.0 - flicker_depth * (1.0 - dip) * 0.6)


# --- emissive pulse --------------------------------------------------------

func _update_pulse() -> void:
	if pulse_targets.is_empty() or pulse_depth <= 0.0:
		return
	for target in pulse_targets:
		if not is_instance_valid(target):
			continue
		var mat := _emissive_material(target)
		if mat == null:
			continue
		var base: float = _base_emission.get(target, mat.emission_energy_multiplier)
		var phase := float(target.get_instance_id() % 100) * 0.37
		var wave := 0.5 + 0.5 * sin(_t * pulse_speed + phase)
		mat.emission_energy_multiplier = base * (1.0 - pulse_depth + pulse_depth * wave)


func _emissive_material(target: GeometryInstance3D) -> StandardMaterial3D:
	# Prefer an override material, else the first surface material that is
	# emissive. Returns null when nothing pulses.
	if target.material_override is StandardMaterial3D:
		var ov := target.material_override as StandardMaterial3D
		if ov.emission_enabled:
			return ov
	if target.mesh != null:
		for i in target.mesh.get_surface_count():
			var sm: Material = target.get_active_material(i)
			if sm is StandardMaterial3D and (sm as StandardMaterial3D).emission_enabled:
				return sm
	return null


# --- presets ----------------------------------------------------------------

## Fluorescent office/station: warm dust + buzzing tube.
static func for_interior(lights: Array[Light3D] = []) -> AmbientLife:
	var a := AmbientLife.new()
	a.mode = ParticleMode.DUST
	a.particle_color = Color(0.9, 0.85, 0.7, 0.22)
	a.particle_amount = 40
	a.particle_size = 0.018
	a.volume = Vector3(7, 3, 7)
	a.flicker_lights = lights
	a.flicker_depth = 0.35
	a.flicker_speed = 1.0
	return a


## Liminal space: cold drifting fog, slow and thick.
static func for_liminal() -> AmbientLife:
	var a := AmbientLife.new()
	a.mode = ParticleMode.FOG
	a.particle_color = Color(0.5, 0.6, 0.7, 0.10)
	a.particle_amount = 90
	a.particle_size = 0.06
	a.particle_lifetime = 14.0
	a.volume = Vector3(14, 5, 14)
	a.flicker_depth = 0.0
	return a


## Ash / dead air outdoors: grey motes falling slowly.
static func for_ash() -> AmbientLife:
	var a := AmbientLife.new()
	a.mode = ParticleMode.ASH
	a.particle_color = Color(0.55, 0.55, 0.6, 0.3)
	a.particle_amount = 120
	a.particle_size = 0.015
	a.particle_lifetime = 11.0
	a.volume = Vector3(16, 8, 16)
	a.flicker_depth = 0.0
	return a


## Radio static burst: fast tiny sparks for signal/decode moments.
static func for_static(volume_size: Vector3 = Vector3(4, 2, 4)) -> AmbientLife:
	var a := AmbientLife.new()
	a.mode = ParticleMode.STATIC
	a.particle_color = Color(0.7, 0.9, 1.0, 0.5)
	a.particle_amount = 160
	a.particle_size = 0.008
	a.particle_lifetime = 0.6
	a.volume = volume_size
	a.flicker_depth = 0.0
	return a


## Neon / sign glow: pulsing emissive targets, minimal particles.
static func for_neon(pulse: Array[GeometryInstance3D]) -> AmbientLife:
	var a := AmbientLife.new()
	a.mode = ParticleMode.DUST
	a.particle_amount = 12
	a.particle_color = Color(1.0, 0.6, 0.3, 0.15)
	a.particle_size = 0.02
	a.volume = Vector3(6, 3, 6)
	a.pulse_targets = pulse
	a.pulse_depth = 0.4
	a.pulse_speed = 2.2
	return a
