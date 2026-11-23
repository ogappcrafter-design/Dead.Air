class_name SegmentCamera
extends RefCounted

## DEA-177: fixed-camera coverage for the zero-zone phase scenes.
##
## The station and the neighborhood author their CameraZone/CameraAngle nodes
## in the scene files. The nine phase-scene segments came later and each drove
## its rig from code, so none of them had a camera_zone node at all.
##
## Rather than hand-place 25 zones across nine .tscn files (and pay the risk of
## a lost sub-resource on every future scene edit), the coverage lives here as
## one table: for each scene, the walkable boxes and the angle each cut uses.
## `wire()` builds the CameraZone nodes from it, registers them with
## CameraManager, and enters the zone the player starts in without a cut.
##
## Boxes are world-space (every one of these scenes has its root at the origin)
## and sized on the walkable floor, not on the walls: a player who steps
## outside every box keeps the last angle, which is the RE-style contract.
##
## A box is the floor its shot shows. The strip beside, under or behind a fixed
## camera is outside the claim: a player there is off-screen on that shot
## anyway, so leaving the box only keeps the angle the cut already put them on.
## `tests/test_camera_coverage.gd` samples each box's interior at the player's
## body height, so a box that claims more than its shot frames fails there.

## Half-open at the max edge is not modelled; boxes may touch at the seam.
const COVERAGE := {
	"first_house": [
		{
			"angle_id": "FH1",
			"zone_pos": Vector3(-0.75, 1.5, 0.0),
			"zone_size": Vector3(4.5, 3.0, 12.0),
			"camera_pos": Vector3(-6.5, 2.0, 0.0),
			"look_at": Vector3(0.0, 1.0, 0.1),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "FH2",
			"zone_pos": Vector3(3.0, 1.5, -3.0),
			"zone_size": Vector3(5.0, 3.0, 5.0),
			"camera_pos": Vector3(-2.0, 2.0, -7.0),
			"look_at": Vector3(2.0, 1.0, -2.8),
			"fov": 60.0,
			"priority": 1,
		},
	],
	"follower": [
		{
			"angle_id": "FD1",
			"zone_pos": Vector3(10.0, 1.5, 0.0),
			"zone_size": Vector3(20.0, 3.0, 8.0),
			"camera_pos": Vector3(-4.0, 2.6, 5.0),
			"look_at": Vector3(16.0, 1.0, 0.0),
			"fov": 65.0,
			"priority": 0,
		},
		{
			"angle_id": "FD2",
			"zone_pos": Vector3(27.5, 1.5, 0.0),
			"zone_size": Vector3(15.0, 3.0, 8.0),
			"camera_pos": Vector3(14.0, 3.2, 6.5),
			"look_at": Vector3(34.0, 1.0, 0.0),
			"fov": 60.0,
			"priority": 0,
		},
		{
			"angle_id": "FD3",
			"zone_pos": Vector3(42.5, 1.5, 0.0),
			"zone_size": Vector3(15.0, 3.0, 10.0),
			"camera_pos": Vector3(30.0, 2.8, 5.0),
			"look_at": Vector3(44.0, 1.2, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
	],
	"static_sky": [
		{
			"angle_id": "SK1",
			"zone_pos": Vector3(8.0, 1.5, 0.0),
			"zone_size": Vector3(24.0, 3.0, 8.0),
			"camera_pos": Vector3(14.0, 11.0, 18.0),
			"look_at": Vector3(14.0, 0.5, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "SK2",
			"zone_pos": Vector3(30.0, 1.5, 0.0),
			"zone_size": Vector3(20.0, 3.0, 8.0),
			"camera_pos": Vector3(10.0, 6.0, 8.0),
			"look_at": Vector3(40.0, 1.0, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "SK3",
			"zone_pos": Vector3(46.0, 1.5, 0.0),
			"zone_size": Vector3(12.0, 3.0, 10.0),
			"camera_pos": Vector3(34.0, 6.0, 10.0),
			"look_at": Vector3(52.0, 2.5, 0.0),
			"fov": 52.0,
			"priority": 1,
		},
	],
	"bunker": [
		{
			"angle_id": "BK1",
			"zone_pos": Vector3(0.0, 1.5, 7.25),
			"zone_size": Vector3(10.0, 3.0, 2.5),
			"camera_pos": Vector3(0.0, 2.5, 12.0),
			"look_at": Vector3(0.0, 1.0, 4.0),
			"fov": 60.0,
			"priority": 0,
		},
		{
			"angle_id": "BK2",
			"zone_pos": Vector3(0.0, 1.5, -1.0),
			"zone_size": Vector3(16.0, 3.0, 14.0),
			"camera_pos": Vector3(0.0, 2.8, 9.5),
			"look_at": Vector3(0.0, 1.2, -6.0),
			"fov": 58.0,
			"priority": 0,
		},
		{
			"angle_id": "BK3",
			"zone_pos": Vector3(0.0, 1.5, -9.5),
			"zone_size": Vector3(16.0, 3.0, 3.0),
			"camera_pos": Vector3(0.0, 2.2, 4.0),
			"look_at": Vector3(0.0, 1.2, -9.0),
			"fov": 50.0,
			"priority": 1,
		},
		{
			"angle_id": "BK4",
			"entry": Vector3(-7.0, 0.5, 8.0),
			"exit": Vector3(-12.0, 0.5, 6.0),
			"zone_pos": Vector3(-9.5, 1.5, 6.0),
			"zone_size": Vector3(5.0, 3.0, 7.0),
			"camera_pos": Vector3(-4.0, 2.4, 9.0),
			"look_at": Vector3(-10.0, 1.0, 6.0),
			"fov": 55.0,
			"priority": 2,
		},
		{
			"angle_id": "BK5",
			"entry": Vector3(7.0, 0.5, 8.0),
			"exit": Vector3(12.0, 0.5, 6.0),
			"zone_pos": Vector3(9.5, 1.5, 6.0),
			"zone_size": Vector3(5.0, 3.0, 7.0),
			"camera_pos": Vector3(4.0, 2.4, 9.0),
			"look_at": Vector3(10.0, 1.0, 6.0),
			"fov": 55.0,
			"priority": 2,
		},
	],
	"highway": [
		{
			"angle_id": "HW1",
			"zone_pos": Vector3(17.5, 1.75, 0.0),
			"zone_size": Vector3(55.0, 3.5, 10.0),
			"camera_pos": Vector3(-14.0, 6.0, 12.0),
			"look_at": Vector3(60.0, 0.5, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "HW2",
			"exit": Vector3(60.0, 0.5, 7.0),
			"zone_pos": Vector3(65.0, 1.75, 1.0),
			"zone_size": Vector3(40.0, 3.5, 12.0),
			"camera_pos": Vector3(34.0, 5.5, 8.0),
			"look_at": Vector3(100.0, 0.5, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "HW3",
			"zone_pos": Vector3(157.5, 1.75, 0.0),
			"zone_size": Vector3(145.0, 3.5, 10.0),
			"camera_pos": Vector3(74.0, 4.5, 6.0),
			"look_at": Vector3(230.0, 0.5, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
	],
	"liminal_space": [
		{
			"angle_id": "LS1",
			"zone_pos": Vector3(0.0, 1.75, -0.5),
			"zone_size": Vector3(20.0, 3.5, 15.0),
			"camera_pos": Vector3(0.0, 8.0, 10.0),
			"look_at": Vector3(0.0, 1.0, 0.0),
			"fov": 60.0,
			"priority": 0,
		},
		{
			"angle_id": "LS2",
			"zone_pos": Vector3(0.0, 1.75, -12.0),
			"zone_size": Vector3(14.0, 3.5, 8.0),
			"camera_pos": Vector3(0.0, 6.0, -4.0),
			"look_at": Vector3(0.0, 1.5, -12.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "LS3",
			"entry": Vector3(12.0, 0.5, 8.0),
			"exit": Vector3(20.0, 0.5, 8.0),
			"zone_pos": Vector3(16.0, 1.75, 8.0),
			"zone_size": Vector3(8.0, 3.5, 8.0),
			"camera_pos": Vector3(10.0, 2.5, 2.0),
			"look_at": Vector3(16.0, 1.0, 8.0),
			"fov": 55.0,
			"priority": 2,
		},
	],
	"chamber": [
		{
			"angle_id": "CH1",
			"zone_pos": Vector3(0.0, -198.5, 3.25),
			"zone_size": Vector3(13.0, 5.0, 6.5),
			"camera_pos": Vector3(-6.5, -196.2, 7.5),
			"look_at": Vector3(2.0, -200.5, 0.0),
			"fov": 55.0,
			"priority": 0,
		},
		{
			"angle_id": "CH2",
			"zone_pos": Vector3(0.0, -198.5, -4.5),
			"zone_size": Vector3(13.0, 5.0, 9.0),
			"camera_pos": Vector3(6.5, -196.2, 7.0),
			"look_at": Vector3(-2.0, -200.5, -4.5),
			"fov": 60.0,
			"priority": 0,
		},
	],
	"clearing": [
		{
			"angle_id": "CL1",
			"zone_pos": Vector3(0.0, 2.0, 1.5),
			"zone_size": Vector3(24.0, 4.0, 13.0),
			"camera_pos": Vector3(0.0, 1.5, 12.0),
			"look_at": Vector3(0.0, 10.0, -40.0),
			"fov": 70.0,
			"priority": 0,
		},
		{
			"angle_id": "CL2",
			"zone_pos": Vector3(0.0, 2.0, -19.5),
			"zone_size": Vector3(32.0, 4.0, 29.0),
			"camera_pos": Vector3(0.0, 8.0, 16.0),
			"look_at": Vector3(0.0, 9.0, -40.0),
			"fov": 62.0,
			"priority": 0,
		},
		{
			"angle_id": "CL3",
			"zone_pos": Vector3(0.0, 2.0, -40.0),
			"zone_size": Vector3(20.0, 4.0, 30.0),
			"camera_pos": Vector3(0.0, 6.0, -10.0),
			"look_at": Vector3(0.0, 5.0, -42.0),
			"fov": 70.0,
			"priority": 1,
		},
	],
	"staircase": [
		{
			"angle_id": "ST1",
			"zone_pos": Vector3(0.0, -2.0, 0.0),
			"zone_size": Vector3(10.0, 8.0, 10.0),
			"camera_pos": Vector3(0.0, 7.0, 0.001),
			"look_at": Vector3(0.0, -2.0, 0.0),
			"fov": 60.0,
			"priority": 0,
		},
		{
			"angle_id": "ST2",
			"zone_pos": Vector3(0.0, -11.0, 0.0),
			"zone_size": Vector3(10.0, 10.0, 10.0),
			"camera_pos": Vector3(6.0, -4.0, 6.0),
			"look_at": Vector3(0.0, -11.0, 0.0),
			"fov": 65.0,
			"priority": 0,
		},
		{
			"angle_id": "ST3",
			"zone_pos": Vector3(0.0, -18.0, 0.0),
			"zone_size": Vector3(10.0, 4.0, 10.0),
			"camera_pos": Vector3(0.0, -10.0, 6.0),
			"look_at": Vector3(0.0, -19.0, 0.0),
			"fov": 60.0,
			"priority": 1,
		},
		{
			"angle_id": "ST4",
			"zone_pos": Vector3(0.0, -100.0, 0.0),
			"zone_size": Vector3(10.0, 160.0, 10.0),
			"camera_pos": Vector3(0.0, -14.0, 2.5),
			"look_at": Vector3(0.0, -60.0, 0.0),
			"fov": 75.0,
			"priority": 0,
		},
	],
}

## The walkable routes through each scene, one polyline per branch at the
## player's body height. A shot is only valid when it frames the part of a
## route inside its box: framing the box centre alone still lets the player walk
## behind the camera for the first metres after a cut. Side rooms branch off the
## main route, so their definitions carry an explicit entry/exit instead.
const WALKS := {
	"first_house": [[Vector3(0.0, 0.5, 0.0), Vector3(3.0, 0.5, -3.0)]],
	"follower": [[Vector3(2.0, 0.5, 0.0), Vector3(50.0, 0.5, 0.0)]],
	"static_sky": [[Vector3(2.0, 0.5, 0.0), Vector3(52.0, 0.5, 0.0)]],
	"bunker": [[Vector3(0.0, 0.5, 8.0), Vector3(0.0, 0.5, -11.0)]],
	"highway": [
		[Vector3(0.0, 0.5, 0.0), Vector3(120.0, 0.5, 0.0)],
		[Vector3(60.0, 0.5, 0.0), Vector3(60.0, 0.5, 7.0)],
	],
	"liminal_space": [[Vector3(0.0, 0.5, 4.0), Vector3(0.0, 0.5, -16.0)]],
	"chamber": [
		[Vector3(6.0, -200.5, 4.0), Vector3(0.0, -200.5, -9.0)],
		[Vector3(6.0, -200.5, 4.0), Vector3(6.0, -200.5, -4.0)],
	],
	"clearing": [
		[Vector3(0.0, 0.5, 0.0), Vector3(0.0, 0.5, -55.0)],
		[Vector3(-14.0, 0.5, -27.0), Vector3(-13.0, 0.5, -12.0)],
		[Vector3(-15.0, 0.5, -30.0), Vector3(0.0, 0.5, -40.0)],
	],
	"staircase": [[Vector3(0.0, -1.0, 0.0), Vector3(0.0, -180.0, 0.0)]],
}

const HOLDER_NAME := "CameraCoverage"


## Resolve the coverage key from a scene node. Falls back to the node name so a
## segment that was renamed in code still finds its table entry.
static func scene_key(scene: Node) -> String:
	var path: String = String(scene.scene_file_path)
	if path.is_empty():
		return ""
	return path.get_file().get_basename()


## Number of authored zones for a scene key.
static func zone_count(key: String) -> int:
	var defs: Array = COVERAGE.get(key, [])
	return defs.size()


## World-space box for a zone definition.
static func zone_box(def: Dictionary) -> AABB:
	return AABB(def["zone_pos"] - def["zone_size"] * 0.5, def["zone_size"])


## Points where `box` intersects the scene's walkable route: the ends of every
## clipped segment. A view frustum is convex, so framing both ends of a straight
## stretch frames the whole stretch -- these are the frames the player is in
## when the cut happens, not just the box centre.
static func walk_points(key: String, box: AABB) -> Array[Vector3]:
	var points: Array[Vector3] = []
	var walks: Array = WALKS.get(key, [])
	for walk in walks:
		for i in range(walk.size() - 1):
			var clipped: Array[Vector3] = _clip_segment(walk[i], walk[i + 1], box)
			if clipped.is_empty():
				continue
			points.append(clipped[0])
			if clipped[1] != clipped[0]:
				points.append(clipped[1])
	return points


## Segment `a` to `b` clipped to `box`, or an empty array when it misses. Slab
## clip per axis; a zero-length axis has to already lie inside the box.
static func _clip_segment(a: Vector3, b: Vector3, box: AABB) -> Array[Vector3]:
	var out: Array[Vector3] = []
	var t0: float = 0.0
	var t1: float = 1.0
	var delta: Vector3 = b - a
	var min_edge: Vector3 = box.position
	var max_edge: Vector3 = box.end
	for axis in range(3):
		if absf(delta[axis]) < 0.000001:
			if a[axis] < min_edge[axis] or a[axis] > max_edge[axis]:
				return out
			continue
		var enter: float = (min_edge[axis] - a[axis]) / delta[axis]
		var leave: float = (max_edge[axis] - a[axis]) / delta[axis]
		if enter > leave:
			var swap: float = enter
			enter = leave
			leave = swap
		t0 = maxf(t0, enter)
		t1 = minf(t1, leave)
		if t0 > t1:
			return out
	out.append(a + delta * t0)
	out.append(a + delta * t1)
	return out


## True when `point` falls inside the angle's view frustum at the aspect the
## game actually renders (RetroResolution's 4:3; a 16:9 test accepts shots the
## player never sees). Catches a look-at that points away from the box it is
## supposed to cover.
static func frames_point(def: Dictionary, point: Vector3) -> bool:
	var camera_pos: Vector3 = def["camera_pos"]
	var forward: Vector3 = (def["look_at"] as Vector3) - camera_pos
	if forward.length_squared() < 0.0001:
		return false
	forward = forward.normalized()
	# A straight-down shot has no Y-up reference: use the same fallback axis
	# build_angle() gives the basis, then test both lateral bounds like any
	# other shot. Depth alone would accept points far outside the shaft.
	var up_ref: Vector3 = Vector3.BACK if absf(forward.dot(Vector3.UP)) > 0.999 else Vector3.UP
	var right: Vector3 = forward.cross(up_ref).normalized()
	var up: Vector3 = right.cross(forward)
	var to_point: Vector3 = point - camera_pos
	var depth: float = to_point.dot(forward)
	if depth <= 0.0:
		return false
	var half_vertical: float = tan(deg_to_rad(float(def["fov"]) * 0.5))
	var half_horizontal: float = half_vertical * RetroResolution.ASPECT
	return absf(to_point.dot(right)) <= half_horizontal * depth \
		and absf(to_point.dot(up)) <= half_vertical * depth


## Index of the first zone whose box contains `point`, or -1.
static func start_zone_index(key: String, point: Vector3) -> int:
	var defs: Array = COVERAGE.get(key, [])
	for i in range(defs.size()):
		if zone_box(defs[i]).has_point(point):
			return i
	return -1


## Build one CameraAngle from a definition. The angle is authored as a look-at
## target because that is how the segments were written; CameraAngle stores an
## Euler rotation, so convert once here.
static func build_angle(def: Dictionary) -> CameraAngle:
	var angle := CameraAngle.new()
	angle.angle_id = String(def["angle_id"])
	angle.position = def["camera_pos"]
	var to_target: Vector3 = (def["look_at"] as Vector3) - (def["camera_pos"] as Vector3)
	if to_target.length_squared() > 0.0001:
		var dir: Vector3 = to_target.normalized()
		# A straight-down shot has no usable Y-up reference (top-down stair
		# shaft); fall back to the horizontal axis Godot uses for look_at.
		var up: Vector3 = Vector3.BACK if absf(dir.dot(Vector3.UP)) > 0.999 else Vector3.UP
		angle.rotation_degrees = Basis.looking_at(dir, up).get_euler() * (180.0 / PI)
	angle.fov = float(def["fov"])
	angle.max_pan_degrees = float(def.get("max_pan", 15.0))
	angle.max_tilt_degrees = float(def.get("max_tilt", 5.0))
	angle.tracking_strength = float(def.get("tracking", 0.5))
	return angle


## Build one CameraZone (Area3D + box shape) from a definition.
static func build_zone(def: Dictionary, angle: CameraAngle) -> CameraZone:
	var zone := CameraZone.new()
	zone.name = "Zone" + String(def["angle_id"])
	zone.position = def["zone_pos"]
	zone.camera_angle = angle
	zone.zone_priority = int(def.get("priority", 0))
	zone.use_transition = bool(def.get("transition", true))
	# Zones are observers: they must not push the player around, and they only
	# need to see bodies on layer 1 (the player).
	zone.collision_layer = 0
	zone.collision_mask = 1
	zone.monitoring = true
	var shape := CollisionShape3D.new()
	shape.name = "Shape"
	var box := BoxShape3D.new()
	box.size = def["zone_size"]
	shape.shape = box
	zone.add_child(shape)
	return zone


## Build the coverage for `scene`, register it with CameraManager, and enter the
## zone the player is standing in without a static cut. Returns the number of
## zones wired (0 when the scene has no authored coverage).
##
## `key` defaults to the scene file's basename; pass it explicitly when the
## scene is loaded from a path that does not match the table (tests do).
static func wire(scene: Node3D, rig: Camera3D, player: Node3D, key: String = "") -> int:
	var resolved_key: String = key if not key.is_empty() else scene_key(scene)
	var defs: Array = COVERAGE.get(resolved_key, [])
	if defs.is_empty():
		push_warning("SegmentCamera: no coverage authored for '%s'" % resolved_key)
		return 0
	if rig == null or player == null:
		push_warning("SegmentCamera: %s needs a rig and a player" % resolved_key)
		return 0

	# Rebuild from scratch so a re-wire (tests, scene reload) cannot double the
	# zones or hand CameraManager freed instances.
	var stale: Node = scene.get_node_or_null(HOLDER_NAME)
	if stale != null:
		scene.remove_child(stale)
		stale.queue_free()
	var holder := Node3D.new()
	holder.name = HOLDER_NAME
	scene.add_child(holder)

	var zones: Array[CameraZone] = []
	for def in defs:
		var angle: CameraAngle = build_angle(def)
		var zone: CameraZone = build_zone(def, angle)
		holder.add_child(zone)
		zones.append(zone)

	var cam_mgr: Node = scene.get_node_or_null("/root/CameraManager")
	if cam_mgr == null:
		# No coordinator (bare tool scripts): the zones still exist and the rig
		# is placed on the first angle so the scene is not looking at nothing.
		var rig_script := rig as CameraRig
		if rig_script != null:
			rig_script.transition_to(build_angle(defs[0]), 0.0)
		return zones.size()

	cam_mgr.reset()
	cam_mgr.set_rig(rig as CameraRig)
	cam_mgr.set_player(player)
	for zone in zones:
		cam_mgr.register_zone(zone)

	var start_index: int = start_zone_index(resolved_key, player.global_position)
	if start_index < 0:
		start_index = 0
	cam_mgr.activate_zone(zones[start_index], true)
	return zones.size()
