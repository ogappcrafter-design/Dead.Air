extends SceneTree

const SuitBuilderScript = preload("res://src/entities/suit_builder.gd")

func _init() -> void:
	print("--- Generating Suit Model Scene ---")
	var root: Node3D = SuitBuilderScript.build_suit_visuals()
	if root == null:
		push_error("Failed to build suit visuals")
		quit(1)
		return

	# Calculate triangle count and verify hierarchy
	var total_triangles := 0
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var node: Node = stack.pop_back()
		if node is MeshInstance3D and (node as MeshInstance3D).mesh != null:
			var mesh: Mesh = (node as MeshInstance3D).mesh
			for surf in range(mesh.get_surface_count()):
				var arrays := mesh.surface_get_arrays(surf)
				if arrays.size() > Mesh.ARRAY_INDEX and arrays[Mesh.ARRAY_INDEX] != null:
					var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
					total_triangles += indices.size() / 3
				elif arrays.size() > Mesh.ARRAY_VERTEX and arrays[Mesh.ARRAY_VERTEX] != null:
					var verts: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
					total_triangles += verts.size() / 3
		for c in node.get_children():
			stack.append(c)

	print("Total triangle count: %d" % total_triangles)

	# Verify AnimationPlayer
	var anim_player: AnimationPlayer = root.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if anim_player == null:
		push_error("Missing AnimationPlayer")
		quit(1)
		return

	var anim_list := anim_player.get_animation_list()
	print("Animations in AnimationPlayer: %s" % str(anim_list))

	# Pack scene
	var packed_scene := PackedScene.new()
	# Set owner for all descendants so pack() includes them
	_set_owner_recursive(root, root)
	var pack_res := packed_scene.pack(root)
	if pack_res != OK:
		push_error("Failed to pack scene: %d" % pack_res)
		quit(1)
		return

	var save_path := "res://scenes/entities/suit_model.tscn"
	var err := ResourceSaver.save(packed_scene, save_path)
	if err != OK:
		push_error("Failed to save scene to %s: %d" % [save_path, err])
		quit(1)
		return

	print("Successfully saved suit_model.tscn to %s" % save_path)
	quit(0)


func _set_owner_recursive(node: Node, scene_root: Node) -> void:
	for child in node.get_children():
		child.owner = scene_root
		_set_owner_recursive(child, scene_root)
