## test_camera_coverage.gd — DEA-177 fixed-camera coverage for the zero-zone
## phase scenes.
## Verifies: every one of the nine door-to-door scenes carries at least two
## authored zones, the angles are well formed and actually frame their box, the
## player's spawn is inside a zone, and a loaded scene registers with
## CameraManager and cuts when the player walks into the next box.
extends RefCounted

const SegmentCameraScript = preload("res://src/visual/segment_camera.gd")

## The nine scenes DEA-177 names, with the position each one spawns the player.
const SCENE_SPAWNS := {
	"first_house": Vector3(0.0, 0.5, 0.0),
	"follower": Vector3(2.0, 0.5, 0.0),
	"static_sky": Vector3(2.0, 0.5, 0.0),
	"bunker": Vector3(0.0, 0.5, 8.0),
	"highway": Vector3(0.0, 0.5, 0.0),
	"liminal_space": Vector3(0.0, 0.5, 4.0),
	"chamber": Vector3(6.0, -200.5, 4.0),
	"clearing": Vector3(0.0, 0.5, 0.0),
	"staircase": Vector3(0.0, -1.0, 0.0),
}

var test_name: String = "CameraCoverage"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_every_scene_has_two_zones"] = await test_every_scene_has_two_zones()
	results["test_angles_are_well_formed"] = await test_angles_are_well_formed()
	results["test_spawn_positions_inside_zone"] = await test_spawn_positions_inside_zone()
	results["test_scene_registers_spawn_zone"] = await test_scene_registers_spawn_zone()
	results["test_walking_cuts_to_next_zone"] = await test_walking_cuts_to_next_zone()
	results["test_reset_clears_active_zone"] = await test_reset_clears_active_zone()
	results["test_freed_zone_cannot_activate"] = await test_freed_zone_cannot_activate()
	results["test_stale_active_zone_does_not_block_lower_priority"] = await test_stale_active_zone_does_not_block_lower_priority()
	return results


## A zone the player is no longer inside must not outrank a zone the player
## walks into, whatever its priority. A teleport or a lost exit signal leaves
## exactly this state, and it pins the camera to a box the player left while
## every lower-priority angle in the scene becomes unreachable.
func test_stale_active_zone_does_not_block_lower_priority() -> bool:
	var cam_mgr: Node = _camera_manager()
	if cam_mgr == null:
		return false
	cam_mgr.reset()
	var high: CameraZone = CameraZone.new()
	high.zone_priority = 5
	var low: CameraZone = CameraZone.new()
	low.zone_priority = 1
	cam_mgr.register_zone(high)
	cam_mgr.register_zone(low)
	cam_mgr.activate_zone(high, true)
	cam_mgr.activate_zone(low, true)
	var ok: bool = cam_mgr.get_active_zone() == low
	high.free()
	low.free()
	cam_mgr.reset()
	return ok


# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_static_sky() -> Node:
	var scene: PackedScene = load("res://scenes/phase2/static_sky.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment


func _cleanup(segment: Node) -> void:
	var cam_mgr: Node = _camera_manager()
	if cam_mgr != null:
		cam_mgr.reset()
	if segment:
		segment._reset_for_testing()
		segment.queue_free()


func _camera_manager() -> Node:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	return tree.root.get_node_or_null("CameraManager")


func _wait_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).process_frame


func _wait_physics_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).physics_frame


# ─── Tests ───────────────────────────────────────────────────────────────────

func test_every_scene_has_two_zones() -> bool:
	for key in SCENE_SPAWNS.keys():
		if SegmentCameraScript.zone_count(key) < 2:
			return false
	return true


func test_angles_are_well_formed() -> bool:
	for key in SCENE_SPAWNS.keys():
		var defs: Array = SegmentCameraScript.COVERAGE[key]
		var seen_ids := {}
		var seen_cameras: Array[Vector3] = []
		for def in defs:
			var angle_id: String = String(def["angle_id"])
			if angle_id.is_empty() or seen_ids.has(angle_id):
				return false
			seen_ids[angle_id] = true

			var box: AABB = SegmentCameraScript.zone_box(def)
			if box.size.x <= 0.0 or box.size.y <= 0.0 or box.size.z <= 0.0:
				return false

			# The shot has to be aimed at the box it covers, from somewhere other
			# than the previous angle's eye (a cut between identical cameras is
			# not coverage).
			if not SegmentCameraScript.frames_point(def, box.get_center()):
				return false
			var camera_pos: Vector3 = def["camera_pos"]
			if seen_cameras.has(camera_pos):
				return false
			seen_cameras.append(camera_pos)

			var fov: float = float(def["fov"])
			if fov < 30.0 or fov > 90.0:
				return false
	return true


func test_spawn_positions_inside_zone() -> bool:
	for key in SCENE_SPAWNS.keys():
		if SegmentCameraScript.start_zone_index(key, SCENE_SPAWNS[key]) < 0:
			return false
	return true


func test_scene_registers_spawn_zone() -> bool:
	var segment: Node = _load_static_sky()
	await _wait_frames(4)
	var ok: bool = true
	var holder: Node = segment.get_node_or_null("CameraCoverage")
	if holder == null or holder.get_child_count() != SegmentCameraScript.zone_count("static_sky"):
		ok = false
	var cam_mgr: Node = _camera_manager()
	if ok and (cam_mgr == null or cam_mgr.get_active_angle_id() != "SK1"):
		ok = false
	if ok:
		var rig: Camera3D = segment.get_node_or_null("CameraRig") as Camera3D
		# The spawn angle is the high wide shot this scene used to hard-code.
		ok = rig != null and rig.global_position.y > 8.0 and rig.fov >= 50.0
	_cleanup(segment)
	await _wait_frames(2)
	return ok


func test_walking_cuts_to_next_zone() -> bool:
	var segment: Node = _load_static_sky()
	await _wait_frames(4)
	var player: CharacterBody3D = segment.get_player()
	var ok: bool = player != null
	var cut := [""]
	if ok:
		var cam_mgr: Node = _camera_manager()
		ok = cam_mgr != null and cam_mgr.get_active_angle_id() == "SK1"
		if ok:
			cam_mgr.camera_transition_started.connect(
				func(new_id: String, _old_id: String) -> void: cut[0] = new_id
			)
			# SK2 starts at x = 20 on the road.
			player.global_position = Vector3(26.0, 0.5, 0.0)
			await _wait_physics_frames(3)
			ok = cut[0] == "SK2" and cam_mgr.get_active_angle_id() == "SK2"
	_cleanup(segment)
	await _wait_frames(2)
	return ok


func test_reset_clears_active_zone() -> bool:
	var segment: Node = _load_static_sky()
	await _wait_frames(4)
	var cam_mgr: Node = _camera_manager()
	var ok: bool = cam_mgr != null and cam_mgr.get_active_angle_id() == "SK1"
	if ok:
		cam_mgr.reset()
		ok = cam_mgr.get_active_angle_id() == ""
	_cleanup(segment)
	await _wait_frames(2)
	return ok


## A zone freed by a scene unload must not survive in the manager's list, and
## activating it must not cut the camera onto a dead box.
func test_freed_zone_cannot_activate() -> bool:
	var segment: Node = _load_static_sky()
	await _wait_frames(4)
	var cam_mgr: Node = _camera_manager()
	if cam_mgr == null:
		_cleanup(segment)
		return false
	var size_before: int = cam_mgr.zones().size()
	var zone: CameraZone = CameraZone.new()
	cam_mgr.register_zone(zone)
	if cam_mgr.zones().size() != size_before + 1:
		zone.free()
		_cleanup(segment)
		return false
	var angle_before: String = cam_mgr.get_active_angle_id()
	zone.queue_free()
	await _wait_frames(2)
	cam_mgr.activate_zone(zone)
	var ok: bool = cam_mgr.get_active_angle_id() == angle_before
	ok = ok and cam_mgr.zones().size() == size_before
	_cleanup(segment)
	await _wait_frames(2)
	return ok
