extends Node
## Visual driver for DEA-186 hide spots. Renders the booth hiding cabinet from the
## player's eye before and after entering it, so the limited view and the HUD
## contraction have pixel evidence.
## Usage: xvfb-run godot --path godot res://tests/visual_driver_hide_spot.tscn

var _spot: Node = null
var _player: Node3D = null


func _ready() -> void:
	DirAccess.open("user://").make_dir("screenshot")
	var scene: PackedScene = load("res://scenes/station/booth.tscn")
	var room: Node = scene.instantiate()
	add_child(room)
	await get_tree().process_frame
	await get_tree().process_frame
	_spot = room.find_child("CabinetHide", true, false)
	_player = Node3D.new()
	_player.name = "DriverPlayer"
	_player.add_to_group("player")
	add_child(_player)
	_player.global_position = Vector3(0.0, 1.6, 0.6)
	var eye := Camera3D.new()
	eye.name = "EyeCam"
	add_child(eye)
	eye.global_position = Vector3(-1.6, 1.6, 0.9)
	eye.look_at(Vector3(-1.6, 1.0, -1.0))
	eye.current = true
	await get_tree().create_timer(0.6).timeout
	_snap("outside")
	var entered: bool = _spot.enter(_player) if _spot else false
	print("[Driver] entered=", entered)
	await get_tree().create_timer(0.6).timeout
	_snap("inside")
	var cam: Camera3D = _spot.view_camera if _spot else null
	var vp_cam := get_viewport().get_camera_3d()
	print("[Driver] camera=", cam != null, " current=", cam.current if cam else false, " fov=", cam.fov if cam else -1.0, " viewport_cam=", vp_cam.name if vp_cam else "none", " pos=", cam.global_position if cam else Vector3.ZERO)
	_spot.exit()
	await get_tree().create_timer(0.4).timeout
	print("[Driver] restored=", get_viewport().get_camera_3d().name if get_viewport().get_camera_3d() else "none")
	_snap("after_exit")
	get_tree().quit(0)


func _snap(label: String) -> void:
	var img := get_viewport().get_texture().get_image()
	var path := "user://screenshot/dea186_" + label + ".png"
	var err := img.save_png(path)
	print("[Driver] ", path, " err=", err)
