# suit.gd — The Suits enemy entity (DEA-125)
# Source: GDD §The Suits (docs/plans/redesign-gdd.md lines 721-726, 1110-1151)
#
# Men in dark suits. No face — smooth skin where the face should be.
# They do not attack. They do not kill. They _manage_ you.
# Contact sets composure to 0 and relocates the player to a random safe area.
#
# Audio is heard through radio static, NOT world audio. No footsteps, no breathing.
# Signal spikes when near; radio static intensifies on APPROACH; the signal needle
# moves toward them.
class_name Suit
extends CharacterBody3D

## ─── Signals ────────────────────────────────────────────────────────────

## Emitted when the state machine transitions. Carries old and new state names.
signal state_changed(old_state: int, new_state: int)

## Emitted when the suit detects the player (enters APPROACH from PATROL/INVESTIGATE).
signal player_detected(suit: Suit)

## Emitted when the suit makes contact with the player → relocate triggered.
signal player_relocated(suit: Suit)

## Emitted when the suit hears a noise and starts investigating the source.
signal noise_heard(suit: Suit, position: Vector3)

## ─── State Enum ─────────────────────────────────────────────────────────

enum State {
	IDLE,  ## Standing still, not actively patrolling (initial / debug).
	PATROL,  ## Slow walk, checking doors, listening to radios.
	INVESTIGATE,  ## Heard something — moving to a location, then waiting 10s.
	APPROACH,  ## Player detected — walking speed toward player / last known pos.
	SEARCH,  ## Player lost — checking nearby rooms for 30s.
	RELOCATE,  ## Contact made — carrying player to a new location (brief).
}

## Human-readable state names for debugging.
const STATE_NAMES: Dictionary = {
	State.IDLE: "IDLE",
	State.PATROL: "PATROL",
	State.INVESTIGATE: "INVESTIGATE",
	State.APPROACH: "APPROACH",
	State.SEARCH: "SEARCH",
	State.RELOCATE: "RELOCATE",
}

## ─── Detection Constants ────────────────────────────────────────────────

## Base detection range (metres) while PATROLling.
const DETECTION_RANGE_PATROL: float = 5.0

## Base detection range (metres) while INVESTIGATEing.
const DETECTION_RANGE_INVESTIGATE: float = 10.0

## Dread scaling: detection radius increases by this many metres per 10 dread.
const DREAD_RANGE_BONUS_PER_10: float = 1.0

## Contact distance (metres) — within this, the suit reaches the player.
const CONTACT_DISTANCE: float = 1.0

## Time to wait at an investigation point (seconds).
const INVESTIGATE_WAIT_TIME: float = 10.0

## Time to search for a lost player (seconds).
const SEARCH_TIME: float = 30.0

## Time the player must be visible before detection locks in (seconds).
const DETECTION_LOCK_TIME: float = 3.0

## Vision cone half-angle (degrees). Player within this cone is "visible".
const VISION_CONE_HALF_ANGLE: float = 22.5

## ─── Movement Constants ─────────────────────────────────────────────────

## Patrol speed — slow, methodical walk (m/s).
const PATROL_SPEED: float = 1.0

## Investigate speed — slightly faster walk (m/s).
const INVESTIGATE_SPEED: float = 1.2

## Approach / pursue speed — walking pace, NEVER running (m/s).
const APPROACH_SPEED: float = 2.5

## Search speed — careful walk checking rooms (m/s).
const SEARCH_SPEED: float = 1.0

## ─── Appearance Constants ──────────────────────────────────────────────

## Charcoal suit colour (#1A1A1A).
const SUIT_COLOR: Color = Color("#1A1A1A")

## White shirt colour.
const SHIRT_COLOR: Color = Color(0.9, 0.9, 0.9)

## Thin tie colour — dark, slightly different from suit.
const TIE_COLOR: Color = Color(0.08, 0.08, 0.08)

## Faceless skin colour — smooth, featureless.
const SKIN_COLOR: Color = Color(0.78, 0.72, 0.66)

## ─── Composure / Hide Integration ───────────────────────────────────────

## Composure set to this on contact (relocate).
const COMPOSURE_ON_CONTACT: float = 0.0

## ─── Breath-Hold Detection ──────────────────────────────────────────────

## GDD: "If investigated and player is holding breath: 50% chance not found."
const BREATH_HELD_DETECT_CHANCE: float = 0.5

## GDD: "If investigated and player is NOT holding breath: 90% chance found."
const BREATH_NOT_HELD_DETECT_CHANCE: float = 0.9

## ─── Radio / Signal Integration ─────────────────────────────────────────

## Signal needle bias toward the suit when within this distance (metres).
const SIGNAL_NEEDLE_RANGE: float = 8.0

## ─── Exported References ────────────────────────────────────────────────

## Patrol waypoints. The suit walks between these in order, looping.
@export var patrol_points: Array[Vector3] = []

## Safe areas the player can be relocated to (room centres / marker positions).
@export var safe_areas: Array[Vector3] = []

## Reference to the player node (CharacterBody3D). If null, suit tries to find
## a node in the "player" group.
@export var player_node_path: NodePath = ""

## Whether this suit casts shadows. The Suits do NOT cast shadows per GDD.
@export var cast_shadows: bool = false

## Whether debug labels are drawn (shows state + detection in editor play).
@export var debug_display: bool = false

## ─── Internal State ─────────────────────────────────────────────────────

var _state: int = State.IDLE
var _player: Node3D = null
var _dread_composure: DreadComposure = null
var _signal_strength: SignalStrength = null
var _phase_manager: Node = null
var _stinger_system: Node = null

var _current_patrol_index: int = 0
var _investigate_position: Vector3 = Vector3.ZERO
var _last_known_player_pos: Vector3 = Vector3.ZERO

var _investigate_timer: float = 0.0
var _search_timer: float = 0.0
var _detection_timer: float = 0.0  # Time player has been continuously visible.
var _player_detected: bool = false
var _entity_nearby: bool = false

var _hiding: bool = false
var _breath_holding: bool = false

var _relocate_timer: float = 0.0
## APPROACH visual stutter state (GDD: 1-2 frame position jumps).
var _stutter_timer: float = 1.0
var _stutter_freeze: float = 0.0
var _relocate_target: Vector3 = Vector3.ZERO

var _rng: RandomNumberGenerator = RandomNumberGenerator.new()
var _noise_events: Array[Dictionary] = []  # Pending noise events: {position, radius}

## Whether the suit is actively enabled (spawned and active for the current phase).
var _active: bool = true

## ─── Lifecycle ──────────────────────────────────────────────────────────


func _ready() -> void:
	# Faceless suited character — no shadows.
	_setup_appearance()
	_resolve_references()
	_rng.randomize()
	if _active and patrol_points.size() > 0:
		_set_state(State.PATROL)


func _physics_process(delta: float) -> void:
	if not _active:
		return
	_process_noise_events()
	match _state:
		State.PATROL:
			_process_patrol(delta)
		State.INVESTIGATE:
			_process_investigate(delta)
		State.APPROACH:
			_process_approach(delta)
		State.SEARCH:
			_process_search(delta)
		State.RELOCATE:
			_process_relocate(delta)
		State.IDLE:
			pass
	_update_radio_proximity(delta)
	_update_hide_breath(delta)


## ─── Reference Resolution ───────────────────────────────────────────────


func _resolve_references() -> void:
	# Player — from exported path or "player" group.
	if player_node_path != NodePath(""):
		_player = get_node_or_null(player_node_path)
	if _player == null:
		var players := get_tree().get_nodes_in_group("player")
		if players.size() > 0:
			_player = players[0]
	# Resolve singletons via the documented owners: DreadComposure/SignalStrength
	# are owned by the CallManager autoload; PhaseManager and StingerSystem are autoloads.
	if CallManager:
		_dread_composure = CallManager.get_dread_composure()
		_signal_strength = CallManager.get_signal_strength()
	_phase_manager = get_tree().root.get_node_or_null("/root/PhaseManager")
	_stinger_system = get_tree().root.get_node_or_null("/root/StingerSystem")


## ─── Appearance ────────────────────────────────────────────────────────


func _setup_appearance() -> void:
	# The Suits do not cast shadows.
	# Set cast_shadow on any GeometryInstance3D children to false.
	for child in get_children():
		if child is GeometryInstance3D:
			(child as GeometryInstance3D).cast_shadow = (
				GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				if not cast_shadows
				else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			)


## ─── State Machine ─────────────────────────────────────────────────────


func _set_state(new_state: int) -> void:
	if new_state == _state:
		return
	var old := _state
	_state = new_state
	# Reset per-state timers.
	_investigate_timer = 0.0
	_search_timer = 0.0
	_detection_timer = 0.0
	_player_detected = false
	if new_state == State.APPROACH:
		_player_detected = true
	state_changed.emit(old, new_state)
	# Fire stinger on first detection.
	if new_state == State.APPROACH and _stinger_system != null:
		if _stinger_system.has_method("trigger_suits_detected"):
			_stinger_system.trigger_suits_detected()
	# Signal that the player has been detected (player controller owns hide mode).
	if new_state == State.APPROACH:
		player_detected.emit(self)


func get_state() -> int:
	return _state


func get_state_name() -> String:
	return STATE_NAMES.get(_state, "UNKNOWN")


## ─── PATROL ─────────────────────────────────────────────────────────────


func _process_patrol(delta: float) -> void:
	if patrol_points.is_empty():
		return
	var target := patrol_points[_current_patrol_index]
	_move_toward(target, PATROL_SPEED, delta)
	if global_position.distance_to(target) < 0.5:
		_current_patrol_index = (_current_patrol_index + 1) % patrol_points.size()
	# Detection check.
	if _check_detection(DETECTION_RANGE_PATROL):
		_detection_timer += delta
		if _detection_timer >= DETECTION_LOCK_TIME:
			_last_known_player_pos = _get_player_pos()
			_set_state(State.APPROACH)
	else:
		_detection_timer = 0.0


## ─── INVESTIGATE ───────────────────────────────────────────────────────


func _process_investigate(delta: float) -> void:
	# Move to investigation point, then wait.
	var dist := global_position.distance_to(_investigate_position)
	if dist > 0.5:
		_move_toward(_investigate_position, INVESTIGATE_SPEED, delta)
	else:
		# Arrived — wait 10 seconds, listening.
		_investigate_timer += delta
		# Detection check while investigating has wider range.
		if _check_detection(DETECTION_RANGE_INVESTIGATE):
			_detection_timer += delta
			if _detection_timer >= DETECTION_LOCK_TIME:
				_last_known_player_pos = _get_player_pos()
				_set_state(State.APPROACH)
				return
		else:
			_detection_timer = 0.0
		# After wait, return to patrol.
		if _investigate_timer >= INVESTIGATE_WAIT_TIME:
			_set_state(State.PATROL)


## ─── APPROACH (PURSUE) ─────────────────────────────────────────────────


func _process_approach(delta: float) -> void:
	if _player != null and _is_player_visible():
		_last_known_player_pos = _get_player_pos()
	# Walk toward last known position — NEVER run.
	_move_toward(_last_known_player_pos, APPROACH_SPEED, delta)
	# Contact check.
	if _player != null:
		var dist := global_position.distance_to(_get_player_pos())
		if dist <= CONTACT_DISTANCE:
			_trigger_relocate()
			return
	# If player is hidden and we've reached last known position without contact:
	if global_position.distance_to(_last_known_player_pos) < 0.5:
		if _player == null or not _is_player_visible():
			_set_state(State.SEARCH)
	# Detection re-check — if player visible again while searching, re-approach.
	# (SEARCH → APPROACH transition handled in _process_search.)


## ─── SEARCH ────────────────────────────────────────────────────────────


func _process_search(delta: float) -> void:
	_search_timer += delta
	# Check nearby rooms — move toward player's last known area, then wander.
	if _search_timer < SEARCH_TIME:
		# If player becomes visible again, re-approach.
		if _check_detection(DETECTION_RANGE_INVESTIGATE):
			_detection_timer += delta
			if _detection_timer >= DETECTION_LOCK_TIME:
				_last_known_player_pos = _get_player_pos()
				_set_state(State.APPROACH)
				return
		else:
			_detection_timer = 0.0
		# Wander toward last known position, then patrol points.
		if global_position.distance_to(_last_known_player_pos) > 1.0:
			_move_toward(_last_known_player_pos, SEARCH_SPEED, delta)
		elif not patrol_points.is_empty():
			var wp := patrol_points[_current_patrol_index]
			_move_toward(wp, SEARCH_SPEED, delta)
			if global_position.distance_to(wp) < 0.5:
				_current_patrol_index = (_current_patrol_index + 1) % patrol_points.size()
	else:
		# Search expired — return to patrol.
		_set_state(State.PATROL)


## ─── RELOCATE ───────────────────────────────────────────────────────────


func _trigger_relocate() -> void:
	# Contact: composure → 0, teleport player to random safe area.
	_set_state(State.RELOCATE)
	# Set composure to 0.
	if _dread_composure != null:
		_dread_composure.set_composure(COMPOSURE_ON_CONTACT)
	# Pick a random safe area for the player.
	if not safe_areas.is_empty():
		var idx := _rng.randi_range(0, safe_areas.size() - 1)
		_relocate_target = safe_areas[idx]
	else:
		_relocate_target = _get_player_pos()
	# Screen cuts to static for the 0.5s relocation (GDD: "screen cuts to
	# static for 0.5 sec, then player is in new location").
	var fx := StaticTransition.new()
	fx.name = "RelocateStatic"
	if _player != null and _player.is_inside_tree():
		_player.get_tree().root.add_child(fx)
		fx.play(0.5)
	# Teleport player immediately (the relocate state is a brief "carry" animation window).
	if _player != null and _player.has_method("set_global_position"):
		_player.set_global_position(_relocate_target)
	elif _player != null:
		_player.global_position = _relocate_target
	player_relocated.emit(self)
	_relocate_timer = 0.0


func _process_relocate(delta: float) -> void:
	# Brief state — the suit "carries" the player. After a short delay, resume patrol.
	_relocate_timer += delta
	# Reset detection timers so the suit doesn't immediately re-detect.
	_detection_timer = 0.0
	_player_detected = false
	# After 2 seconds, resume patrol from a new position near the relocated player.
	if _relocate_timer >= 2.0:
		# Move the suit away from the player's new position.
		if not patrol_points.is_empty():
			_current_patrol_index = _rng.randi_range(0, patrol_points.size() - 1)
			global_position = patrol_points[_current_patrol_index]
		_set_state(State.PATROL)


## ─── Detection ─────────────────────────────────────────────────────────


## Returns true if the player is within the detection range and visible
## (in the vision cone, not hidden, and not making excessive noise that
## breaks the hide).
func _check_detection(base_range: float) -> bool:
	if _player == null:
		return false
	# Hidden players are undetectable unless making noise or being searched.
	if _is_player_hidden():
		if _is_player_making_noise():
			return true
		# GDD §The Suits: during SEARCH, breath-hold affects detection.
		# "Holding breath: 50% chance not found" / "NOT holding: 90% found."
		if _state == State.SEARCH:
			var chance := BREATH_NOT_HELD_DETECT_CHANCE if not _breath_holding else BREATH_HELD_DETECT_CHANCE
			return _rng.randf() < chance
		return false
	# Calculate effective range with dread scaling.
	var effective_range := _get_effective_range(base_range)
	var dist := global_position.distance_to(_get_player_pos())
	if dist > effective_range:
		return false
	# Vision cone check.
	return _is_in_vision_cone(dist)


func _get_effective_range(base_range: float) -> float:
	var dread := 0.0
	if _dread_composure != null:
		dread = _dread_composure.dread
	var bonus: float = floor(dread / 10.0) * DREAD_RANGE_BONUS_PER_10
	return base_range + bonus


func _is_player_hidden() -> bool:
	return _hiding


func _is_player_making_noise() -> bool:
	# Player makes noise if:
	# - Radio is being actively tuned (player-generated, not ambient signal)
	# - Player is running (velocity magnitude > walk threshold)
	# Ambient signal_value is NOT used — it decays slowly and continues
	# during HIDE mode, making hidden-still-quiet players falsely detectable.
	if _player == null:
		return false
	# Radio tuning while investigating.
	if _state == State.INVESTIGATE and _is_radio_being_tuned():
		return true
	# Running (velocity check).
	if _player is CharacterBody3D:
		var vel := (_player as CharacterBody3D).velocity
		if vel.length() > 3.5:  # Running threshold
			return true
	return false


func _is_radio_being_tuned() -> bool:
	# Check if the player is actively tuning the radio.
	# Uses InputManager.get_tune_value(), which is mode-aware (returns 0.0
	# outside EXPLORE/RADIO, e.g. during HIDE/CALL) so a hidden player pressing
	# the tune button is not falsely flagged as making noise.
	var im := get_tree().root.get_node_or_null("/root/InputManager")
	if im != null and im.has_method("get_tune_value"):
		return im.get_tune_value() != 0.0
	# Fallback to Input directly when InputManager is absent.
	return Input.is_action_pressed("radio_tune_left") or Input.is_action_pressed("radio_tune_right")


func _is_in_vision_cone(dist: float) -> bool:
	if dist <= 0.01:
		return true
	# The suit "looks" forward (its facing direction).
	var to_player := (_get_player_pos() - global_position).normalized()
	var forward := -global_transform.basis.z.normalized()
	var dot := forward.dot(to_player)
	var angle := rad_to_deg(acos(clamp(dot, -1.0, 1.0)))
	return angle <= VISION_CONE_HALF_ANGLE


func _is_player_visible() -> bool:
	# Visible = within effective range and in vision cone (not hidden).
	if _player == null:
		return false
	if _is_player_hidden() and not _is_player_making_noise():
		return false
	var effective_range := _get_effective_range(DETECTION_RANGE_INVESTIGATE)
	var dist := global_position.distance_to(_get_player_pos())
	if dist > effective_range:
		return false
	return _is_in_vision_cone(dist)


func _get_player_pos() -> Vector3:
	if _player != null:
		return _player.global_position
	return Vector3.ZERO


## ─── Noise Events (from radio / footsteps) ──────────────────────────────


## Called externally (e.g. by a radio interactable or player footstep system)
## to report a noise at a position with a given radius.
func hear_noise(position: Vector3, radius: float = 5.0) -> void:
	_noise_events.append({"position": position, "radius": radius})


func _process_noise_events() -> void:
	if _noise_events.is_empty():
		return
	if _state == State.APPROACH or _state == State.RELOCATE:
		_noise_events.clear()
		return
	# Only react to noise if PATROL or SEARCH.
	var event: Dictionary = _noise_events.pop_front()
	var noise_pos: Vector3 = event["position"]
	var noise_radius: float = event["radius"]
	var dist := global_position.distance_to(noise_pos)
	if dist <= noise_radius and _state != State.INVESTIGATE:
		_investigate_position = noise_pos
		_set_state(State.INVESTIGATE)
		noise_heard.emit(self, noise_pos)


## ─── Movement ──────────────────────────────────────────────────────────


func _move_toward(target: Vector3, speed: float, delta: float) -> void:
	var to_target := target - global_position
	to_target.y = 0.0  # Keep on the ground plane.
	var dist := to_target.length()
	if dist < 0.01:
		return
	var dir := to_target.normalized()

	# APPROACH stutter (GDD: 1-2 frame position jump, "as if dropping
	# frames"). Every 0.7-1.5s the suit jumps slightly ahead and freezes
	# for a couple of frames. Other states walk smoothly.
	if _state == State.APPROACH:
		_stutter_timer -= delta
		if _stutter_freeze > 0.0:
			_stutter_freeze -= delta
			return
		if _stutter_timer <= 0.0:
			_stutter_timer = _rng.randf_range(0.7, 1.5)
			_stutter_freeze = _rng.randf_range(0.03, 0.06)
			global_position += dir * speed * 0.1
			return

	# Smooth, human walk — never robotic, never running.
	var move := dir * speed * delta
	if move.length() > dist:
		move = to_target
	global_position += move
	# Face the direction of movement (smooth rotation).
	if dir.length() > 0.01:
		var target_angle := atan2(-dir.x, -dir.z)
		var current_angle := rotation.y
		global_rotation.y = lerp_angle(current_angle, target_angle, delta * 5.0)


## ─── Radio Proximity (signal spikes, static intensifies) ───────────────


func _update_radio_proximity(_delta: float) -> void:
	if _player == null or _signal_strength == null:
		return
	var dist := global_position.distance_to(_get_player_pos())
	# SignalStrength entity count drives drain; we set entity_nearby on DreadComposure
	# to drive composure decay when the suit is close.
	_entity_nearby = _state == State.APPROACH and dist <= SIGNAL_NEEDLE_RANGE
	if _dread_composure != null and not _is_spawner_managed():
		_dread_composure.entity_nearby = _entity_nearby


## ─── Hide / Breath-Hold Integration ────────────────────────────────────


func _update_hide_breath(_delta: float) -> void:
	# Read hide state from PhaseManager's current mode (player controller owns
	# the input and drives enter_hide_mode / exit_hide_mode).
	if _phase_manager != null and _phase_manager.has_method("get_mode"):
		_hiding = _phase_manager.get_mode() == PhaseEnums.ModeContext.HIDE
	else:
		_hiding = false
	# Read breath-hold state from PhaseManager (player controller sets this).
	if _phase_manager != null and "breath_held" in _phase_manager:
		_breath_holding = _phase_manager.breath_held
	else:
		_breath_holding = false
	# Composure drain while hiding and detected.
	var hiding_detected := _hiding and _player_detected
	if _dread_composure != null and not _is_spawner_managed():
		_dread_composure.hiding_detected = hiding_detected


## ─── Public API ─────────────────────────────────────────────────────────


## Spawn this suit at a patrol point. Called by SuitSpawner or level setup.
func spawn_at(position_index: int = -1) -> void:
	if position_index >= 0 and position_index < patrol_points.size():
		global_position = patrol_points[position_index]
		_current_patrol_index = position_index
	elif not patrol_points.is_empty():
		global_position = patrol_points[0]
	_active = true
	_set_state(State.PATROL)


## Despawn this suit (Phase 4: no suits).
func despawn() -> void:
	_active = false
	_entity_nearby = false
	_player_detected = false
	_set_state(State.IDLE)
	if _dread_composure != null:
		_dread_composure.entity_nearby = false
		_dread_composure.hiding_detected = false
	visible = false


## Set dread composure reference (for testing / manual wiring).
func set_dread_composure(dc: DreadComposure) -> void:
	_dread_composure = dc


## Set signal strength reference (for testing / manual wiring).
func set_signal_strength(ss: SignalStrength) -> void:
	_signal_strength = ss


func _is_spawner_managed() -> bool:
	var parent := get_parent()
	return parent != null and parent is SuitSpawner


func is_entity_nearby() -> bool:
	return _entity_nearby


func is_hiding_detected() -> bool:
	return _hiding and _player_detected


func get_dread_composure() -> DreadComposure:
	return _dread_composure


func get_signal_strength() -> Node:
	return _signal_strength


## Set phase manager reference (for testing / manual wiring).
func set_phase_manager(pm: Node) -> void:
	_phase_manager = pm


## Set player reference (for testing / manual wiring).
func set_player(p: Node3D) -> void:
	_player = p


## Set the RNG seed for deterministic testing.
func set_rng_seed(seed_val: int) -> void:
	_rng.seed = seed_val


## Force a state transition (for testing / scripted encounters).
func force_state(new_state: int) -> void:
	_set_state(new_state)


## Set patrol waypoints.
func set_patrol_points(points: Array[Vector3]) -> void:
	patrol_points = points


## Set safe areas for relocation.
func set_safe_areas(areas: Array[Vector3]) -> void:
	safe_areas = areas


## Returns true if this suit is currently approaching/pursuing the player.
func is_approaching() -> bool:
	return _state == State.APPROACH


## Returns true if this suit is active (spawned and present in the current phase).
func is_active() -> bool:
	return _active
