extends Node
## AudioBusManager — minimal autoload for bus routing helpers.
## Fills the DEA-134 gap: project.godot references this file but it didn't exist.

const RADIO_AMBIENT_BUS := "RADIO_AMBIENT"


static func get_bus_index(bus_name: String) -> int:
	return AudioServer.get_bus_index(bus_name)


static func set_bus_volume_db(bus_name: String, volume_db: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx >= 0:
		AudioServer.set_bus_volume_db(idx, volume_db)


static func get_bus_volume_db(bus_name: String) -> float:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx >= 0:
		return AudioServer.get_bus_volume_db(idx)
	return 0.0


static func set_bus_mute(bus_name: String, muted: bool) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx >= 0:
		AudioServer.set_bus_mute(idx, muted)


static func is_bus_muted(bus_name: String) -> bool:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx >= 0:
		return AudioServer.is_bus_mute(idx)
	return false
