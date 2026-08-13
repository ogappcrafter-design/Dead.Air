## test_silence_system.gd — Tests for SilenceSystem (DEA-140)
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

const test_name := "SilenceSystem"

# Reference to SilenceSystem autoload
var _silence: Node


func _init() -> void:
	# Access the SilenceSystem autoload
	var tree = Engine.get_main_loop() as SceneTree
	if tree and tree.root:
		_silence = tree.root.get_node_or_null("/root/SilenceSystem")


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["test_silence_system_exists"] = test_silence_system_exists()
	results["test_default_state_is_idle"] = test_default_state_is_idle()
	results["test_trigger_dead_air_sets_state"] = test_trigger_dead_air_sets_state()
	results["test_dead_air_duration_in_range"] = test_dead_air_duration_in_range()
	results["test_dead_air_mutes_radio_ambient"] = test_dead_air_mutes_radio_ambient()
	results["test_dead_air_mutes_call_audio"] = test_dead_air_mutes_call_audio()
	results["test_dead_air_mutes_stinger"] = test_dead_air_mutes_stinger()
	results["test_phase4_mutes_room_tone"] = test_phase4_mutes_room_tone()
	results["test_end_dead_air_restores_buses"] = test_end_dead_air_restores_buses()
	results["test_composure_default_is_max"] = test_composure_default_is_max()
	results["test_set_composure_clamped"] = test_set_composure_clamped()
	results["test_breathing_volume_scales_with_composure"] = test_breathing_volume_scales_with_composure()
	results["test_dead_air_signals_emitted"] = test_dead_air_signals_emitted()

	# Cleanup: ensure dead air is ended after tests
	if _silence and _silence.is_dead_air_active():
		_silence.end_dead_air()

	return results


# ─── Tests ────────────────────────────────────────────────────────────

func test_silence_system_exists() -> bool:
	if _silence == null:
		push_error("SilenceSystem autoload not found")
		return false
	return true


func test_default_state_is_idle() -> bool:
	if _silence == null:
		return false
	# End any active dead air to reset state
	if _silence.is_dead_air_active():
		_silence.end_dead_air()
	return _silence.get_state() == _silence.State.IDLE


func test_trigger_dead_air_sets_state() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	var active: bool = _silence.is_dead_air_active()

	# Cleanup
	_silence.end_dead_air()

	return active


func test_dead_air_duration_in_range() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	var duration: float = _silence.get_dead_air_duration()

	# Cleanup
	_silence.end_dead_air()

	# Duration must be in [8.0, 20.0]
	return duration >= 8.0 and duration <= 20.0


func test_dead_air_mutes_radio_ambient() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	# RadioAmbient = bus index 2
	var muted := AudioServer.is_bus_mute(2)

	# Cleanup
	_silence.end_dead_air()

	return muted


func test_dead_air_mutes_call_audio() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	# CallAudio = bus index 3
	var muted := AudioServer.is_bus_mute(3)

	# Cleanup
	_silence.end_dead_air()

	return muted


func test_dead_air_mutes_stinger() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	# Stinger = bus index 5
	var muted := AudioServer.is_bus_mute(5)

	# Cleanup
	_silence.end_dead_air()

	return muted


func test_phase4_mutes_room_tone() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	# Simulate Phase 4 by setting the internal phase directly
	_silence._current_phase = PhaseEnums.Phase.PHASE_4_DESCENT

	_silence.trigger_dead_air()
	# RoomTone = bus index 1
	var room_tone_muted := AudioServer.is_bus_mute(1)
	# RadioAmbient = bus index 2
	var radio_muted := AudioServer.is_bus_mute(2)
	# CallAudio = bus index 3
	var call_muted := AudioServer.is_bus_mute(3)
	# Stinger = bus index 5
	var stinger_muted := AudioServer.is_bus_mute(5)

	# Cleanup
	_silence.end_dead_air()
	# Reset phase to default
	_silence._current_phase = PhaseEnums.Phase.PHASE_1_STATION

	# All four must be muted in Phase 4
	return room_tone_muted and radio_muted and call_muted and stinger_muted


func test_end_dead_air_restores_buses() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	_silence.trigger_dead_air()
	_silence.end_dead_air()

	# After ending, buses should be unmuted
	var radio_unmuted := not AudioServer.is_bus_mute(2)
	var call_unmuted := not AudioServer.is_bus_mute(3)
	var stinger_unmuted := not AudioServer.is_bus_mute(5)
	var state_idle: bool = _silence.get_state() == _silence.State.IDLE

	return radio_unmuted and call_unmuted and stinger_unmuted and state_idle


func test_composure_default_is_max() -> bool:
	if _silence == null:
		return false
	# Reset composure
	_silence.set_composure(100.0)
	return _silence.get_composure() == 100.0


func test_set_composure_clamped() -> bool:
	if _silence == null:
		return false
	# Test clamping above max
	_silence.set_composure(150.0)
	var above: bool = _silence.get_composure() == 100.0

	# Test clamping below min
	_silence.set_composure(-20.0)
	var below: bool = _silence.get_composure() == 0.0

	# Test normal value
	_silence.set_composure(50.0)
	var normal: bool = _silence.get_composure() == 50.0

	# Reset
	_silence.set_composure(100.0)

	return above and below and normal


func test_breathing_volume_scales_with_composure() -> bool:
	if _silence == null:
		return false
	var player: AudioStreamPlayer = _silence.get_breathing_player()
	if player == null:
		return false

	# High composure (calm) → quiet breathing (-24 dB)
	_silence.set_composure(100.0)
	var calm_vol := player.volume_db

	# Low composure (panic) → loud breathing (-6 dB)
	_silence.set_composure(0.0)
	var panic_vol := player.volume_db

	# Reset
	_silence.set_composure(100.0)

	# Calm should be quieter than panic
	return calm_vol < panic_vol


func test_dead_air_signals_emitted() -> bool:
	if _silence == null:
		return false
	# Reset
	if _silence.is_dead_air_active():
		_silence.end_dead_air()

	# Use a Dictionary because GDScript lambdas capture booleans by value,
	# not by reference. A Dictionary is a reference type so mutations inside
	# the lambda are visible to the outer scope.
	var signals: Dictionary = {"started": false, "ended": false}

	_silence.dead_air_started.connect(func() -> void: signals["started"] = true)
	_silence.dead_air_ended.connect(func() -> void: signals["ended"] = true)

	_silence.trigger_dead_air()
	_silence.end_dead_air()

	return signals["started"] and signals["ended"]
