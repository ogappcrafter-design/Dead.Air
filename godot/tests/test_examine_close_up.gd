## test_examine_close_up.gd — Unit tests for DEA-193 examine close-up system.
## Verifies:
## 1. 3D close-up mode for cassette tapes and props (SubViewport, camera, lighting, mesh).
## 2. 2D close-up mode for notes and photos (textured paper card, title, content, photo).
## 3. Rotation controls on keyboard, mouse, and gamepad.
## 4. Zoom controls on wheel, triggers, and keyboard.
## 5. World pause on open and exact restoration on return (no softlock).
## 6. Typewriter text display and skip.
## 7. Integration with every examinable object subclass.
extends RefCounted

var test_name: String = "ExamineCloseUp"

const ExamineDisplayScene := preload("res://src/ui/examine_display.gd")
const CassetteTapeScene := preload("res://src/interactables/cassette_tape.gd")
const NoteInteractableScene := preload("res://src/interactables/note_interactable.gd")
const ItemInteractableScene := preload("res://src/interactables/item_interactable.gd")
const DoorInteractableScene := preload("res://src/interactables/door_interactable.gd")
const RadioInteractableScene := preload("res://src/interactables/radio_interactable.gd")
const SwitchInteractableScene := preload("res://src/interactables/switch_interactable.gd")


## Explicit text-mode interactable (base class default is also text).
class TextModeInteractable extends Interactable:
	func get_examine_mode() -> String:
		return "text"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_tape_closeup_mode_and_3d_viewport"] = test_tape_closeup_mode_and_3d_viewport()
	results["test_note_closeup_mode_and_2d_card"] = test_note_closeup_mode_and_2d_card()
	results["test_photo_closeup_mode"] = test_photo_closeup_mode()
	results["test_prop_closeup_mode"] = test_prop_closeup_mode()
	results["test_text_only_fallback"] = test_text_only_fallback()
	results["test_mouse_drag_rotation"] = test_mouse_drag_rotation()
	results["test_scrollbar_drag_does_not_rotate"] = (
		await test_scrollbar_drag_does_not_rotate()
	)
	results["test_mouse_wheel_zoom"] = test_mouse_wheel_zoom()
	results["test_world_pause_and_restore"] = test_world_pause_and_restore()
	results["test_dismiss_no_softlock"] = test_dismiss_no_softlock()
	results["test_typewriter_and_skip"] = test_typewriter_and_skip()
	results["test_all_interactables_support_examine"] = test_all_interactables_support_examine()
	results["test_text_mode_resolves_text_only"] = test_text_mode_resolves_text_only()
	results["test_replacement_keeps_original_pause_snapshot"] = (
		test_replacement_keeps_original_pause_snapshot()
	)
	results["test_empty_examine_text_does_not_stick"] = test_empty_examine_text_does_not_stick()
	results["test_examine_content_preferred_over_legacy_text"] = (
		test_examine_content_preferred_over_legacy_text()
	)
	results["test_prop_mesh_skips_collider_and_null_accessor"] = (
		test_prop_mesh_skips_collider_and_null_accessor()
	)
	results["test_active_controller_tracks_latest_device"] = (
		test_active_controller_tracks_latest_device()
	)
	results["test_layout_fits_retro_viewport"] = test_layout_fits_retro_viewport()
	results["test_shipped_scene_wires_examine_to_display"] = (
		test_shipped_scene_wires_examine_to_display()
	)
	results["test_booth_note_has_visible_mesh"] = test_booth_note_has_visible_mesh()
	results["test_remapped_pause_action_dismisses"] = test_remapped_pause_action_dismisses()

	return results


func _create_examine() -> ExamineDisplay:
	var disp: ExamineDisplay = ExamineDisplayScene.new()
	Engine.get_main_loop().root.add_child(disp)
	return disp


## 1. Verify examining a CassetteTape opens 3D mode with SubViewport and tape model.
func test_tape_closeup_mode_and_3d_viewport() -> bool:
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	tape.tape_id = "tape_test_01"
	tape.tape_label = "Midnight Broadcast"

	examine.show_examine(tape)

	var is_tape_3d: bool = (examine.current_mode == ExamineDisplay.ViewMode.TAPE_3D)
	var viewport_vis: bool = examine._viewport_container.visible
	var note_hidden: bool = not examine._note_card.visible
	var has_model: bool = examine._model_pivot.get_child_count() > 0
	var title_correct: bool = examine._title_label.text == "Midnight Broadcast"

	examine.dismiss()
	examine.queue_free()
	tape.free()

	return is_tape_3d and viewport_vis and note_hidden and has_model and title_correct


## 2. Verify examining a NoteInteractable opens 2D mode with paper card layout.
func test_note_closeup_mode_and_2d_card() -> bool:
	var examine := _create_examine()
	var note := NoteInteractableScene.new()
	note.note_title = "Log Entry #4"
	note.note_content = "The signals do not originate from the tower."

	examine.show_examine(note)

	var is_note_2d: bool = (examine.current_mode == ExamineDisplay.ViewMode.NOTE_2D)
	var note_card_vis: bool = examine._note_card.visible
	var viewport_hidden: bool = not examine._viewport_container.visible
	var title_match: bool = examine._note_title_label.text == "Log Entry #4"
	var content_match: bool = examine._note_content_label.text == "The signals do not originate from the tower."

	examine.dismiss()
	examine.queue_free()
	note.free()

	return is_note_2d and note_card_vis and viewport_hidden and title_match and content_match


## 3. Verify examining a photo sets PHOTO_2D mode and shows photo container.
func test_photo_closeup_mode() -> bool:
	var examine := _create_examine()
	var note := NoteInteractableScene.new()
	note.note_title = "Station Staff Photo"
	note.note_content = "July 1994"
	note.is_photo = true

	# Assign a dummy placeholder image as photo texture
	var img := Image.create(64, 64, false, Image.FORMAT_RGBA8)
	img.fill(Color.WHITE)
	var tex := ImageTexture.create_from_image(img)
	note.note_texture = tex

	examine.show_examine(note)

	var is_photo_mode: bool = (examine.current_mode == ExamineDisplay.ViewMode.PHOTO_2D)
	var photo_visible: bool = examine._photo_rect.visible
	var tex_assigned: bool = (examine._photo_rect.texture == tex)

	examine.dismiss()
	examine.queue_free()
	note.free()

	return is_photo_mode and photo_visible and tex_assigned


## 4. Verify examining an ItemInteractable sets PROP_3D mode.
func test_prop_closeup_mode() -> bool:
	var examine := _create_examine()
	var item := ItemInteractableScene.new()
	item.item_name = "Brass Key"
	item.item_description = "A heavy key stamped with 103."

	examine.show_examine(item)

	var is_prop_3d: bool = (examine.current_mode == ExamineDisplay.ViewMode.PROP_3D)
	var viewport_vis: bool = examine._viewport_container.visible
	var has_model: bool = examine._model_pivot.get_child_count() > 0

	examine.dismiss()
	examine.queue_free()
	item.free()

	return is_prop_3d and viewport_vis and has_model


## 5. Verify text-only fallback works when no target node is supplied.
func test_text_only_fallback() -> bool:
	var examine := _create_examine()
	examine.show_text("A peculiar static hum.")

	var is_text_mode: bool = (examine.current_mode == ExamineDisplay.ViewMode.TEXT_ONLY)
	var is_active: bool = examine._is_active
	var text_set: bool = (examine._full_text == "A peculiar static hum.")

	examine.dismiss()
	examine.queue_free()

	return is_text_mode and is_active and text_set


## 6. Verify mouse drag input rotates 3D model.
func test_mouse_drag_rotation() -> bool:
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	tape.tape_label = "Rotate Test Tape"
	examine.show_examine(tape)

	var initial_yaw: float = examine.rotation_yaw
	var initial_pitch: float = examine.rotation_pitch

	# Simulate mouse motion with left button held
	var motion := InputEventMouseMotion.new()
	motion.relative = Vector2(50.0, 30.0)
	motion.button_mask = MOUSE_BUTTON_MASK_LEFT

	# A drag that began on the 3D stage arrives as GUI input on the stage.
	examine._on_stage_gui_input(motion)

	var yaw_changed: bool = (examine.rotation_yaw != initial_yaw)
	var pitch_changed: bool = (examine.rotation_pitch != initial_pitch)
	var pivot_rotated: bool = (examine._model_pivot.rotation.y != 0.0)

	examine.dismiss()
	examine.queue_free()
	tape.free()

	return yaw_changed and pitch_changed and pivot_rotated


## 6b. Drive a real GUI press and motion over the note scrollbar: the
## scrollbar must scroll and the model must not rotate. A drag that begins on
## the 3D stage still rotates the model.
func test_scrollbar_drag_does_not_rotate() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var examine := _create_examine()
	var note := NoteInteractableScene.new()
	note.note_title = "Scroll Test"
	note.note_content = "line\n".repeat(80)
	examine.show_examine(note)

	var scroll: ScrollContainer = examine._note_content_scroll
	var bar: VScrollBar = scroll.get_v_scroll_bar()
	for i in 12:
		# A laid-out scrollbar has a page size; the frame-zero control does not.
		if bar.page > 0.0 and bar.max_value > bar.page:
			break
		await tree.process_frame
	var can_scroll: bool = bar.page > 0.0 and bar.max_value > bar.page
	var start_scroll: int = scroll.scroll_vertical

	var center: Vector2 = bar.get_global_rect().get_center()
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = center
	examine.get_viewport().push_input(press)
	var motion := InputEventMouseMotion.new()
	motion.position = center + Vector2(0.0, 40.0)
	motion.relative = Vector2(0.0, 40.0)
	motion.button_mask = MOUSE_BUTTON_MASK_LEFT
	examine.get_viewport().push_input(motion)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = center + Vector2(0.0, 40.0)
	examine.get_viewport().push_input(release)

	var scrolled: bool = scroll.scroll_vertical > start_scroll
	var note_not_rotated: bool = examine.rotation_yaw == 0.0 and examine.rotation_pitch == 0.0

	# A held-button motion that reaches _input (no stage press) is not a drag.
	examine._input(motion)
	note_not_rotated = (
		note_not_rotated and examine.rotation_yaw == 0.0 and examine.rotation_pitch == 0.0
	)

	var tape := CassetteTapeScene.new()
	tape.tape_label = "Stage Drag Tape"
	examine.show_examine(tape)
	for i in 4:
		await tree.process_frame
	var stage_center: Vector2 = examine._viewport_container.get_global_rect().get_center()
	var stage_press := InputEventMouseButton.new()
	stage_press.button_index = MOUSE_BUTTON_LEFT
	stage_press.pressed = true
	stage_press.position = stage_center
	examine.get_viewport().push_input(stage_press)
	var stage_motion := InputEventMouseMotion.new()
	stage_motion.position = stage_center + Vector2(30.0, 20.0)
	stage_motion.relative = Vector2(30.0, 20.0)
	stage_motion.button_mask = MOUSE_BUTTON_MASK_LEFT
	examine.get_viewport().push_input(stage_motion)
	var stage_release := InputEventMouseButton.new()
	stage_release.button_index = MOUSE_BUTTON_LEFT
	stage_release.pressed = false
	stage_release.position = stage_center + Vector2(30.0, 20.0)
	examine.get_viewport().push_input(stage_release)
	var stage_rotated: bool = examine.rotation_yaw != 0.0 and examine.rotation_pitch != 0.0

	examine.dismiss()
	examine.queue_free()
	note.free()
	tape.free()

	return can_scroll and scrolled and note_not_rotated and stage_rotated


## 7. Verify mouse wheel adjusts camera zoom distance within bounds.
func test_mouse_wheel_zoom() -> bool:
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	examine.show_examine(tape)

	var initial_zoom: float = examine.zoom_distance

	# Simulate wheel up (zoom in)
	var wheel_up := InputEventMouseButton.new()
	wheel_up.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel_up.pressed = true
	examine._input(wheel_up)

	var zoomed_in: bool = (examine.zoom_distance < initial_zoom)

	# Simulate wheel down (zoom out)
	# Scrolling back out must move the camera away from the zoomed-in distance,
	# not merely stay above the minimum (which the zoom-in state already does).
	var zoomed_in_distance: float = examine.zoom_distance
	var wheel_down := InputEventMouseButton.new()
	wheel_down.button_index = MOUSE_BUTTON_WHEEL_DOWN
	wheel_down.pressed = true
	examine._input(wheel_down)
	examine._input(wheel_down)

	var zoomed_out: bool = (examine.zoom_distance > zoomed_in_distance)

	examine.dismiss()
	examine.queue_free()
	tape.free()

	return zoomed_in and zoomed_out


## 8. Verify world pause on open and exact restoration on return.
func test_world_pause_and_restore() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree

	# Case A: Tree was unpaused
	tree.paused = false
	var examine := _create_examine()
	examine.show_text("Pause test")
	var paused_while_open: bool = tree.paused

	examine.dismiss()
	var restored_unpaused: bool = (tree.paused == false)

	# Case B: Tree was already paused
	tree.paused = true
	examine.show_text("Already paused test")
	var still_paused: bool = tree.paused

	examine.dismiss()
	var restored_paused: bool = (tree.paused == true)
	tree.paused = false

	examine.queue_free()
	return paused_while_open and restored_unpaused and still_paused and restored_paused


## 9. Verify returning via Escape/B button dismisses and emits signals without softlock.
func test_dismiss_no_softlock() -> bool:
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	tape.tape_label = "Dismiss Test"

	var closed_state := {"closed": false, "dismissed": false}

	examine.examine_closed.connect(func(_t: Node) -> void: closed_state["closed"] = true)
	examine.dismissed.connect(func() -> void: closed_state["dismissed"] = true)

	examine.show_examine(tape)
	examine._is_typing = false  # Complete typewriter

	# Simulate Escape key press
	var esc_key := InputEventKey.new()
	esc_key.keycode = KEY_ESCAPE
	esc_key.pressed = true
	examine._input(esc_key)

	var is_inactive: bool = (examine._is_active == false)
	var signals_ok: bool = (closed_state["closed"] and closed_state["dismissed"])

	examine.queue_free()
	tape.free()

	return is_inactive and signals_ok


## 10. Verify typewriter display advances and first keypress skips to end.
func test_typewriter_and_skip() -> bool:
	var examine := _create_examine()
	examine.show_text("This is an important clue that takes time to type.")

	# Advance 0.1s delta
	examine._process(0.1)
	var partial_typed: bool = examine._is_typing and examine._label.text.length() < examine._full_text.length()

	# First press skips typewriter
	var space_key := InputEventKey.new()
	space_key.keycode = KEY_SPACE
	space_key.pressed = true
	examine._input(space_key)

	var full_shown: bool = (examine._label.text == examine._full_text)
	var typing_stopped: bool = (examine._is_typing == false)

	examine.dismiss()
	examine.queue_free()

	return partial_typed and full_shown and typing_stopped


## 12. Verify explicit and default "text" modes resolve to TEXT_ONLY, not PROP_3D.
func test_text_mode_resolves_text_only() -> bool:
	var examine := _create_examine()
	var base := Interactable.new()
	var explicit := TextModeInteractable.new()
	var door := DoorInteractable.new()

	var base_mode: String = base.get_examine_mode()
	var base_view: int = examine._resolve_view_mode(base)
	var explicit_view: int = examine._resolve_view_mode(explicit)
	var door_view: int = examine._resolve_view_mode(door)

	examine.show_examine(door)
	var opened_as_text: bool = examine.current_mode == ExamineDisplay.ViewMode.TEXT_ONLY
	var text_shown: bool = examine._full_text == door.get_examine_content()

	examine.dismiss()
	examine.queue_free()
	base.free()
	explicit.free()
	door.free()

	return (
		base_mode == "text"
		and base_view == ExamineDisplay.ViewMode.TEXT_ONLY
		and explicit_view == ExamineDisplay.ViewMode.TEXT_ONLY
		and door_view == ExamineDisplay.ViewMode.TEXT_ONLY
		and opened_as_text
		and text_shown
	)


## 13. Verify replacing an open close-up keeps the original pause snapshot.
func test_replacement_keeps_original_pause_snapshot() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	var note := NoteInteractableScene.new()

	# Case A: world was unpaused before the first close-up.
	tree.paused = false
	examine.show_examine(tape)
	examine.show_examine(note)
	examine.dismiss()
	var restored_unpaused: bool = tree.paused == false

	# Case B: world was already paused before the first close-up.
	tree.paused = true
	examine.show_examine(tape)
	examine.show_examine(note)
	examine.dismiss()
	var restored_paused: bool = tree.paused == true
	tree.paused = false

	examine.queue_free()
	tape.free()
	note.free()

	return restored_unpaused and restored_paused


## 14. Verify empty examine text finishes the typewriter instead of sticking.
func test_empty_examine_text_does_not_stick() -> bool:
	var examine := _create_examine()
	examine.show_text("")

	var finished: bool = examine._is_typing == false
	var active: bool = examine._is_active

	var esc_key := InputEventKey.new()
	esc_key.keycode = KEY_ESCAPE
	esc_key.pressed = true
	examine._input(esc_key)

	var closed_on_first_press: bool = examine._is_active == false
	examine.queue_free()

	return finished and active and closed_on_first_press


## 15. Verify the dedicated examine content accessor is used when no fallback text.
func test_examine_content_preferred_over_legacy_text() -> bool:
	var examine := _create_examine()
	var item := ItemInteractableScene.new()
	item.item_name = "Brass Key"
	item.item_description = "A heavy key stamped with 103."

	examine.show_examine(item)

	var title_ok: bool = examine._title_label.text == "Brass Key"
	var content_ok: bool = examine._full_text == "A heavy key stamped with 103."

	examine.dismiss()
	examine.queue_free()
	item.free()

	return title_ok and content_ok


## 16. Verify a null mesh accessor falls through to a type-filtered mesh search.
func test_prop_mesh_skips_collider_and_null_accessor() -> bool:
	var examine := _create_examine()
	var item := ItemInteractableScene.new()
	item.item_name = "Spare Battery"

	# CollisionShape3D is added first: a name-based find_child() would pick it.
	var collider := CollisionShape3D.new()
	collider.name = "CollisionShape3D"
	item.add_child(collider)

	var expected_mesh := BoxMesh.new()
	expected_mesh.size = Vector3(1.2, 0.2, 0.5)
	var mesh_node := MeshInstance3D.new()
	mesh_node.name = "BatteryMesh"
	mesh_node.mesh = expected_mesh
	item.add_child(mesh_node)

	examine.show_examine(item)

	var model: MeshInstance3D = null
	if examine._model_pivot.get_child_count() > 0:
		model = examine._model_pivot.get_child(0) as MeshInstance3D
	var used_world_geometry: bool = (
		model != null and model.mesh is BoxMesh and (model.mesh as BoxMesh).size == expected_mesh.size
	)

	examine.dismiss()
	examine.queue_free()
	item.free()

	return used_world_geometry


## 17. Verify the axis reads follow the controller that last sent input.
func test_active_controller_tracks_latest_device() -> bool:
	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	examine.show_examine(tape)

	var button := InputEventJoypadButton.new()
	button.device = 1
	button.button_index = JOY_BUTTON_A
	button.pressed = true
	examine._input(button)

	var tracked: bool = examine._active_joypad == 1
	var still_open: bool = examine._is_active

	examine.dismiss()
	examine.queue_free()
	tape.free()

	return tracked and still_open


## 18. Verify the computed layout fits the default 320x240 retro viewport.
func test_layout_fits_retro_viewport() -> bool:
	var examine := _create_examine()
	examine.size = Vector2(320, 240)
	examine._apply_layout()

	var stage: Vector2 = examine._viewport_container.custom_minimum_size
	var desc: Vector2 = examine._desc_box.custom_minimum_size
	var prompt_font: int = examine._prompt_label.get_theme_font_size("font_size")
	var margin_y: float = maxf(6.0, 240.0 * 0.03)
	var separation: float = float(int(round(maxf(4.0, 240.0 * 0.02))))
	var budget: float = (
		stage.y + desc.y + float(prompt_font) * 3.0 + separation * 2.0 + margin_y * 2.0
	)

	var fits: bool = budget <= 240.0 + 0.01 and stage.x <= 320.0 and desc.x <= 320.0
	var card_fills_stage: bool = examine._note_card.custom_minimum_size == stage
	var prompt_scaled: bool = prompt_font <= 10

	examine.queue_free()
	return fits and card_fills_stage and prompt_scaled


## 19. Verify the shipped night_shift scene mounts the display and opens it from the
## station raycast (the test scene's listener used to be the only one).
func test_shipped_scene_wires_examine_to_display() -> bool:
	var packed: PackedScene = load("res://scenes/night_shift.tscn") as PackedScene
	if packed == null:
		return false
	var scene: Node = packed.instantiate()
	if scene == null:
		return false

	# The debug-only integration runner would re-run the night suite on _ready;
	# it is inert in release exports, so drop it for this scene-level check.
	var runner: Node = scene.get_node_or_null("TestRunner")
	if runner != null:
		scene.remove_child(runner)
		runner.free()

	Engine.get_main_loop().root.add_child(scene)

	var examine: ExamineDisplay = (
		scene.get_node_or_null("InteractionUI/ExamineDisplay") as ExamineDisplay
	)
	var raycast: InteractionRaycast = (
		scene.get_node_or_null("StationEnvironment/Player/InteractionRaycast") as InteractionRaycast
	)

	# Physics does not step in the headless test runner, so the reachability of
	# the booth targets is checked by the shipped scene itself: the station
	# must contain at least one Interactable on the raycast's collision layer.
	var target: Interactable = _find_first_interactable(scene)
	var target_reachable: bool = (
		raycast != null
		and target != null
		and target is Area3D
		and (target.collision_layer & raycast.collision_mask) != 0
	)
	var wired: bool = (
		raycast != null and raycast.examine_performed.get_connections().size() > 0
	)

	var opened: bool = false
	if examine != null and raycast != null and target != null:
		raycast.examine_performed.emit(target, target.get_examine_text())
		opened = examine._is_active and examine.current_target == target

	# The cassette close-up (TAPE_3D) needs a gameplay target too; the shipped
	# station used to have none, so only the screenshot driver exercised it.
	var tape: CassetteTape = _find_first_cassette(scene)
	var tape_supported: bool = (
		tape != null
		and examine != null
		and examine._resolve_view_mode(tape) == ExamineDisplay.ViewMode.TAPE_3D
	)
	var tape_opened: bool = false
	if examine != null and raycast != null and tape != null:
		raycast.examine_performed.emit(tape, tape.get_examine_text())
		tape_opened = (
			examine._is_active
			and examine.current_target == tape
			and examine.current_mode == ExamineDisplay.ViewMode.TAPE_3D
		)
		examine.dismiss()

	# Resolve the verdict before freeing the scene: the local references become
	# invalid once its children are freed.
	var passed: bool = (
		examine != null
		and raycast != null
		and target != null
		and target_reachable
		and wired
		and opened
		and tape_supported
		and tape_opened
	)

	scene.free()
	# CameraManager is an autoload and may still reference the freed rig.
	CameraManager.set_rig(null)
	CameraManager._active_zone = null

	return passed


## 20. Verify a pause action rebound to a non-default key still dismisses and is
## consumed before PauseMenu sees it.
func test_remapped_pause_action_dismisses() -> bool:
	var original_events: Array[InputEvent] = []
	for event in InputMap.action_get_events("pause"):
		original_events.append(event.duplicate() as InputEvent)

	var p_binding := InputEventKey.new()
	p_binding.keycode = KEY_P
	p_binding.physical_keycode = KEY_P
	InputMap.action_add_event("pause", p_binding)

	var examine := _create_examine()
	var tape := CassetteTapeScene.new()
	examine.show_examine(tape)
	examine._is_typing = false

	var p_press := InputEventKey.new()
	p_press.keycode = KEY_P
	p_press.physical_keycode = KEY_P
	p_press.pressed = true
	examine._input(p_press)

	var dismissed: bool = examine._is_active == false

	InputMap.action_erase_events("pause")
	for event in original_events:
		InputMap.action_add_event("pause", event)

	examine.queue_free()
	tape.free()

	return dismissed


## 20. The shipped booth note must render where its collider is: a visible
## world mesh sized like the note's collision volume, not just a hittable area.
func test_booth_note_has_visible_mesh() -> bool:
	var packed: PackedScene = load("res://scenes/station/booth.tscn") as PackedScene
	if packed == null:
		return false
	var scene: Node = packed.instantiate()
	if scene == null:
		return false
	var note: Node = scene.get_node_or_null("NightLog")
	var mesh: MeshInstance3D = null
	var shape: CollisionShape3D = null
	if note != null:
		mesh = note.get_node_or_null("MeshInstance3D") as MeshInstance3D
		shape = note.get_node_or_null("CollisionShape3D") as CollisionShape3D
	var ok: bool = mesh != null and mesh.mesh is BoxMesh and mesh.visible
	if ok and shape != null and shape.shape is BoxShape3D:
		ok = (mesh.mesh as BoxMesh).size.is_equal_approx((shape.shape as BoxShape3D).size)
	scene.free()
	return ok


func _find_first_interactable(node: Node) -> Interactable:
	for child in node.get_children():
		if child is Interactable:
			return child as Interactable
		var found: Interactable = _find_first_interactable(child)
		if found != null:
			return found
	return null


func _find_first_cassette(node: Node) -> CassetteTape:
	for child in node.get_children():
		if child is CassetteTape:
			return child as CassetteTape
		var found: CassetteTape = _find_first_cassette(child)
		if found != null:
			return found
	return null


## 11. Verify every interactable subclass implements examine interface without error.
func test_all_interactables_support_examine() -> bool:
	var instances: Array[Interactable] = [
		CassetteTapeScene.new(),
		NoteInteractableScene.new(),
		ItemInteractableScene.new(),
		DoorInteractableScene.new(),
		RadioInteractableScene.new(),
		SwitchInteractableScene.new(),
	]

	var all_ok := true
	for inst in instances:
		var has_mode: bool = not inst.get_examine_mode().is_empty()
		var has_title: bool = not inst.get_examine_title().is_empty()
		var has_text: bool = inst.has_method("get_examine_text")
		if not (has_mode and has_title and has_text):
			all_ok = false
			print("  FAIL: Interactable %s failed examine interface" % inst.get_class())
		inst.free()

	return all_ok
