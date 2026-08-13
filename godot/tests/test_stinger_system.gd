## test_stinger_system.gd — Tests for StingerSystem (DEA-101)
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

const test_name := "StingerSystem"

# Reference to StingerSystem autoload
var _stinger: Node


func _init() -> void:
	# Access the StingerSystem autoload
	var tree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		_stinger = tree.root.get_node_or_null("/root/StingerSystem")


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_stinger_system_exists"] = test_stinger_system_exists()
	results["test_seven_stinger_types"] = test_seven_stinger_types()
	results["test_cooldown_blocks_repeat"] = test_cooldown_blocks_repeat()
	results["test_clear_cooldown_allows_retrigger"] = test_clear_cooldown_allows_retrigger()
	results["test_clear_all_cooldowns"] = test_clear_all_cooldowns()
	results["test_duck_active_after_trigger"] = test_duck_active_after_trigger()
	results["test_duck_ends_via_end_duck"] = test_duck_ends_via_end_duck()
	results["test_stinger_routes_to_stinger_bus"] = test_stinger_routes_to_stinger_bus()
	results["test_stinger_volume_is_negative_6db"] = test_stinger_volume_is_negative_6db()
	results["test_composure_low_triggers_stinger"] = test_composure_low_triggers_stinger()
	results["test_composure_crit_triggers_stinger"] = test_composure_crit_triggers_stinger()
	results["test_signal_lost_triggers_dead_air"] = test_signal_lost_triggers_dead_air()
	results["test_phase4_triggers_false_call"] = test_phase4_triggers_false_call()
	results["test_stinger_triggered_signal_emitted"] = test_stinger_triggered_signal_emitted()
	results["test_convenience_methods"] = test_convenience_methods()
	results["test_cooldown_blocked_signal_emitted"] = test_cooldown_blocked_signal_emitted()
	results["test_cooldown_remaining_decreases"] = test_cooldown_remaining_decreases()

	# Cleanup: clear all cooldowns and end ducking
	if _stinger:
		_stinger.clear_all_cooldowns()
		_stinger.end_duck()

	return results


# ─── Tests ────────────────────────────────────────────────────────────

func test_stinger_system_exists() -> bool:
	if _stinger == null:
		push_error("StingerSystem autoload not found")
		return false
	return true


func test_seven_stinger_types() -> bool:
	if _stinger == null:
		return false
	# Enum should have 7 values: WRONGNESS(0) through FALSE_CALL(6)
	var max_val: int = _stinger.StingerType.FALSE_CALL
	return max_val == 6


func test_cooldown_blocks_repeat() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var first: bool = _stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	var second: bool = _stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return first and not second


func test_clear_cooldown_allows_retrigger() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	_stinger.trigger_stinger(_stinger.StingerType.SUITS_DETECTED)
	# Should be on cooldown now
	var blocked: bool = _stinger.is_on_cooldown(_stinger.StingerType.SUITS_DETECTED)
	# Clear cooldown
	_stinger.clear_cooldown(_stinger.StingerType.SUITS_DETECTED)
	var can_retrigger: bool = not _stinger.is_on_cooldown(_stinger.StingerType.SUITS_DETECTED)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return blocked and can_retrigger


func test_clear_all_cooldowns() -> bool:
	if _stinger == null:
		return false
	# Trigger multiple stingers to set cooldowns
	_stinger.clear_all_cooldowns()
	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	_stinger.trigger_stinger(_stinger.StingerType.MORAL_CHOICE)
	_stinger.trigger_stinger(_stinger.StingerType.DEAD_AIR)

	# Clear all
	_stinger.clear_all_cooldowns()

	var no_cooldowns: bool = not _stinger.is_on_cooldown(_stinger.StingerType.WRONGNESS) \
		and not _stinger.is_on_cooldown(_stinger.StingerType.MORAL_CHOICE) \
		and not _stinger.is_on_cooldown(_stinger.StingerType.DEAD_AIR)

	_stinger.end_duck()

	return no_cooldowns


func test_duck_active_after_trigger() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	var active: bool = _stinger.is_duck_active()

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return active


func test_duck_ends_via_end_duck() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	var active_before: bool = _stinger.is_duck_active()
	_stinger.end_duck()
	var active_after: bool = _stinger.is_duck_active()

	_stinger.clear_all_cooldowns()

	return active_before and not active_after


func test_stinger_routes_to_stinger_bus() -> bool:
	if _stinger == null:
		return false
	var player: AudioStreamPlayer = _stinger._stinger_player
	if player == null:
		return false
	return player.bus == AudioBusManager.BUS_STINGER


func test_stinger_volume_is_negative_6db() -> bool:
	if _stinger == null:
		return false
	var player: AudioStreamPlayer = _stinger._stinger_player
	if player == null:
		return false
	return player.volume_db == _stinger.STINGER_VOLUME_DB


func test_composure_low_triggers_stinger() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	# Create a DreadComposure instance and connect
	var dc := DreadComposure.new()
	_stinger.connect_composure(dc)

	# Track triggered signal
	var triggered: Dictionary = {"COMPOSURE_LOW": false}
	_stinger.stinger_triggered.connect(func(t: int) -> void:
		if t == _stinger.StingerType.COMPOSURE_LOW:
			triggered["COMPOSURE_LOW"] = true
	)

	# Start above threshold, then drop below 20
	dc.composure = 50.0
	_stinger._prev_composure = 50.0
	dc.composure = 15.0
	# Manually emit signal since we're not in a scene tree
	dc.composure_changed.emit(15.0)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return triggered["COMPOSURE_LOW"]


func test_composure_crit_triggers_stinger() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var dc := DreadComposure.new()
	_stinger.connect_composure(dc)

	var triggered: Dictionary = {"COMPOSURE_CRIT": false}
	_stinger.stinger_triggered.connect(func(t: int) -> void:
		if t == _stinger.StingerType.COMPOSURE_CRIT:
			triggered["COMPOSURE_CRIT"] = true
	)

	# Start above crit threshold, then drop below 10
	dc.composure = 15.0
	_stinger._prev_composure = 15.0
	dc.composure = 5.0
	dc.composure_changed.emit(5.0)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return triggered["COMPOSURE_CRIT"]


func test_signal_lost_triggers_dead_air() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var ss := SignalStrength.new()
	_stinger.connect_signal_strength(ss)

	var triggered: Dictionary = {"DEAD_AIR": false}
	_stinger.stinger_triggered.connect(func(t: int) -> void:
		if t == _stinger.StingerType.DEAD_AIR:
			triggered["DEAD_AIR"] = true
	)

	# Emit signal_lost
	ss.signal_lost.emit()

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return triggered["DEAD_AIR"]


func test_phase4_triggers_false_call() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var triggered: Dictionary = {"FALSE_CALL": false}
	_stinger.stinger_triggered.connect(func(t: int) -> void:
		if t == _stinger.StingerType.FALSE_CALL:
			triggered["FALSE_CALL"] = true
	)

	# Simulate phase change to Phase 4
	_stinger._on_phase_changed(PhaseEnums.Phase.PHASE_3_JOURNEY, PhaseEnums.Phase.PHASE_4_DESCENT)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return triggered["FALSE_CALL"]


func test_stinger_triggered_signal_emitted() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var triggered: Dictionary = {"fired": false}
	_stinger.stinger_triggered.connect(func(_t: int) -> void:
		triggered["fired"] = true
	)

	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return triggered["fired"]


func test_convenience_methods() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var w: bool = _stinger.trigger_wrongness()
	_stinger.clear_all_cooldowns()

	var s: bool = _stinger.trigger_suits_detected()
	_stinger.clear_all_cooldowns()

	var m: bool = _stinger.trigger_moral_choice()
	_stinger.clear_all_cooldowns()

	var f: bool = _stinger.trigger_false_call()
	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return w and s and m and f


func test_cooldown_blocked_signal_emitted() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	var blocked: Dictionary = {"fired": false}
	_stinger.stinger_cooldown_blocked.connect(func(_t: int) -> void:
		blocked["fired"] = true
	)

	# First trigger succeeds, second should be blocked
	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	return blocked["fired"]


func test_cooldown_remaining_decreases() -> bool:
	if _stinger == null:
		return false
	_stinger.clear_all_cooldowns()

	_stinger.trigger_stinger(_stinger.StingerType.WRONGNESS)
	var remaining: float = _stinger.get_cooldown_remaining(_stinger.StingerType.WRONGNESS)

	_stinger.clear_all_cooldowns()
	_stinger.end_duck()

	# After triggering, remaining should be positive and <= COOLDOWN_SECONDS
	return remaining > 0.0 and remaining <= _stinger.COOLDOWN_SECONDS
