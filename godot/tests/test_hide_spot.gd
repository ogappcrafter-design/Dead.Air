## test_hide_spot.gd — DEA-186 hide spots.
## Covers the state transitions, the 5 s forced exhale, the seeded GDD odds,
## the caught penalties and that a spot can always be left.
extends RefCounted

var test_name: String = "HideSpot"

const HideSpotScript = preload("res://src/entities/hide_spot.gd")


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_enter_and_exit"] = test_enter_and_exit()
	results["test_enter_twice_refused"] = test_enter_twice_refused()
	results["test_breath_forces_exhale_at_5s"] = test_breath_forces_exhale_at_5s()
	results["test_exhaled_odds_are_heavier"] = test_exhaled_odds_are_heavier()
	results["test_holding_odds_match_gdd"] = test_holding_odds_match_gdd()
	results["test_caught_applies_penalties"] = test_caught_applies_penalties()
	results["test_exit_always_possible"] = test_exit_always_possible()
	results["test_view_camera_activates_and_restores"] = test_view_camera_activates_and_restores()
	results["test_view_angles_are_clamped"] = test_view_angles_are_clamped()
	results["test_radio_muted_while_hidden"] = test_radio_muted_while_hidden()
	results["test_not_holding_breath_is_unfavourable"] = test_not_holding_breath_is_unfavourable()
	results["test_interacting_again_leaves_the_spot"] = test_interacting_again_leaves_the_spot()
	results["test_empty_spot_never_rolls"] = test_empty_spot_never_rolls()
	results["test_not_holding_breath_uses_loud_odds"] = test_not_holding_breath_uses_loud_odds()
	return results


func _spot(seed_value: int = 0) -> Node:
	var spot: Node = HideSpotScript.new()
	spot.rng_seed = seed_value
	Engine.get_main_loop().root.add_child(spot)
	return spot


func _player() -> Node3D:
	var player := Node3D.new()
	player.name = "TestPlayer"
	Engine.get_main_loop().root.add_child(player)
	return player


func test_enter_and_exit() -> bool:
	var spot := _spot()
	var player := _player()
	var ok: bool = spot.enter(player) and spot.is_occupied() and spot.occupant == player
	spot.exit()
	var left: bool = (not spot.is_occupied()) and spot.occupant == null
	spot.queue_free()
	player.queue_free()
	return ok and left


func test_enter_twice_refused() -> bool:
	var spot := _spot()
	var a := _player()
	var b := _player()
	spot.enter(a)
	var refused: bool = not spot.enter(b)
	spot.exit()
	spot.queue_free()
	a.queue_free()
	b.queue_free()
	return refused


func test_breath_forces_exhale_at_5s() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.set_holding_breath(true)
	for i in 5:
		spot._process(1.0)
	var exhaled: bool = spot.exhaled and not spot.holding_breath
	var zero: bool = is_equal_approx(spot.breath, 0.0)
	spot.exit()
	spot.queue_free()
	player.queue_free()
	return exhaled and zero


func test_exhaled_odds_are_heavier() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.exhaled = true
	var caught := 0
	var trials := 4000
	for i in trials:
		if spot.roll_detection() == HideSpotScript.Outcome.CAUGHT:
			caught += 1
	var ratio: float = float(caught) / float(trials)
	spot.exit()
	spot.queue_free()
	player.queue_free()
	return ratio > 0.42 and ratio < 0.58


func test_holding_odds_match_gdd() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.set_holding_breath(true)
	var counts := {0: 0, 1: 0, 2: 0}
	var trials := 4000
	for i in trials:
		counts[int(spot.roll_detection())] += 1
	var unseen: float = float(counts[0]) / float(trials)
	var invest: float = float(counts[1]) / float(trials)
	var caught: float = float(counts[2]) / float(trials)
	spot.exit()
	spot.queue_free()
	player.queue_free()
	return absf(unseen - 0.70) < 0.05 and absf(invest - 0.20) < 0.05 and absf(caught - 0.10) < 0.04


func test_caught_applies_penalties() -> bool:
	if DreadComposure.instance == null:
		var dc := DreadComposure.new()
		Engine.get_main_loop().root.add_child(dc)
	var ss: Node = Engine.get_main_loop().root.get_node_or_null("CallManager/SignalStrength")
	if ss != null and ss.has_method("set_signal"):
		ss.set_signal(100.0)
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.exhaled = true
	var before_composure: float = DreadComposure.instance.composure
	var before_dread: float = DreadComposure.instance.dread
	# Force the caught branch deterministically.
	var caught_hits := [0]
	spot.caught.connect(func(_p: Variant) -> void: caught_hits[0] += 1)
	var guard := 0
	while caught_hits[0] == 0 and guard < 200:
		spot.enter(player) if not spot.is_occupied() else null
		spot.exhaled = true
		spot.check_detection()
		guard += 1
	var dropped: bool = DreadComposure.instance.composure <= before_composure - 24.0 + 0.01
	var rose: bool = DreadComposure.instance.dread >= before_dread + 14.0
	var signal_ok: bool = ss == null or not ss.has_method("get_signal_value") or is_equal_approx(ss.get_signal_value(), 20.0)
	var blackout: bool = spot.blackout_remaining > 4.0
	spot.queue_free()
	player.queue_free()
	return caught_hits[0] == 1 and dropped and rose and signal_ok and blackout


func test_exit_always_possible() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.set_holding_breath(true)
	spot._process(6.0)
	spot.exit()
	var left: bool = not spot.is_occupied() and not spot.exhaled
	spot.queue_free()
	player.queue_free()
	return left


func test_view_camera_activates_and_restores() -> bool:
	var spot := _spot()
	var player := _player()
	var main := Camera3D.new()
	Engine.get_main_loop().root.add_child(main)
	main.current = true
	spot.enter(player)
	var inside: bool = spot.view_camera != null and spot.view_camera.current
	spot.exit()
	var restored: bool = main.current and not spot.view_camera.current
	main.queue_free()
	spot.queue_free()
	player.queue_free()
	return inside and restored


func test_view_angles_are_clamped() -> bool:
	var spot := _spot()
	spot.look_around(500.0, 500.0)
	var at_limit: Vector2 = spot.get_view_angles()
	var clamped: bool = is_equal_approx(at_limit.x, spot.yaw_limit) and is_equal_approx(at_limit.y, spot.pitch_limit)
	spot.look_around(-1000.0, -1000.0)
	var at_other: Vector2 = spot.get_view_angles()
	var clamped_back: bool = is_equal_approx(at_other.x, -spot.yaw_limit) and is_equal_approx(at_other.y, -spot.pitch_limit)
	spot.queue_free()
	return clamped and clamped_back


func test_radio_muted_while_hidden() -> bool:
	var radio := Node.new()
	radio.name = "TestRadio"
	var state := [false]
	var mute := func(v: bool) -> void: state[0] = v
	radio.set_meta("mute_fn", mute)
	# Duck-typed stand-in matching the real radio's API.
	var script := GDScript.new()
	script.source_code = "extends Node\nvar muted := false\nfunc set_muted(v: bool) -> void:\n\tmuted = v\n"
	script.reload()
	radio.set_script(script)
	radio.add_to_group("radio")
	Engine.get_main_loop().root.add_child(radio)
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	var muted_inside: bool = radio.muted and spot.is_radio_muted()
	spot.exit()
	var unmuted: bool = not radio.muted and not spot.is_radio_muted()
	radio.queue_free()
	spot.queue_free()
	player.queue_free()
	return muted_inside and unmuted


func test_empty_spot_never_rolls() -> bool:
	var spot := _spot()
	var unseen := true
	for i in 200:
		if spot.roll_detection() != HideSpotScript.Outcome.UNSEEN:
			unseen = false
		if spot.check_detection() != HideSpotScript.Outcome.UNSEEN:
			unseen = false
	var no_blackout: bool = is_zero_approx(spot.blackout_remaining)
	spot.queue_free()
	return unseen and no_blackout


func test_not_holding_breath_uses_loud_odds() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	var caught := 0
	var trials := 4000
	for i in trials:
		if spot.roll_detection() == HideSpotScript.Outcome.CAUGHT:
			caught += 1
	var ratio: float = float(caught) / float(trials)
	spot.exit()
	spot.queue_free()
	player.queue_free()
	return ratio > 0.42 and ratio < 0.58


func test_not_holding_breath_is_unfavourable() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	var caught := 0
	for i in 2000:
		if spot.roll_detection() == HideSpotScript.Outcome.CAUGHT:
			caught += 1
	var ratio: float = float(caught) / 2000.0
	spot.exit()
	spot.queue_free()
	player.queue_free()
	return ratio > 0.42 and ratio < 0.58


func test_interacting_again_leaves_the_spot() -> bool:
	var spot := _spot()
	var player := _player()
	spot.enter(player)
	spot.interact(player)
	var left: bool = not spot.is_occupied()
	spot.queue_free()
	player.queue_free()
	return left
