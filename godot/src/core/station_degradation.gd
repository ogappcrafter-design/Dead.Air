extends Node
## StationDegradation autoload singleton.
##
## Implements the Dead Air Radio station degradation / wrongness schedule for
## shifts 1-5.  Wraps the existing StationState autoload (which already applies
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
const MIRROR_DELAY_SHIFT3: float = 0.05  # GDD shift 3: "1-frame delay" (~60fps frame)
const MIRROR_DELAY_SHIFT4: float = -1.0  # GDD shift 4: reflection moves independently
const MIRROR_DELAY_DEFAULT: float = 0.0

# -- Hallway lengths (GDD: scene baseline 4m; shift 3 = 4.5m; E1 event = 5m) --
const HALLWAY_LENGTH_BASELINE: float = 4.0
const HALLWAY_LENGTH_SHIFT3: float = 4.5
const HALLWAY_LENGTH_EVENT1: float = 5.0
const HALLWAY_LENGTH_SHIFT4: float = 5.0  # GDD shift 4: 5m, one door sometimes a wall

# -- Shift 3 wrongness event trigger times (seconds into shift 3) -----------
const S3_E1_TRIGGER_TIME: float = 90.0   # hallway stretches to 5m
const S3_E2_TRIGGER_TIME: float = 150.0  # family photo: one face blurs
const S3_E3_TRIGGER_TIME: float = 210.0  # bathroom tile rotated 90°

# -- Shift 4 wrongness event trigger times (seconds into shift 4) -----------
const S4_E1_TRIGGER_TIME: float = 90.0   # bathroom door opens wrong
const S4_E2_TRIGGER_TIME: float = 150.0  # shadow shapes in back office
const S4_E3_TRIGGER_TIME: float = 210.0  # antenna tracks player
const S4_E4_TRIGGER_TIME: float = 270.0  # reflection independent

# -- Shift 5 (dying station): layout shifts between EVERY call (GDD) --------
const S5_HALLWAY_LENGTHS: Array[float] = [5.0, 6.0, 7.5, 9.0]  # per call
const S5_E1_TRIGGER_TIME: float = 60.0   # doors appear/disappear
const S5_E2_TRIGGER_TIME: float = 120.0  # hallway length jumps
const S5_E3_TRIGGER_TIME: float = 180.0  # 1920s office door appears
const S5_E4_TRIGGER_TIME: float = 240.0  # station goes dark (pre-call 17)

# -- Internal state --------------------------------------------------------
var _current_shift: int = 1
var _mirror_delay: float = MIRROR_DELAY_DEFAULT
var _crt_glitch_interval: float = 0.0
var _shift_elapsed: float = 0.0
var _e1_fired: bool = false
var _e2_fired: bool = false
var _s3_e1_fired: bool = false
var _s3_e2_fired: bool = false
var _s3_e3_fired: bool = false
var _s4_e1_fired: bool = false
var _s4_e2_fired: bool = false
var _s4_e3_fired: bool = false
var _s4_e4_fired: bool = false
# Shift 5 state
var _s5_e1_fired: bool = false
var _s5_e2_fired: bool = false
var _s5_e3_fired: bool = false
var _s5_e4_fired: bool = false
var _calls_elapsed: int = 0  # for per-call layout shifts
var _s5_door1920: Node3D = null
var _office_door_locked: bool = false
var _hallway_length: float = HALLWAY_LENGTH_BASELINE
var _crt_glitch_timer: Timer = null
# Shift 4 state
var _antenna_tracking: bool = false

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
	if _current_shift == 2:
		if not _e1_fired and _shift_elapsed >= E1_TRIGGER_TIME:
			_e1_fired = true
			trigger_event("E1")
		if not _e2_fired and _shift_elapsed >= E2_TRIGGER_TIME:
			_e2_fired = true
			trigger_event("E2")
	elif _current_shift == 3:
		if not _s3_e1_fired and _shift_elapsed >= S3_E1_TRIGGER_TIME:
			_s3_e1_fired = true
			trigger_event("E1")
		if not _s3_e2_fired and _shift_elapsed >= S3_E2_TRIGGER_TIME:
			_s3_e2_fired = true
			trigger_event("E2")
		if not _s3_e3_fired and _shift_elapsed >= S3_E3_TRIGGER_TIME:
			_s3_e3_fired = true
			trigger_event("E3")
		elif _current_shift == 4:
			if not _s4_e1_fired and _shift_elapsed >= S4_E1_TRIGGER_TIME:
				_s4_e1_fired = true
				trigger_event("E1")
			if not _s4_e2_fired and _shift_elapsed >= S4_E2_TRIGGER_TIME:
				_s4_e2_fired = true
				trigger_event("E2")
			if not _s4_e3_fired and _shift_elapsed >= S4_E3_TRIGGER_TIME:
				_s4_e3_fired = true
				trigger_event("E3")
			if not _s4_e4_fired and _shift_elapsed >= S4_E4_TRIGGER_TIME:
				_s4_e4_fired = true
				trigger_event("E4")
		elif _current_shift == 5:
			if not _s5_e1_fired and _shift_elapsed >= S5_E1_TRIGGER_TIME:
				_s5_e1_fired = true
				trigger_event("E1")
			if not _s5_e2_fired and _shift_elapsed >= S5_E2_TRIGGER_TIME:
				_s5_e2_fired = true
				trigger_event("E2")
			if not _s5_e3_fired and _shift_elapsed >= S5_E3_TRIGGER_TIME:
				_s5_e3_fired = true
				trigger_event("E3")
			if not _s5_e4_fired and _shift_elapsed >= S5_E4_TRIGGER_TIME:
				_s5_e4_fired = true
				trigger_event("E4")


# ===========================================================================
#  Public API
# ===========================================================================


## Apply degradation state for the given shift number.
## shift 1 = normal, shift 2 = subtle, shift 3 = noticeable, shift 4 = fighting back.
func apply_degradation(shift_number: int) -> void:
	_current_shift = shift_number
	_shift_elapsed = 0.0
	_e1_fired = false
	_e2_fired = false
	_s3_e1_fired = false
	_s3_e2_fired = false
	_s3_e3_fired = false
	_s4_e1_fired = false
	_s4_e2_fired = false
	_s4_e3_fired = false
	_s4_e4_fired = false
	_s5_e1_fired = false
	_s5_e2_fired = false
	_s5_e3_fired = false
	_s5_e4_fired = false
	_calls_elapsed = 0
	_s5_door1920 = null

	match shift_number:
		1:
			_reset_to_normal()
		2:
			_apply_shift2_degradation()
		3:
			_apply_shift3_degradation()
		4:
			_apply_shift4_degradation()
		5:
			_apply_shift5_degradation()
		_:
			_reset_to_normal()

	# Emit signal.
	degradation_applied.emit(shift_number)


## Returns mirror response delay in seconds.
## 0.0 shift 1, 0.2 shift 2, 0.05 shift 3 (GDD: "1-frame delay"),
## -1.0 shift 4 (GDD: reflection moves independently — check is_mirror_independent()).
func get_mirror_delay() -> float:
	return _mirror_delay


## Whether the mirror reflection moves independently (shift 4+, GDD).
func is_mirror_independent() -> bool:
	return _current_shift >= 4


## Returns CRT glitch interval in seconds.
## 0.0 for shift 1, 45.0 for shift 2, 0.0 for shift 3 (the permanent faint
## drift comes from the CRTDegradation baseline instead of discrete glitches).
## Shift 4 gets a shorter permanent flicker interval.
func get_crt_glitch_interval() -> float:
	return _crt_glitch_interval


## Hallway length in metres (GDD: 4m baseline, 4.5m shift 3, 5m shift 4+).
func get_hallway_length() -> float:
	return _hallway_length


## Whether the rooftop antenna tracks the player (shift 4 E3 event).
func is_antenna_tracking() -> bool:
	return _antenna_tracking


## Trigger a wrongness event by ID. Meaning depends on the current shift:
## shift 2 — E1 hallway light flicker, E2 office door lock + breathing.
## shift 3 — E1 hallway stretches to 5m, E2 photo face blurs, E3 bathroom tile rotates.
## shift 4 — E1 bathroom door opens wrong, E2 shadow shapes, E3 antenna tracks,
##           E4 booth glass reflection acts independently.
func trigger_event(event_id: String) -> void:
	match event_id:
		"E1":
			if _current_shift >= 5:
				_do_s5_e1_doors_shift()
			elif _current_shift == 4:
				_do_s4_e1_bathroom_wrong()
			elif _current_shift == 3:
				_do_s3_e1_hallway_stretch()
			else:
				_do_e1_hallway_flicker()
		"E2":
			if _current_shift >= 5:
				_do_s5_e2_hallway_jump()
			elif _current_shift == 4:
				_do_s4_e2_shadow_shapes()
			elif _current_shift == 3:
				_do_s3_e2_photo_blur()
			else:
				_do_e2_door_lock()
		"E3":
			if _current_shift >= 5:
				_do_s5_e3_door_1920()
			elif _current_shift == 4:
				_do_s4_e3_antenna_track()
			else:
				_do_s3_e3_tile_rotate()
		"E4":
			if _current_shift >= 5:
				_do_s5_e4_station_dark()
			else:
				_do_s4_e4_reflection_independent()
		_:
			push_warning("StationDegradation: unknown event_id '%s'" % event_id)
			return


## Returns true if the back-office door is currently locked by E2.
func is_office_door_locked() -> bool:
	return _office_door_locked


## Returns the current shift number (1-5).
func get_current_shift() -> int:
	return _current_shift


# ===========================================================================
#  Internal — degradation application
# ===========================================================================


func _reset_to_normal() -> void:
	_mirror_delay = MIRROR_DELAY_DEFAULT
	_crt_glitch_interval = 0.0
	_office_door_locked = false
	_hallway_length = HALLWAY_LENGTH_BASELINE
	_antenna_tracking = false
	_stop_crt_glitch_timer()

	# Reset mug rotation (0°) and visibility (shift 4 shatters it, shift 5 dusts it).
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		mug.rotation_degrees.y = 0.0
		mug.visible = true

	# Reset chair rotation (0°) and visibility (shift 5 removes it).
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.rotation_degrees.y = 0.0
		chair.visible = true

	# Hide second mug, restore its color (shift 4 tips it over and tints).
	var second_mug: Node3D = _find_node("BackOffice/SecondMug") as Node3D
	if second_mug:
		second_mug.visible = false
		_restore_material(second_mug)

	# Restore second mug rotation (shift 4 tips it over).
	if second_mug:
		second_mug.rotation_degrees.z = 0.0

	# Remove second chair (shift 4 adds it).
	var second_chair: Node3D = _find_node("BackOffice/SecondChair") as Node3D
	if second_chair:
		second_chair.queue_free()

	# Remove DO NOT PLAY tape (shift 4 rooftop ledge, shift 5 console).
	var dnp_tape: Node3D = _find_node("Rooftop/DoNotPlayTape") as Node3D
	if dnp_tape:
		dnp_tape.queue_free()
	var console_tape: Node3D = _find_node("Booth/DoNotPlayTape") as Node3D
	if console_tape:
		console_tape.queue_free()

	# Restore doors and mirror hidden by shift 5 (booth door, rooftop door,
	# bathroom mirror were set visible=false with "removed" metadata).
	for path in ["Booth/DoorToHallway", "Rooftop/DoorToBackOffice", "Bathroom/Mirror"]:
		var hidden: Node = _find_node(path)
		if hidden and hidden.get_meta("removed", false):
			hidden.visible = true
			hidden.remove_meta("removed")

	# Restore all station lights (shift 5 E4 kills them except console).
	var station := _find_station_root()
	if station:
		for light in station.find_children("*", "Light3D", true, false):
			if light is Light3D and (light as Light3D).light_energy == 0.0:
				(light as Light3D).light_energy = 1.0

	# Restore family photo color and face (shift 3 blur).
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		var photo: Node3D = hallway.get_node_or_null("FamilyPhoto") as Node3D
		if photo:
			photo.remove_meta("face_blurred")
			_restore_material(photo)

	# Clear door lock metadata.
	var office_door: Node3D = _find_node("BackOffice/OfficeDoor") as Node3D
	if office_door:
		office_door.set_meta("locked", false)

	# Reset shift-3 mutations: hallway length, family photo, bathroom tile.
	if hallway:
		_stretch_hallway(hallway, HALLWAY_LENGTH_BASELINE)
		var photo2: Node3D = hallway.get_node_or_null("FamilyPhoto") as Node3D
		if photo2:
			photo2.queue_free()
	var bathroom: Node3D = _find_bathroom_root()
	if bathroom:
		var floor_node: Node3D = bathroom.get_node_or_null("Floor") as Node3D
		if floor_node:
			floor_node.rotation_degrees.z = 0.0
			var floor_mat: Variant = floor_node.get("material")
			if floor_mat is StandardMaterial3D:
				(floor_mat as StandardMaterial3D).uv1_rot = 0.0
				(floor_mat as StandardMaterial3D).uv1_scale = Vector3(1, 1, 1)


## Restore a node's material color to the original recorded by _tint_material.
func _restore_material(node: Node) -> void:
	var key := "original_color_" + node.name
	if not node.has_meta(key):
		return
	var mat: Variant = node.get("material")
	if mat is StandardMaterial3D:
		(mat as StandardMaterial3D).albedo_color = node.get_meta(key) as Color
	node.remove_meta(key)


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


func _apply_shift3_degradation() -> void:
	_mirror_delay = MIRROR_DELAY_SHIFT3
	_crt_glitch_interval = 0.0  # permanent faint drift lives in CRTDegradation baseline
	_hallway_length = HALLWAY_LENGTH_SHIFT3

	# Coffee mug now has a crack (rotate it back, tint darker to read as damaged).
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		mug.rotation_degrees.y = 0.0
		_tint_material(mug, Color(0.35, 0.25, 0.2), 0.4)

	# Chair now faces the wall (GDD: chair faces wall).
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.rotation_degrees.y = 180.0

	# Back office mug has lipstick on the rim (darker tint).
	var second_mug: Node3D = _find_node("BackOffice/SecondMug") as Node3D
	if second_mug:
		second_mug.visible = true
		_tint_material(second_mug, Color(0.6, 0.1, 0.15), 0.35)

	# Family photo appears on hallway wall (GDD: 4 people, faces visible).
	_ensure_family_photo()

	# Permanent faint scanline drift: CRTDegradation already handles the
	# shift-3 baseline (0.35); nothing extra to start here.

	# Stop the shift-2 recurring glitch timer if it is still running.
	_stop_crt_glitch_timer()


func _apply_shift4_degradation() -> void:
	_mirror_delay = MIRROR_DELAY_SHIFT4  # negative = independent reflection flag
	_crt_glitch_interval = 0.0  # permanent flicker comes from CRTDegradation baseline (0.60)
	_hallway_length = HALLWAY_LENGTH_SHIFT4

	# Coffee mug shattered on the floor (not cleaned up): tint dark brown
	# and tip it over to read as fallen.
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		_tint_material(mug, Color(0.25, 0.18, 0.14), 0.6)
		mug.rotation_degrees.z = 90.0
		mug.position.y = 0.15  # on the floor instead of the console

	# Chair faces the door (GDD), not the console or the wall.
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.rotation_degrees.y = 90.0

	# Back office mug is empty and tipped over.
	var second_mug: Node3D = _find_node("BackOffice/SecondMug") as Node3D
	if second_mug:
		second_mug.visible = true
		_tint_material(second_mug, Color(0.3, 0.3, 0.32), 0.4)
		second_mug.rotation_degrees.z = 90.0

	# Second chair in back office facing the first.
	_ensure_second_chair()

	# A blank cassette labeled DO NOT PLAY on the rooftop ledge.
	_ensure_do_not_play_tape()

	# Family photo from shift 3 remains (ensure present).
	_ensure_family_photo()

	# Hallway at 5m per GDD (shift 3's 4.5m grows again).
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		_stretch_hallway(hallway, HALLWAY_LENGTH_SHIFT4)

	# Stop the shift-2 recurring glitch timer if it is still running.
	_stop_crt_glitch_timer()


# ===========================================================================
#  Internal — Shift 4 objects
# ===========================================================================


## Second chair in the back office, facing the first (GDD: "two chairs,
## both occupied by shadow shapes" after E2).
func _ensure_second_chair() -> void:
	var office: Node3D = _find_node("BackOffice") as Node3D
	if office == null:
		return
	if office.get_node_or_null("SecondChair") != null:
		return
	var first_chair: Node3D = office.get_node_or_null("ChairSeat") as Node3D
	var base_pos := Vector3(0, 0.5, -1.2)
	var base_rot := 0.0
	if first_chair:
		base_pos = first_chair.global_position + Vector3(0.8, 0, 0) if first_chair else base_pos

	var chair_root := Node3D.new()
	chair_root.name = "SecondChair"
	chair_root.position = office.to_local(base_pos)
	office.add_child(chair_root)

	var seat := CSGBox3D.new()
	seat.name = "Seat"
	seat.size = Vector3(0.45, 0.08, 0.45)
	seat.position = Vector3(0, 0.45, 0)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.15, 0.15, 0.17)
	seat.material = mat
	chair_root.add_child(seat)

	var back := CSGBox3D.new()
	back.name = "Back"
	back.size = Vector3(0.45, 0.5, 0.08)
	back.position = Vector3(0, 0.75, -0.2)
	back.material = mat
	chair_root.add_child(back)

	# Shadow shape: a dark, low-alpha box hovering where a person would sit.
	var shadow := CSGBox3D.new()
	shadow.name = "ShadowShape"
	shadow.size = Vector3(0.4, 0.7, 0.3)
	shadow.position = Vector3(0, 1.0, 0)
	var shadow_mat := StandardMaterial3D.new()
	shadow_mat.albedo_color = Color(0.02, 0.02, 0.03, 0.6)
	shadow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shadow.material = shadow_mat
	chair_root.add_child(shadow)


## Blank cassette on the rooftop ledge labeled DO NOT PLAY (not collectible).
func _ensure_do_not_play_tape() -> void:
	var roof: Node3D = _find_node("Rooftop") as Node3D
	if roof == null:
		return
	if roof.get_node_or_null("DoNotPlayTape") != null:
		return
	var tape := CSGBox3D.new()
	tape.name = "DoNotPlayTape"
	tape.size = Vector3(0.12, 0.03, 0.08)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.05, 0.05, 0.05)
	tape.material = mat
	tape.position = Vector3(1.8, 0.35, 0.5)
	roof.add_child(tape)


# ===========================================================================
#  Internal — Shift 3 events (E1 hallway 5m, E2 photo face blur, E3 tile rotate)
# ===========================================================================


## E1: the hallway is now 5m (was 4.5m). One more step to traverse.
## Lengthens the hallway meshes and moves the far-wall/doors accordingly.
func _do_s3_e1_hallway_stretch() -> void:
	_hallway_length = HALLWAY_LENGTH_EVENT1
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		_stretch_hallway(hallway, HALLWAY_LENGTH_EVENT1)
	wrongness_event_triggered.emit("E1", "The hallway is longer than it was")


## E2: family photo — one person's face is now blurred.
func _do_s3_e2_photo_blur() -> void:
	var photo: Node3D = _find_node("Hallway/FamilyPhoto") as Node3D
	if photo:
		photo.set_meta("face_blurred", true)
		_tint_material(photo, Color(0.2, 0.2, 0.25), 0.5)
	wrongness_event_triggered.emit("E2", "One face in the photo is blurred")


## E3: bathroom tile pattern rotated 90°.
func _do_s3_e3_tile_rotate() -> void:
	var bathroom: Node3D = _find_bathroom_root()
	if bathroom:
		var floor_node: Node3D = bathroom.get_node_or_null("Floor") as Node3D
		if floor_node:
			floor_node.rotation_degrees.z = 90.0
			var mat: Variant = floor_node.get("material")
			if mat is StandardMaterial3D:
				(mat as StandardMaterial3D).uv1_scale = Vector3(1, 1, 1)
				(mat as StandardMaterial3D).uv1_rot = PI * 0.5
	wrongness_event_triggered.emit("E3", "The bathroom tile is rotated 90 degrees")


# ===========================================================================
#  Internal — Shift 4 events (E1 bathroom wrong, E2 shadows, E3 antenna, E4 mirror)
# ===========================================================================


## E1: bathroom door opens to a hallway (wrong room), then reopens normally.
## Implementation: briefly re-target the bathroom's door to a wrong destination,
## then restore it. The player who opens the door during the window gets sent
## to the wrong place; after the window the door behaves normally again.
func _do_s4_e1_bathroom_wrong() -> void:
	var bathroom: Node3D = _find_bathroom_root()
	if bathroom:
		var door: Node = bathroom.get_node_or_null("DoorToHallway")
		if door:
			# Store original target and swap it to a wrong one for 10 seconds.
			var original: Vector3 = door.get("target_position")
			var wrong_target: Vector3 = original + Vector3(0, 0, 6.0)  # lands in the wrong place
			door.set("target_position", wrong_target)
			var timer := get_tree().create_timer(10.0)
			timer.timeout.connect(func() -> void:
				if is_instance_valid(door):
					door.set("target_position", original)
			)
	wrongness_event_triggered.emit(
		"E1", "The bathroom door opened somewhere wrong for a moment"
	)


## E2: shadow shapes occupy the second chair (and a hint on the first).
func _do_s4_e2_shadow_shapes() -> void:
	var office: Node3D = _find_node("BackOffice") as Node3D
	if office:
		var second_chair: Node3D = office.get_node_or_null("SecondChair") as Node3D
		if second_chair:
			var shadow: Node3D = second_chair.get_node_or_null("ShadowShape") as Node3D
			if shadow:
				shadow.visible = true
		else:
			# Chair not created yet (apply_degradation order) — create with shadow on.
			_ensure_second_chair()
	wrongness_event_triggered.emit(
		"E2", "There are two chairs in the back office. Both look occupied."
	)


## E3: rooftop antenna rotates to track the player.
func _do_s4_e3_antenna_track() -> void:
	_antenna_tracking = true
	var roof: Node3D = _find_node("Rooftop") as Node3D
	if roof:
		var mast: Node3D = roof.get_node_or_null("AntennaMast") as Node3D
		if mast:
			mast.set_meta("tracks_player", true)
	wrongness_event_triggered.emit(
		"E3", "The rooftop antenna is pointing at you"
	)


## E4: booth glass reflection acts independently (turns head before you do).
## No reflection mesh exists; flag it so the render layer can pick it up.
func _do_s4_e4_reflection_independent() -> void:
	var booth: Node3D = _find_node("Booth") as Node3D
	if booth:
		booth.set_meta("reflection_independent", true)
	wrongness_event_triggered.emit(
		"E4", "Your reflection isn't moving with you"
	)


# ===========================================================================
#  Internal — Shift 5 (dying station)
# ===========================================================================


## Shift 5 baseline: the station is dying (GDD).
## Coffee mug is dust. Chair is gone. DO NOT PLAY tape moved to the console.
## Booth door gone (wall is smooth). Mirror gone. Hallway starts long.
## Rooftop inaccessible (door removed).
func _apply_shift5_degradation() -> void:
	_mirror_delay = MIRROR_DELAY_SHIFT4  # keep the independent-reflection flag
	_crt_glitch_interval = 0.0
	_hallway_length = S5_HALLWAY_LENGTHS[0]

	# Coffee mug is dust: hide the mesh entirely.
	var mug: Node3D = _find_node("Booth/CoffeeMug") as Node3D
	if mug:
		mug.visible = false

	# Chair is gone.
	var chair: Node3D = _find_node("Booth/Chair") as Node3D
	if chair:
		chair.visible = false

	# DO NOT PLAY tape now sits on the console (not the rooftop).
	_ensure_do_not_play_tape_on_console()

	# Booth door is gone — wall is smooth where it was.
	# Rooftop inaccessible — door is gone.
	_remove_booth_and_rooftop_doors()

	# Bathroom mirror is just a wall.
	_remove_bathroom_mirror()

	# Hallway starts at its shift-5 length.
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		_stretch_hallway(hallway, S5_HALLWAY_LENGTHS[0])

	_stop_crt_glitch_timer()


## DO NOT PLAY tape moved from the rooftop to the console (GDD shift 5).
func _ensure_do_not_play_tape_on_console() -> void:
	var booth: Node3D = _find_node("Booth") as Node3D
	if booth and booth.get_node_or_null("DoNotPlayTape") == null:
		var tape := CSGBox3D.new()
		tape.name = "DoNotPlayTape"
		tape.size = Vector3(0.12, 0.03, 0.08)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.05, 0.05, 0.05)
		tape.material = mat
		tape.position = Vector3(0.3, 0.85, -0.2)  # on the console surface
		booth.add_child(tape)


## Shift 5: booth door and rooftop door are gone (wall is smooth where they were).
func _remove_booth_and_rooftop_doors() -> void:
	for path in ["Booth/DoorToHallway", "Rooftop/DoorToBackOffice"]:
		var door: Node = _find_node(path)
		if door:
			door.visible = false
			door.set_meta("removed", true)


## Shift 5: the bathroom mirror is just a wall.
func _remove_bathroom_mirror() -> void:
	var mirror: Node = _find_node("Bathroom/Mirror")
	if mirror:
		mirror.visible = false
		mirror.set_meta("removed", true)


## Register a completed call so the layout can shift between calls (GDD:
## "layout shifts between every call"). Called by CallManager via
## StationDegradation.on_call_completed() or driven by timed events here.
func on_call_completed() -> void:
	if _current_shift != 5:
		return
	_calls_elapsed += 1
	# Hallway length varies between calls.
	var idx: int = clampi(_calls_elapsed, 0, S5_HALLWAY_LENGTHS.size() - 1)
	_hallway_length = S5_HALLWAY_LENGTHS[idx]
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		_stretch_hallway(hallway, _hallway_length)
	# Doors appear and disappear: toggle bathroom door visibility.
	_toggle_bathroom_door()
	wrongness_event_triggered.emit(
		"LAYOUT", "The station shifted while you weren't looking"
	)


## Doors appear and disappear: flip the bathroom door's visibility.
func _toggle_bathroom_door() -> void:
	var bathroom: Node3D = _find_bathroom_root()
	if bathroom:
		var door: Node3D = bathroom.get_node_or_null("DoorToHallway") as Node3D
		if door and not door.get_meta("removed", false):
			door.visible = not door.visible


## E1: doors appear and disappear around the station.
func _do_s5_e1_doors_shift() -> void:
	_toggle_bathroom_door()
	wrongness_event_triggered.emit(
		"E1", "A door is missing. Then it isn't."
	)


## E2: hallway length jumps between calls.
func _do_s5_e2_hallway_jump() -> void:
	var idx: int = clampi(_calls_elapsed + 1, 0, S5_HALLWAY_LENGTHS.size() - 1)
	_hallway_length = S5_HALLWAY_LENGTHS[idx]
	var hallway: Node3D = _find_hallway_root()
	if hallway:
		_stretch_hallway(hallway, _hallway_length)
	wrongness_event_triggered.emit(
		"E2", "The hallway is longer than it should be"
	)


## E3: one door always leads to the same wrong room — a 1920s office
## (foreshadowing Phase 4). Re-target the bathroom door; restore after 15s.
func _do_s5_e3_door_1920() -> void:
	var bathroom: Node3D = _find_bathroom_root()
	if bathroom:
		var door: Node = bathroom.get_node_or_null("DoorToHallway")
		if door:
			var original: Variant = door.get("target_position")
			# The 1920s office: further down and offset from the station layout.
			var wrong_target: Vector3 = original + Vector3(0, 0, 12.0)
			door.set("target_position", wrong_target)
			var timer := get_tree().create_timer(15.0)
			timer.timeout.connect(func() -> void:
				if is_instance_valid(door):
					door.set("target_position", original)
			)
	wrongness_event_triggered.emit(
		"E3", "One door leads somewhere that doesn't exist yet"
	)


## E4: the station goes dark — every light dies except the console CRT.
func _do_s5_e4_station_dark() -> void:
	for light in _all_station_lights():
		if light.has_meta("console_light"):
			continue
		light.light_energy = 0.0
	wrongness_event_triggered.emit(
		"E4", "The lights are gone. Only the console glows."
	)


## Collect every Light3D in the station, tagging console lights.
func _all_station_lights() -> Array[Light3D]:
	var lights: Array[Light3D] = []
	var station := _find_station_root()
	if station:
		for child in station.find_children("*", "Light3D", true, false):
			lights.append(child as Light3D)
	return lights


## Tint a node's StandardMaterial3D toward `target` by `amount` (0-1).
## Stores the original color in metadata on first tint so repeated
## apply_degradation calls don't compound the tint.
func _tint_material(node: Node, target: Color, amount: float) -> void:
	var mat: Variant = node.get("material")
	if not (mat is StandardMaterial3D):
		return
	var m := mat as StandardMaterial3D
	var key := "original_color_" + node.name
	if not node.has_meta(key):
		node.set_meta(key, m.albedo_color)
	m.albedo_color = (node.get_meta(key) as Color).lerp(target, amount)


## Stretch hallway meshes along x so the walk from booth to far end reads as
## `length` metres. Floor/ceiling lengthen; end walls move; door zones move
## with the far wall so navigation still works.
func _stretch_hallway(hallway: Node3D, length: float) -> void:
	# CSG boxes: size.x = thickness for the x-axis walls (they read as length).
	var floor_node: CSGBox3D = hallway.get_node_or_null("Floor") as CSGBox3D
	var ceiling: CSGBox3D = hallway.get_node_or_null("Ceiling") as CSGBox3D
	var east_wall: CSGBox3D = hallway.get_node_or_null("EastWall") as CSGBox3D
	if floor_node:
		floor_node.size = Vector3(length, floor_node.size.y, floor_node.size.z)
	if ceiling:
		ceiling.size = Vector3(length, ceiling.size.y, ceiling.size.z)
	if east_wall:
		east_wall.size = Vector3(0.1, east_wall.size.y, east_wall.size.z)
		east_wall.position = Vector3(length * 0.5, 1.25, 0)
	# Move camera zone with the room bounds.
	var zone: Area3D = hallway.get_node_or_null("ZoneH1") as Area3D
	if zone:
		var shape: CollisionShape3D = zone.get_node_or_null("CollisionShape3D") as CollisionShape3D
		if shape and shape.shape is BoxShape3D:
			var box := shape.shape as BoxShape3D
			box.size = Vector3(length, box.size.y, box.size.z)


## Create the family photo on the hallway wall if it does not exist yet.
## GDD: 4 people, faces visible — simple framed plane.
func _ensure_family_photo() -> void:
	var hallway: Node3D = _find_hallway_root()
	if hallway == null:
		return
	if hallway.get_node_or_null("FamilyPhoto") != null:
		return

	var photo := CSGBox3D.new()
	photo.name = "FamilyPhoto"
	photo.size = Vector3(0.05, 0.35, 0.5)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.68, 0.55)
	photo.material = mat
	photo.position = Vector3(0, 1.5, -0.68)  # on the north wall, between the doors
	photo.use_collision = false
	hallway.add_child(photo)


## Find the hallway root in the live scene. The station is instanced as
## "StationEnvironment" under NightShift, so search by class/name across
## the tree rather than assuming a root-level "Station" child.
func _find_hallway_root() -> Node3D:
	var direct: Node3D = _find_node("Hallway") as Node3D
	if direct:
		return direct
	var station := _find_station_root()
	if station:
		return station.get_node_or_null("Hallway") as Node3D
	return null


## Find the bathroom root in the live scene.
func _find_bathroom_root() -> Node3D:
	var direct: Node3D = _find_node("Bathroom") as Node3D
	if direct:
		return direct
	var station := _find_station_root()
	if station:
		return station.get_node_or_null("Bathroom") as Node3D
	return null


## Find the station root node in the live scene ("Station" or "StationEnvironment").
func _find_station_root() -> Node3D:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	var by_name: Node = tree.root.get_node_or_null("Station")
	if by_name == null:
		by_name = tree.root.get_node_or_null("NightShift/StationEnvironment")
	if by_name == null:
		by_name = tree.root.get_node_or_null("StationEnvironment")
	return by_name as Node3D


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
	var station := _find_station_root()
	if not station:
		return null
	return station.get_node_or_null(path)


# ===========================================================================
#  Internal — signal handlers
# ===========================================================================


func _on_shift_changed(new_shift: int) -> void:
	# Auto-apply degradation when StationState changes the shift.
	apply_degradation(new_shift)
