## ExamineDisplay — Full-screen close-up examination system for DEA-193.
## Supports:
## 1. 3D rotate and zoom for props, cassette tapes, and 3D interactables.
## 2. 2D textured close-up view for notes, letters, and photos.
## 3. Descriptive CRT typewriter text panel.
## 4. Gamepad & keyboard/mouse controls (L-Stick/Arrows/Drag to rotate, LT/RT/Wheel to zoom, B/Esc to return).
## 5. Pauses the world and cleanly restores exact prior state without softlock.
## 6. Audio cues on inspect (paper rustle for notes, plastic/mechanical click for tapes/props).
class_name ExamineDisplay
extends Control

signal examine_opened(target: Node)
signal examine_closed(target: Node)
signal dismissed

enum ViewMode { NONE, TEXT_ONLY, NOTE_2D, PHOTO_2D, PROP_3D, TAPE_3D }

const TAPE_LABEL_TEXTURE: Texture2D = preload("res://assets/textures/props/tape_label.jpg")

@export var typewriter_speed: float = 35.0  # characters per second
@export var fade_duration: float = 0.15
@export var rotate_speed: float = 2.4
@export var zoom_speed: float = 1.2
@export var min_zoom: float = 0.8
@export var max_zoom: float = 2.8

var current_mode: ViewMode = ViewMode.NONE
var current_target: Node = null

# State
var _is_active: bool = false
var _is_typing: bool = false
var _full_text: String = ""
var _char_accum: float = 0.0
var _was_tree_paused: bool = false
var _tween: Tween

# 3D Close-up variables
var rotation_yaw: float = 0.0
var rotation_pitch: float = 0.0
var zoom_distance: float = 1.8

# UI Components
var _dim_bg: ColorRect
var _panel: Panel
var _label: Label
var _title_label: Label
var _desc_box: PanelContainer
var _prompt_label: Label
var _root_vbox: VBoxContainer
var _stage_center: CenterContainer
var _card_vbox: VBoxContainer
var _desc_vbox: VBoxContainer
var _desc_scroll: ScrollContainer
var _note_content_scroll: ScrollContainer

# Most recently active controller, used for continuous stick/trigger reads.
var _active_joypad: int = 0

# 3D SubViewport elements
var _viewport_container: SubViewportContainer
var _sub_viewport: SubViewport
var _camera_3d: Camera3D
var _model_pivot: Node3D
var _light_3d: DirectionalLight3D

# 2D Note/Photo elements
var _note_card: PanelContainer
var _note_title_label: Label
var _note_content_label: Label
var _photo_rect: TextureRect

# Audio
var _audio_player: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	modulate.a = 0.0
	visible = false
	_build_ui()
	var pads := Input.get_connected_joypads()
	if not pads.is_empty():
		_active_joypad = pads[0]
	_apply_layout()
	resized.connect(_apply_layout)


func _build_ui() -> void:
	# 1. Dark atmosphere dim
	_dim_bg = ColorRect.new()
	_dim_bg.name = "DimBackground"
	_dim_bg.color = Color(0.02, 0.02, 0.03, 0.94)
	_dim_bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dim_bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_dim_bg)

	# 2. Main layout VBox (margins and spacing come from _apply_layout)
	_root_vbox = VBoxContainer.new()
	_root_vbox.name = "RootVBox"
	_root_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	_root_vbox.add_theme_constant_override("separation", 4)
	add_child(_root_vbox)

	# 3. Center close-up stage (holds either 3D Viewport or 2D Note Card)
	_stage_center = CenterContainer.new()
	_stage_center.name = "StageCenter"
	_stage_center.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_root_vbox.add_child(_stage_center)

	_build_3d_viewport(_stage_center)
	_build_2d_note_card(_stage_center)

	# 4. Descriptive CRT Text Box (Bottom)
	_build_description_panel(_root_vbox)

	# 5. Return & Interaction Prompts (Footer)
	_prompt_label = Label.new()
	_prompt_label.name = "PromptLabel"
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.add_theme_font_size_override("font_size", 14)
	_prompt_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.75))
	_prompt_label.text = "[L-Stick / Drag / Arrows: Rotate]   [LT/RT / Wheel: Zoom]   [B / Esc / Space: Return]"
	_prompt_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_prompt_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_root_vbox.add_child(_prompt_label)

	# Audio player
	_audio_player = AudioStreamPlayer.new()
	_audio_player.name = "ExamineAudioPlayer"
	_audio_player.bus = "Master"
	add_child(_audio_player)


func _build_3d_viewport(parent: Control) -> void:
	_viewport_container = SubViewportContainer.new()
	_viewport_container.name = "ViewportContainer"
	_viewport_container.custom_minimum_size = Vector2.ZERO
	_viewport_container.stretch = true
	# Rotation drags are GUI input on the stage: Godot routes the motion that
	# follows a press to the control that received it, so a scrollbar drag
	# never reaches this handler and stays available to its scrollbar.
	_viewport_container.mouse_filter = Control.MOUSE_FILTER_STOP
	_viewport_container.gui_input.connect(_on_stage_gui_input)
	parent.add_child(_viewport_container)

	_sub_viewport = SubViewport.new()
	_sub_viewport.name = "ExamineSubViewport"
	_sub_viewport.own_world_3d = true
	_sub_viewport.world_3d = World3D.new()
	_sub_viewport.size = Vector2i(560, 360)
	_sub_viewport.transparent_bg = true
	_sub_viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	_viewport_container.add_child(_sub_viewport)

	# Camera
	_camera_3d = Camera3D.new()
	_camera_3d.name = "ExamineCamera"
	_camera_3d.position = Vector3(0, 0, zoom_distance)
	_camera_3d.fov = 42.0
	_camera_3d.current = true
	_sub_viewport.add_child(_camera_3d)

	# Lighting
	_light_3d = DirectionalLight3D.new()
	_light_3d.name = "KeyLight"
	_light_3d.position = Vector3(-1.5, 2.0, 2.5)
	_light_3d.rotation_degrees = Vector3(-35, -25, 0)
	_light_3d.light_energy = 1.3
	_sub_viewport.add_child(_light_3d)

	var fill_light := DirectionalLight3D.new()
	fill_light.name = "FillLight"
	fill_light.position = Vector3(2.0, -1.0, 1.5)
	fill_light.rotation_degrees = Vector3(20, 45, 0)
	fill_light.light_energy = 0.5
	_sub_viewport.add_child(fill_light)

	# Model Pivot
	_model_pivot = Node3D.new()
	_model_pivot.name = "ModelPivot"
	_sub_viewport.add_child(_model_pivot)


func _build_2d_note_card(parent: Control) -> void:
	_note_card = PanelContainer.new()
	_note_card.name = "NoteCard"
	_note_card.custom_minimum_size = Vector2.ZERO

	var card_style := StyleBoxFlat.new()
	card_style.bg_color = Color(0.92, 0.90, 0.84, 0.98)  # Aged parchment paper
	card_style.border_color = Color(0.65, 0.60, 0.52)
	card_style.border_width_left = 3
	card_style.border_width_right = 3
	card_style.border_width_top = 3
	card_style.border_width_bottom = 3
	card_style.corner_radius_top_left = 4
	card_style.corner_radius_top_right = 4
	card_style.corner_radius_bottom_left = 4
	card_style.corner_radius_bottom_right = 4
	card_style.content_margin_left = 28.0
	card_style.content_margin_right = 28.0
	card_style.content_margin_top = 22.0
	card_style.content_margin_bottom = 22.0
	_note_card.add_theme_stylebox_override("panel", card_style)
	parent.add_child(_note_card)

	_card_vbox = VBoxContainer.new()
	_card_vbox.add_theme_constant_override("separation", 4)
	_note_card.add_child(_card_vbox)

	_note_title_label = Label.new()
	_note_title_label.name = "NoteTitleLabel"
	_note_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_note_title_label.add_theme_font_size_override("font_size", 20)
	_note_title_label.add_theme_color_override("font_color", Color(0.12, 0.12, 0.14))
	_card_vbox.add_child(_note_title_label)

	_photo_rect = TextureRect.new()
	_photo_rect.name = "PhotoRect"
	_photo_rect.custom_minimum_size = Vector2(240, 160)
	_photo_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_photo_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_photo_rect.visible = false
	_card_vbox.add_child(_photo_rect)

	_note_content_label = Label.new()
	_note_content_label.name = "NoteContentLabel"
	_note_content_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_note_content_label.add_theme_font_size_override("font_size", 15)
	_note_content_label.add_theme_color_override("font_color", Color(0.2, 0.2, 0.24))
	_note_content_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_note_content_scroll = ScrollContainer.new()
	_note_content_scroll.name = "NoteContentScroll"
	_note_content_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_note_content_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_note_content_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_note_content_scroll.add_child(_note_content_label)
	_card_vbox.add_child(_note_content_scroll)


func _build_description_panel(parent: Control) -> void:
	_desc_box = PanelContainer.new()
	_desc_box.name = "DescBox"
	_desc_box.custom_minimum_size = Vector2.ZERO

	var panel_style := StyleBoxFlat.new()
	panel_style.bg_color = Color(0.04, 0.05, 0.06, 0.95)
	panel_style.border_color = Color(0.25, 0.35, 0.28)
	panel_style.border_width_left = 2
	panel_style.border_width_right = 2
	panel_style.border_width_top = 2
	panel_style.border_width_bottom = 2
	panel_style.content_margin_left = 24.0
	panel_style.content_margin_right = 24.0
	panel_style.content_margin_top = 14.0
	panel_style.content_margin_bottom = 14.0
	_desc_box.add_theme_stylebox_override("panel", panel_style)
	parent.add_child(_desc_box)

	_desc_vbox = VBoxContainer.new()
	_desc_vbox.add_theme_constant_override("separation", 4)
	_desc_box.add_child(_desc_vbox)

	_title_label = Label.new()
	_title_label.name = "TitleLabel"
	_title_label.add_theme_font_size_override("font_size", 18)
	_title_label.add_theme_color_override("font_color", Color(0.0, 1.0, 0.25))
	_desc_vbox.add_child(_title_label)

	_label = Label.new()
	_label.name = "ExamineLabel"
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.add_theme_font_size_override("font_size", 15)
	_label.add_theme_color_override("font_color", Color(0.85, 0.85, 0.9))
	_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_desc_scroll = ScrollContainer.new()
	_desc_scroll.name = "DescScroll"
	_desc_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_desc_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_desc_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_desc_scroll.add_child(_label)
	_desc_vbox.add_child(_desc_scroll)

	# Compatibility pointer for legacy tests
	_panel = Panel.new()
	_panel.visible = false
	add_child(_panel)


## Size the stage, margins, and text panels from the active UI viewport.
## The retro renderer presents 320x240 by default, so fixed 560x360 stage
## minimums used to push the description and return hint off-screen.
func _apply_layout() -> void:
	var view: Vector2 = size
	if view.x <= 1.0 or view.y <= 1.0:
		view = get_viewport_rect().size
	if view.x <= 1.0 or view.y <= 1.0:
		return

	var margin_x := maxf(8.0, view.x * 0.04)
	var margin_y := maxf(6.0, view.y * 0.03)
	var separation := float(int(round(maxf(4.0, view.y * 0.02))))
	var font_scale := clampf(view.x / 320.0, 1.0, 2.0)
	var prompt_font := int(round(9.0 * font_scale))
	# Three lines of headroom keeps the wrapped control hint fully on screen.
	var prompt_height := float(prompt_font) * 3.0
	var desc_height := clampf(view.y * 0.30, 56.0, 180.0)
	var stage_width := maxf(80.0, view.x - margin_x * 2.0)
	var stage_height := maxf(
		48.0, view.y - margin_y * 2.0 - desc_height - prompt_height - separation * 2.0
	)

	_root_vbox.offset_left = margin_x
	_root_vbox.offset_top = margin_y
	_root_vbox.offset_right = -margin_x
	_root_vbox.offset_bottom = -margin_y
	_root_vbox.add_theme_constant_override("separation", int(separation))

	# SubViewportContainer.stretch makes the SubViewport track the container,
	# so only the container's minimum size needs to be set here.
	_viewport_container.custom_minimum_size = Vector2(stage_width, stage_height)
	_note_card.custom_minimum_size = Vector2(stage_width, stage_height)
	_desc_box.custom_minimum_size = Vector2(stage_width, desc_height)
	_photo_rect.custom_minimum_size = Vector2(
		stage_width * 0.6, minf(stage_height * 0.45, 220.0)
	)

	_prompt_label.add_theme_font_size_override("font_size", prompt_font)
	_title_label.add_theme_font_size_override("font_size", int(round(11.0 * font_scale)))
	_label.add_theme_font_size_override("font_size", int(round(10.0 * font_scale)))
	_note_title_label.add_theme_font_size_override("font_size", int(round(12.0 * font_scale)))
	_note_content_label.add_theme_font_size_override(
		"font_size", int(round(10.0 * font_scale))
	)
	_card_vbox.add_theme_constant_override("separation", int(separation))
	_desc_vbox.add_theme_constant_override("separation", maxi(2, int(separation * 0.5)))

	var card_style := _note_card.get_theme_stylebox("panel") as StyleBoxFlat
	if card_style != null:
		card_style.content_margin_left = maxf(8.0, view.x * 0.03)
		card_style.content_margin_right = card_style.content_margin_left
		card_style.content_margin_top = maxf(6.0, view.y * 0.02)
		card_style.content_margin_bottom = card_style.content_margin_top
	var desc_style := _desc_box.get_theme_stylebox("panel") as StyleBoxFlat
	if desc_style != null:
		desc_style.content_margin_left = maxf(10.0, view.x * 0.035)
		desc_style.content_margin_right = desc_style.content_margin_left
		desc_style.content_margin_top = maxf(5.0, view.y * 0.015)
		desc_style.content_margin_bottom = desc_style.content_margin_top


## Main close-up entry point for any examinable object.
func show_examine(target: Node, fallback_text: String = "") -> void:
	# Replacing an open examination keeps the original pause snapshot: the
	# world is already paused because of the first show_examine call.
	var entering: bool = not _is_active
	current_target = target
	_is_active = true
	rotation_yaw = 0.0
	rotation_pitch = 0.0
	zoom_distance = 1.8
	_camera_3d.position.z = zoom_distance

	# World pause
	if entering:
		_was_tree_paused = get_tree().paused
	get_tree().paused = true

	# Determine ViewMode
	current_mode = _resolve_view_mode(target)

	var title_text := ""
	var desc_text := fallback_text

	if target != null:
		if target.has_method("get_examine_title"):
			title_text = target.get_examine_title()
		elif "tape_label" in target:
			title_text = str(target.tape_label)
		elif "note_title" in target:
			title_text = str(target.note_title)
		elif "item_name" in target:
			title_text = str(target.item_name)
		elif target.has_method("get_prompt_text"):
			title_text = target.get_prompt_text()

		if desc_text.is_empty():
			if target.has_method("get_examine_content"):
				desc_text = target.get_examine_content()
			elif target.has_method("get_examine_text"):
				desc_text = target.get_examine_text()

	if title_text.is_empty():
		title_text = "EXAMINE"

	_title_label.text = title_text
	_start_typewriter(desc_text)

	# Setup visual presentation according to mode
	match current_mode:
		ViewMode.NOTE_2D, ViewMode.PHOTO_2D:
			_setup_2d_view(target, title_text, desc_text)
			_play_paper_rustle_sfx()
		ViewMode.TAPE_3D:
			_setup_tape_3d_view(target)
			_play_plastic_click_sfx()
		ViewMode.PROP_3D:
			_setup_prop_3d_view(target)
			_play_plastic_click_sfx()
		_:
			_setup_text_only_view()
			_play_paper_rustle_sfx()

	_update_prompt_text()
	_fade_in()
	set_process(true)
	set_process_input(true)
	examine_opened.emit(target)


## Backward-compatible show_text method.
func show_text(text: String) -> void:
	show_examine(null, text)


func _resolve_view_mode(target: Node) -> ViewMode:
	if target == null:
		return ViewMode.TEXT_ONLY

	if target.has_method("get_examine_mode"):
		var m: String = target.get_examine_mode().to_lower()
		if m == "tape" or m == "cassette":
			return ViewMode.TAPE_3D
		elif m == "note":
			return ViewMode.NOTE_2D
		elif m == "photo":
			return ViewMode.PHOTO_2D
		elif m == "text":
			return ViewMode.TEXT_ONLY
		elif m == "prop" or m == "3d":
			return ViewMode.PROP_3D

	# Fallbacks by class / properties
	if target is CassetteTape or "tape_label" in target or "tape_id" in target:
		return ViewMode.TAPE_3D
	elif target is NoteInteractable or "note_content" in target:
		if "is_photo" in target and target.is_photo:
			return ViewMode.PHOTO_2D
		return ViewMode.NOTE_2D
	elif target is ItemInteractable or "item_name" in target or target is Interactable:
		return ViewMode.PROP_3D

	return ViewMode.TEXT_ONLY


func _setup_2d_view(target: Node, title: String, content: String) -> void:
	_viewport_container.visible = false
	_note_card.visible = true
	_note_title_label.text = title

	# Check for photo texture
	var photo_tex: Texture2D = null
	if target != null:
		if target.has_method("get_examine_texture"):
			photo_tex = target.get_examine_texture()
		elif "note_texture" in target and target.note_texture != null:
			photo_tex = target.note_texture
		elif "photo_texture" in target and target.photo_texture != null:
			photo_tex = target.photo_texture

	if photo_tex != null:
		_photo_rect.texture = photo_tex
		_photo_rect.visible = true
	else:
		_photo_rect.visible = false

	# Note body text
	var body_text := content
	if target != null and "note_content" in target:
		body_text = str(target.note_content)
	_note_content_label.text = body_text


func _setup_tape_3d_view(target: Node) -> void:
	_note_card.visible = false
	_viewport_container.visible = true
	_clear_model_pivot()

	# Create 3D Cassette Tape mesh
	var tape_root := Node3D.new()
	tape_root.name = "TapeMeshRoot"

	# Cassette Shell (standard cassette aspect: 1.0 x 0.64 x 0.12)
	var shell_mesh := BoxMesh.new()
	shell_mesh.size = Vector3(1.0, 0.64, 0.12)
	var shell_inst := MeshInstance3D.new()
	shell_inst.mesh = shell_mesh

	var shell_mat := StandardMaterial3D.new()
	shell_mat.albedo_color = Color(0.12, 0.12, 0.14)  # Charcoal plastic
	shell_mat.roughness = 0.6
	shell_inst.material_override = shell_mat
	tape_root.add_child(shell_inst)

	# Tape Label
	var label_mesh := QuadMesh.new()
	label_mesh.size = Vector2(0.85, 0.45)
	var label_inst := MeshInstance3D.new()
	label_inst.mesh = label_mesh
	label_inst.position = Vector3(0, 0, 0.062)

	var label_mat := StandardMaterial3D.new()
	label_mat.albedo_texture = TAPE_LABEL_TEXTURE
	label_mat.roughness = 0.8
	label_inst.material_override = label_mat
	tape_root.add_child(label_inst)

	# Left and right reels
	for x_pos in [-0.22, 0.22]:
		var reel_mesh := CylinderMesh.new()
		reel_mesh.top_radius = 0.08
		reel_mesh.bottom_radius = 0.08
		reel_mesh.height = 0.13
		var reel_inst := MeshInstance3D.new()
		reel_inst.mesh = reel_mesh
		reel_inst.rotation_degrees = Vector3(90, 0, 0)
		reel_inst.position = Vector3(x_pos, 0, 0)

		var reel_mat := StandardMaterial3D.new()
		reel_mat.albedo_color = Color(0.9, 0.9, 0.9)  # White plastic reel
		reel_inst.material_override = reel_mat
		tape_root.add_child(reel_inst)

	_model_pivot.add_child(tape_root)


func _setup_prop_3d_view(target: Node) -> void:
	_note_card.visible = false
	_viewport_container.visible = true
	_clear_model_pivot()

	# Prefer an explicit accessor, but fall through when it returns null: the
	# base ItemInteractable accessor is null for items that only have a mesh
	# node in the world.
	var found_mesh: Mesh = null
	if target != null:
		if target.has_method("get_examine_mesh"):
			found_mesh = target.get_examine_mesh()
		if found_mesh == null and "item_mesh" in target and target.item_mesh != null:
			found_mesh = target.item_mesh
		if found_mesh == null:
			var mi := _find_mesh_instance(target)
			if mi != null:
				found_mesh = mi.mesh

	if found_mesh != null:
		var prop_inst := MeshInstance3D.new()
		prop_inst.mesh = found_mesh
		_model_pivot.add_child(prop_inst)
	else:
		# Procedural collectible prop mesh (antique metallic radio cartridge/battery)
		var box := BoxMesh.new()
		box.size = Vector3(0.7, 0.7, 0.7)
		var inst := MeshInstance3D.new()
		inst.mesh = box
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.35, 0.38, 0.4)
		mat.metallic = 0.7
		mat.roughness = 0.4
		inst.material_override = mat
		_model_pivot.add_child(inst)


func _setup_text_only_view() -> void:
	_note_card.visible = false
	_viewport_container.visible = false


func _clear_model_pivot() -> void:
	for child in _model_pivot.get_children():
		child.queue_free()
	_model_pivot.rotation = Vector3.ZERO


func _update_prompt_text() -> void:
	if current_mode == ViewMode.TAPE_3D or current_mode == ViewMode.PROP_3D:
		_prompt_label.text = "[L-Stick / Drag / Arrows: Rotate]   [LT/RT / Wheel: Zoom]   [B / Esc / Space: Return]"
	else:
		_prompt_label.text = "[B / Esc / Space: Return]"


func _start_typewriter(text: String) -> void:
	_full_text = text
	_char_accum = 0.0
	_label.text = ""
	# Empty text never satisfies the typewriter's length check, so finish it
	# immediately instead of swallowing the first dismiss input.
	_is_typing = not text.is_empty()


func dismiss() -> void:
	if not _is_active:
		return
	_is_active = false
	_is_typing = false
	_fade_out()
	set_process(false)
	set_process_input(false)

	# Restore exact prior world pause state without softlock
	get_tree().paused = _was_tree_paused

	_play_plastic_click_sfx()
	examine_closed.emit(current_target)
	dismissed.emit()


func _process(delta: float) -> void:
	# Typewriter effect
	if _is_typing and _char_accum < _full_text.length():
		_char_accum += typewriter_speed * delta
		if _char_accum >= _full_text.length():
			_char_accum = _full_text.length()
			_is_typing = false
		_label.text = _full_text.substr(0, int(_char_accum))
		_scroll_desc_to_end()

	# 3D Rotation & Zoom processing
	if _is_active and (current_mode == ViewMode.TAPE_3D or current_mode == ViewMode.PROP_3D):
		var rx := 0.0
		var ry := 0.0
		var zoom_delta := 0.0

		# Keyboard arrows / WASD
		if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
			rx -= 1.0
		if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
			rx += 1.0
		if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
			ry -= 1.0
		if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
			ry += 1.0

		# Zoom keys (+ / - or Q / E)
		if Input.is_key_pressed(KEY_EQUAL) or Input.is_key_pressed(KEY_KP_ADD) or Input.is_key_pressed(KEY_E):
			zoom_delta -= 1.0
		if Input.is_key_pressed(KEY_MINUS) or Input.is_key_pressed(KEY_KP_SUBTRACT) or Input.is_key_pressed(KEY_Q):
			zoom_delta += 1.0

		# Gamepad Joypad Stick (Action mapping fallback or raw motion)
		# Read the most recently active controller instead of a hard-coded
		# device 0, so a second controller can rotate and zoom the model.
		_sync_active_joypad()
		var joy_x := Input.get_joy_axis(_active_joypad, JOY_AXIS_LEFT_X)
		var joy_y := Input.get_joy_axis(_active_joypad, JOY_AXIS_LEFT_Y)
		if absf(joy_x) > 0.15:
			rx += joy_x
		if absf(joy_y) > 0.15:
			ry += joy_y

		# Gamepad Triggers (LT/RT zoom)
		var trigger_l := Input.get_joy_axis(_active_joypad, JOY_AXIS_TRIGGER_LEFT)
		var trigger_r := Input.get_joy_axis(_active_joypad, JOY_AXIS_TRIGGER_RIGHT)
		if trigger_r > 0.2:
			zoom_delta -= trigger_r
		if trigger_l > 0.2:
			zoom_delta += trigger_l

		# Apply rotation
		if rx != 0.0 or ry != 0.0:
			rotation_yaw += rx * rotate_speed * delta
			rotation_pitch = clampf(rotation_pitch + ry * rotate_speed * delta, -1.2, 1.2)
			_model_pivot.rotation = Vector3(rotation_pitch, rotation_yaw, 0.0)

		# Apply zoom
		if zoom_delta != 0.0:
			zoom_distance = clampf(zoom_distance + zoom_delta * zoom_speed * delta, min_zoom, max_zoom)
			_camera_3d.position.z = zoom_distance


## Rotate the model for a drag that began on the 3D stage. This runs as GUI
## input on the stage, so the motion of a scrollbar drag is routed to the
## scrollbar and never consumed here.
func _on_stage_gui_input(event: InputEvent) -> void:
	if not _is_active:
		return
	if current_mode != ViewMode.TAPE_3D and current_mode != ViewMode.PROP_3D:
		return
	if event is InputEventMouseMotion:
		var drag_mask := MOUSE_BUTTON_MASK_LEFT | MOUSE_BUTTON_MASK_RIGHT
		if (event.button_mask & drag_mask) == 0:
			return
		rotation_yaw += event.relative.x * 0.008
		rotation_pitch = clampf(rotation_pitch + event.relative.y * 0.008, -1.2, 1.2)
		_model_pivot.rotation = Vector3(rotation_pitch, rotation_yaw, 0.0)
		accept_event()


func _input(event: InputEvent) -> void:
	if not _is_active:
		return

	# Track the controller that most recently sent input so stick/trigger
	# polling follows it (see _process).
	if event is InputEventJoypadButton or event is InputEventJoypadMotion:
		_active_joypad = event.device

	# Mouse Wheel to Zoom (3D close-ups only; 2D cards scroll their text).
	if (
		event is InputEventMouseButton
		and event.pressed
		and (current_mode == ViewMode.TAPE_3D or current_mode == ViewMode.PROP_3D)
	):
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom_distance = clampf(zoom_distance - 0.18, min_zoom, max_zoom)
			_camera_3d.position.z = zoom_distance
			get_viewport().set_input_as_handled()
			return
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom_distance = clampf(zoom_distance + 0.18, min_zoom, max_zoom)
			_camera_3d.position.z = zoom_distance
			get_viewport().set_input_as_handled()
			return

	# Return / Dismiss buttons: B, Esc, Space, Cancel, Pause.
	# Configured actions are checked independently of the event-type branches:
	# a key or button that is bound to a remapped pause/cancel action must still
	# dismiss (and consume) the input before PauseMenu sees it.
	var is_return := false
	if event.is_action_pressed("ui_cancel"):
		is_return = true
	elif InputMap.has_action("pause") and event.is_action_pressed("pause"):
		is_return = true
	elif event is InputEventKey and event.pressed:
		if event.keycode == KEY_ESCAPE or event.keycode == KEY_SPACE or event.keycode == KEY_BACKSPACE:
			is_return = true
	elif event is InputEventJoypadButton and event.pressed:
		if event.button_index == JOY_BUTTON_B or event.button_index == JOY_BUTTON_START:
			is_return = true

	if is_return:
		if _is_typing:
			# Skip typewriter on first press
			_char_accum = _full_text.length()
			_label.text = _full_text
			_is_typing = false
			_scroll_desc_to_end()
		else:
			dismiss()
		get_viewport().set_input_as_handled()


## Type-filtered descendant search: find_child() returns the first name match,
## which can be a CollisionShape3D before the MeshInstance3D.
func _find_mesh_instance(node: Node) -> MeshInstance3D:
	for candidate in node.find_children("*", "MeshInstance3D", true, false):
		var mi := candidate as MeshInstance3D
		if mi != null and mi.mesh != null:
			return mi
	return null


func _sync_active_joypad() -> void:
	var pads := Input.get_connected_joypads()
	if pads.is_empty():
		return
	if not pads.has(_active_joypad):
		_active_joypad = pads[0]


func _scroll_desc_to_end() -> void:
	if _desc_scroll == null:
		return
	_desc_scroll.scroll_vertical = int(_desc_scroll.get_v_scroll_bar().max_value)


func _fade_in() -> void:
	visible = true
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 1.0, fade_duration)


func _fade_out() -> void:
	if _tween != null and _tween.is_valid():
		_tween.kill()
	_tween = create_tween()
	_tween.tween_property(self, "modulate:a", 0.0, fade_duration)
	_tween.tween_callback(func() -> void: visible = false)


## Procedural Paper Rustle Sound (for notes & photos).
func _play_paper_rustle_sfx() -> void:
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = 22050
	var sample_count := int(0.12 * 22050)
	var bytes := PackedByteArray()
	bytes.resize(sample_count * 2)

	var last_val := 0.0
	for i in range(sample_count):
		var t := float(i) / 22050.0
		var env := exp(-25.0 * t) * (1.0 - exp(-80.0 * t))
		var white_noise := randf_range(-1.0, 1.0)
		last_val = lerpf(last_val, white_noise, 0.4)
		var sample := last_val * env * 0.5
		var val := int(clampf(sample, -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, val)

	wav.data = bytes
	_audio_player.stream = wav
	_audio_player.play()


## Procedural Plastic/Mechanical Click (for tapes & props).
func _play_plastic_click_sfx() -> void:
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = 22050
	var sample_count := int(0.06 * 22050)
	var bytes := PackedByteArray()
	bytes.resize(sample_count * 2)

	for i in range(sample_count):
		var t := float(i) / 22050.0
		var env := exp(-45.0 * t)
		var sample := sin(TAU * 480.0 * t) * env * 0.6
		var val := int(clampf(sample, -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, val)

	wav.data = bytes
	_audio_player.stream = wav
	_audio_player.play()
