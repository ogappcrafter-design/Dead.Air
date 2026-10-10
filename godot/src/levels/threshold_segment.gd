class_name ThresholdSegment
extends Node3D

## Segment 2A: "The Threshold" — first segment of Phase 2 (DEA-117).
##
## 5-minute linear sequence. The player exits the station into a hallway
## that wasn't there: 1920s architecture, wood paneling, brass fixtures,
## a single dead bulb. The station door closes behind and becomes a wall.
## The portable radio crackles on LIVING with a weak signal. Only forward
## is available. Total silence except radio static — no room tone, no
## footsteps. The hallway ends at a door that opens to outside (Segment 2B).
##
## GDD: Phase 2, Segment 2A.

signal segment_started
signal exit_reached
signal station_door_sealed

## Speed limit applied to backward (-X) velocity. 0 = fully blocked.
const BACKWARD_DAMPING := 0.0

## LIVING is band 0 (band_config.tres order: LIVING, LIMINAL, LOST, ...).
const LIVING_BAND_ID := 0

## Weak signal value (GDD: "tuned to LIVING, but the signal is weak").
## FRAGMENTS tier (20-49) = "mostly static, voice fragments".
const WEAK_SIGNAL_VALUE := 20.0

## Buses muted for total silence (GDD: "Total silence except radio
## static. No room tone."). RADIO_AMBIENT stays live — it carries the
## portable radio static.
const SILENCED_BUS_NAMES: Array[StringName] = [
	&"ROOM_TONE",
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"SILENCE",
	&"UI",
	&"TAPE",
]

## Fixed-camera tracking: the camera stays behind the player and looks
## past them into the dark (GDD). The corridor is a straight line along
## +X, so a constant offset keeps the framing identical for the whole
## walk while the rig dollies forward with the player.
const CAMERA_TRACK_OFFSET := Vector3(0, 0, 4.5)  # behind the player, on the corridor axis
const CAMERA_TRACK_HEIGHT := 2.8
const CAMERA_TRACK_PITCH_DEG := -8.0

## How long the static cut plays when the segment begins (station -> threshold).
const STATIC_CUT_DURATION: float = 0.75

## The weak signal is held flat for the whole walk (GDD: "tuned to LIVING,
## but the signal is weak" — it doesn't decay to silence here). SignalStrength
## decays at 1.5/s, so the segment re-applies the value every frame; the hold
## ends only when the exit door is reached.

var _player: CharacterBody3D
var _exit_door: Area3D
var _station_door: Node3D
var _camera_rig: Camera3D
var _radio_tuner: Node  # RadioTuner instance (portable radio)
var _signal_strength: Node  # SignalStrength instance (weak signal)

var _started: bool = false
var _sealed: bool = false
var _exit_reached_fired: bool = false
var _player_start_x: float = 0.0
var _furthest_x: float = 0.0  # furthest forward X reached; backward clamps here
var _baseline_bus_volumes: Dictionary = {}  # bus_idx -> volume_db before muting


func _ready() -> void:
	# The Phase 2 transition can happen mid-scene-change: the incoming
	# scene may not be fully in the tree when this _ready runs, so
	# resolve the player/camera and start the segment on the next idle
	# frame instead.
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_exit_door = get_node_or_null("Hallway/ExitDoor") as Area3D
	_station_door = get_node_or_null("Hallway/StationDoor")
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	# Portable radio (child nodes created by the scene)
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	if _exit_door and not _exit_door.body_entered.is_connected(_on_exit_door_entered):
		_exit_door.body_entered.connect(_on_exit_door_entered)
	if _player:
		_player_start_x = _player.global_position.x
		_furthest_x = _player_start_x
	# Hand the camera to the player and register it with CameraManager
	if _camera_rig:
		_camera_rig.current = true
		_camera_rig.set_target(_player)
	var cam_mgr := _autoload("CameraManager")
	if cam_mgr:
		cam_mgr.set_rig(_camera_rig)
		cam_mgr.set_player(_player)
		# NOTE: the CameraZone in the scene is intentionally NOT registered —
		# registering it would hand the rig to CameraRig's semi-fixed tracking
		# (a single angle at x=1.5), which conflicts with the fixed-behind-player
		# tracking this segment owns. The zone stays in the scene for future
		# camera-cut work; the static cut below covers the entry transition.
	# Static cut on entry: station -> threshold (per DEA-108 camera-cut spec)
	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(STATIC_CUT_DURATION)
	# Start: Phase 2, seal the door, silence everything but the radio
	start_segment()


## Begin the segment: switch to Phase 2, seal the door behind the player,
## silence the world, and start the one-way walk.
func start_segment() -> void:
	if _started:
		return
	_started = true

	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)

	_seal_station_door()
	_silence_world()
	_setup_radio()
	if _player:
		_furthest_x = _player.global_position.x
	segment_started.emit()


## Seal the station door behind the player — it becomes a wall (no return).
func _seal_station_door() -> void:
	if _sealed:
		return
	_sealed = true
	if _station_door:
		_station_door.visible = false
		_station_door.set_meta("sealed", true)
		# Add a wall panel where the door was so the way back reads as solid.
		var wall := CSGBox3D.new()
		wall.name = "SealedWall"
		wall.size = Vector3(0.2, 2.5, 2.0)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.28, 0.2, 0.13)  # dark wood paneling
		wall.material = mat
		wall.use_collision = true
		var parent: Node = _station_door.get_parent()
		if parent:
			parent.add_child(wall)
			# Wall is added to the door's parent, so the door's local
			# position is directly the wall's local position.
			wall.position = _station_door.position
	station_door_sealed.emit()


## GDD: "Total silence except radio static. No room tone. No footsteps."
## Mutes every non-radio bus. The hallway has no footstep playback in the
## scene (the floor absorbs sound) and no room-tone sources are present.
func _silence_world() -> void:
	var abm := _autoload("AudioBusManager")
	if abm == null:
		return
	for name in SILENCED_BUS_NAMES:
		var idx: int = AudioServer.get_bus_index(name)
		if idx < 0:
			continue
		_baseline_bus_volumes[idx] = AudioServer.get_bus_volume_db(idx)
		abm.set_bus_mute(idx, true)


## GDD: "The portable radio crackles. It's tuned to LIVING, but the
## signal is weak." The RadioStatic node (child of PortableRadio) drives
## the RADIO_AMBIENT bus from the tuner/signal strength below.
func _setup_radio() -> void:
	if _radio_tuner:
		# Phase 2 = location_id 1 in BandController's cross-pollination map
		# (LIMINAL native there, so LIVING is ×0.4 — capped at 40, and the
		# weak-signal hold re-applies 20 every frame regardless).
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(1)
		_radio_tuner.set_band(LIVING_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
		_signal_strength.set_signal(WEAK_SIGNAL_VALUE)
	# NOTE: SignalStrength decays at 1.5/s, so _process re-applies the weak
	# signal every frame for the whole walk. The hold ends at the exit door.


## Keep the radio on the weak LIVING signal for the whole walk (the
## SignalStrength decay would otherwise drift it down to dead air mid-segment).
func _process(_delta: float) -> void:
	# Keep the radio on the weak LIVING signal for the whole walk.
	# SignalStrength decays at 1.5/s, so re-apply every frame until the exit
	# door is reached (the hold is the point: a flat, weak crackle).
	if _started and not _exit_reached_fired:
		if _radio_tuner != null and _signal_strength != null:
			_radio_tuner.set_band(LIVING_BAND_ID)
			_signal_strength.set_signal(WEAK_SIGNAL_VALUE)
	# Fixed camera that follows the player: behind them, looking past them
	# into the dark (GDD). Tracking is a constant offset — the framing never
	# changes, the rig simply dollies forward with the player for the whole
	# walk.
	if not _started or _camera_rig == null or _player == null:
		return
	var target_pos: Vector3 = _player.global_position + CAMERA_TRACK_OFFSET
	target_pos.y = CAMERA_TRACK_HEIGHT
	# The camera sits behind the player at +Z and looks down the corridor
	# toward -Z (past the player into the dark). The default camera looks
	# along -Z; with CAMERA_TRACK_PITCH_DEG = -8, the negative X rotation
	# tilts the lens down at the floor ahead (a positive pitch would aim it
	# at the ceiling).
	var basis := Basis.from_euler(Vector3(0.0, 0.0, 0.0))
	basis = basis * Basis.from_euler(Vector3(deg_to_rad(CAMERA_TRACK_PITCH_DEG), 0.0, 0.0))
	_camera_rig.global_transform = Transform3D(basis, target_pos)


## Block backward movement (GDD: "only forward direction available"): zero
## out any -X velocity and clamp to the furthest X the player has reached.
## Even a teleport can't send them back.
func _physics_process(_delta: float) -> void:
	if not _started or _player == null:
		return
	if is_instance_valid(_player):
		var px := _player.global_position.x
		if px > _furthest_x:
			_furthest_x = px
	var vx := _player.velocity.x
	if vx < 0.0:
		_player.velocity.x = vx * BACKWARD_DAMPING
	if _player.global_position.x < _furthest_x:
		var p := _player.global_position
		p.x = _furthest_x
		_player.global_position = p


## Called by the ExitDoor trigger when the player reaches the end of the hall.
func _on_exit_door_entered(body: Node3D) -> void:
	if not _started or _exit_reached_fired:
		return
	if not body.is_in_group("player"):
		return
	_exit_reached_fired = true
	exit_reached.emit()


## Find the player body. Prefers the one in this segment; falls back to
## the first "player"-group CharacterBody3D in the tree.
func _find_player() -> CharacterBody3D:
	var local := get_node_or_null("Player")
	if local is CharacterBody3D:
		return local
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	for c in tree.get_nodes_in_group("player"):
		if c is CharacterBody3D:
			return c
	return null


func _autoload(name: String) -> Node:
	return get_node_or_null("/root/" + name)


# ─── Testing helpers ───────────────────────────────────────────────────


## Advance setup+start immediately (tests: no deferred frame waiting).
func _start_for_testing() -> void:
	_setup_and_start()


func is_started() -> bool:
	return _started


func is_station_door_sealed() -> bool:
	return _sealed


func is_silenced() -> bool:
	# True when at least one non-radio bus was muted by this segment.
	for idx in _baseline_bus_volumes:
		if AudioServer.is_bus_mute(idx):
			return true
	return false


func get_player() -> CharacterBody3D:
	return _player


func get_radio_tuner() -> Node:
	return _radio_tuner


func get_radio_band_id() -> int:
	if _radio_tuner == null:
		return -1
	return _radio_tuner.get("current_band_id")


func get_radio_signal() -> float:
	if _signal_strength == null:
		return -1.0
	return _signal_strength.get("signal_value")


## Restore Phase 1, un-seal the door, and restore silenced buses.
func _reset_for_testing() -> void:
	_exit_reached_fired = false
	_sealed = false
	if _station_door:
		_station_door.visible = true
		_station_door.remove_meta("sealed")
	var sealed_wall := get_node_or_null("Hallway/SealedWall")
	if sealed_wall:
		sealed_wall.queue_free()
	# Restore muted buses
	var abm := _autoload("AudioBusManager")
	if abm:
		for idx in _baseline_bus_volumes:
			abm.set_bus_mute(idx, false)
			AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
	_started = false
	_furthest_x = _player_start_x
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)


## The fixed camera position for a given player position (test helper).
func get_camera_target_position(player_pos: Vector3) -> Vector3:
	var target_pos: Vector3 = player_pos + CAMERA_TRACK_OFFSET
	target_pos.y = CAMERA_TRACK_HEIGHT
	return target_pos
