class_name StaticSkySegment
extends Node3D

## Segment 2B: "The Static Sky" — second segment of Phase 2 (DEA-118).
##
## The door at the end of the hallway opens onto a suburban road at night.
## The sky is wrong: TV static where stars should be. Faint, constant.
## A long road runs ahead; the camera holds a high, wide angle — the player
## is small on the road. The portable radio picks up fragments: voices from
## the Shift 1-5 calls, reversed, distorted, warning. The road bends, and
## houses appear beyond the bend — the Neighborhood, previewed.
## The radio signal pulses stronger when facing the right direction: the
## first navigation-by-radio moment.
## Audio: wind (wrong pitch, slightly flat), distant dissonant wind chimes,
## a lawnmower somewhere at 3 AM. No room tone from the station.
##
## GDD: Phase 2, Segment 2B.

signal segment_started
signal bend_reached
signal houses_visible
signal exit_reached

## Movement: free but the road keeps you — invisible walls funnel to the road.
## (No backward clamp here: the player can turn and walk back; the world just
## doesn't reward it. GDD says the road bends forward.)

## LIVING band id (band_config.tres order).
const LIVING_BAND_ID := 0

## Base radio signal when facing the correct direction (GDD: signal pulses,
## stronger toward the right direction — good alignment = strong signal).
const SIGNAL_ALIGNED := 72.0

## Base radio signal when facing the wrong direction.
const SIGNAL_MISALIGNED := 18.0

## Angle (degrees) of full alignment — within this of the target heading,
## signal reads aligned; falls off linearly to misaligned over 120 deg.
const ALIGNMENT_FULL_DEG := 35.0
const ALIGNMENT_FALLOFF_DEG := 130.0

## Navigation target heading: the direction of the Neighborhood (down the
## road, past the bend). +X in this segment.
const NAV_HEADING := Vector3(1.0, 0.0, 0.0)

## Radio signal pulse: gentle breathing on top of alignment signal.
const PULSE_RATE_HZ := 0.25
const PULSE_DEPTH := 6.0

## Bus layout: like 2A, everything is silent except the radio and the
## outdoor ambience. The hallway silence carries over; outdoors, wind
## replaces room tone.
const SILENCED_BUS_NAMES: Array[StringName] = [
	&"ROOM_TONE",
	&"CALL_AUDIO",
	&"DREAD_LAYER",
	&"STINGER",
	&"SILENCE",
	&"UI",
	&"TAPE",
]

## High wide camera: player small on a long road.
const CAMERA_POSITION := Vector3(14.0, 11.0, 18.0)
const CAMERA_LOOK_AT := Vector3(26.0, 0.5, 0.0)
const CAMERA_FOV := 55.0

## Where the road bends and houses appear.
const BEND_X := 34.0

## Segment end: reaching the bend area with houses visible.
const EXIT_X := 38.0

var _player: CharacterBody3D
var _camera_rig: Camera3D
var _radio_tuner: Node
var _signal_strength: Node
var _fragments: Node
var _ambience: Node
var _static_sky: StaticSky

var _started := false
var _exit_fired := false
var _bend_fired := false
var _houses_fired := false
var _baseline_bus_volumes := {}

var _last_fragment_text := ""
var _last_fragment_call_id := -1


func _ready() -> void:
	call_deferred("_setup_and_start")


func _setup_and_start() -> void:
	_player = _find_player()
	_camera_rig = get_node_or_null("CameraRig") as Camera3D
	_radio_tuner = get_node_or_null("PortableRadio/RadioTuner")
	_signal_strength = get_node_or_null("PortableRadio/SignalStrength")
	_fragments = get_node_or_null("PortableRadio/ReversedFragments")
	_ambience = get_node_or_null("OutdoorAmbience")
	_static_sky = get_node_or_null("StaticSky") as StaticSky
	if _static_sky == null:
		# Fallback: build the sky programmatically (scene may not have it).
		_static_sky = StaticSky.new()
		_static_sky.name = "StaticSky"
		_static_sky.position = Vector3(40, 0, 0)
		add_child(_static_sky)

	if _fragments and _radio_tuner and not _fragments.fragment_started.is_connected(_on_fragment):
		_fragments.fragment_started.connect(_on_fragment)

	# Camera: fixed high wide. Set position and look at the road.
	if _camera_rig:
		_camera_rig.current = true
		_camera_rig.look_at_from_position(CAMERA_POSITION, CAMERA_LOOK_AT, Vector3.UP)
		_camera_rig.fov = CAMERA_FOV
	var cam_mgr := _autoload("CameraManager")
	if cam_mgr:
		cam_mgr.set_rig(_camera_rig)
		cam_mgr.set_player(_player)

	# Static cut entering this segment (hallway door → outdoors).
	var static_fx := StaticTransition.new()
	static_fx.name = "StaticCut"
	add_child(static_fx)
	static_fx.play(0.75)

	start_segment()


## Begin the segment: phase, radio setup, ambience, fragments.
func start_segment() -> void:
	if _started:
		return
	_started = true

	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)

	_silence_world()
	_setup_radio()
	_start_ambience()
	segment_started.emit()


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


## Radio: LIVING band, phase 2 (location 1). Signal is driven each frame by
## navigation alignment (not held flat like 2A) — this is the navigation
## mechanic.
func _setup_radio() -> void:
	if _radio_tuner:
		if _radio_tuner.has_method("set_phase"):
			_radio_tuner.set_phase(1)
		_radio_tuner.set_band(LIVING_BAND_ID)
	if _signal_strength:
		_signal_strength.set_dread(0.0)
	# Fragments + ambience start below.


func _start_ambience() -> void:
	if _ambience:
		_ambience.start()
	if _fragments:
		_fragments.start()


func _process(delta: float) -> void:
	if not _started:
		return

	# Navigation-by-radio: signal from alignment with NAV_HEADING, plus a
	# gentle pulse. This is the whole mechanic: face down the road and the
	# radio clears; face away and it dies.
	var signal_val := _compute_signal()
	if _signal_strength:
		_signal_strength.set_signal(signal_val)

	# Progress triggers
	if _player:
		var px := _player.global_position.x
		if not _bend_fired and px >= BEND_X - 4.0:
			_bend_fired = true
			bend_reached.emit()
		if not _houses_fired and px >= BEND_X + 1.0:
			_houses_fired = true
			houses_visible.emit()

	_update_sky()


## Signal from facing alignment + pulse + fragment bursts.
func _compute_signal() -> float:
	var alignment := 0.0
	if _player:
		var facing := -_player.global_transform.basis.z
		facing.y = 0.0
		facing = facing.normalized() if facing.length() > 0.01 else NAV_HEADING
		var dot := facing.dot(NAV_HEADING)
		var angle_deg := rad_to_deg(acos(clampf(dot, -1.0, 1.0)))
		if angle_deg <= ALIGNMENT_FULL_DEG:
			alignment = 1.0
		elif angle_deg >= ALIGNMENT_FALLOFF_DEG:
			alignment = 0.0
		else:
			var t := (angle_deg - ALIGNMENT_FULL_DEG) / (ALIGNMENT_FALLOFF_DEG - ALIGNMENT_FULL_DEG)
			alignment = 1.0 - t
	# Pulse: gentle breathing (always some movement in the number).
	var pulse := sin(Time.get_ticks_msec() * PULSE_RATE_HZ * TAU / 1000.0) * PULSE_DEPTH
	var val := lerpf(SIGNAL_MISALIGNED, SIGNAL_ALIGNED, alignment) + pulse
	return clampf(val, 0.0, 100.0)


func _update_sky() -> void:
	if _static_sky and _static_sky is StaticSky:
		# Keep the sky plane centered over the player as they advance.
		_static_sky.position.x = _player.global_position.x + 20.0 if _player else _static_sky.position.x



func _on_fragment(text: String, call_id: int) -> void:
	_last_fragment_text = text
	_last_fragment_call_id = call_id


## Called when the player reaches the end of this segment (door/house area).
func _on_exit_area_entered(body: Node3D) -> void:
	if not _started or _exit_fired:
		return
	if not body.is_in_group("player"):
		return
	_exit_fired = true
	exit_reached.emit()


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


# ---- Testing helpers ----

func _start_for_testing() -> void:
	_setup_and_start()


func is_started() -> bool:
	return _started


func is_silenced() -> bool:
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


func get_last_fragment() -> Dictionary:
	return {"text": _last_fragment_text, "call_id": _last_fragment_call_id}


func get_static_sky() -> StaticSky:
	return _static_sky


func get_ambience() -> Node:
	return _ambience


func get_fragments() -> Node:
	return _fragments


## Simulate facing: point the player's -Z at the given direction.
func _face_player(direction: Vector3) -> void:
	if _player:
		var pos := _player.global_position
		_player.look_at(pos + direction, Vector3.UP)


func has_bend_fired() -> bool:
	return _bend_fired


func has_houses_fired() -> bool:
	return _houses_fired


## Restore phase and unmute buses.
func _reset_for_testing() -> void:
	_exit_fired = false
	_bend_fired = false
	_houses_fired = false
	_started = false
	var abm := _autoload("AudioBusManager")
	if abm:
		for idx in _baseline_bus_volumes:
			abm.set_bus_mute(idx, false)
			AudioServer.set_bus_volume_db(idx, _baseline_bus_volumes[idx])
	_baseline_bus_volumes.clear()
	if _ambience:
		_ambience.stop()
	if _fragments:
		_fragments.stop()
	if PhaseManager:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
