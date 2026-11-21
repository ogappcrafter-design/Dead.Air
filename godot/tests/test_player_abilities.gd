## test_player_abilities.gd — DEA-187 flashlight + DEA-188 sprint/stamina.
## Tests: input actions, sprint speed, stamina drain/regen/lockout, sprint
##        noise reaching the Suits, sprint dread, flashlight battery/toggle,
##        flashlight widening Suit detection.
extends RefCounted

var test_name: String = "PlayerAbilities"

## Loaded by path: new class_name identifiers are not in the global class
## cache until the project is imported, which headless suite runs skip.
const PlayerFlashlightScript = preload("res://src/entities/player_flashlight.gd")


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_input_actions_registered"] = test_input_actions_registered()
	results["test_sprint_speed_is_4_mps"] = test_sprint_speed_is_4_mps()
	results["test_stamina_drains_in_6s_regens_in_4s"] = test_stamina_drains_in_6s_regens_in_4s()
	results["test_no_sprint_at_zero_stamina"] = test_no_sprint_at_zero_stamina()
	results["test_sprint_noise_alerts_near_suit_only"] = test_sprint_noise_alerts_near_suit_only()
	results["test_sprint_raises_dread"] = test_sprint_raises_dread()
	results["test_flashlight_toggle_and_light"] = test_flashlight_toggle_and_light()
	results["test_flashlight_battery_drain_90s"] = test_flashlight_battery_drain_90s()
	results["test_flashlight_locked_out_at_zero_battery"] = test_flashlight_locked_out_at_zero_battery()
	results["test_flashlight_widens_suit_detection"] = test_flashlight_widens_suit_detection()
	return results


## ─── Helpers ────────────────────────────────────────────────────────────


func _tree() -> SceneTree:
	return Engine.get_main_loop() as SceneTree


## CharacterBody3D + camera + ScreenRelativeMovement, all in-tree so
## global_position and move_and_slide behave like the real player.
func _make_move() -> Dictionary:
	var tree := _tree()
	var body := CharacterBody3D.new()
	tree.root.add_child(body)
	body.global_position = Vector3.ZERO
	var cam := Camera3D.new()
	tree.root.add_child(cam)
	cam.global_position = Vector3(0, 5, 10)
	cam.look_at(Vector3.ZERO, Vector3.UP)
	var move := ScreenRelativeMovement.new()
	body.add_child(move)
	move.set_camera(cam)
	return {"body": body, "cam": cam, "move": move}


func _drop_move(world: Dictionary) -> void:
	var body: Node = world["body"]
	var cam: Node = world["cam"]
	if is_instance_valid(body):
		body.free()
	if is_instance_valid(cam):
		cam.free()


## Movement is mode-gated by InputManager; tests drive EXPLORE.
func _force_explore() -> void:
	var im: Node = _tree().root.get_node_or_null("/root/InputManager")
	if im != null and im.has_method("set_mode"):
		im.set_mode(ControlEnums.ControlMode.EXPLORE)


func _release_inputs() -> void:
	for action in ["sprint", "flashlight", "move_up", "move_down", "move_left", "move_right"]:
		Input.action_release(action)


## Suit with a test DreadComposure, added to the tree so group lookups and
## global positions work. Caller frees with _drop_suit.
func _make_suit(player: Node3D, pos: Vector3) -> Suit:
	var suit := Suit.new()
	suit.name = "AbilityTestSuit"
	suit.set_rng_seed(42)
	# PATROL returns before its detection check when patrol_points is empty.
	suit.set_patrol_points([pos])
	_tree().root.add_child(suit)
	suit.set_player(player)
	suit.set_dread_composure(DreadComposure.new())
	suit.global_position = pos
	suit.global_rotation = Vector3.ZERO
	return suit


func _drop_suit(suit: Suit) -> void:
	if not is_instance_valid(suit):
		return
	var dc: DreadComposure = suit.get_dread_composure()
	suit.free()
	if dc != null and is_instance_valid(dc) and dc.get_parent() == null:
		dc.free()


func _simulate(suit: Suit, delta: float, frames: int) -> void:
	for i in range(frames):
		suit._physics_process(delta)


## ─── DEA-188: input + sprint ────────────────────────────────────────────


func test_input_actions_registered() -> bool:
	if not InputMap.has_action("sprint") or not InputMap.has_action("flashlight"):
		return false
	var sprint_has_shift := false
	var sprint_has_trigger := false
	for ev in InputMap.action_get_events("sprint"):
		if ev is InputEventKey and ev.keycode == KEY_SHIFT:
			sprint_has_shift = true
		elif ev is InputEventJoypadMotion and ev.axis == 5:
			sprint_has_trigger = true
	var flashlight_has_key := false
	var flashlight_has_button := false
	for ev in InputMap.action_get_events("flashlight"):
		if ev is InputEventKey and ev.keycode == KEY_V:
			flashlight_has_key = true
		elif ev is InputEventJoypadButton and ev.button_index == JOY_BUTTON_LEFT_STICK:
			flashlight_has_button = true
	return sprint_has_shift and sprint_has_trigger and flashlight_has_key and flashlight_has_button


func test_sprint_speed_is_4_mps() -> bool:
	var world := _make_move()
	var move: ScreenRelativeMovement = world["move"]
	var body: CharacterBody3D = world["body"]
	var constants_ok := (
		is_equal_approx(move.move_speed, 3.0) and is_equal_approx(move.sprint_speed, 4.0)
	)
	_force_explore()
	_release_inputs()
	Input.action_press("move_up")
	Input.action_press("sprint")
	for i in range(30):
		move._physics_process(0.05)
	var sprint_speed: float = Vector2(body.velocity.x, body.velocity.z).length()
	var sprinting: bool = move.is_sprinting()
	# Release sprint: walking again must settle back at 3.0 m/s.
	Input.action_release("sprint")
	for i in range(30):
		move._physics_process(0.05)
	var walk_speed: float = Vector2(body.velocity.x, body.velocity.z).length()
	_release_inputs()
	_drop_move(world)
	return (
		constants_ok and sprinting
		and absf(sprint_speed - 4.0) < 0.15
		and absf(walk_speed - 3.0) < 0.15
	)


func test_stamina_drains_in_6s_regens_in_4s() -> bool:
	var world := _make_move()
	var move: ScreenRelativeMovement = world["move"]
	move.set_stamina(100.0)
	_force_explore()
	_release_inputs()
	Input.action_press("move_up")
	Input.action_press("sprint")
	for i in range(60):  # 6.0 s at 0.1 s
		move._physics_process(0.1)
	var drained: bool = move.get_stamina() <= 0.01 and not move.is_sprinting()
	Input.action_release("sprint")
	for i in range(40):  # 4.0 s of regen
		move._physics_process(0.1)
	var regen: bool = move.get_stamina() >= 99.9
	_release_inputs()
	_drop_move(world)
	return drained and regen


func test_no_sprint_at_zero_stamina() -> bool:
	var world := _make_move()
	var move: ScreenRelativeMovement = world["move"]
	move.set_stamina(0.0)
	_force_explore()
	_release_inputs()
	Input.action_press("move_up")
	Input.action_press("sprint")
	for i in range(5):  # 0.5 s — regen keeps it below the re-arm threshold
		move._physics_process(0.1)
	var blocked: bool = not move.is_sprinting() and move.is_exhausted()
	var stamina_rising: bool = move.get_stamina() > 0.0
	_release_inputs()
	_drop_move(world)
	return blocked and stamina_rising


func test_sprint_noise_alerts_near_suit_only() -> bool:
	var world := _make_move()
	var move: ScreenRelativeMovement = world["move"]
	var body: CharacterBody3D = world["body"]
	var near := _make_suit(body, Vector3.ZERO)
	var far := _make_suit(body, Vector3(20, 0, 0))
	near.spawn_at()
	far.spawn_at()
	_force_explore()
	_release_inputs()
	Input.action_press("move_up")
	Input.action_press("sprint")
	for i in range(5):  # 0.5 s -> one 0.4 s noise pulse
		move._physics_process(0.1)
	Input.action_release("sprint")
	near._physics_process(0.1)
	far._physics_process(0.1)
	var near_state: int = near.get_state()
	var far_state: int = far.get_state()
	_release_inputs()
	_drop_suit(near)
	_drop_suit(far)
	_drop_move(world)
	return near_state == Suit.State.INVESTIGATE and far_state == Suit.State.PATROL


func test_sprint_raises_dread() -> bool:
	var world := _make_move()
	var move: ScreenRelativeMovement = world["move"]
	var dc := DreadComposure.new()
	dc.set_dread(0.0)
	move.set_dread_composure(dc)
	_force_explore()
	_release_inputs()
	Input.action_press("move_up")
	Input.action_press("sprint")
	for i in range(10):  # 1.0 s -> two noise pulses
		move._physics_process(0.1)
	var dread: float = dc.dread
	_release_inputs()
	dc.free()
	_drop_move(world)
	return dread > 0.0


## ─── DEA-187: flashlight ────────────────────────────────────────────────


func test_flashlight_toggle_and_light() -> bool:
	var fl := PlayerFlashlightScript.new()
	_tree().root.add_child(fl)
	var ok: bool = true
	ok = ok and fl.get_light() != null
	ok = ok and is_equal_approx(fl.get_visibility_multiplier(), 1.0)
	ok = ok and fl.toggle() and fl.is_on and fl.get_light().visible
	ok = ok and is_equal_approx(fl.get_visibility_multiplier(), fl.VISIBILITY_MULTIPLIER)
	ok = ok and fl.toggle() and not fl.is_on and not fl.get_light().visible
	ok = ok and is_equal_approx(fl.get_visibility_multiplier(), 1.0)
	fl.free()
	return ok


func test_flashlight_battery_drain_90s() -> bool:
	var fl := PlayerFlashlightScript.new()
	_tree().root.add_child(fl)
	fl.set_on(true)
	for i in range(90):  # 90 s of ON time
		fl._process(1.0)
	var drained: bool = fl.get_battery() <= 0.01 and not fl.is_on
	var light_off: bool = not fl.get_light().visible
	fl.free()
	return drained and light_off


func test_flashlight_locked_out_at_zero_battery() -> bool:
	var fl := PlayerFlashlightScript.new()
	_tree().root.add_child(fl)
	fl.set_battery(0.0)
	var refused: bool = not fl.set_on(true) and not fl.is_on
	refused = refused and not fl.get_light().visible
	refused = refused and not fl.toggle() and not fl.is_on
	fl.free()
	return refused


func test_flashlight_widens_suit_detection() -> bool:
	var player := Player.new()
	player.name = "AbilityTestPlayer"
	_tree().root.add_child(player)
	player.global_position = Vector3(0, 0, -8)
	player.global_rotation = Vector3.ZERO
	var fl = player.get_flashlight()
	if fl == null:
		player.free()
		return false

	# Unlit control: 8 m is beyond the 5 m patrol range.
	var suit_unlit := _make_suit(player, Vector3.ZERO)
	suit_unlit.spawn_at()
	_simulate(suit_unlit, 0.1, 40)
	var unlit_state: int = suit_unlit.get_state()
	_drop_suit(suit_unlit)

	# Lit: 5 m * 1.8 = 9 m effective range, so 8 m is detected.
	fl.set_on(true)
	var suit_lit := _make_suit(player, Vector3.ZERO)
	suit_lit.spawn_at()
	_simulate(suit_lit, 0.1, 40)
	var lit_state: int = suit_lit.get_state()
	_drop_suit(suit_lit)

	player.free()
	return unlit_state == Suit.State.PATROL and lit_state == Suit.State.APPROACH
