class_name TapePickup
extends Area3D

## 3D interactable tape pickup object.
## Detects player proximity, shows interaction prompt, calls TapeInventory.collect_tape on interact.
## Consumes the tape (removes from world) after successful collection.

signal tape_picked_up(tape_id: String)

const _TAPE_LIBRARY_PATH := "res://src/data/tapes.tres"

@export var tape_id: String = ""
@export var interaction_range: float = 2.5
@export var auto_collect: bool = false
@export var glow_enabled: bool = true
@export var glow_color: Color = Color(0.4, 0.8, 0.6, 0.6)

var _player_in_range: bool = false
var _collected: bool = false
var _tape_data: TapeData = null
var _glow_mesh: MeshInstance3D = null
var _prompt_label: Label3D = null


func _ready() -> void:
	if tape_id.is_empty():
		push_warning("TapePickup: tape_id is empty, this pickup will not function")
		return

	# Load tape data from library for display info
	var library := load(_TAPE_LIBRARY_PATH) as TapeLibrary
	if library:
		_tape_data = library.get_tape_by_id(tape_id)

	# If already collected, don't show
	if TapeInventory.has_tape(tape_id):
		_collected = true
		hide_pickup()
		return

	# Set up collision
	var collision := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = interaction_range
	collision.shape = sphere
	add_child(collision)

	# Set up visual mesh (cassette-shaped box)
	_setup_visual()

	# Set up glow
	if glow_enabled:
		_setup_glow()

	# Set up interaction prompt
	_setup_prompt()

	# Connect signals
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)

	if auto_collect and _player_in_range:
		_do_collect()


func _setup_visual() -> void:
	var mesh_inst := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.08, 0.05, 0.12)
	mesh_inst.mesh = box

	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.3, 0.3, 0.35)
	mat.roughness = 0.7
	mat.metalness = 0.2
	mesh_inst.material_override = mat
	add_child(mesh_inst)


func _setup_glow() -> void:
	_glow_mesh = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.15
	sphere.height = 0.3
	_glow_mesh.mesh = sphere

	var mat := StandardMaterial3D.new()
	mat.albedo_color = glow_color
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.emission_enabled = true
	mat.emission = glow_color
	mat.emission_energy_multiplier = 0.5
	_glow_mesh.material_override = mat
	add_child(_glow_mesh)


func _setup_prompt() -> void:
	_prompt_label = Label3D.new()
	_prompt_label.text = "[E] Pick Up"
	_prompt_label.font_size = 48
	_prompt_label.outline_modulate = Color.BLACK
	_prompt_label.outline_size = 8
	_prompt_label.position = Vector3(0, 0.15, 0)
	_prompt_label.visible = false
	_prompt_label.no_depth_test = true
	add_child(_prompt_label)


func _on_body_entered(_body: Node3D) -> void:
	if _collected:
		return
	_player_in_range = true
	if _prompt_label:
		_prompt_label.visible = true


func _on_body_exited(_body: Node3D) -> void:
	_player_in_range = false
	if _prompt_label:
		_prompt_label.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if _collected or not _player_in_range:
		return

	if event.is_action_pressed("interact"):
		_do_collect()


func _do_collect() -> void:
	if _collected:
		return
	_collected = true

	# Provide tape data if we have it
	var data_to_pass: Variant = _tape_data if _tape_data else null
	TapeInventory.collect_tape(tape_id, data_to_pass)

	tape_picked_up.emit(tape_id)
	hide_pickup()


func hide_pickup() -> void:
	visible = false
	set_process(false)
	set_physics_process(false)
	if _prompt_label:
		_prompt_label.visible = false
	# Disable collision
	monitoring = false


func show_pickup() -> void:
	_collected = false
	visible = true
	set_process(true)
	set_physics_process(true)
	monitoring = true


func is_collected() -> bool:
	return _collected


func get_tape_data() -> TapeData:
	return _tape_data


func _process(_delta: float) -> void:
	# Gentle bobbing animation
	if _glow_mesh and not _collected:
		_glow_mesh.position.y = sin(Time.get_ticks_msec() * 0.003) * 0.02
