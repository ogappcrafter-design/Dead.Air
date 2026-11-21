## hide_spot.gd — DEA-186. The hiding verb.
## A hide spot the player enters with `interact` (or the `hide` action while
## standing in it). While hidden the world keeps running: the spot drives breath,
## rolls the GDD detection odds, and on a catch applies the GDD penalties and
## relocates the player. Exiting is always possible — nothing here blocks it.
##
## GDD §Hiding odds, as read for this implementation:
##   breath held : 70% unseen / 20% investigated / 10% caught
##   exhaled     : 10% unseen / 40% investigated / 50% caught  (90% cumulative detection)
extends Interactable
class_name HideSpot

signal hidden(occupant: Node)
signal exited(occupant: Node)
signal breath_exhaled(occupant: Node)
signal caught(occupant: Node)
signal blackout_started(seconds: float)
## HUDs in group "hide_ui" get set_hiding(bool) so the meters can pull back.
signal ui_state_changed(hiding: bool)

## Optional one-shot played on enter, caught and exit; scenes may leave it empty.
@export var sfx: AudioStreamPlayer3D = null

const BREATH_MAX := 5.0
const CAUGHT_COMPOSURE_LOSS := 25.0
const CAUGHT_DREAD_GAIN := 15.0
const CAUGHT_SIGNAL := 20.0
const BLACKOUT_SECONDS := 5.0
const EXHALE_NOISE_RADIUS := 10.0
const SEARCH_ROLL_RADIUS := 8.0
const SEARCH_ROLL_INTERVAL := 2.0

## Outcome of one detection roll.
enum Outcome { UNSEEN, INVESTIGATE, CAUGHT }

const HOLDING_ODDS := {Outcome.UNSEEN: 0.70, Outcome.INVESTIGATE: 0.20, Outcome.CAUGHT: 0.10}
const EXHALED_ODDS := {Outcome.UNSEEN: 0.10, Outcome.INVESTIGATE: 0.40, Outcome.CAUGHT: 0.50}

@export var spot_type: String = "locker"
@export var rng_seed: int = 0
@export var save_spawn_group: String = "safe_area"

var occupant: Node = null
var breath: float = BREATH_MAX
var holding_breath: bool = false
## True once the held breath ran out; the exhale is what gives the player away.
var exhaled: bool = false
var blackout_remaining: float = 0.0

var _rng: RandomNumberGenerator = null
## Limited-view camera authored per spot: narrow FOV, clamped look range.
var view_camera: Camera3D = null
var yaw_limit: float = 45.0
var pitch_limit: float = 20.0
var _yaw: float = 0.0
var _pitch: float = 0.0
var _previous_camera: Camera3D = null
var _radio_muted: bool = false
var _roll_cooldown: float = 0.0
## How often a suit standing over an occupied spot gets a detection roll.
var detection_interval: float = 1.5
var _detect_timer: float = 0.0


func _ready() -> void:
	interacted.connect(_on_interacted)
	_build_camera()
	_rng = RandomNumberGenerator.new()
	if rng_seed != 0:
		_rng.seed = rng_seed
	else:
		_rng.randomize()


func _on_interacted(interactor: Node) -> void:
	if is_occupied():
		exit()
		return
	enter(interactor)


func is_occupied() -> bool:
	return occupant != null and is_instance_valid(occupant)


func enter(player: Node) -> bool:
	if is_occupied():
		return false
	occupant = player
	breath = BREATH_MAX
	holding_breath = false
	exhaled = false
	blackout_remaining = 0.0
	if PhaseManager != null and PhaseManager.has_method("enter_hide_mode"):
		PhaseManager.enter_hide_mode()
	_activate_camera()
	_set_radio_muted(true)
	_play_sfx()
	_notify_ui(true)
	hidden.emit(player)
	return true


## Always allowed, even mid-pursuit, so a spot can never softlock the player.
func exit() -> void:
	if is_occupied():
		var who := occupant
		occupant = null
		if PhaseManager != null and PhaseManager.has_method("exit_hide_mode"):
			PhaseManager.exit_hide_mode()
		_restore_camera()
		_set_radio_muted(false)
		_notify_ui(false)
		exited.emit(who)
	breath = BREATH_MAX
	exhaled = false
	holding_breath = false


func set_holding_breath(value: bool) -> void:
	holding_breath = value


func _process(delta: float) -> void:
	if blackout_remaining > 0.0:
		blackout_remaining = maxf(0.0, blackout_remaining - delta)
		if blackout_remaining <= 0.0:
			_set_radio_muted(false)
	if not is_occupied():
		return
	_process_search_roll(delta)
	if exhaled:
		return
	if holding_breath:
		breath = maxf(0.0, breath - delta)
		if breath <= 0.0:
			_force_exhale()
	_detect_timer += delta
	if _detect_timer >= detection_interval:
		_detect_timer = 0.0
		_roll_for_watching_suit()


## A suit investigating the spot is what turns a hide into a coin toss; nothing
## rolls while no suit is close enough to look.
func _roll_for_watching_suit() -> void:
	var origin: Vector3 = Vector3.ZERO
	if occupant is Node3D:
		origin = (occupant as Node3D).global_position
	for suit in get_tree().get_nodes_in_group("suit"):
		if not (suit is Node3D):
			continue
		if not suit.has_method("get_state"):
			continue
		if suit.get_state() != Suit.State.INVESTIGATE:
			continue
		if (suit as Node3D).global_position.distance_to(origin) > 12.0:
			continue
		check_detection()
		return


func _force_exhale() -> void:
	exhaled = true
	holding_breath = false
	_alert_suits(EXHALE_NOISE_RADIUS)
	breath_exhaled.emit(occupant)


func _alert_suits(radius: float) -> void:
	if occupant == null:
		return
	var origin: Vector3 = Vector3.ZERO
	if occupant is Node3D:
		origin = (occupant as Node3D).global_position
	for suit in get_tree().get_nodes_in_group("suit"):
		if suit.has_method("hear_noise"):
			suit.hear_noise(origin, radius)


## One detection roll for a suit looking at this spot.
func roll_detection() -> Outcome:
	if not is_occupied():
		return Outcome.UNSEEN
	# The quiet odds only apply to a breath the player is actually holding:
	# breathing normally in a spot is as loud as having exhaled.
	var odds: Dictionary = HOLDING_ODDS if (holding_breath and not exhaled) else EXHALED_ODDS
	var r: float = _rng.randf()
	var acc := 0.0
	for outcome in [Outcome.UNSEEN, Outcome.INVESTIGATE, Outcome.CAUGHT]:
		acc += float(odds[outcome])
		if r < acc:
			return outcome
	return Outcome.UNSEEN


## Apply one detection roll; a CAUGHT result runs the GDD penalty and relocates.
func check_detection() -> Outcome:
	if not is_occupied():
		return Outcome.UNSEEN
	var outcome := roll_detection()
	if outcome == Outcome.CAUGHT:
		_handle_caught()
	elif outcome == Outcome.INVESTIGATE:
		_alert_suits(EXHALE_NOISE_RADIUS)
	return outcome


func _handle_caught() -> void:
	var player := occupant
	var dread: DreadComposure = DreadComposure.instance
	if dread != null:
		dread.set_composure(dread.composure - CAUGHT_COMPOSURE_LOSS)
		dread.add_dread(CAUGHT_DREAD_GAIN)
	var signal_strength: Node = get_node_or_null("/root/CallManager/SignalStrength")
	if signal_strength != null and signal_strength.has_method("set_signal"):
		signal_strength.set_signal(CAUGHT_SIGNAL)
	blackout_remaining = BLACKOUT_SECONDS
	blackout_started.emit(BLACKOUT_SECONDS)
	exit()
	# The radio stays dead through the blackout: being caught costs contact.
	_set_radio_muted(true)
	_play_sfx()
	if player != null:
		_relocate(player)
	caught.emit(player)


## The live subsystem is owned by CallManager, not the scene root.
func _find_signal_strength() -> Node:
	var call_manager: Node = get_node_or_null("/root/CallManager")
	if call_manager != null:
		if call_manager.has_method("get_signal_strength"):
			var from_manager: Node = call_manager.get_signal_strength()
			if from_manager != null:
				return from_manager
		var child: Node = call_manager.get_node_or_null("SignalStrength")
		if child != null:
			return child
	return get_node_or_null("/root/SignalStrength")


## Interacting with a spot you are already inside lets you out; so does the
## `hide` action. Without these there is no way to leave a spot in play.
func _unhandled_input(event: InputEvent) -> void:
	if not is_occupied():
		return
	if event.is_action_pressed("hide"):
		exit()
		get_viewport().set_input_as_handled()


## A suit searching nearby rolls against the spot; that is the only thing that
## can catch a hidden player, so the roll has to live here rather than in tests.
func _process_search_roll(delta: float) -> void:
	_roll_cooldown -= delta
	if _roll_cooldown > 0.0:
		return
	for suit in get_tree().get_nodes_in_group("suit"):
		if not (suit is Node3D):
			continue
		if (suit as Node3D).global_position.distance_to((occupant as Node3D).global_position) > SEARCH_ROLL_RADIUS:
			continue
		_roll_cooldown = SEARCH_ROLL_INTERVAL
		check_detection()
		return


func _relocate(player: Node) -> void:
	if not (player is Node3D):
		return
	var anchors := get_tree().get_nodes_in_group(save_spawn_group)
	if anchors.is_empty():
		return
	var anchor: Node3D = anchors[0] as Node3D
	if anchor != null:
		(player as Node3D).global_position = anchor.global_position


## The authored limited view: a narrow, low-FOV camera the player can only
## sweep through a small arc, which is what makes hiding feel claustrophobic.
func _build_camera() -> void:
	view_camera = Camera3D.new()
	view_camera.name = "HideView"
	view_camera.fov = 45.0
	view_camera.near = 0.05
	view_camera.current = false
	add_child(view_camera)


func _activate_camera() -> void:
	if view_camera == null:
		return
	var viewport := get_viewport()
	if viewport != null:
		_previous_camera = viewport.get_camera_3d()
	view_camera.current = true


func _restore_camera() -> void:
	if view_camera != null:
		view_camera.current = false
	if _previous_camera != null and is_instance_valid(_previous_camera):
		_previous_camera.current = true
	_previous_camera = null
	_yaw = 0.0
	_pitch = 0.0


## Sweep the limited view; input beyond the arc is clamped, never accepted.
func look_around(delta_yaw: float, delta_pitch: float) -> void:
	if view_camera == null:
		return
	_yaw = clampf(_yaw + delta_yaw, -yaw_limit, yaw_limit)
	_pitch = clampf(_pitch + delta_pitch, -pitch_limit, pitch_limit)
	view_camera.rotation_degrees = Vector3(_pitch, _yaw, 0.0)


func get_view_angles() -> Vector2:
	return Vector2(_yaw, _pitch)


## Radio is the player's only tether; a hide spot cuts it while you are inside.
func is_radio_muted() -> bool:
	return _radio_muted


func _set_radio_muted(value: bool) -> void:
	_radio_muted = value
	for node in get_tree().get_nodes_in_group("radio"):
		if node.has_method("set_muted"):
			node.set_muted(value)


func _play_sfx() -> void:
	if sfx != null and sfx.stream != null:
		sfx.play()


func _notify_ui(hiding: bool) -> void:
	ui_state_changed.emit(hiding)
	for node in get_tree().get_nodes_in_group("hide_ui"):
		if node.has_method("set_hiding"):
			node.set_hiding(hiding)


func get_prompt_text() -> String:
	return "Hide (%s)" % spot_type
