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
