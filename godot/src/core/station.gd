extends Node3D

## Station root script — wires up the station scene on load:
## 1. Registers the CameraRig with CameraManager autoload.
## 2. Registers the Player with CameraManager (for tracking).
## 3. Registers all CameraZone nodes (group "camera_zone") with CameraManager.
## 4. Registers degradation and wrongness target nodes with StationState autoload.


func _ready() -> void:
	# Defer to ensure all child nodes (instanced scenes) are ready
	call_deferred("_setup_station")


func _setup_station() -> void:
	# 1. Register camera rig
	var rig: Node3D = get_node_or_null("CameraRig")
	if rig:
		CameraManager.set_rig(rig)

	# 2. Register player
	var player: Node3D = get_node_or_null("Player")
	if player:
		CameraManager.set_player(player)

	# 3. Register all camera zones via group
	for zone in get_tree().get_nodes_in_group("camera_zone"):
		CameraManager.register_zone(zone)

	# 3b. DEA-175: dress textured architecture with the PS1 geometry shader.
	PS1Geometry.dress_surfaces(self)

	# 4. Register degradation targets with StationState
	var mug: Node3D = get_node_or_null("Booth/CoffeeMug")
	var chair: Node3D = get_node_or_null("Booth/Chair")
	var second_mug: Node3D = get_node_or_null("BackOffice/SecondMug")
	var crt: Node = get_node_or_null("CRTPostProcess")

	if mug:
		StationState.register_degradation_node("coffee_mug", mug)
	if chair:
		StationState.register_degradation_node("chair", chair)
	if second_mug:
		StationState.register_degradation_node("second_mug", second_mug)
	if crt:
		StationState.register_degradation_node("crt", crt)

	# 5. Register wrongness targets with StationState
	var hallway_light: Node3D = get_node_or_null("Hallway/HallwayLight")
	var office_door: Node3D = get_node_or_null("BackOffice/OfficeDoor")

	if hallway_light:
		StationState.register_wrongness_node("hallway_light", hallway_light)
	if office_door:
		StationState.register_wrongness_node("office_door", office_door)

	# 6. Ambient motion: dust, flicker, drifting motes per room
	_setup_ambient()


## Adds an AmbientLife node to a room: warm dust motes + fluorescent flicker.
## Lights are fetched by path so each room's tubes buzz independently.
func _add_room_ambient(room_path: String, pos: Vector3, light_paths: Array,
		flicker_depth: float, particle_color: Color, amount: int,
		pulse_paths: Array = []) -> void:
	var lights: Array[Light3D] = []
	for lp in light_paths:
		var n := get_node_or_null(room_path + "/" + lp)
		if n is Light3D:
			lights.append(n)
	var a := AmbientLife.new()
	a.name = "Ambient_" + room_path.get_file()
	a.mode = AmbientLife.ParticleMode.DUST
	a.particle_color = particle_color
	a.particle_amount = amount
	a.particle_size = 0.018
	a.volume = Vector3(3.6, 2.2, 3.6)
	a.position = pos
	a.flicker_lights = lights
	a.flicker_depth = flicker_depth
	a.flicker_speed = 1.0
	for pp in pulse_paths:
		var pn := get_node_or_null(room_path + "/" + pp)
		if pn is GeometryInstance3D:
			a.pulse_targets.append(pn)
	add_child(a)


func _setup_ambient() -> void:
	var warm := Color(0.9, 0.85, 0.7, 0.22)
	var cold := Color(0.7, 0.8, 0.95, 0.2)
	# Broadcast booth: warm tungsten dust, gentle flicker.
	_add_room_ambient("Booth", Vector3(0, 1.2, 0), ["WarmLight"], 0.18, warm, 36, ["OnAirSign"])
	# Hallway: sparse cold dust, fluorescent buzz.
	_add_room_ambient("Hallway", Vector3(20, 1.2, 0), ["HallwayLight"], 0.3, cold, 30)
	# Bathroom: harsh fluorescent — deeper flicker, cooler motes.
	_add_room_ambient("Bathroom", Vector3(40, 1.2, 0), ["FluorescentLight"], 0.45, cold, 34)
	# Back office: two practicals, moderate flicker.
	_add_room_ambient("BackOffice", Vector3(60, 1.2, 0), ["DeskLamp", "RoomLight"], 0.28, warm, 34)
	# Rooftop: outdoor ash/drift, no flicker (moonlight stays steady).
	var roof := AmbientLife.for_ash()
	roof.name = "Ambient_Rooftop"
	roof.position = Vector3(80, 6.5, 0)
	roof.volume = Vector3(9, 5, 9)
	var crossbar: GeometryInstance3D = get_node_or_null("Rooftop/AntennaCrossbar")
	if crossbar != null:
		# Aircraft-warning beacon: dark housing, red glow, slow deep sweep.
		var beacon := StandardMaterial3D.new()
		beacon.albedo_color = Color(0.15, 0.02, 0.02, 1)
		beacon.emission_enabled = true
		beacon.emission = Color(1.0, 0.08, 0.04, 1)
		beacon.emission_energy_multiplier = 2.0
		crossbar.material_override = beacon
		roof.pulse_targets.append(crossbar)
		roof.pulse_depth = 0.9
		roof.pulse_speed = 0.8
	add_child(roof)
