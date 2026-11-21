class_name Player
extends CharacterBody3D

## DEA-108: Minimal player entity for camera system testing.
## Uses ScreenRelativeMovement for RE-style screen-relative controls.
## In the full game this will be expanded, but for camera testing
## we only need a body that moves and triggers CameraZones.

## Movement component (added as child in scene or via code).
var _movement: ScreenRelativeMovement

## DEA-187: handheld flashlight (created in code, no scene surgery).
## Loaded by path: a brand-new class_name is not in the global class cache
## until the project is imported, so a bare `PlayerFlashlight` identifier
## fails to parse in headless runs.
const PlayerFlashlightScript = preload("res://src/entities/player_flashlight.gd")

var _flashlight: PlayerFlashlightScript

func _ready() -> void:
	# Add to "player" group so CameraZones detect this body
	add_to_group("player")

	# Create movement component if not already added
	_movement = get_node_or_null("ScreenRelativeMovement")
	if _movement == null:
		_movement = ScreenRelativeMovement.new()
		_movement.name = "ScreenRelativeMovement"
		add_child(_movement)

	# DEA-187: create the flashlight if not already added
	_flashlight = get_node_or_null("PlayerFlashlight")
	if _flashlight == null:
		_flashlight = PlayerFlashlightScript.new()
		_flashlight.name = "PlayerFlashlight"
		add_child(_flashlight)

	# Set up camera reference — will be assigned by CameraManager
	# For now, try to find the active camera
	call_deferred("_setup_camera")

func _setup_camera() -> void:
	# Find the CameraRig in the scene
	var viewport: Viewport = get_viewport()
	if viewport != null:
		var cam: Camera3D = viewport.get_camera_3d()
		if cam != null and _movement != null:
			_movement.set_camera(cam)

func _physics_process(_delta: float) -> void:
	# Ensure camera reference is set
	if _movement != null and _movement._camera == null:
		_setup_camera()

## DEA-187: the Suit reads this to widen its effective detection range while
## the flashlight is on. 1.0 = not lit.
func get_visibility_multiplier() -> float:
	if _flashlight != null:
		return _flashlight.get_visibility_multiplier()
	return 1.0

## DEA-187: flashlight accessor (HUD / tests).
func get_flashlight() -> Node3D:
	return _flashlight

## DEA-188: movement component accessor (stamina / sprint state).
func get_movement() -> ScreenRelativeMovement:
	return _movement
