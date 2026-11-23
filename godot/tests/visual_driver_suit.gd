extends Node
## visual_driver_suit.gd — Visual driver capturing screenshot evidence for DEA-180.
## Captures readable silhouette of The Suit in low light across:
##   1. Station Broadcast Booth (res://screenshot/dea180_suit_booth.png)
##   2. Station Hallway (res://screenshot/dea180_suit_hallway.png)
##   3. Phase 3 Bunker (res://screenshot/dea180_suit_bunker.png)

var _stages: Array[Dictionary] = [
	{
		"name": "booth",
		"scene": "res://scenes/station/booth.tscn",
		"suit_pos": Vector3(0.0, 0.0, -1.8),
		"cam_pos": Vector3(0.0, 1.4, 1.2),
		"state": Suit.State.PATROL,
		"out": "res://screenshot/dea180_suit_booth.png"
	},
	{
		"name": "hallway",
		"scene": "res://scenes/station/hallway.tscn",
		"suit_pos": Vector3(0.0, 0.0, -2.5),
		"cam_pos": Vector3(0.0, 1.4, 1.5),
		"state": Suit.State.APPROACH,
		"out": "res://screenshot/dea180_suit_hallway.png"
	},
	{
		"name": "bunker",
		"scene": "res://scenes/phase3/bunker.tscn",
		"suit_pos": Vector3(0.0, 0.0, 4.0),
		"cam_pos": Vector3(0.0, 1.4, 7.5),
		"state": Suit.State.SEARCH,
		"out": "res://screenshot/dea180_suit_bunker.png"
	}
]

var _current_stage_idx: int = 0
var _current_root: Node = null


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute("res://screenshot")
	_run_next_stage()


func _run_next_stage() -> void:
	if _current_stage_idx >= _stages.size():
		print("[VisualDriverSuit] All screenshot stages complete.")
		get_tree().quit(0)
		return

	var stage: Dictionary = _stages[_current_stage_idx]
	print("[VisualDriverSuit] Running stage: ", stage["name"])

	if _current_root != null and is_instance_valid(_current_root):
		_current_root.queue_free()
		await get_tree().process_frame
		await get_tree().process_frame

	var room_scene: PackedScene = load(stage["scene"])
	_current_root = room_scene.instantiate()
	add_child(_current_root)

	var suit_scene: PackedScene = load("res://scenes/entities/suit.tscn")
	var suit: Suit = suit_scene.instantiate() as Suit
	_current_root.add_child(suit)
	suit.global_position = stage["suit_pos"]
	suit.force_state(stage["state"])

	var cam := Camera3D.new()
	cam.name = "CaptureCam"
	_current_root.add_child(cam)
	cam.global_position = stage["cam_pos"]
	cam.look_at(stage["suit_pos"] + Vector3(0.0, 1.2, 0.0))
	cam.current = true

	# Wait for transitions and lighting to settle
	await get_tree().create_timer(1.0).timeout
	cam.current = true
	for i in range(5):
		await get_tree().process_frame

	if not _capture(stage["out"]):
		printerr("[VisualDriverSuit] Screenshot failed at stage: ", stage["name"])
		get_tree().quit(1)
		return

	_current_stage_idx += 1
	call_deferred("_run_next_stage")


func _capture(out_path: String) -> bool:
	var tex := get_viewport().get_texture()
	if tex == null:
		printerr("[VisualDriverSuit] Viewport texture was null.")
		return false

	var img := tex.get_image()
	if img == null:
		printerr("[VisualDriverSuit] Viewport image was null.")
		return false

	var err := img.save_png(out_path)
	if err != OK:
		printerr("[VisualDriverSuit] save_png failed for ", out_path, " err=", err)
		return false

	print("[VisualDriverSuit] Saved: ", out_path)
	return true
