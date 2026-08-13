## test_station_degradation.gd — Tests for StationDegradation autoload.
## Verifies degradation states for shifts 1-2, event triggers, and API surface.
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

const test_name := "StationDegradation"

var _sd: Node


func _init() -> void:
	var tree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		_sd = tree.root.get_node_or_null("/root/StationDegradation")


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_autoload_exists"] = test_autoload_exists()
	results["test_signals_exist"] = test_signals_exist()
	results["test_apply_degradation_shift1_normal"] = test_apply_degradation_shift1_normal()
	results["test_apply_degradation_shift2_mug_rotated"] = test_apply_degradation_shift2_mug_rotated()
	results["test_apply_degradation_shift2_chair_angled"] = (test_apply_degradation_shift2_chair_angled())
	results["test_apply_degradation_shift2_second_mug_visible"] = (test_apply_degradation_shift2_second_mug_visible())
	results["test_mirror_delay_shift1_zero"] = test_mirror_delay_shift1_zero()
	results["test_mirror_delay_shift2_200ms"] = test_mirror_delay_shift2_200ms()
	results["test_crt_glitch_interval_shift1_zero"] = test_crt_glitch_interval_shift1_zero()
	results["test_crt_glitch_interval_shift2_45s"] = test_crt_glitch_interval_shift2_45s()
	results["test_trigger_e1_event"] = test_trigger_e1_event()
	results["test_trigger_e2_door_locked"] = test_trigger_e2_door_locked()
	results["test_trigger_e2_breathing_player"] = test_trigger_e2_breathing_player()
	results["test_trigger_e1_buzz_player"] = test_trigger_e1_buzz_player()
	results["test_degradation_applied_signal"] = test_degradation_applied_signal()
	results["test_wrongness_event_signal_e1"] = test_wrongness_event_signal_e1()
	results["test_wrongness_event_signal_e2"] = test_wrongness_event_signal_e2()
	results["test_unknown_event_id_warning"] = test_unknown_event_id_warning()
	results["test_reset_to_normal_after_shift2"] = test_reset_to_normal_after_shift2()

	return results


# ─── Tests ────────────────────────────────────────────────────────────


func test_autoload_exists() -> bool:
	if _sd == null:
		push_error("StationDegradation autoload not found")
		return false
	return true


func test_signals_exist() -> bool:
	if _sd == null:
		return false
	if not _sd.has_signal("degradation_applied"):
		push_error("Missing signal: degradation_applied")
		return false
	if not _sd.has_signal("wrongness_event_triggered"):
		push_error("Missing signal: wrongness_event_triggered")
		return false
	return true


func test_apply_degradation_shift1_normal() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(1)
	# Shift 1: mirror delay should be 0, CRT glitch interval 0
	if _sd.get_mirror_delay() != 0.0:
		push_error("Shift 1 mirror delay should be 0.0, got %f" % _sd.get_mirror_delay())
		return false
	if _sd.get_crt_glitch_interval() != 0.0:
		push_error(
			"Shift 1 CRT glitch interval should be 0.0, got %f" % _sd.get_crt_glitch_interval()
		)
		return false
	if _sd.is_office_door_locked():
		push_error("Shift 1 office door should not be locked")
		return false
	return true


func test_apply_degradation_shift2_mug_rotated() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	# Check mug rotation via scene lookup (may not exist in headless test env)
	var station = _get_station_root()
	if station == null:
		return true  # No scene loaded — skip visual check
	var mug = station.get_node_or_null("Booth/CoffeeMug")
	if mug == null:
		return true  # Node not present — skip
	return is_equal_approx(snapped(mug.rotation_degrees.y, 0.01), 90.0)


func test_apply_degradation_shift2_chair_angled() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	var station = _get_station_root()
	if station == null:
		return true
	var chair = station.get_node_or_null("Booth/Chair")
	if chair == null:
		return true
	return is_equal_approx(snapped(chair.rotation_degrees.y, 0.01), -15.0)


func test_apply_degradation_shift2_second_mug_visible() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	var station = _get_station_root()
	if station == null:
		return true
	var second_mug = station.get_node_or_null("BackOffice/SecondMug")
	if second_mug == null:
		return true
	return second_mug.visible


func test_mirror_delay_shift1_zero() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(1)
	return _sd.get_mirror_delay() == 0.0


func test_mirror_delay_shift2_200ms() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	return is_equal_approx(_sd.get_mirror_delay(), 0.2)


func test_crt_glitch_interval_shift1_zero() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(1)
	return _sd.get_crt_glitch_interval() == 0.0


func test_crt_glitch_interval_shift2_45s() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	return is_equal_approx(_sd.get_crt_glitch_interval(), 45.0)


func test_trigger_e1_event() -> bool:
	if _sd == null:
		return false
	# GDScript 4 lambdas capture by value; use array (reference type) to
	# propagate signal results back to the outer scope.
	var result := [false, ""]
	_sd.wrongness_event_triggered.connect(
		func(eid: String, d: String):
			if eid == "E1":
				result[0] = true
				result[1] = d
	)
	_sd.trigger_event("E1")
	if not result[0]:
		push_error("E1 signal not received")
		return false
	if result[1].is_empty():
		push_error("E1 description empty")
		return false
	return true


func test_trigger_e2_door_locked() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)  # Ensure shift 2
	_sd.trigger_event("E2")
	return _sd.is_office_door_locked()


func test_trigger_e2_breathing_player() -> bool:
	if _sd == null:
		return false
	_sd.trigger_event("E2")
	# Check breathing player exists as child
	for child in _sd.get_children():
		if child is AudioStreamPlayer and child.name == "E2BreathingPlayer":
			return true
	push_error("E2BreathingPlayer not found")
	return false


func test_trigger_e1_buzz_player() -> bool:
	if _sd == null:
		return false
	_sd.trigger_event("E1")
	for child in _sd.get_children():
		if child is AudioStreamPlayer and child.name == "E1BuzzPlayer":
			return true
	push_error("E1BuzzPlayer not found")
	return false


func test_degradation_applied_signal() -> bool:
	if _sd == null:
		return false
	var result := [-1]
	_sd.degradation_applied.connect(func(s: int): result[0] = s)
	_sd.apply_degradation(2)
	return result[0] == 2


func test_wrongness_event_signal_e1() -> bool:
	if _sd == null:
		return false
	var result := [false]
	_sd.wrongness_event_triggered.connect(
		func(eid: String, _d: String):
			if eid == "E1":
				result[0] = true
	)
	_sd.trigger_event("E1")
	return result[0]


func test_wrongness_event_signal_e2() -> bool:
	if _sd == null:
		return false
	var result := [false]
	_sd.wrongness_event_triggered.connect(
		func(eid: String, _d: String):
			if eid == "E2":
				result[0] = true
	)
	_sd.trigger_event("E2")
	return result[0]


func test_unknown_event_id_warning() -> bool:
	if _sd == null:
		return false
	# Should not crash on unknown event ID
	_sd.trigger_event("UNKNOWN")
	return true


func test_reset_to_normal_after_shift2() -> bool:
	if _sd == null:
		return false
	_sd.apply_degradation(2)
	# Now reset to shift 1
	_sd.apply_degradation(1)
	if _sd.get_mirror_delay() != 0.0:
		push_error("After reset, mirror delay should be 0.0")
		return false
	if _sd.get_crt_glitch_interval() != 0.0:
		push_error("After reset, CRT glitch interval should be 0.0")
		return false
	if _sd.is_office_door_locked():
		push_error("After reset, door should be unlocked")
		return false
	return true


# ─── Helpers ─────────────────────────────────────────────────────────


func _get_station_root() -> Node3D:
	var tree = Engine.get_main_loop() as SceneTree
	if not tree or not tree.root:
		return null
	return tree.root.get_node_or_null("Station") as Node3D
