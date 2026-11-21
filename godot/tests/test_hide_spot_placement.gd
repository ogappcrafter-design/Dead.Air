## test_hide_spot_placement.gd — DEA-186: spots must exist in the world, not just
## in the class. Every level that ships a hiding place is loaded here and checked
## for a HideSpot instance with a live collision shape and its sound wired.
extends RefCounted

var test_name: String = "HideSpotPlacement"

const SCENES := {
	"res://scenes/station/hallway.tscn": "LockerHide",
	"res://scenes/station/bathroom.tscn": "StallHide",
	"res://scenes/station/back_office.tscn": "UnderDeskHide",
	"res://scenes/station/booth.tscn": "CabinetHide",
	"res://scenes/phase3/bunker.tscn": "BunkHide",
}


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	for path in SCENES:
		results["test_%s_has_spot" % path.get_file().get_basename()] = _scene_has_spot(path)
	results["test_spot_scene_has_sfx_and_shape"] = _spot_scene_is_complete()
	return results


func _scene_has_spot(path: String) -> bool:
	var packed: PackedScene = load(path)
	if packed == null:
		return false
	var root: Node = packed.instantiate()
	var found: Node = root.find_child(SCENES[path], true, false)
	var ok: bool = found != null and found is HideSpot and found is Area3D
	root.free()
	return ok


func _spot_scene_is_complete() -> bool:
	var packed: PackedScene = load("res://scenes/entities/hide_spot.tscn")
	if packed == null:
		return false
	var spot: Node = packed.instantiate()
	var has_shape: bool = spot.find_child("CollisionShape3D", true, false) != null
	var sfx: Node = spot.find_child("Sfx", true, false)
	var has_sfx: bool = sfx is AudioStreamPlayer3D and (sfx as AudioStreamPlayer3D).stream != null
	spot.free()
	return has_shape and has_sfx
