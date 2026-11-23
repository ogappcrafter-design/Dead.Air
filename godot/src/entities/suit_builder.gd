@tool
## suit_builder.gd — Procedural generator and scene builder for The Suit (DEA-180)
## Creates a low-poly rigged suited humanoid figure (~1.6k tris) with AnimationPlayer
## and full animation set (idle, patrol, approach, search, turn, relocate, despawn).
class_name SuitBuilder
extends RefCounted

const SUIT_WOOL_TEX = "res://assets/textures/environment/suit_wool.jpg"
const SUIT_WOOL_NRM = "res://assets/textures/environment/suit_wool_normal.jpg"
const SUIT_WOOL_RGH = "res://assets/textures/environment/suit_wool_roughness.jpg"

const CHARCOAL_COLOR = Color(0.1, 0.1, 0.1, 1.0)
const SHIRT_COLOR = Color(0.92, 0.92, 0.92, 1.0)
const TIE_COLOR = Color(0.06, 0.06, 0.06, 1.0)
const SKIN_COLOR = Color(0.78, 0.72, 0.66, 1.0)
const SHOE_COLOR = Color(0.05, 0.05, 0.05, 1.0)

## The rig is authored facing +Z: the tie and chest sit on +Z, the toes point at +Z and the
## head's front face is +Z. The Suit body moves and looks along -Z, so the visual root is
## rotated 180 degrees once, here, instead of every consumer compensating for it.
const VISUAL_FORWARD_CORRECTION := PI

## Rest pose of the hips joint. Clips that do not drive the hips must key this explicitly,
## otherwise the character keeps whatever height the previous clip left it at.
const HIPS_REST_POSITION := Vector3(0.0, 0.95, 0.0)

## Rig joints that swing a limb away from the body. A clip that leaves one of them unkeyed
## inherits the pose from the clip before it (legs stuck mid-stride, arms frozen in a run),
## so every clip gets an explicit neutral key on each joint it does not drive. The Neck joint
## is deliberately absent: head tracking writes it at runtime and no clip may key it.
const ANIMATED_JOINT_PATHS: Array[String] = [
	"Hips/Spine",
	"Hips/Spine/Neck/Head",
	"Hips/Spine/LeftShoulder",
	"Hips/Spine/LeftShoulder/LeftElbow",
	"Hips/Spine/RightShoulder",
	"Hips/Spine/RightShoulder/RightElbow",
	"Hips/LeftHip",
	"Hips/LeftHip/LeftKnee",
	"Hips/RightHip",
	"Hips/RightHip/RightKnee",
]


## Builds the complete rigged VisualModel Node3D with materials, meshes, and AnimationPlayer.
static func build_suit_visuals() -> Node3D:
	var root := Node3D.new()
	root.name = "VisualModel"
	root.rotation.y = VISUAL_FORWARD_CORRECTION

	# Load textures
	var tex_wool: Texture2D = load(SUIT_WOOL_TEX) if ResourceLoader.exists(SUIT_WOOL_TEX) else null
	var nrm_wool: Texture2D = load(SUIT_WOOL_NRM) if ResourceLoader.exists(SUIT_WOOL_NRM) else null
	var rgh_wool: Texture2D = load(SUIT_WOOL_RGH) if ResourceLoader.exists(SUIT_WOOL_RGH) else null

	# Materials
	var mat_suit := StandardMaterial3D.new()
	mat_suit.albedo_color = CHARCOAL_COLOR
	if tex_wool:
		mat_suit.albedo_texture = tex_wool
		mat_suit.uv1_scale = Vector3(1.5, 1.5, 1.5)
	if nrm_wool:
		mat_suit.normal_enabled = true
		mat_suit.normal_texture = nrm_wool
	if rgh_wool:
		mat_suit.roughness_texture = rgh_wool
	mat_suit.roughness = 0.9

	var mat_skin := StandardMaterial3D.new()
	mat_skin.albedo_color = SKIN_COLOR
	mat_skin.roughness = 1.0

	var mat_shirt := StandardMaterial3D.new()
	mat_shirt.albedo_color = SHIRT_COLOR
	mat_shirt.roughness = 0.8

	var mat_tie := StandardMaterial3D.new()
	mat_tie.albedo_color = TIE_COLOR
	mat_tie.roughness = 0.9

	var mat_shoe := StandardMaterial3D.new()
	mat_shoe.albedo_color = SHOE_COLOR
	mat_shoe.roughness = 0.4
	mat_shoe.metallic = 0.2

	# --- Rig Hierarchy ---
	# Hips pivot at ~0.95m
	var hips := Node3D.new()
	hips.name = "Hips"
	hips.position = Vector3(0.0, 0.95, 0.0)
	root.add_child(hips)

	# Pelvis / Lower Jacket mesh
	var pelvis_mesh := _create_box_mesh(Vector3(0.36, 0.22, 0.24), mat_suit)
	var pelvis_inst := _create_mesh_instance("PelvisMesh", pelvis_mesh)
	pelvis_inst.position = Vector3(0.0, 0.0, 0.0)
	hips.add_child(pelvis_inst)

	# Spine / Chest pivot
	var spine := Node3D.new()
	spine.name = "Spine"
	spine.position = Vector3(0.0, 0.12, 0.0)
	hips.add_child(spine)

	# Chest / Suit Jacket mesh (tapered waist to shoulders)
	var chest_mesh := _create_box_mesh(Vector3(0.42, 0.42, 0.24), mat_suit)
	var chest_inst := _create_mesh_instance("ChestMesh", chest_mesh)
	chest_inst.position = Vector3(0.0, 0.21, 0.0)
	spine.add_child(chest_inst)

	# White shirt collar/chest panel
	var shirt_mesh := _create_box_mesh(Vector3(0.14, 0.32, 0.02), mat_shirt)
	var shirt_inst := _create_mesh_instance("ShirtMesh", shirt_mesh)
	shirt_inst.position = Vector3(0.0, 0.26, 0.122)
	spine.add_child(shirt_inst)

	# Tie
	var tie_mesh := _create_box_mesh(Vector3(0.045, 0.34, 0.02), mat_tie)
	var tie_inst := _create_mesh_instance("TieMesh", tie_mesh)
	tie_inst.position = Vector3(0.0, 0.22, 0.133)
	spine.add_child(tie_inst)

	# Neck pivot
	var neck := Node3D.new()
	neck.name = "Neck"
	neck.position = Vector3(0.0, 0.42, 0.0)
	spine.add_child(neck)

	var neck_mesh := _create_cylinder_mesh(0.06, 0.10, mat_skin)
	var neck_inst := _create_mesh_instance("NeckMesh", neck_mesh)
	neck_inst.position = Vector3(0.0, 0.05, 0.0)
	neck.add_child(neck_inst)

	# Head pivot
	var head := Node3D.new()
	head.name = "Head"
	head.position = Vector3(0.0, 0.10, 0.0)
	neck.add_child(head)

	# Faceless head mesh (smooth oval/egg sphere)
	var head_mesh := _create_sphere_mesh(0.13, 0.26, mat_skin)
	var head_inst := _create_mesh_instance("HeadMesh", head_mesh)
	head_inst.position = Vector3(0.0, 0.13, 0.0)
	head.add_child(head_inst)

	# Left Arm
	var l_shoulder := Node3D.new()
	l_shoulder.name = "LeftShoulder"
	l_shoulder.position = Vector3(0.24, 0.38, 0.0)
	spine.add_child(l_shoulder)

	var l_upper_mesh := _create_box_mesh(Vector3(0.11, 0.30, 0.12), mat_suit)
	var l_upper_inst := _create_mesh_instance("LeftUpperArmMesh", l_upper_mesh)
	l_upper_inst.position = Vector3(0.0, -0.15, 0.0)
	l_shoulder.add_child(l_upper_inst)

	var l_elbow := Node3D.new()
	l_elbow.name = "LeftElbow"
	l_elbow.position = Vector3(0.0, -0.30, 0.0)
	l_shoulder.add_child(l_elbow)

	var l_fore_mesh := _create_box_mesh(Vector3(0.09, 0.28, 0.10), mat_suit)
	var l_fore_inst := _create_mesh_instance("LeftForearmMesh", l_fore_mesh)
	l_fore_inst.position = Vector3(0.0, -0.14, 0.0)
	l_elbow.add_child(l_fore_inst)

	var l_hand := Node3D.new()
	l_hand.name = "LeftHand"
	l_hand.position = Vector3(0.0, -0.28, 0.0)
	l_elbow.add_child(l_hand)

	var l_hand_mesh := _create_box_mesh(Vector3(0.07, 0.13, 0.05), mat_skin)
	var l_hand_inst := _create_mesh_instance("LeftHandMesh", l_hand_mesh)
	l_hand_inst.position = Vector3(0.0, -0.065, 0.0)
	l_hand.add_child(l_hand_inst)

	# Right Arm
	var r_shoulder := Node3D.new()
	r_shoulder.name = "RightShoulder"
	r_shoulder.position = Vector3(-0.24, 0.38, 0.0)
	spine.add_child(r_shoulder)

	var r_upper_mesh := _create_box_mesh(Vector3(0.11, 0.30, 0.12), mat_suit)
	var r_upper_inst := _create_mesh_instance("RightUpperArmMesh", r_upper_mesh)
	r_upper_inst.position = Vector3(0.0, -0.15, 0.0)
	r_shoulder.add_child(r_upper_inst)

	var r_elbow := Node3D.new()
	r_elbow.name = "RightElbow"
	r_elbow.position = Vector3(0.0, -0.30, 0.0)
	r_shoulder.add_child(r_elbow)

	var r_fore_mesh := _create_box_mesh(Vector3(0.09, 0.28, 0.10), mat_suit)
	var r_fore_inst := _create_mesh_instance("RightForearmMesh", r_fore_mesh)
	r_fore_inst.position = Vector3(0.0, -0.14, 0.0)
	r_elbow.add_child(r_fore_inst)

	var r_hand := Node3D.new()
	r_hand.name = "RightHand"
	r_hand.position = Vector3(0.0, -0.28, 0.0)
	r_elbow.add_child(r_hand)

	var r_hand_mesh := _create_box_mesh(Vector3(0.07, 0.13, 0.05), mat_skin)
	var r_hand_inst := _create_mesh_instance("RightHandMesh", r_hand_mesh)
	r_hand_inst.position = Vector3(0.0, -0.065, 0.0)
	r_hand.add_child(r_hand_inst)

	# Left Leg
	var l_hip := Node3D.new()
	l_hip.name = "LeftHip"
	l_hip.position = Vector3(0.11, -0.10, 0.0)
	hips.add_child(l_hip)

	var l_thigh_mesh := _create_box_mesh(Vector3(0.14, 0.40, 0.15), mat_suit)
	var l_thigh_inst := _create_mesh_instance("LeftThighMesh", l_thigh_mesh)
	l_thigh_inst.position = Vector3(0.0, -0.20, 0.0)
	l_hip.add_child(l_thigh_inst)

	var l_knee := Node3D.new()
	l_knee.name = "LeftKnee"
	l_knee.position = Vector3(0.0, -0.40, 0.0)
	l_hip.add_child(l_knee)

	var l_shin_mesh := _create_box_mesh(Vector3(0.12, 0.40, 0.13), mat_suit)
	var l_shin_inst := _create_mesh_instance("LeftShinMesh", l_shin_mesh)
	l_shin_inst.position = Vector3(0.0, -0.20, 0.0)
	l_knee.add_child(l_shin_inst)

	var l_ankle := Node3D.new()
	l_ankle.name = "LeftAnkle"
	l_ankle.position = Vector3(0.0, -0.40, 0.0)
	l_knee.add_child(l_ankle)

	var l_foot_mesh := _create_box_mesh(Vector3(0.10, 0.08, 0.22), mat_shoe)
	var l_foot_inst := _create_mesh_instance("LeftFootMesh", l_foot_mesh)
	l_foot_inst.position = Vector3(0.0, -0.04, 0.05)
	l_ankle.add_child(l_foot_inst)

	# Right Leg
	var r_hip := Node3D.new()
	r_hip.name = "RightHip"
	r_hip.position = Vector3(-0.11, -0.10, 0.0)
	hips.add_child(r_hip)

	var r_thigh_mesh := _create_box_mesh(Vector3(0.14, 0.40, 0.15), mat_suit)
	var r_thigh_inst := _create_mesh_instance("RightThighMesh", r_thigh_mesh)
	r_thigh_inst.position = Vector3(0.0, -0.20, 0.0)
	r_hip.add_child(r_thigh_inst)

	var r_knee := Node3D.new()
	r_knee.name = "RightKnee"
	r_knee.position = Vector3(0.0, -0.40, 0.0)
	r_hip.add_child(r_knee)

	var r_shin_mesh := _create_box_mesh(Vector3(0.12, 0.40, 0.13), mat_suit)
	var r_shin_inst := _create_mesh_instance("RightShinMesh", r_shin_mesh)
	r_shin_inst.position = Vector3(0.0, -0.20, 0.0)
	r_knee.add_child(r_shin_inst)

	var r_ankle := Node3D.new()
	r_ankle.name = "RightAnkle"
	r_ankle.position = Vector3(0.0, -0.40, 0.0)
	r_knee.add_child(r_ankle)

	var r_foot_mesh := _create_box_mesh(Vector3(0.10, 0.08, 0.22), mat_shoe)
	var r_foot_inst := _create_mesh_instance("RightFootMesh", r_foot_mesh)
	r_foot_inst.position = Vector3(0.0, -0.04, 0.05)
	r_ankle.add_child(r_foot_inst)

	# Build AnimationPlayer with full animation set
	var anim_player := _create_suit_animation_player()
	root.add_child(anim_player)

	return root


## Helper to create a BoxMesh with specified size and material
static func _create_box_mesh(size: Vector3, material: Material) -> BoxMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh.material = material
	return mesh


## Helper to create a CylinderMesh with specified radius, height, and material
static func _create_cylinder_mesh(radius: float, height: float, material: Material) -> CylinderMesh:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	mesh.material = material
	return mesh


## Helper to create a SphereMesh with specified radius, height, and material
static func _create_sphere_mesh(radius: float, height: float, material: Material) -> SphereMesh:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = height
	mesh.radial_segments = 16
	mesh.rings = 10
	mesh.material = material
	return mesh


## Helper to create a MeshInstance3D with shadow casting OFF
static func _create_mesh_instance(name_str: String, mesh: Mesh) -> MeshInstance3D:
	var inst := MeshInstance3D.new()
	inst.name = name_str
	inst.mesh = mesh
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return inst


## Builds the AnimationPlayer containing all required animations:
## idle, patrol, approach, search, turn, relocate, despawn
static func _create_suit_animation_player() -> AnimationPlayer:
	var player := AnimationPlayer.new()
	player.name = "AnimationPlayer"

	var lib := AnimationLibrary.new()
	lib.add_animation("idle", _build_idle_animation())
	lib.add_animation("patrol", _build_patrol_animation())
	lib.add_animation("approach", _build_approach_animation())
	lib.add_animation("search", _build_search_animation())
	lib.add_animation("turn", _build_turn_animation())
	lib.add_animation("relocate", _build_relocate_animation())
	lib.add_animation("despawn", _build_despawn_animation())

	for anim_name in lib.get_animation_list():
		_add_neutral_joint_keys(lib.get_animation(anim_name))

	player.add_animation_library("", lib)
	return player


## Keys the rest pose on every animated joint an animation does not drive itself.
static func _add_neutral_joint_keys(anim: Animation) -> void:
	var length: float = anim.length
	for path in ANIMATED_JOINT_PATHS:
		if anim.find_track(NodePath(path + ":rotation"), Animation.TYPE_VALUE) != -1:
			continue
		var track := anim.add_track(Animation.TYPE_VALUE)
		anim.track_set_path(track, NodePath(path + ":rotation"))
		anim.track_insert_key(track, 0.0, Vector3.ZERO)
		anim.track_insert_key(track, length, Vector3.ZERO)
	if anim.find_track(NodePath("Hips:position"), Animation.TYPE_VALUE) == -1:
		var hips_track := anim.add_track(Animation.TYPE_VALUE)
		anim.track_set_path(hips_track, NodePath("Hips:position"))
		anim.track_insert_key(hips_track, 0.0, HIPS_REST_POSITION)
		anim.track_insert_key(hips_track, length, HIPS_REST_POSITION)


## ─── Animation Builders ──────────────────────────────────────────────────

static func _build_idle_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 2.4
	anim.loop_mode = Animation.LOOP_LINEAR

	# Subtle chest breathing
	var t_spine_p := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_spine_p, "Hips/Spine:position")
	anim.track_insert_key(t_spine_p, 0.0, Vector3(0.0, 0.12, 0.0))
	anim.track_insert_key(t_spine_p, 1.2, Vector3(0.0, 0.13, 0.0))
	anim.track_insert_key(t_spine_p, 2.4, Vector3(0.0, 0.12, 0.0))

	# Subtle arm sway
	var t_l_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_arm, "Hips/Spine/LeftShoulder:rotation")
	anim.track_insert_key(t_l_arm, 0.0, Vector3(0.02, 0.0, -0.04))
	anim.track_insert_key(t_l_arm, 1.2, Vector3(-0.02, 0.0, -0.02))
	anim.track_insert_key(t_l_arm, 2.4, Vector3(0.02, 0.0, -0.04))

	var t_r_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_arm, "Hips/Spine/RightShoulder:rotation")
	anim.track_insert_key(t_r_arm, 0.0, Vector3(0.02, 0.0, 0.04))
	anim.track_insert_key(t_r_arm, 1.2, Vector3(-0.02, 0.0, 0.02))
	anim.track_insert_key(t_r_arm, 2.4, Vector3(0.02, 0.0, 0.04))

	# Slight head tilt/uncanny micro-glance
	var t_head := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_head, "Hips/Spine/Neck/Head:rotation")
	anim.track_insert_key(t_head, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_head, 0.8, Vector3(0.03, 0.05, -0.02))
	anim.track_insert_key(t_head, 1.6, Vector3(-0.02, -0.04, 0.02))
	anim.track_insert_key(t_head, 2.4, Vector3(0.0, 0.0, 0.0))

	return anim


static func _build_patrol_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 1.2
	anim.loop_mode = Animation.LOOP_LINEAR

	# Pelvis bob
	var t_hips := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_hips, "Hips:position")
	anim.track_insert_key(t_hips, 0.0, Vector3(0.0, 0.95, 0.0))
	anim.track_insert_key(t_hips, 0.3, Vector3(0.0, 0.97, 0.0))
	anim.track_insert_key(t_hips, 0.6, Vector3(0.0, 0.95, 0.0))
	anim.track_insert_key(t_hips, 0.9, Vector3(0.0, 0.97, 0.0))
	anim.track_insert_key(t_hips, 1.2, Vector3(0.0, 0.95, 0.0))

	# Left Hip stride (pitch)
	var t_l_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_hip, "Hips/LeftHip:rotation")
	anim.track_insert_key(t_l_hip, 0.0, Vector3(0.35, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.3, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.6, Vector3(-0.35, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.9, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 1.2, Vector3(0.35, 0.0, 0.0))

	# Left Knee bend
	var t_l_knee := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_knee, "Hips/LeftHip/LeftKnee:rotation")
	anim.track_insert_key(t_l_knee, 0.0, Vector3(0.05, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 0.3, Vector3(0.15, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 0.6, Vector3(0.40, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 0.9, Vector3(0.20, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 1.2, Vector3(0.05, 0.0, 0.0))

	# Right Hip stride (opposite)
	var t_r_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_hip, "Hips/RightHip:rotation")
	anim.track_insert_key(t_r_hip, 0.0, Vector3(-0.35, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.3, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.6, Vector3(0.35, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.9, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 1.2, Vector3(-0.35, 0.0, 0.0))

	# Right Knee bend
	var t_r_knee := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_knee, "Hips/RightHip/RightKnee:rotation")
	anim.track_insert_key(t_r_knee, 0.0, Vector3(0.40, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 0.3, Vector3(0.20, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 0.6, Vector3(0.05, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 0.9, Vector3(0.15, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 1.2, Vector3(0.40, 0.0, 0.0))

	# Left Shoulder swing (opposite to left leg)
	var t_l_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_arm, "Hips/Spine/LeftShoulder:rotation")
	anim.track_insert_key(t_l_arm, 0.0, Vector3(-0.25, 0.0, -0.05))
	anim.track_insert_key(t_l_arm, 0.6, Vector3(0.25, 0.0, -0.05))
	anim.track_insert_key(t_l_arm, 1.2, Vector3(-0.25, 0.0, -0.05))

	# Right Shoulder swing
	var t_r_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_arm, "Hips/Spine/RightShoulder:rotation")
	anim.track_insert_key(t_r_arm, 0.0, Vector3(0.25, 0.0, 0.05))
	anim.track_insert_key(t_r_arm, 0.6, Vector3(-0.25, 0.0, 0.05))
	anim.track_insert_key(t_r_arm, 1.2, Vector3(0.25, 0.0, 0.05))

	return anim


static func _build_approach_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 0.7
	anim.loop_mode = Animation.LOOP_LINEAR

	# Fast, stiff, menacing pursuit stride
	var t_hips := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_hips, "Hips:position")
	anim.track_insert_key(t_hips, 0.0, Vector3(0.0, 0.94, 0.0))
	anim.track_insert_key(t_hips, 0.175, Vector3(0.0, 0.965, 0.0))
	anim.track_insert_key(t_hips, 0.35, Vector3(0.0, 0.94, 0.0))
	anim.track_insert_key(t_hips, 0.525, Vector3(0.0, 0.965, 0.0))
	anim.track_insert_key(t_hips, 0.7, Vector3(0.0, 0.94, 0.0))

	# Spine leaned menacingly forward
	var t_spine := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_spine, "Hips/Spine:rotation")
	anim.track_insert_key(t_spine, 0.0, Vector3(0.08, 0.0, 0.0))
	anim.track_insert_key(t_spine, 0.35, Vector3(0.08, 0.02, 0.0))
	anim.track_insert_key(t_spine, 0.7, Vector3(0.08, 0.0, 0.0))

	# Left Hip stride
	var t_l_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_hip, "Hips/LeftHip:rotation")
	anim.track_insert_key(t_l_hip, 0.0, Vector3(0.48, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.35, Vector3(-0.48, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.7, Vector3(0.48, 0.0, 0.0))

	# Left Knee
	var t_l_knee := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_knee, "Hips/LeftHip/LeftKnee:rotation")
	anim.track_insert_key(t_l_knee, 0.0, Vector3(0.10, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 0.35, Vector3(0.45, 0.0, 0.0))
	anim.track_insert_key(t_l_knee, 0.7, Vector3(0.10, 0.0, 0.0))

	# Right Hip stride
	var t_r_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_hip, "Hips/RightHip:rotation")
	anim.track_insert_key(t_r_hip, 0.0, Vector3(-0.48, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.35, Vector3(0.48, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.7, Vector3(-0.48, 0.0, 0.0))

	# Right Knee
	var t_r_knee := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_knee, "Hips/RightHip/RightKnee:rotation")
	anim.track_insert_key(t_r_knee, 0.0, Vector3(0.45, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 0.35, Vector3(0.10, 0.0, 0.0))
	anim.track_insert_key(t_r_knee, 0.7, Vector3(0.45, 0.0, 0.0))

	# Stiff arms held slightly forward
	var t_l_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_arm, "Hips/Spine/LeftShoulder:rotation")
	anim.track_insert_key(t_l_arm, 0.0, Vector3(-0.20, 0.0, -0.08))
	anim.track_insert_key(t_l_arm, 0.35, Vector3(0.30, 0.0, -0.08))
	anim.track_insert_key(t_l_arm, 0.7, Vector3(-0.20, 0.0, -0.08))

	var t_r_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_arm, "Hips/Spine/RightShoulder:rotation")
	anim.track_insert_key(t_r_arm, 0.0, Vector3(0.30, 0.0, 0.08))
	anim.track_insert_key(t_r_arm, 0.35, Vector3(-0.20, 0.0, 0.08))
	anim.track_insert_key(t_r_arm, 0.7, Vector3(0.30, 0.0, 0.08))

	return anim


static func _build_search_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 2.4
	anim.loop_mode = Animation.LOOP_LINEAR

	# Upper body sweeps left and right searching
	var t_spine := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_spine, "Hips/Spine:rotation")
	anim.track_insert_key(t_spine, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_spine, 0.6, Vector3(0.04, 0.35, 0.0))
	anim.track_insert_key(t_spine, 1.2, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_spine, 1.8, Vector3(0.04, -0.35, 0.0))
	anim.track_insert_key(t_spine, 2.4, Vector3(0.0, 0.0, 0.0))

	# Head turns sharply and scans upwards
	var t_head := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_head, "Hips/Spine/Neck/Head:rotation")
	anim.track_insert_key(t_head, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_head, 0.6, Vector3(0.08, 0.45, 0.02))
	anim.track_insert_key(t_head, 1.2, Vector3(-0.05, 0.0, 0.0))
	anim.track_insert_key(t_head, 1.8, Vector3(0.08, -0.45, -0.02))
	anim.track_insert_key(t_head, 2.4, Vector3(0.0, 0.0, 0.0))

	# Arms resting with slight tension
	var t_l_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_arm, "Hips/Spine/LeftShoulder:rotation")
	anim.track_insert_key(t_l_arm, 0.0, Vector3(0.05, 0.0, -0.06))
	anim.track_insert_key(t_l_arm, 1.2, Vector3(0.08, 0.0, -0.08))
	anim.track_insert_key(t_l_arm, 2.4, Vector3(0.05, 0.0, -0.06))

	var t_r_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_arm, "Hips/Spine/RightShoulder:rotation")
	anim.track_insert_key(t_r_arm, 0.0, Vector3(0.05, 0.0, 0.06))
	anim.track_insert_key(t_r_arm, 1.2, Vector3(0.08, 0.0, 0.08))
	anim.track_insert_key(t_r_arm, 2.4, Vector3(0.05, 0.0, 0.06))

	return anim


static func _build_turn_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 0.5
	anim.loop_mode = Animation.LOOP_NONE

	# Quick pivot step
	var t_hips := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_hips, "Hips:position")
	anim.track_insert_key(t_hips, 0.0, Vector3(0.0, 0.95, 0.0))
	anim.track_insert_key(t_hips, 0.25, Vector3(0.0, 0.97, 0.0))
	anim.track_insert_key(t_hips, 0.5, Vector3(0.0, 0.95, 0.0))

	var t_l_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_hip, "Hips/LeftHip:rotation")
	anim.track_insert_key(t_l_hip, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_l_hip, 0.25, Vector3(0.20, 0.15, 0.0))
	anim.track_insert_key(t_l_hip, 0.5, Vector3(0.0, 0.0, 0.0))

	var t_r_hip := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_hip, "Hips/RightHip:rotation")
	anim.track_insert_key(t_r_hip, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_r_hip, 0.25, Vector3(-0.20, -0.15, 0.0))
	anim.track_insert_key(t_r_hip, 0.5, Vector3(0.0, 0.0, 0.0))

	return anim


static func _build_relocate_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 1.0
	anim.loop_mode = Animation.LOOP_NONE

	# Lean forward and extend arms to seize / manage the player
	var t_spine := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_spine, "Hips/Spine:rotation")
	anim.track_insert_key(t_spine, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_spine, 0.4, Vector3(0.18, 0.0, 0.0))
	anim.track_insert_key(t_spine, 1.0, Vector3(0.20, 0.0, 0.0))

	# Left arm reaches out
	var t_l_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_arm, "Hips/Spine/LeftShoulder:rotation")
	anim.track_insert_key(t_l_arm, 0.0, Vector3(0.0, 0.0, -0.05))
	anim.track_insert_key(t_l_arm, 0.4, Vector3(-1.10, 0.20, -0.10))
	anim.track_insert_key(t_l_arm, 1.0, Vector3(-1.20, 0.25, -0.12))

	var t_l_elbow := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_l_elbow, "Hips/Spine/LeftShoulder/LeftElbow:rotation")
	anim.track_insert_key(t_l_elbow, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_l_elbow, 0.4, Vector3(0.35, 0.0, 0.0))
	anim.track_insert_key(t_l_elbow, 1.0, Vector3(0.40, 0.0, 0.0))

	# Right arm reaches out
	var t_r_arm := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_arm, "Hips/Spine/RightShoulder:rotation")
	anim.track_insert_key(t_r_arm, 0.0, Vector3(0.0, 0.0, 0.05))
	anim.track_insert_key(t_r_arm, 0.4, Vector3(-1.10, -0.20, 0.10))
	anim.track_insert_key(t_r_arm, 1.0, Vector3(-1.20, -0.25, 0.12))

	var t_r_elbow := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_r_elbow, "Hips/Spine/RightShoulder/RightElbow:rotation")
	anim.track_insert_key(t_r_elbow, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_r_elbow, 0.4, Vector3(0.35, 0.0, 0.0))
	anim.track_insert_key(t_r_elbow, 1.0, Vector3(0.40, 0.0, 0.0))

	return anim


static func _build_despawn_animation() -> Animation:
	var anim := Animation.new()
	anim.length = 1.0
	anim.loop_mode = Animation.LOOP_NONE

	# Sink into the floor with arms down
	var t_hips := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_hips, "Hips:position")
	anim.track_insert_key(t_hips, 0.0, Vector3(0.0, 0.95, 0.0))
	anim.track_insert_key(t_hips, 1.0, Vector3(0.0, -0.50, 0.0))

	var t_head := anim.add_track(Animation.TYPE_VALUE)
	anim.track_set_path(t_head, "Hips/Spine/Neck/Head:rotation")
	anim.track_insert_key(t_head, 0.0, Vector3(0.0, 0.0, 0.0))
	anim.track_insert_key(t_head, 0.5, Vector3(-0.35, 0.0, 0.0))
	anim.track_insert_key(t_head, 1.0, Vector3(-0.45, 0.0, 0.0))

	return anim
