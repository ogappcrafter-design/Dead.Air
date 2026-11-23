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
	results["test_walk_routes_are_covered_by_zones"] = await test_walk_routes_are_covered_by_zones()
	results["test_spawn_positions_inside_zone"] = await test_spawn_positions_inside_zone()
	results["test_scene_registers_spawn_zone"] = await test_scene_registers_spawn_zone()
	results["test_walking_cuts_to_next_zone"] = await test_walking_cuts_to_next_zone()
	results["test_reset_clears_active_zone"] = await test_reset_clears_active_zone()
	results["test_freed_zone_cannot_activate"] = await test_freed_zone_cannot_activate()
	results["test_stale_active_zone_does_not_block_lower_priority"] = await test_stale_active_zone_does_not_block_lower_priority()
	results["test_exit_fallback_ignores_wall_only_zone"] = await test_exit_fallback_ignores_wall_only_zone()
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
	var rig := CameraRig.new()
	cam_mgr.set_rig(rig)
	var high: CameraZone = CameraZone.new()
	high.zone_priority = 5
	high.camera_angle = _angle("HIGH", Vector3(0.0, 30.0, 0.0), 40.0)
	var low: CameraZone = CameraZone.new()
	low.zone_priority = 1
	low.camera_angle = _angle("LOW", Vector3(10.0, 30.0, 0.0), 70.0)
	cam_mgr.register_zone(high)
	cam_mgr.register_zone(low)
	cam_mgr.activate_zone(high, true)
	var ok: bool = cam_mgr.get_active_angle_id() == "HIGH"
	# Neither zone holds a player (they are outside the tree), so the stale
	# high-priority box must not keep the camera: the cut lands on the low zone.
	cam_mgr.activate_zone(low, true)
	ok = ok and cam_mgr.get_active_zone() == low
	ok = ok and cam_mgr.get_active_angle_id() == "LOW"
	ok = ok and rig.current_angle == low.camera_angle
	ok = ok and rig.fov == 70.0
	cam_mgr.set_rig(null)
	high.free()
	low.free()
	rig.free()
	cam_mgr.reset()
	return ok


## Leaving a zone falls back to the best zone that still holds the player. A
## higher-priority box that only contains static geometry (floors and walls
## share the zones' collision layer) must not win: the camera would stay on a
## shot the player has already walked out of.
func test_exit_fallback_ignores_wall_only_zone() -> bool:
	var cam_mgr: Node = _camera_manager()
	if cam_mgr == null:
		return false
	cam_mgr.reset()
	var world := Node3D.new()
	(Engine.get_main_loop() as SceneTree).root.add_child(world)

	var player := CharacterBody3D.new()
	player.add_to_group("player")
	var player_shape := CollisionShape3D.new()
	var player_box := BoxShape3D.new()
	player_box.size = Vector3(0.5, 1.0, 0.5)
	player_shape.shape = player_box
	player.add_child(player_shape)
	player.position = Vector3(-10.0, 1.5, 0.0)
	world.add_child(player)

	var wall := StaticBody3D.new()
	var wall_shape := CollisionShape3D.new()
	var wall_box := BoxShape3D.new()
	wall_box.size = Vector3(2.0, 3.0, 2.0)
	wall_shape.shape = wall_box
	wall.add_child(wall_shape)
	wall.position = Vector3(10.0, 1.5, 0.0)
	world.add_child(wall)

	var left: CameraZone = _zone_with_angle(world, Vector3.ZERO, 9, "LEFT")
	var wall_zone: CameraZone = _zone_with_angle(world, Vector3(10.0, 1.5, 0.0), 5, "WALL")
	var player_zone: CameraZone = _zone_with_angle(world, Vector3(-10.0, 1.5, 0.0), 1, "PLAYER")
	var rig := CameraRig.new()
	world.add_child(rig)
	cam_mgr.set_rig(rig)
	cam_mgr.set_player(player)
	cam_mgr.register_zone(left)
	cam_mgr.register_zone(wall_zone)
	cam_mgr.register_zone(player_zone)
	cam_mgr.activate_zone(left, true)
	# Let the physics server publish the overlaps the fallback reads.
	await _wait_physics_frames(3)
	# The player_zone enter signal fires while the overlaps settle, so put the
	# zone being left back on top: the fallback only runs for the active zone.
	cam_mgr.activate_zone(left, true)
	# The premise: the wall box holds a body, but not the player, and the exit
	# handler really runs instead of returning early.
	var ok: bool = wall_zone.get_overlapping_bodies().has(wall)
	ok = ok and player_zone.get_overlapping_bodies().has(player)
	ok = ok and cam_mgr.get_active_zone() == left
	# Drive the handler the exit signal calls, with `left` still active.
	cam_mgr._on_zone_exited(left)
	ok = ok and cam_mgr.get_active_zone() == player_zone
	ok = ok and cam_mgr.get_active_angle_id() == "PLAYER"
	ok = ok and rig.current_angle == player_zone.camera_angle
	cam_mgr.reset()
	cam_mgr.set_rig(null)
	world.free()
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


func _angle(id: String, at: Vector3, fov: float) -> CameraAngle:
	var angle := CameraAngle.new()
	angle.angle_id = id
	angle.position = at
	angle.fov = fov
	return angle


## Interior sample points of a zone box at the player's body height: the
## quarter, mid and three-quarter point on each horizontal axis. The box edge
## is the cut boundary, not interior -- a shot is claimed for the footprint it
## shows, so a blind corner inside the box has to fail here.
func _zone_samples(box: AABB) -> Array[Vector3]:
	var points: Array[Vector3] = []
	var y: float = box.position.y + 0.5
	for fx in [0.25, 0.5, 0.75]:
		for fz in [0.25, 0.5, 0.75]:
			points.append(Vector3(
				box.position.x + box.size.x * fx,
				y,
				box.position.z + box.size.z * fz
			))
	return points


## CameraZone with a box shape and a camera angle, parented so the physics
## server reports its overlaps. Used by the exit-fallback test.
func _zone_with_angle(parent: Node, at: Vector3, priority: int, id: String) -> CameraZone:
	var zone := CameraZone.new()
	zone.position = at
	zone.zone_priority = priority
	zone.collision_layer = 0
	zone.collision_mask = 1
	zone.monitoring = true
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(4.0, 3.0, 4.0)
	shape.shape = box
	zone.add_child(shape)
	zone.camera_angle = _angle(id, at + Vector3(0.0, 2.0, 6.0), 55.0)
	parent.add_child(zone)
	return zone


# ─── Tests ───────────────────────────────────────────────────────────────────

func test_every_scene_has_two_zones() -> bool:
	for key in SCENE_SPAWNS.keys():
		if SegmentCameraScript.zone_count(key) < 2:
			return false
	return true


## Every step of every walkable route has to sit inside some zone, or the
## player leaves all triggers and the rig keeps a shot of wherever they were.
func test_walk_routes_are_covered_by_zones() -> bool:
	for key in SCENE_SPAWNS.keys():
		var boxes: Array[AABB] = []
		for def in SegmentCameraScript.COVERAGE[key]:
			boxes.append(SegmentCameraScript.zone_box(def))
		for walk in SegmentCameraScript.WALKS[key]:
			for i in range(walk.size() - 1):
				var from: Vector3 = walk[i]
				var to: Vector3 = walk[i + 1]
				var span_length: float = from.distance_to(to)
				if span_length <= 0.0001:
					continue
				# Exact intervals: the clipper already knows where each box starts
				# and ends along the segment, so no gap can hide between samples.
				var spans: Array[Vector2] = []
				for box in boxes:
					var clipped: Array[Vector3] = SegmentCameraScript._clip_segment(from, to, box)
					if clipped.is_empty():
						continue
					var t0: float = from.distance_to(clipped[0]) / span_length
					var t1: float = from.distance_to(clipped[1]) / span_length
					spans.append(Vector2(minf(t0, t1), maxf(t0, t1)))
				spans.sort_custom(func(x: Vector2, y: Vector2) -> bool: return x.x < y.x)
				var reach: float = 0.0
				for span in spans:
					if span.x > reach + 0.0001:
						return false
					reach = maxf(reach, span.y)
				if reach < 1.0 - 0.0001:
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
			# not coverage). Framing the centre is not enough: the cut points on
			# the walkable route -- where the player enters this box and where it
			# hands off -- must be in frame too, or the player walks off-screen
			# for the first metres of the shot.
			if not SegmentCameraScript.frames_point(def, box.get_center()):
				return false
			var walk: Array[Vector3] = SegmentCameraScript.walk_points(key, box)
			var anchors: Array[Vector3] = []
			if def.has("entry"):
				anchors.append(def["entry"])
			if def.has("exit"):
				anchors.append(def["exit"])
			for point in anchors:
				# A point the shot is asserted to frame must also sit inside the
				# zone's own trigger, or no cut ever happens there.
				if not box.has_point(point):
					return false
			walk.append_array(anchors)
			for point in walk:
				if not SegmentCameraScript.frames_point(def, point):
					return false
			for point in _zone_samples(box):
				if not SegmentCameraScript.frames_point(def, point):
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
