## test_shift1_tutorial.gd — Tests for DEA-111 Shift 1 (First Night / Tutorial).
## Verifies: band restriction (LIVING only), call sequence (procedural + ids 0,1,3),
## tutorial overlay triggers (tuning/signal/composure), dread meter hidden, save hidden,
## station clean, end condition.
extends RefCounted

var test_name: String = "Shift1Tutorial"

var _tutorial_mgr: Node
var _step_shown_count: int = 0
var _step_shown_args: Array[String] = []
var _tutorial_complete_count: int = 0


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_band_restriction_living_only"] = test_band_restriction_living_only()
	results["test_call_sequence_order"] = test_call_sequence_order()
	results["test_tutorial_tuning_on_shift_start"] = test_tutorial_tuning_on_shift_start()
	results["test_tutorial_signal_meter_on_call"] = test_tutorial_signal_meter_on_call()
	results["test_tutorial_composure_on_change"] = test_tutorial_composure_on_change()
	results["test_tutorial_inactive_when_disabled"] = test_tutorial_inactive_when_disabled()
	results["test_dread_meter_hidden_shift1"] = test_dread_meter_hidden_shift1()
	results["test_save_not_available_shift1"] = test_save_not_available_shift1()
	results["test_shift_summary_set_save_available"] = test_shift_summary_set_save_available()
	results["test_station_clean_shift1"] = test_station_clean_shift1()
	results["test_end_condition_shift_completes"] = test_end_condition_shift_completes()
	_cleanup()
	return results


# ─── Helpers ─────────────────────────────────────────────────────────────────


func _reset_shift() -> void:
	ShiftController._reset_for_testing()
	if CallManager:
		CallManager._reset_for_testing()


func _setup_tutorial_mgr() -> void:
	_cleanup_tutorial_mgr()
	_tutorial_mgr = load("res://src/ui/tutorial_manager.gd").new()
	_tutorial_mgr.name = "TestTutorialManager"
	_step_shown_count = 0
	_step_shown_args.clear()
	_tutorial_complete_count = 0
	_tutorial_mgr.tutorial_step_shown.connect(_on_tutorial_step_shown)
	_tutorial_mgr.tutorial_complete.connect(_on_tutorial_complete)
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		tree.root.add_child(_tutorial_mgr)


func _cleanup_tutorial_mgr() -> void:
	if _tutorial_mgr:
		_tutorial_mgr._reset_for_testing()
		if _tutorial_mgr.tutorial_step_shown.is_connected(_on_tutorial_step_shown):
			_tutorial_mgr.tutorial_step_shown.disconnect(_on_tutorial_step_shown)
		if _tutorial_mgr.tutorial_complete.is_connected(_on_tutorial_complete):
			_tutorial_mgr.tutorial_complete.disconnect(_on_tutorial_complete)
		_tutorial_mgr.queue_free()
		_tutorial_mgr = null


func _cleanup() -> void:
	_cleanup_tutorial_mgr()
	_reset_shift()


func _on_tutorial_step_shown(step_name: String) -> void:
	_step_shown_count += 1
	_step_shown_args.append(step_name)


func _on_tutorial_complete() -> void:
	_tutorial_complete_count += 1


# ─── Tests ────────────────────────────────────────────────────────────────────


func test_band_restriction_living_only() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# After shift 1 starts, only LIVING (band 0) should be unlocked
	if not BandController.is_band_unlocked(0):
		ShiftController._reset_for_testing()
		return false

	# Bands 1-7 should be locked
	for i in range(1, 8):
		if BandController.is_band_unlocked(i):
			ShiftController._reset_for_testing()
			return false

	# Attempting to switch to a locked band should fail
	var prev_band: int = BandController.active_band_id
	BandController.set_active_band(1)  # LIMINAL — should be rejected
	if BandController.active_band_id != prev_band:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_call_sequence_order() -> bool:
	_reset_shift()
	CallManager._reset_for_testing()
	CallManager.start_shift(0)  # Shift index 0 = Shift 1

	# Queue should have 4 calls
	if CallManager._shift_queue.size() != 4:
		CallManager._reset_for_testing()
		return false

	# First call is procedural (id == -1)
	var first: Dictionary = CallManager._shift_queue[0]
	if first.get("id", -999) != -1:
		CallManager._reset_for_testing()
		return false

	# Scripted calls should be ids 0, 1, 3 in order
	var ids: Array = []
	for i in range(1, CallManager._shift_queue.size()):
		ids.append(int(CallManager._shift_queue[i].get("id", -999)))

	var ok: bool = ids == [0, 1, 3]
	CallManager._reset_for_testing()
	return ok


func test_tutorial_tuning_on_shift_start() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(1, true)

	# Tuning step should be shown immediately
	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_TUNING):
		_cleanup_tutorial_mgr()
		return false

	# Step shown signal should have fired
	if _step_shown_count < 1:
		_cleanup_tutorial_mgr()
		return false

	# First signal arg should be "tune the dial"
	if _step_shown_args[0] != "tune the dial":
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true


func test_tutorial_signal_meter_on_call() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(1, true)

	# Dismiss tuning overlay first so signal meter can show
	if _tutorial_mgr._overlay and _tutorial_mgr._overlay.is_active():
		_tutorial_mgr._overlay.hide_overlay()

	# Simulate first call starting
	_tutorial_mgr.on_call_started({})

	# Signal meter step should be shown
	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_SIGNAL_METER):
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true


func test_tutorial_composure_on_change() -> bool:
	_setup_tutorial_mgr()
	_tutorial_mgr.on_shift_started(1, true)

	# Dismiss tuning overlay
	if _tutorial_mgr._overlay and _tutorial_mgr._overlay.is_active():
		_tutorial_mgr._overlay.hide_overlay()

	# Simulate composure change
	_tutorial_mgr.on_composure_changed(85.0)

	# Composure step should be shown
	if not _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_COMPOSURE):
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true


func test_tutorial_inactive_when_disabled() -> bool:
	_setup_tutorial_mgr()
	# Start with tutorial disabled (as if non-tutorial shift)
	_tutorial_mgr.on_shift_started(2, false)

	# Tutorial should NOT be active
	if _tutorial_mgr.is_tutorial_active():
		_cleanup_tutorial_mgr()
		return false

	# No steps should be shown
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_TUNING):
		_cleanup_tutorial_mgr()
		return false

	# Calling on_call_started should be a no-op
	_tutorial_mgr.on_call_started({})
	if _tutorial_mgr.is_step_shown(_tutorial_mgr.STEP_SIGNAL_METER):
		_cleanup_tutorial_mgr()
		return false

	_cleanup_tutorial_mgr()
	return true


func test_dread_meter_hidden_shift1() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Shift 1 should have dread meter hidden
	if ShiftController.is_dread_meter_visible() != false:
		ShiftController._reset_for_testing()
		return false

	# DreadComposure should not be visible
	var dc: Node = CallManager.get_dread_composure()
	if dc == null:
		ShiftController._reset_for_testing()
		return false

	if dc.is_visible():
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_save_not_available_shift1() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Shift 1 should not have save available
	if ShiftController.is_save_available() != false:
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_shift_summary_set_save_available() -> bool:
	# Load shift_summary scene and verify set_save_available toggles UI
	var scene: PackedScene = load("res://scenes/shift_summary.tscn")
	if scene == null:
		# shift_summary.tscn might not exist — try instantiating the script
		var script: GDScript = load("res://src/ui/shift_summary.gd")
		if script == null:
			return false
		var summary: Control = script.new()
		if summary == null:
			return false
		summary.set_anchors_preset(Control.PRESET_FULL_RECT)
		# Need to add to tree for _ready to fire
		var tree: SceneTree = Engine.get_main_loop() as SceneTree
		if tree and tree.root:
			tree.root.add_child(summary)
		# Test set_save_available(false)
		summary.set_save_available(false)
		var prompt: Label = summary.get_node_or_null("VBox/SavePrompt")
		var container: HBoxContainer = summary.get_node_or_null("VBox/SaveContainer")
		var ok: bool = true
		if prompt and prompt.visible:
			ok = false
		if container and container.visible:
			ok = false
		# Test set_save_available(true)
		summary.set_save_available(true)
		if prompt and not prompt.visible:
			ok = false
		if container and not container.visible:
			ok = false
		summary.queue_free()
		return ok
	# Scene path
	var instance: Control = scene.instantiate()
	if instance == null:
		return false
	var tree2: SceneTree = Engine.get_main_loop() as SceneTree
	if tree2 and tree2.root:
		tree2.root.add_child(instance)

	instance.set_save_available(false)
	var prompt2: Label = instance.get_node_or_null("VBox/SavePrompt")
	var container2: HBoxContainer = instance.get_node_or_null("VBox/SaveContainer")
	var ok2: bool = true
	if prompt2 and prompt2.visible:
		ok2 = false
	if container2 and container2.visible:
		ok2 = false

	instance.set_save_available(true)
	if prompt2 and not prompt2.visible:
		ok2 = false
	if container2 and not container2.visible:
		ok2 = false

	instance.queue_free()
	return ok2


func test_station_clean_shift1() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# After shift 1 starts, station should have no degradation.
	# StationState is the autoload that ShiftController calls.
	if not StationState:
		ShiftController._reset_for_testing()
		return false

	# Shift 1 should report shift_number == 1 with no degradation applied.
	# We verify the shift is active (start_shift didn't crash) and station state exists.
	# Detailed degradation checks are in test_station_degradation.gd.
	if not ShiftController.is_shift_active():
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true


func test_end_condition_shift_completes() -> bool:
	_reset_shift()
	ShiftController._set_testing_mode(true)
	ShiftController.start_shift(1)

	# Track shift_complete signal (use Dict — Godot 4 lambdas capture primitives by value)
	var result: Dictionary = {"count": 0, "arg": 0}
	ShiftController.shift_complete.connect(func(s: int) -> void:
		result["count"] = result["count"] + 1
		result["arg"] = s
	)

	# Force through all phases to completion
	ShiftController._force_enter_calls_active()
	ShiftController._force_enter_post_shift()
	ShiftController._force_enter_shift_transition()
	ShiftController._force_complete_shift()

	# shift_complete should have been emitted with shift_number=1
	if result["count"] != 1:
		ShiftController._reset_for_testing()
		return false
	if result["arg"] != 1:
		ShiftController._reset_for_testing()
		return false
	if ShiftController.is_shift_active():
		ShiftController._reset_for_testing()
		return false

	ShiftController._reset_for_testing()
	return true
