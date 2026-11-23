## test_suit_model_rig.gd — Unit tests for The Suit modelled, rigged entity (DEA-180)
## Tests:
##   - Model hierarchy and pivot points
##   - Triangle count within low-poly budget (<2,000 tris)
##   - Material assignment (wool, skin, shirt, tie)
##   - Shadow casting disabled across all mesh instances
##   - AnimationPlayer presence and required animations (idle, patrol, approach, search, turn, relocate, despawn)
##   - State machine to animation mapping (no T-pose / sliding)
##   - Head/neck tracking toward player during detection with clamp limits
##   - LOD distance scaling (>14m simplifies detail)
##   - Collision capsule and state machine contract preservation
##   - Model front faces the body's forward direction
##   - Head aim actually points at the target (sign, not just magnitude)
##   - Despawn notifies IDLE, defers the hide to the clip, and respawn restores visibility
##   - A route-less patrol idles instead of marching in place
##   - A same-clip speed change reaches the playing clip
##   - A playback rate is applied once, not compounded by clip and player speed
##   - A route arriving after spawn restores the patrol walk
##   - A shorter route keeps the patrol index in bounds, and an empty one idles
##   - A reversal pivots in place, keeps the turn clip, and resumes walking
##   - A pivot released by the clip's own end, and by the hold when it cannot report
##   - A pivot neither jumps nor consumes a pursuit stutter that was already due
##   - Every clip keys both knees and the head
extends RefCounted

var test_name: String = "SuitModelRig"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_visual_model_hierarchy"] = test_visual_model_hierarchy()
	results["test_triangle_count_under_2k"] = test_triangle_count_under_2k()
	results["test_no_shadows_recursively"] = test_no_shadows_recursively()
	results["test_materials_and_textures"] = test_materials_and_textures()
	results["test_animation_player_has_all_animations"] = test_animation_player_has_all_animations()
	results["test_animation_playback_on_state_changes"] = test_animation_playback_on_state_changes()
	results["test_despawn_animation"] = test_despawn_animation()
	results["test_head_torso_tracking"] = test_head_torso_tracking()
	results["test_lod_distance_scaling"] = test_lod_distance_scaling()
	results["test_collision_and_state_machine_contract"] = test_collision_and_state_machine_contract()
	results["test_visual_forward_matches_body_forward"] = test_visual_forward_matches_body_forward()
	results["test_head_aims_at_target_direction"] = test_head_aims_at_target_direction()
	results["test_head_pitch_follows_a_raised_target"] = test_head_pitch_follows_a_raised_target()
	results["test_despawn_notifies_and_defers_hide"] = await test_despawn_notifies_and_defers_hide()
	results["test_patrol_without_points_idles"] = test_patrol_without_points_idles()
	results["test_route_arriving_restores_patrol"] = test_route_arriving_restores_patrol()
	results["test_shorter_route_keeps_a_valid_patrol_index"] = (
		test_shorter_route_keeps_a_valid_patrol_index()
	)
	results["test_same_clip_speed_change_applies"] = test_same_clip_speed_change_applies()
	results["test_playback_speed_has_one_multiplier"] = test_playback_speed_has_one_multiplier()
	results["test_turn_clip_on_reversal"] = await test_turn_clip_on_reversal()
	results["test_pivot_hold_expires_without_the_signal"] = test_pivot_hold_expires_without_the_signal()
	results["test_pivot_preserves_pending_stutter"] = test_pivot_preserves_pending_stutter()
	results["test_every_clip_keys_joints"] = test_every_clip_keys_joints()
	return results


func _make_suit() -> Suit:
	var scene: PackedScene = load("res://scenes/entities/suit.tscn")
	var suit: Suit = scene.instantiate() as Suit
	suit.name = "TestSuitModel"
	suit.set_rng_seed(42)
	var tree := Engine.get_main_loop() as SceneTree
	var player := CharacterBody3D.new()
	player.name = "Player"
	player.add_to_group("player")
	tree.root.add_child(player)
	player.global_position = Vector3(100, 0, 100)
	suit.set_player(player)
	tree.root.add_child(suit)
	return suit


func _drop_suit(suit: Suit) -> void:
	if suit and is_instance_valid(suit):
		var p := suit._player
		if p and is_instance_valid(p):
			p.queue_free()
		suit.queue_free()


func _count_triangles(node: Node) -> int:
	var total := 0
	var stack: Array[Node] = [node]
	while not stack.is_empty():
		var curr: Node = stack.pop_back()
		if curr is MeshInstance3D and (curr as MeshInstance3D).mesh != null:
			var m: Mesh = (curr as MeshInstance3D).mesh
			for s in range(m.get_surface_count()):
				var arrays := m.surface_get_arrays(s)
				if arrays.size() > Mesh.ARRAY_INDEX and arrays[Mesh.ARRAY_INDEX] != null:
					var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
					total += indices.size() / 3
				elif arrays.size() > Mesh.ARRAY_VERTEX and arrays[Mesh.ARRAY_VERTEX] != null:
					var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
					total += verts.size() / 3
		for c in curr.get_children():
			stack.append(c)
	return total


# ─── Tests ───────────────────────────────────────────────────────────────────


func test_visual_model_hierarchy() -> bool:
	var suit := _make_suit()
	var vm := suit.get_node_or_null("VisualModel")
	if vm == null:
		_drop_suit(suit)
		return false

	var required_nodes := [
		"Hips",
		"Hips/PelvisMesh",
		"Hips/Spine",
		"Hips/Spine/ChestMesh",
		"Hips/Spine/ShirtMesh",
		"Hips/Spine/TieMesh",
		"Hips/Spine/Neck",
		"Hips/Spine/Neck/Head",
		"Hips/Spine/Neck/Head/HeadMesh",
		"Hips/Spine/LeftShoulder",
		"Hips/Spine/LeftShoulder/LeftElbow",
		"Hips/Spine/LeftShoulder/LeftElbow/LeftHand",
		"Hips/Spine/RightShoulder",
		"Hips/Spine/RightShoulder/RightElbow",
		"Hips/Spine/RightShoulder/RightElbow/RightHand",
		"Hips/LeftHip",
		"Hips/LeftHip/LeftKnee",
		"Hips/LeftHip/LeftKnee/LeftAnkle",
		"Hips/RightHip",
		"Hips/RightHip/RightKnee",
		"Hips/RightHip/RightKnee/RightAnkle",
	]

	for path in required_nodes:
		if vm.get_node_or_null(path) == null:
			printerr("Missing required rig node: ", path)
			_drop_suit(suit)
			return false

	_drop_suit(suit)
	return true


func test_triangle_count_under_2k() -> bool:
	var suit := _make_suit()
	var vm := suit.get_node_or_null("VisualModel")
	if vm == null:
		_drop_suit(suit)
		return false

	var tris := _count_triangles(vm)
	_drop_suit(suit)
	# Budget is ~2k tris. Model should be low-poly but detailed enough (between 400 and 2000).
	return tris > 400 and tris <= 2000


func test_no_shadows_recursively() -> bool:
	var suit := _make_suit()
	var stack: Array[Node] = [suit]
	var all_shadows_off := true
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is GeometryInstance3D:
			var gi := node as GeometryInstance3D
			if gi.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
				all_shadows_off = false
				break
		for c in node.get_children():
			stack.append(c)

	_drop_suit(suit)
	return all_shadows_off


func test_materials_and_textures() -> bool:
	var suit := _make_suit()
	var vm := suit.get_node_or_null("VisualModel")
	if vm == null:
		_drop_suit(suit)
		return false

	var chest: MeshInstance3D = vm.find_child("ChestMesh", true, false) as MeshInstance3D
	var head: MeshInstance3D = vm.find_child("HeadMesh", true, false) as MeshInstance3D
	var shirt: MeshInstance3D = vm.find_child("ShirtMesh", true, false) as MeshInstance3D
	var tie: MeshInstance3D = vm.find_child("TieMesh", true, false) as MeshInstance3D

	if chest == null or head == null or shirt == null or tie == null:
		_drop_suit(suit)
		return false

	var chest_mat: Material = chest.mesh.material if chest.mesh else null
	var head_mat: Material = head.mesh.material if head.mesh else null

	_drop_suit(suit)
	return chest_mat != null and head_mat != null


func test_animation_player_has_all_animations() -> bool:
	var suit := _make_suit()
	var vm := suit.get_node_or_null("VisualModel")
	if vm == null:
		_drop_suit(suit)
		return false

	var player: AnimationPlayer = vm.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if player == null:
		_drop_suit(suit)
		return false

	var required := ["idle", "patrol", "approach", "search", "turn", "relocate", "despawn"]
	for anim_name in required:
		if not player.has_animation(anim_name):
			printerr("Missing animation: ", anim_name)
			_drop_suit(suit)
			return false

	_drop_suit(suit)
	return true


func test_animation_playback_on_state_changes() -> bool:
	var suit := _make_suit()
	suit.force_state(Suit.State.IDLE)
	var idle_ok := suit.get_current_animation() == "idle"

	suit.force_state(Suit.State.PATROL)
	var patrol_ok := suit.get_current_animation() == "patrol"

	suit.force_state(Suit.State.APPROACH)
	var approach_ok := suit.get_current_animation() == "approach"

	suit.force_state(Suit.State.SEARCH)
	var search_ok := suit.get_current_animation() == "search"

	suit.force_state(Suit.State.RELOCATE)
	var relocate_ok := suit.get_current_animation() == "relocate"

	_drop_suit(suit)
	return idle_ok and patrol_ok and approach_ok and search_ok and relocate_ok


func test_despawn_animation() -> bool:
	var suit := _make_suit()
	suit.spawn_at(0)
	suit.despawn()
	var despawn_anim_ok := suit.get_current_animation() == "despawn"
	_drop_suit(suit)
	return despawn_anim_ok


func test_head_torso_tracking() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	# Position player within vision cone (14 deg < 22.5 deg half-angle) and 4m ahead
	suit._player.global_position = Vector3(-1.0, 0.0, -4.0)
	suit.force_state(Suit.State.APPROACH)

	# Process frames to verify tracking lerp actively turns head towards player
	var max_lead_yaw := 0.0
	for i in range(15):
		suit._physics_process(0.05)
		var curr_yaw: float = abs(suit.get_head_tracking_rotation().y)
		if curr_yaw > max_lead_yaw:
			max_lead_yaw = curr_yaw

	# Head must have actively rotated toward player during approach turn
	var tracking_active: bool = max_lead_yaw > 0.05

	_drop_suit(suit)
	return tracking_active


func test_lod_distance_scaling() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3.ZERO

	# Near player (<14m)
	suit._player.global_position = Vector3(0, 0, -5)
	suit._physics_process(0.1)
	var near_ok: bool = not suit.is_far_lod()

	# Far player (>14m)
	suit._player.global_position = Vector3(0, 0, -25)
	suit._physics_process(0.1)
	var far_ok: bool = suit.is_far_lod()

	_drop_suit(suit)
	return near_ok and far_ok


func test_collision_and_state_machine_contract() -> bool:
	var suit := _make_suit()
	var col: CollisionShape3D = suit.get_node_or_null("CollisionShape3D") as CollisionShape3D
	if col == null or col.shape == null:
		_drop_suit(suit)
		return false

	var shape: CapsuleShape3D = col.shape as CapsuleShape3D
	var shape_ok: bool = shape != null and is_equal_approx(shape.radius, 0.35) and is_equal_approx(shape.height, 1.8)
	var layer_ok: bool = suit.collision_layer == 8 and suit.collision_mask == 1

	_drop_suit(suit)
	return shape_ok and layer_ok


## The rig is authored facing +Z; the body walks toward its own -Z. The model has to be
## corrected once, or every Suit walks backwards with its tie on the wrong side.
func test_visual_forward_matches_body_forward() -> bool:
	var suit := _make_suit()
	var vm := suit.get_node_or_null("VisualModel") as Node3D
	if vm == null:
		_drop_suit(suit)
		return false

	var model_front: Vector3 = vm.global_transform.basis.z
	var body_back: Vector3 = suit.global_transform.basis.z
	var faces_forward: bool = model_front.dot(body_back) < -0.99

	# The tie sits on the rig's +Z face, so it must end up on the body's -Z side.
	var tie: MeshInstance3D = vm.find_child("TieMesh", true, false) as MeshInstance3D
	var tie_in_body: Vector3 = suit.global_transform.affine_inverse() * tie.global_position
	var tie_on_front: bool = tie_in_body.z < -0.05

	_drop_suit(suit)
	return faces_forward and tie_on_front


## Aiming has a sign as well as a magnitude: a mirrored yaw reports the same angle while
## looking away from the target, which is what a magnitude-only test cannot see.
func test_head_aims_at_target_direction() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	# 45 degrees off the suit's forward, inside the 65 degree neck clamp.
	suit._player.global_position = Vector3(2.8, 1.4, -2.8)
	suit.force_state(Suit.State.APPROACH)

	# Drive the tracking tick directly: APPROACH walks the suit toward its last known
	# position, which moves the geometry under test. The aim math is what matters here.
	for i in range(40):
		suit._update_head_torso_tracking(0.05)

	var neck: Node3D = suit._neck_node
	if neck == null:
		_drop_suit(suit)
		return false

	var aim: Vector3 = neck.global_transform.basis.z
	# Tracking aims at the player's chest, 1.4 m above the player origin.
	var aim_point: Vector3 = suit._player.global_position + Vector3(0.0, 1.4, 0.0)
	var to_target: Vector3 = (aim_point - neck.global_position).normalized()
	var aims_at_target: bool = aim.dot(to_target) > 0.95
	var actually_turned: bool = absf(suit.get_head_tracking_rotation().y) > 0.2
	if not (aims_at_target and actually_turned):
		printerr("Yaw aim ", aim, " toward ", to_target, " rot ", suit.get_head_tracking_rotation())

	_drop_suit(suit)
	return aims_at_target and actually_turned


func test_head_pitch_follows_a_raised_target() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	# Raised and in front: a target whose chest sits above the neck must tilt the head up.
	suit._player.global_position = Vector3(0.0, 1.6, -2.4)
	suit.force_state(Suit.State.APPROACH)

	# Same as above: tick the tracking directly so the walk does not move the target frame.
	for i in range(40):
		suit._update_head_torso_tracking(0.05)

	var neck: Node3D = suit._neck_node
	if neck == null:
		_drop_suit(suit)
		return false

	var aim: Vector3 = neck.global_transform.basis.z.normalized()
	var aim_point: Vector3 = suit._player.global_position + Vector3(0.0, 1.4, 0.0)
	var to_target: Vector3 = (aim_point - neck.global_position).normalized()
	var looks_up: bool = aim.y > 0.2
	var aims_at_target: bool = aim.dot(to_target) > 0.9
	if not (looks_up and aims_at_target):
		printerr("Head aim ", aim, " toward ", to_target)

	_drop_suit(suit)
	return looks_up and aims_at_target


## The hide hangs off real clip completion: the engine has to play `despawn` to its end and
## report it, so a hand-emitted animation_finished cannot stand in for playback.
func test_despawn_notifies_and_defers_hide() -> bool:
	var suit := _make_suit()
	var player: AnimationPlayer = suit._anim_player
	if player == null:
		_drop_suit(suit)
		return false

	suit.spawn_at(0)
	var seen: Array = []
	suit.state_changed.connect(func(from_state: int, to_state: int) -> void: seen.append(to_state))
	var finished: Array = []
	player.animation_finished.connect(
		func(anim_name: StringName) -> void: finished.append(anim_name)
	)

	suit.despawn()
	var notified_idle: bool = seen.has(Suit.State.IDLE)
	var still_visible: bool = suit.visible
	var plays_despawn: bool = suit.get_current_animation() == "despawn"

	var tree := Engine.get_main_loop() as SceneTree
	await tree.create_timer(player.get_animation("despawn").length + 0.25).timeout
	var clip_reported: bool = finished.has(&"despawn")
	var hidden_after_clip: bool = not suit.visible

	suit.spawn_at(0)
	var visible_after_respawn: bool = suit.visible

	# A retired suit keeps running until its clip ends, then frees itself, so the exit is
	# seen instead of the node vanishing on the frame it starts.
	var retired := _make_suit()
	retired.spawn_at(0)
	retired.despawn(true)
	var alive_during_clip: bool = is_instance_valid(retired) and not retired.is_queued_for_deletion()
	await tree.create_timer(
		retired._anim_player.get_animation("despawn").length + 0.25
	).timeout
	# queue_free() is processed during the wait, so the node itself is gone by now.
	var freed_after_clip: bool = not is_instance_valid(retired)

	_drop_suit(suit)
	return (
		notified_idle
		and still_visible
		and plays_despawn
		and clip_reported
		and hidden_after_clip
		and visible_after_respawn
		and alive_during_clip
		and freed_after_clip
	)


func test_patrol_without_points_idles() -> bool:
	var suit := _make_suit()
	var no_points: Array[Vector3] = []
	suit.set_patrol_points(no_points)
	suit.global_position = Vector3(0, 0, 0)
	suit.force_state(Suit.State.PATROL)

	var start: Vector3 = suit.global_position
	for i in range(10):
		suit._physics_process(0.05)

	var idles: bool = suit.get_current_animation() == "idle"
	var stood_still: bool = suit.global_position.distance_to(start) < 0.01

	_drop_suit(suit)
	return idles and stood_still


## A Suit spawned without a route idles; a route that arrives later has to hand it back to
## PATROL, or it stands in the idle clip with somewhere to walk.
func test_route_arriving_restores_patrol() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3.ZERO
	suit.global_rotation = Vector3.ZERO
	var started_idle: bool = suit.get_state() == Suit.State.IDLE

	var route: Array[Vector3] = [Vector3(0, 0, -4)]
	suit.set_patrol_points(route)
	var walks: bool = suit.get_state() == Suit.State.PATROL
	suit._physics_process(0.05)
	var walk_clip: bool = suit.get_current_animation() == "patrol"

	# The same route can arrive while the suit already sits in PATROL with none.
	var idling := _make_suit()
	var none: Array[Vector3] = []
	idling.set_patrol_points(none)
	idling.force_state(Suit.State.PATROL)
	idling._physics_process(0.05)
	var idled: bool = idling.get_current_animation() == "idle"
	idling.set_patrol_points(route)
	idling._physics_process(0.05)
	var walked: bool = idling.get_current_animation() == "patrol"

	_drop_suit(suit)
	_drop_suit(idling)
	return started_idle and walks and walk_clip and idled and walked


## The patrol index was measured against the route it advanced through. Replacing a two-point
## route with a shorter one has to keep it in bounds, or the next patrol tick indexes past the
## end and aborts. Clearing the route resets the index, and an empty route must not
## divide by zero.
func test_shorter_route_keeps_a_valid_patrol_index() -> bool:
	var suit := _make_suit()
	var route: Array[Vector3] = [Vector3(0, 0, 2), Vector3(0, 0, 4)]
	suit.global_position = route[0]
	suit.set_patrol_points(route)
	suit.force_state(Suit.State.PATROL)
	# Standing on the first point advances the index the way real patrol movement does.
	suit._physics_process(0.05)
	var advanced: bool = suit._current_patrol_index == 1

	# Index 1 on the two-point route, then IDLE and a one-point route: the retained index is
	# now past the end of the route it belongs to.
	suit.force_state(Suit.State.IDLE)
	# Ahead of the suit's -Z facing, so the tick walks instead of starting a pivot.
	var single: Array[Vector3] = [Vector3(0, 0, -3)]
	suit.set_patrol_points(single)
	var restarted: bool = suit.get_state() == Suit.State.PATROL
	var index_bounded: bool = suit._current_patrol_index == 0
	var before: Vector3 = suit.global_position
	suit._physics_process(0.05)
	var walked: bool = suit.global_position.distance_to(before) > 0.001

	# The index has to be nonzero when the route clears, or the reset assertion cannot
	# tell a reset from an index that was already zero. Standing on the first point of a
	# fresh two-point route lets one tick advance it back to 1.
	var here: Vector3 = suit.global_position
	var again: Array[Vector3] = [here, Vector3(0, 0, 4)]
	suit.set_patrol_points(again)
	suit._physics_process(0.05)
	var re_advanced: bool = suit._current_patrol_index == 1

	# An empty route leaves no index behind, and the patrol tick idles instead of walking.
	var none: Array[Vector3] = []
	suit.set_patrol_points(none)
	var emptied: bool = suit._current_patrol_index == 0
	before = suit.global_position
	suit._physics_process(0.05)
	var idled: bool = suit.global_position.distance_to(before) < 0.001

	_drop_suit(suit)
	return advanced and restarted and index_bounded and walked and re_advanced \
		and emptied and idled


## INVESTIGATE walks 20% faster than PATROL. play()'s custom speed and the player's
## speed_scale multiply, so the rate has to live in one of them or it compounds to 1.44.
func test_playback_speed_has_one_multiplier() -> bool:
	var suit := _make_suit()
	var player: AnimationPlayer = suit._anim_player
	if player == null:
		_drop_suit(suit)
		return false

	suit.force_state(Suit.State.PATROL)
	var patrol_rate: bool = is_equal_approx(player.get_playing_speed(), 1.0)

	# IDLE -> INVESTIGATE switches to the walk clip, then the investigation tick asks for
	# the same rate again on the clip that is already playing.
	suit.force_state(Suit.State.IDLE)
	suit.global_position = Vector3.ZERO
	suit._investigate_position = Vector3(0, 0, -5)
	suit.force_state(Suit.State.INVESTIGATE)
	suit._physics_process(0.05)
	var investigate_rate: bool = is_equal_approx(player.get_playing_speed(), 1.2)

	# Switching clips must not carry the investigation multiplier into a 1.0 request.
	suit.force_state(Suit.State.APPROACH)
	var approach_rate: bool = is_equal_approx(player.get_playing_speed(), 1.0)

	suit.force_state(Suit.State.PATROL)
	var restored_rate: bool = is_equal_approx(player.get_playing_speed(), 1.0)

	_drop_suit(suit)
	return patrol_rate and investigate_rate and approach_rate and restored_rate


func test_same_clip_speed_change_applies() -> bool:
	var suit := _make_suit()
	suit.force_state(Suit.State.PATROL)
	suit._play_animation("patrol", 0.2, 1.0)
	suit._play_animation("patrol", 0.2, 1.2)

	var player: AnimationPlayer = suit._anim_player
	var same_clip: bool = player.current_animation == "patrol"
	var rate_applied: bool = is_equal_approx(player.speed_scale, 1.2)

	_drop_suit(suit)
	return same_clip and rate_applied


func test_turn_clip_on_reversal() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	# Facing -Z, the route point sits directly behind the suit.
	var behind: Array[Vector3] = [Vector3(0, 0, 5)]
	suit.set_patrol_points(behind)
	suit.force_state(Suit.State.PATROL)

	suit._physics_process(0.05)
	var plays_turn: bool = suit.get_current_animation() == "turn"
	var flagged: bool = suit._turning
	var pivot_start: Vector3 = suit.global_position
	# Only the clip's own end may release the pivot in this test: push the fallback hold out
	# of reach, so a run that never receives animation_finished fails instead of passing.
	suit._turn_hold_left = 60.0

	# Routine walk requests arrive every physics tick. They must not replace the pivot, and
	# the pivot must not carry the suit through the corner it is turning around.
	for i in range(4):
		suit._physics_process(0.05)
	var clip_held: bool = suit.get_current_animation() == "turn"
	var pivots_in_place: bool = suit.global_position.distance_to(pivot_start) < 0.01

	# Real playback: the engine ends the clip, and the handler hands the walk clip back.
	var tree := Engine.get_main_loop() as SceneTree
	await tree.create_timer(suit._anim_player.get_animation("turn").length + 0.25).timeout
	var released: bool = not suit._turning
	var walks_again: bool = suit.get_current_animation() == "patrol"

	_drop_suit(suit)
	return plays_turn and flagged and clip_held and pivots_in_place and released and walks_again


## The hold is the fallback for an AnimationPlayer that never reports the clip end. With no
## real frames pumped here the clip cannot finish, so the hold alone has to release the pivot.
func test_pivot_hold_expires_without_the_signal() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	var behind: Array[Vector3] = [Vector3(0, 0, 5)]
	suit.set_patrol_points(behind)
	suit.force_state(Suit.State.PATROL)

	suit._physics_process(0.05)
	var started: bool = suit._turning
	for i in range(8):
		suit._physics_process(0.1)
	var released: bool = not suit._turning
	var walks: bool = suit.get_current_animation() == "patrol"

	_drop_suit(suit)
	return started and released and walks


## The pursuit stutter belongs to walking: a pivot must not jump, must not advance the
## stutter timer, and must not consume a stutter that was already due when the pivot started.
## The first walking tick after the pivot is the one that spends it.
func test_pivot_preserves_pending_stutter() -> bool:
	var suit := _make_suit()
	suit.global_position = Vector3(0, 0, 0)
	suit.global_rotation = Vector3.ZERO
	suit.force_state(Suit.State.APPROACH)
	# Target directly behind the suit, so the first pursuit tick starts a pivot.
	suit._last_known_player_pos = Vector3(0, 0, 5)
	suit._stutter_timer = 0.0

	var start: Vector3 = suit.global_position
	suit._physics_process(0.05)
	var pivots: bool = suit._turning
	var pending_kept: bool = is_zero_approx(suit._stutter_timer) \
		and is_zero_approx(suit._stutter_freeze)
	var held: bool = suit.global_position.distance_to(start) < 0.001

	# Drive the hold out without pumping frames. Every tick before the hold expires is a pivot
	# tick: none may jump, advance the stutter timer, or spend the pending stutter. The first
	# tick that walks has to spend it. A freeze accepted on any later tick at all would pass
	# even if the pivot had eaten the stutter.
	var froze_while_turning := false
	var jumped_while_turning := false
	var timer_ran_while_turning := false
	var walked_at := -1
	var froze_on_first_walk := false
	var moved_on_first_walk := false
	for i in range(8):
		suit._physics_process(0.1)
		if suit._turning:
			froze_while_turning = froze_while_turning or suit._stutter_freeze > 0.0
			timer_ran_while_turning = timer_ran_while_turning \
				or not is_zero_approx(suit._stutter_timer)
			jumped_while_turning = jumped_while_turning \
				or suit.global_position.distance_to(start) > 0.001
		elif walked_at < 0:
			walked_at = i
			froze_on_first_walk = suit._stutter_freeze > 0.0
			moved_on_first_walk = suit.global_position.distance_to(start) > 0.001

	_drop_suit(suit)
	return pivots and pending_kept and held and walked_at > 0 \
		and not froze_while_turning and not jumped_while_turning \
		and not timer_ran_while_turning and froze_on_first_walk and moved_on_first_walk


func test_every_clip_keys_joints() -> bool:
	var suit := _make_suit()
	var player: AnimationPlayer = suit._anim_player
	if player == null:
		_drop_suit(suit)
		return false

	var required := [
		"Hips:position",
		"Hips/Spine:rotation",
		"Hips/Spine/Neck/Head:rotation",
		"Hips/Spine/LeftShoulder/LeftElbow:rotation",
		"Hips/Spine/RightShoulder/RightElbow:rotation",
		"Hips/LeftHip/LeftKnee:rotation",
		"Hips/RightHip/RightKnee:rotation",
	]
	var all_keyed := true
	for anim_name in player.get_animation_list():
		var anim: Animation = player.get_animation(anim_name)
		for path in required:
			if anim.find_track(NodePath(path), Animation.TYPE_VALUE) == -1:
				printerr("Animation missing track ", path, " in ", anim_name)
				all_keyed = false

	_drop_suit(suit)
	return all_keyed
