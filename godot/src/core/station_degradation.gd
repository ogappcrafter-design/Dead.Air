extends Node
## StationDegradation autoload singleton.
##
## Implements the Dead Air Radio station degradation / wrongness schedule for
## shifts 1-2.  Wraps the existing StationState autoload (which already applies
## visual transforms on shift change) by adding:
##
##   * Public API: apply_degradation(), get_mirror_delay(), get_crt_glitch_interval(),
##     trigger_event()
##   * Signals: degradation_applied, wrongness_event_triggered
##   * Recurring CRT glitch timer during shift 2
##   * Audio for E1 (radio_static buzz) and E2 (silence bus breathing)
##   * Door-lock state flag for E2
##   * Mirror delay getter (no mirror node exists in scenes; value-based only)
##
## This file does NOT modify any protected scripts.  All visual transforms are
## applied directly to scene nodes at apply_degradation() time; StationState
## independently applies its own transforms on shift change — idempotent.

signal degradation_applied(shift_number: int)
signal wrongness_event_triggered(event_id: String, description: String)

# -- E1 / E2 trigger times (seconds into shift 2) ---------------------------
const E1_TRIGGER_TIME: float = 135.0  # 02:15
const E2_TRIGGER_TIME: float = 180.0  # 03:00
const CRT_GLITCH_INTERVAL_SHIFT2: float = 45.0
const MIRROR_DELAY_SHIFT2: float = 0.2
const MIRROR_DELAY_DEFAULT: float = 0.0

# -- Internal state --------------------------------------------------------
var _current_shift: int = 1
var _mirror_delay: float = MIRROR_DELAY_DEFAULT
var _crt_glitch_interval: float = 0.0
var _shift_elapsed: float = 0.0
var _e1_fired: bool = false
var _e2_fired: bool = false
var _office_door_locked: bool = false
var _crt_glitch_timer: Timer = null

# Audio players (created lazily)
var _buzz_player: AudioStreamPlayer = null
var _breathing_player: AudioStreamPlayer = null

# ===========================================================================
#  Lifecycle
# ===========================================================================


func _ready() -> void:
	# Connect to StationState's shift_changed to auto-apply degradation.
	var ss: Node = get_node_or_null("/root/StationState")
	if ss and ss.has_signal("shift_changed"):
		ss.shift_changed.connect(_on_shift_changed)
	# Create CRT glitch timer (inactive until shift 2).
	_crt_glitch_timer = Timer.new()
	_crt_glitch_timer.name = "CRTGlitchTimer"
	_crt_glitch_timer.wait_time = CRT_GLITCH_INTERVAL_SHIFT2
	_crt_glitch_timer.autostart = false
	_crt_glitch_timer.one_shot = false
	_crt_glitch_timer.timeout.connect(_on_crt_glitch_timeout)
	add_child(_crt_glitch_timer)


func _process(delta: float) -> void:
	if _current_shift < 2:
		return
	_shift_elapsed += delta
	# Auto-trigger events at the scheduled shift times (manual trigger also OK).
	if not _e1_fired and _shift_elapsed >= E1_TRIGGER_TIME:
		_e1_fired = true
		trigger_event("E1")
	if not _e2_fired and _shift_elapsed >= E2_TRIGGER_TIME:
		_e2_fired = true
		trigger_event("E2")


# ===========================================================================
#  Public API
# ===========================================================================


## Apply degradation state for the given shift number.
## shift 1 = normal, shift 2 = subtle wrongness.
func apply_degradation(shift_number: int) -> void:
	_current_shift = shift_number
	_shift_elapsed = 0.0
	_e1_fired = false
	_e2_fired = false

	if shift_number <= 1:
		_reset_to_normal()
	else:
		_apply_shift2_degradation()

	# Emit signal.
	degradation_applied.emit(shift_number)


## Returns mirror response delay in seconds.
## 0.0 for shift 1, 0.2 for shift 2.
func get_mirror_delay() -> float:
	return _mirror_delay


## Returns CRT glitch interval in seconds.
## 0.0 for shift 1, 45.0 for shift 2.
func get_crt_glitch_interval() -> float:
	return _crt_glitch_interval


## Trigger a wrongness event by ID ("E1" or "E2").
func trigger_event(event_id: String) -> void:
	match event_id:
		"E1":
			_do_e1_hallway_flicker()
		"E2":
			_do_e2_door_lock()
		_:
			push_warning("StationDegradation: unknown event_id '%s'" % event_id)
			return


## Returns true if the back-office door is currently locked by E2.
func is_office_door_locked() -> bool:
	return _office_door_locked


## Returns the current shift number (1 or 2).
func get_current_shift() -> int:
	return _current_shift


# ===========================================================================
#  Internal — degradation application
# ===========================================================================


func _reset_to_normal() -> void:
	_mirror_delay = MIRROR_DELAY_DEFAULT
	_crt_glitch_interval = 0.0
	_office_door_locked = false
	_stop_crt_glitch_timer()

	# Reset mug rotation (0°).
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		mug.rotation_degrees.y = 0.0

	# Reset chair rotation (0°).
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.rotation_degrees.y = 0.0

	# Hide second mug.
	var second_mug: Node3D = _find_node("BackOffice/SecondMug") as Node3D
	if second_mug:
		second_mug.visible = false

	# Clear door lock metadata.
	var office_door: Node3D = _find_node("BackOffice/OfficeDoor") as Node3D
	if office_door:
		office_door.set_meta("locked", false)


func _apply_shift2_degradation() -> void:
	_mirror_delay = MIRROR_DELAY_SHIFT2
	_crt_glitch_interval = CRT_GLITCH_INTERVAL_SHIFT2

	# Rotate mug 90° clockwise.
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		mug.rotation_degrees.y = 90.0

	# Angle chair 15° left.
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.rotation_degrees.y = -15.0

	# Show second mug (clean, on back desk).
	var second_mug: Node3D = _find_node("BackOffice/SecondMug") as Node3D
	if second_mug:
		second_mug.visible = true

	# Start recurring CRT glitch timer.
	_start_crt_glitch_timer()


# ===========================================================================
#  Internal — E1 event (hallway light flicker 3x + radio_static buzz)
# ===========================================================================


func _do_e1_hallway_flicker() -> void:
	var hallway_light: Light3D = _find_node("Hallway/HallwayLight") as Light3D
	if hallway_light:
		_flicker_light_3x(hallway_light)
	# Play buzz on radio_static bus.
	_play_buzz()
	wrongness_event_triggered.emit("E1", "Hallway light flickers three times")


func _flicker_light_3x(light: Light3D) -> void:
	var orig_energy: float = light.light_energy
	# Three flickers via a Tween sequence: off → on → off → on → off → on.
	var tw: Tween = create_tween()
	for i in 3:
		tw.tween_property(light, "light_energy", 0.0, 0.1)  # off 0.1s
		tw.tween_property(light, "light_energy", orig_energy, 0.15)  # on 0.15s
		tw.tween_interval(0.3)  # pause between flickers


func _play_buzz() -> void:
	if not _buzz_player:
		_buzz_player = AudioStreamPlayer.new()
		_buzz_player.name = "E1BuzzPlayer"
		_buzz_player.bus = "RADIO_AMBIENT"
		add_child(_buzz_player)
	_buzz_player.play()


# ===========================================================================
#  Internal — E2 event (door lock + jiggle + breathing on silence bus)
# ===========================================================================


func _do_e2_door_lock() -> void:
	_office_door_locked = true

	# Set door metadata flag (door_trigger.gd can check this without modification).
	var office_door: Node3D = _find_node("BackOffice/OfficeDoor") as Node3D
	if office_door:
		office_door.set_meta("locked", true)
		_jiggle_door(office_door)

	# Play breathing on silence bus.
	_play_breathing()
	wrongness_event_triggered.emit(
		"E2", "Back office door locked; breathing sound plays for 10 seconds"
	)


func _jiggle_door(door: Node3D) -> void:
	var orig_rot: float = door.rotation_degrees.y
	var tw: Tween = create_tween()
	for i in 4:
		tw.tween_property(door, "rotation_degrees:y", orig_rot + 5.0, 0.08)
		tw.tween_property(door, "rotation_degrees:y", orig_rot, 0.08)


func _play_breathing() -> void:
	if not _breathing_player:
		_breathing_player = AudioStreamPlayer.new()
		_breathing_player.name = "E2BreathingPlayer"
		_breathing_player.bus = "SILENCE"
		add_child(_breathing_player)
	_breathing_player.play()


# ===========================================================================
#  Internal — CRT glitch timer
# ===========================================================================


func _start_crt_glitch_timer() -> void:
	if _crt_glitch_timer:
		_crt_glitch_timer.wait_time = _crt_glitch_interval
		if not _crt_glitch_timer.is_inside_tree():
			add_child(_crt_glitch_timer)
		_crt_glitch_timer.start()


func _stop_crt_glitch_timer() -> void:
	if _crt_glitch_timer and not _crt_glitch_timer.is_stopped():
		_crt_glitch_timer.stop()


func _on_crt_glitch_timeout() -> void:
	# Trigger a 1-frame glitch on the CRT post-process node.
	var crt: Node = _find_node("CRTPostProcess")
	if crt and crt.has_method("trigger_glitch_burst"):
		crt.trigger_glitch_burst(0.06, 0.04)  # short burst, brief duration


# ===========================================================================
#  Internal — node lookup helper
# ===========================================================================


## Look up a node under the Station scene root.
## Autoloads exist before the scene loads, so this must be called at
## apply_degradation time (scene already loaded).
func _find_node(path: String) -> Node:
	var root: Node = get_tree().root
	var station: Node3D = root.get_node_or_null("Station")
	if not station:
		# Try searching for it as a child of root.
		for child in root.get_children():
			if child is Node3D and child.name == "Station":
				station = child as Node3D
				break
	if not station:
		return null
	return station.get_node_or_null(path)


# ===========================================================================
#  Internal — signal handlers
# ===========================================================================


func _on_shift_changed(new_shift: int) -> void:
	# Auto-apply degradation when StationState changes the shift.
	apply_degradation(new_shift)
