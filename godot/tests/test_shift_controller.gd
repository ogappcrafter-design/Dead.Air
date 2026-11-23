extends RefCounted
## Tests for ShiftController autoload.
##
## Verifies state transitions, shift data, signal emissions, and integration
## with CallManager, PhaseManager, and band unlock system.

var test_name: String = "ShiftController"

var _shift_started_count: int = 0
var _shift_started_arg: int = 0
var _phase_changed_count: int = 0
var _phase_changed_args: Array[String] = []
var _call_sequence_complete_count: int = 0
var _shift_complete_count: int = 0
var _shift_complete_arg: int = 0
var _band_unlocked_count: int = 0
var _band_unlocked_args: Array[String] = []


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_shift_data_definitions"] = test_shift_data_definitions()
	results["test_is_shift_implemented"] = test_is_shift_implemented()
	results["test_start_shift_sets_state"] = test_start_shift_sets_state()
	results["test_phase_transitions"] = test_phase_transitions()
	results["test_shift_1_config"] = test_shift_1_config()
	results["test_shift_2_config"] = test_shift_2_config()
	results["test_band_unlock_signal"] = test_band_unlock_signal()
	results["test_shift_complete_signal"] = test_shift_complete_signal()
	results["test_shift_completion_starts_next_shift"] = (
		test_shift_completion_starts_next_shift()
	)
	results["test_post_shift_timer_starts_next_shift"] = (
		test_post_shift_timer_starts_next_shift()
	)
	results["test_night_5_enters_phase2"] = await test_night_5_enters_phase2()
	results["test_post_shift_summary_continue_dismisses"] = (
		await test_post_shift_summary_continue_dismisses()
	)
	results["test_loaded_post_shift_summary_restores"] = (
		await test_loaded_post_shift_summary_restores()
	)
	results["test_call_sequence_complete"] = test_call_sequence_complete()
	results["test_unimplemented_shift_rejected"] = test_unimplemented_shift_rejected()
	results["test_phase_name_strings"] = test_phase_name_strings()
	_disconnect_signals()
	return results


# ─── Helpers ─────────────────────────────────────────────────────────────────


func _connect_signals() -> void:
	_shift_started_count = 0
	_shift_started_arg = 0
	_phase_changed_count = 0
	_phase_changed_args.clear()
	_call_sequence_complete_count = 0
	_shift_complete_count = 0
	_shift_complete_arg = 0
	_band_unlocked_count = 0
	_band_unlocked_args.clear()
	ShiftController.shift_started.connect(_on_shift_started)
	ShiftController.shift_phase_changed.connect(_on_phase_changed)
	ShiftController.call_sequence_complete.connect(_on_call_sequence_complete)
	ShiftController.shift_complete.connect(_on_shift_complete)
	ShiftController.band_unlocked.connect(_on_band_unlocked)


func _disconnect_signals() -> void:
	if ShiftController.shift_started.is_connected(_on_shift_started):
		ShiftController.shift_started.disconnect(_on_shift_started)
	if ShiftController.shift_phase_changed.is_connected(_on_phase_changed):
		ShiftController.shift_phase_changed.disconnect(_on_phase_changed)
	if ShiftController.call_sequence_complete.is_connected(_on_call_sequence_complete):
		ShiftController.call_sequence_complete.disconnect(_on_call_sequence_complete)
	if ShiftController.shift_complete.is_connected(_on_shift_complete):
		ShiftController.shift_complete.disconnect(_on_shift_complete)
	if ShiftController.band_unlocked.is_connected(_on_band_unlocked):
		ShiftController.band_unlocked.disconnect(_on_band_unlocked)


func _reset() -> void:
	ShiftController._reset_for_testing()
	if CallManager:
		CallManager._reset_for_testing()
	_connect_signals()


## End the active call queue through CallManager's own advance/end path.
## Returns true only when the queue actually ended, so a mid-flight queue
## fails the test instead of being papered over by a direct handler call.
func _drain_call_queue() -> bool:
	if CallManager == null:
		return false
	var guard := 0
	while CallManager.is_shift_active() and guard < 100:
		CallManager._advance_queue()
		guard += 1
	return not CallManager.is_shift_active()


func _on_shift_started(shift_number: int) -> void:
	_shift_started_count += 1
	_shift_started_arg = shift_number


func _on_phase_changed(phase: String) -> void:
	_phase_changed_count += 1
	_phase_changed_args.append(phase)


func _on_call_sequence_complete() -> void:
	_call_sequence_complete_count += 1


func _on_shift_complete(shift_number: int) -> void:
	_shift_complete_count += 1
	_shift_complete_arg = shift_number


func _on_band_unlocked(band_name: String) -> void:
	_band_unlocked_count += 1
	_band_unlocked_args.append(band_name)


# ─── Tests ────────────────────────────────────────────────────────────────────


func test_shift_data_definitions() -> bool:
	# Shift 1 data
	var s1: Dictionary = ShiftController.get_shift_data(1)
	var s1_ok: bool = (
		not s1.is_empty()
		and s1["shift_number"] == 1
		and s1["bands"] == ["LIVING"]
		and s1["dread_meter_visible"] == false
		and s1["save_unlocked"] == false
		and s1["tutorial"] == true
	)

	# Shift 2 data
	var s2: Dictionary = ShiftController.get_shift_data(2)
	var s2_ok: bool = (
		not s2.is_empty()
		and s2["shift_number"] == 2
		and s2["bands"] == ["LIVING", "LIMINAL"]
		and s2["dread_meter_visible"] == true
		and s2["save_unlocked"] == true
		and s2["tutorial"] == true
	)

	# Out of range returns empty
	var oob_ok: bool = (
		ShiftController.get_shift_data(0).is_empty()
		and ShiftController.get_shift_data(99).is_empty()
	)

	return s1_ok and s2_ok and oob_ok


func test_is_shift_implemented() -> bool:
	if not ShiftController.is_shift_implemented(1) or not ShiftController.is_shift_implemented(2):
		return false
	if not ShiftController.is_shift_implemented(3) or not ShiftController.is_shift_implemented(4) \
			or not ShiftController.is_shift_implemented(5):
		return false
	if ShiftController.is_shift_implemented(6):
		return false
	if ShiftController.is_shift_implemented(0) or ShiftController.is_shift_implemented(-1):
		return false
	return true


func test_start_shift_sets_state() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	if not ShiftController.is_shift_active() or ShiftController.get_current_shift() != 1:
		return false
	if _shift_started_count != 1 or _shift_started_arg != 1:
		return false
	# Phase should have changed at least once (PRE_SHIFT)
	if _phase_changed_count < 1 or _phase_changed_args[0] != "pre_shift":
		return false

	ShiftController._reset_for_testing()
	return true


func test_phase_transitions() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# PRE_SHIFT → CALLS_ACTIVE (testing mode skips timer, but we force it)
	ShiftController._force_enter_calls_active()

	if ShiftController.get_current_phase_name() != "calls_active":
		return false

	# CALLS_ACTIVE → POST_SHIFT
	ShiftController._force_enter_post_shift()

	if ShiftController.get_current_phase_name() != "post_shift":
		return false

	# POST_SHIFT → SHIFT_TRANSITION
	ShiftController._force_enter_shift_transition()

	if ShiftController.get_current_phase_name() != "transition":
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_1_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Shift 1: LIVING only, no dread, no save
	if ShiftController.is_dread_meter_visible() != false:
		return false
	if ShiftController.is_save_available() != false:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 1:
		return false
	if bands[0] != "LIVING":
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_2_config() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2: LIMINAL unlocked, dread shown, save unlocked
	if ShiftController.is_dread_meter_visible() != true:
		return false
	if ShiftController.is_save_available() != true:
		return false

	var bands: Array[String] = ShiftController.get_unlocked_bands()
	if bands.size() != 2:
		return false
	if bands[0] != "LIVING":
		return false
	if bands[1] != "LIMINAL":
		return false

	ShiftController._reset_for_testing()
	return true


func test_band_unlock_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(2)

	# Shift 2 unlocks LIVING and LIMINAL
	# LIVING should fire on shift 1 start; on shift 2 both should fire
	if _band_unlocked_count < 1:
		return false
	# Check LIMINAL was unlocked
	var found_liminal := false
	for b in _band_unlocked_args:
		if b == "LIMINAL":
			found_liminal = true
			break
	if not found_liminal:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_complete_signal() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	# Real path: pre-shift timer → calls active → call end → post-shift
	# confirm → transition timer → completion.
	ShiftController._process(0.1)
	var queue_ended := _drain_call_queue()
	ShiftController.confirm_post_shift()
	ShiftController._process(ShiftController.SHIFT_TRANSITION_DURATION + 0.1)

	if not queue_ended:
		return false
	if _shift_complete_count != 1:
		return false
	if _shift_complete_arg != 1:
		return false
	# Completion advances the campaign instead of leaving it inactive.
	if not ShiftController.is_shift_active() or ShiftController.get_current_shift() != 2:
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_completion_starts_next_shift() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._process(0.1)
	var queue_ended := _drain_call_queue()
	var post_shift: bool = ShiftController.get_current_phase_name() == "post_shift"
	ShiftController.confirm_post_shift()
	var transition: bool = ShiftController.get_current_phase_name() == "transition"
	ShiftController._process(ShiftController.SHIFT_TRANSITION_DURATION + 0.1)
	var advanced: bool = (
		queue_ended
		and post_shift
		and transition
		and ShiftController.is_shift_active()
		and ShiftController.get_current_shift() == 2
		and ShiftController.is_save_available()
	)
	ShiftController._reset_for_testing()
	return advanced


func test_post_shift_timer_starts_next_shift() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._process(0.1)
	var queue_ended := _drain_call_queue()
	var post_shift: bool = ShiftController.get_current_phase_name() == "post_shift"
	# No player confirm: the post-shift timer must leave the state.
	ShiftController._process(ShiftController.POST_SHIFT_DURATION + 0.1)
	var transition: bool = ShiftController.get_current_phase_name() == "transition"
	ShiftController._process(ShiftController.SHIFT_TRANSITION_DURATION + 0.1)
	# Night 2's calls must start. A Night 1 queue left mid-flight makes
	# CallManager reject start_shift, so the listener never sees shift 1.
	var started := {"shift": -1}
	var on_started := func(shift_num: int) -> void: started["shift"] = shift_num
	CallManager.shift_started.connect(on_started)
	ShiftController._process(0.1)
	CallManager.shift_started.disconnect(on_started)
	var advanced: bool = (
		queue_ended
		and post_shift
		and transition
		and ShiftController.is_shift_active()
		and ShiftController.get_current_shift() == 2
		and started["shift"] == 1
	)
	ShiftController._reset_for_testing()
	return advanced


## Night 5 completion must leave the station for the Phase 2 scene, not just
## fire the signal.
func test_night_5_enters_phase2() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var packed: PackedScene = load("res://scenes/night_shift.tscn") as PackedScene
	if packed == null:
		return false
	var scene: Node = packed.instantiate()
	if scene == null:
		return false
	var runner: Node = scene.get_node_or_null("TestRunner")
	if runner != null:
		scene.remove_child(runner)
		runner.free()
	tree.root.add_child(scene)
	await tree.process_frame

	var director: GameDirector = scene.get_node_or_null("GameDirector") as GameDirector
	var recorded := {"path": ""}
	if director != null:
		director.request_scene_change = func(path: String) -> void:
			recorded["path"] = path

	ShiftController._reset_for_testing()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(5)
	ShiftController._process(0.1)
	var queue_ended := _drain_call_queue()
	ShiftController._process(ShiftController.POST_SHIFT_DURATION + 0.1)
	ShiftController._process(ShiftController.SHIFT_TRANSITION_DURATION + 0.1)

	var landed: bool = recorded["path"] == GameDirector.PHASE2_SCENE
	var phase2: bool = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_2_BREAK
	scene.free()
	ShiftController._reset_for_testing()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	CameraManager.set_rig(null)
	CameraManager._active_zone = null
	return queue_ended and landed and phase2


## The shipped scene must mount the post-shift summary, and its Continue
## signal must reach confirm_post_shift().
func test_post_shift_summary_continue_dismisses() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var packed: PackedScene = load("res://scenes/night_shift.tscn") as PackedScene
	if packed == null:
		return false
	var scene: Node = packed.instantiate()
	if scene == null:
		return false
	var runner: Node = scene.get_node_or_null("TestRunner")
	if runner != null:
		scene.remove_child(runner)
		runner.free()
	tree.root.add_child(scene)
	await tree.process_frame

	var summary: ShiftSummary = (
		scene.get_node_or_null("InteractionUI/ShiftSummary") as ShiftSummary
	)
	ShiftController._reset_for_testing()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._process(0.1)
	var queue_ended := _drain_call_queue()
	var post_shift: bool = ShiftController.get_current_phase_name() == "post_shift"
	var shown: bool = summary != null and summary.visible

	# The player presses the Continue control that is on screen; the summary's
	# own signal is never emitted directly, so a missing or disabled button
	# fails here instead of passing on the signal alone.
	var reachable := false
	var below_fold := false
	var dismissed := false
	if summary != null and shown:
		# Shrink the summary to the 320x240 display it has to fit: its text stack
		# is taller than that, so Continue starts below the fold and only the
		# scroll container can bring it back.
		summary.set_anchors_preset(Control.PRESET_TOP_LEFT)
		summary.size = Vector2(320.0, 240.0)
		await tree.process_frame
		await tree.process_frame
		var button: Button = summary.get_continue_button()
		var scroll := summary.get_node_or_null("SummaryScroll") as ScrollContainer
		if button != null and scroll != null and button.is_visible_in_tree() \
				and not button.disabled:
			scroll.scroll_vertical = 0
			await tree.process_frame
			below_fold = button.get_global_rect().end.y > scroll.get_global_rect().end.y
			# Focus-driven scrolling is what a keyboard or gamepad player does, and
			# follow_focus is what makes it reveal a control the layout put below
			# the clip. Emitting pressed alone would pass with neither working.
			button.grab_focus()
			for _frame in 3:
				await tree.process_frame
			var clip := scroll.get_global_rect()
			var rect := button.get_global_rect()
			reachable = scroll.follow_focus and button.has_focus() \
				and rect.size.x > 0.0 and rect.size.y > 0.0 \
				and rect.position.y >= clip.position.y - 0.5 \
				and rect.end.y <= clip.end.y + 0.5 \
				and rect.position.x >= clip.position.x - 0.5 \
				and rect.end.x <= clip.end.x + 0.5
			button.pressed.emit()
			dismissed = not summary.visible
	var still_exploring: bool = ShiftController.get_current_phase_name() == "post_shift"

	scene.free()
	ShiftController._reset_for_testing()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	CameraManager.set_rig(null)
	CameraManager._active_zone = null
	return queue_ended and post_shift and shown and below_fold and reachable \
		and dismissed and still_exploring


## Continue on a post-shift tape restores that phase before the gameplay scene
## exists, so the scene has to pick the phase up when it starts listening.
## Driven through the menu's own Continue button: the restore lives in
## start_loaded_game(), so a test that resumed the phase itself would keep
## passing after that wiring stopped running.
func test_loaded_post_shift_summary_restores() -> bool:
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	ShiftController._reset_for_testing()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	ShiftController._set_testing_mode(true)
	SaveManager.set_save_available(true)

	# A tape written in the post-shift room of night 2 with three calls banked.
	var tape := SaveData.new()
	tape.shift = 2
	tape.phase = PhaseEnums.Phase.PHASE_1_STATION
	tape.shift_phase = int(ShiftController.ShiftPhase.POST_SHIFT)
	tape.completed_calls = 3
	var tape_saved: bool = SaveManager.save_slot("slot_1", tape)

	var packed_menu: PackedScene = load("res://scenes/main_menu.tscn") as PackedScene
	if packed_menu == null or not tape_saved:
		return false
	var menu: Node = packed_menu.instantiate()
	if menu == null:
		return false
	tree.root.add_child(menu)
	var requested := {"scene": ""}
	menu.request_scene_change = func(path: String): requested["scene"] = path
	var continue_button: Button = menu.get_node("PanelCenter/VBox/ContinueButton") as Button
	if continue_button == null:
		menu.queue_free()
		return false
	continue_button.emit_signal("pressed")
	var continued: bool = requested["scene"] == "res://scenes/night_shift.tscn"
	var restored_calls: bool = ShiftController.get_completed_call_count() == 3
	var resumed: bool = (
		ShiftController.is_shift_active()
		and ShiftController.get_current_shift() == 2
		and ShiftController.get_current_phase_name() == "post_shift"
	)

	var packed: PackedScene = load("res://scenes/night_shift.tscn") as PackedScene
	if packed == null:
		return false
	var scene: Node = packed.instantiate()
	if scene == null:
		return false
	var runner: Node = scene.get_node_or_null("TestRunner")
	if runner != null:
		scene.remove_child(runner)
		runner.free()
	tree.root.add_child(scene)
	await tree.process_frame
	await tree.process_frame

	var summary: ShiftSummary = (
		scene.get_node_or_null("InteractionUI/ShiftSummary") as ShiftSummary
	)
	var shown: bool = summary != null and summary.visible
	var button: Button = summary.get_continue_button() if summary != null else null
	var reachable: bool = button != null and button.is_visible_in_tree() and not button.disabled
	var phase: String = ShiftController.get_current_phase_name()

	scene.free()
	menu.queue_free()
	ShiftController._reset_for_testing()
	SaveManager._reset_for_testing()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	CameraManager.set_rig(null)
	CameraManager._active_zone = null
	return continued and resumed and restored_calls and shown and reachable and phase == "post_shift"


func test_call_sequence_complete() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)
	ShiftController._force_enter_calls_active()

	# Simulate CallManager finishing all calls
	ShiftController._on_call_manager_shift_ended(0)

	if _call_sequence_complete_count != 1:
		return false
	if ShiftController.get_current_phase_name() != "post_shift":
		return false

	ShiftController._reset_for_testing()
	return true


func test_unimplemented_shift_rejected() -> bool:
	_reset()
	ShiftController.start_shift(6)  # Shift 6 is out of range — not implemented

	if ShiftController.is_shift_active():
		return false
	if ShiftController.get_current_shift() != 0:
		return false

	ShiftController.start_shift(7)  # Out of range entirely

	if ShiftController.is_shift_active():
		return false

	ShiftController._reset_for_testing()
	return true


func test_phase_name_strings() -> bool:
	_reset()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Collect all phase names through a full cycle
	var phase_names: Array[String] = []
	phase_names.append(ShiftController.get_current_phase_name())  # pre_shift

	ShiftController._force_enter_calls_active()
	phase_names.append(ShiftController.get_current_phase_name())  # calls_active

	ShiftController._force_enter_post_shift()
	phase_names.append(ShiftController.get_current_phase_name())  # post_shift

	ShiftController._force_enter_shift_transition()
	phase_names.append(ShiftController.get_current_phase_name())  # transition

	if phase_names[0] != "pre_shift":
		return false
	if phase_names[1] != "calls_active":
		return false
	if phase_names[2] != "post_shift":
		return false
	if phase_names[3] != "transition":
		return false

	ShiftController._reset_for_testing()
	return true
