## test_pause_and_settings.gd — DEA-189 (pause flow) and DEA-190 (settings coverage).
## Asserts the pause gate honours the safe-room rule and the pause_anywhere
## override, and that the settings screen exposes every option the manager owns.
extends RefCounted

var test_name: String = "PauseAndSettings"

const SETTINGS_SCENE := "res://scenes/settings.tscn"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_pause_refused_outside_safe_room"] = test_pause_refused_outside_safe_room()
	results["test_pause_allowed_in_safe_room"] = test_pause_allowed_in_safe_room()
	results["test_pause_anywhere_overrides_rule"] = test_pause_anywhere_overrides_rule()
	results["test_resume_clears_pause"] = test_resume_clears_pause()
	results["test_settings_expose_every_option"] = test_settings_expose_every_option()
	results["test_settings_reflects_live_state"] = test_settings_reflects_live_state()
	results["test_refused_journey_load_leaves_state"] = test_refused_journey_load_leaves_state()
	return results


func _new_pause() -> Node:
	var script: Resource = load("res://src/ui/pause_menu.gd")
	var menu: Node = script.new()
	Engine.get_main_loop().root.add_child(menu)
	return menu


var _dread: DreadComposure = null


func _ensure_dread() -> DreadComposure:
	if _dread != null and is_instance_valid(_dread):
		return _dread
	_dread = DreadComposure.new()
	Engine.get_main_loop().root.add_child(_dread)
	return _dread


func _reset_state() -> void:
	_ensure_dread().in_safe_room = false
	AccessibilityManager.pause_anywhere = false


func test_pause_refused_outside_safe_room() -> bool:
	_reset_state()
	var menu := _new_pause()
	var started: bool = menu.try_pause()
	var paused: bool = Engine.get_main_loop().root.get_tree().paused
	menu.resume()
	menu.queue_free()
	return (not started) and (not paused) and (not menu.is_open)


func test_pause_allowed_in_safe_room() -> bool:
	_reset_state()
	_ensure_dread().in_safe_room = true
	var menu := _new_pause()
	var started: bool = menu.try_pause()
	var paused: bool = Engine.get_main_loop().root.get_tree().paused
	var open: bool = menu.is_open
	menu.resume()
	menu.queue_free()
	_reset_state()
	return started and paused and open


func test_pause_anywhere_overrides_rule() -> bool:
	_reset_state()
	AccessibilityManager.pause_anywhere = true
	var menu := _new_pause()
	var started: bool = menu.try_pause()
	menu.resume()
	menu.queue_free()
	_reset_state()
	return started


func test_resume_clears_pause() -> bool:
	_reset_state()
	_ensure_dread().in_safe_room = true
	var menu := _new_pause()
	menu.try_pause()
	menu.resume()
	var paused: bool = Engine.get_main_loop().root.get_tree().paused
	var open: bool = menu.is_open
	menu.queue_free()
	_reset_state()
	return (not paused) and (not open)


## A tape in a phase with no resume path must be refused before any of its
## state is applied, so the live run keeps its own moral choices and CRT level.
func test_refused_journey_load_leaves_state() -> bool:
	_reset_state()
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	MoralChoiceTracker.reset()
	CRTDegradation.reset()
	MoralChoiceTracker.set_empathy_score(77)
	CRTDegradation.set_degradation(0.6)
	var sd := SaveData.new()
	sd.phase = PhaseEnums.Phase.PHASE_3_JOURNEY
	var wrote: bool = SaveManager.save_slot("slot_1", sd)
	var decision := SaveManager.inspect_slot_for_load("slot_1")
	# The refusal must come from the phase, not from a missing tape: otherwise
	# this test would pass with nothing written and the trackers never at risk.
	var refused_for_phase: bool = (
		not bool(decision["resumable"]) and not bool(decision["unreadable"])
	)
	MoralChoiceTracker.reset()
	CRTDegradation.reset()

	var menu := _new_pause()
	menu._on_load_requested("slot_1")
	var untouched: bool = (
		MoralChoiceTracker.get_empathy_score() == 0
		and is_zero_approx(CRTDegradation.get_permanent_degradation())
		and menu.last_requested_scene.is_empty()
	)
	menu.queue_free()
	SaveManager._reset_for_testing()
	return wrote and refused_for_phase and untouched


func test_settings_expose_every_option() -> bool:
	var packed: PackedScene = load(SETTINGS_SCENE)
	if packed == null:
		return false
	var screen: Control = packed.instantiate()
	Engine.get_main_loop().root.add_child(screen)
	# 6 bus sliders + 9 audio checks + 5 video checks + 2 video sliders + 1 difficulty
	var expected := AccessibilityManager.VOLUME_KEYS.size() + 9 + 5 + 3
	var count: int = screen.option_count()
	screen.queue_free()
	return count == expected


func test_settings_reflects_live_state() -> bool:
	AccessibilityManager.pause_anywhere = true
	AccessibilityManager.high_contrast_mode = true
	var packed: PackedScene = load(SETTINGS_SCENE)
	var screen: Control = packed.instantiate()
	Engine.get_main_loop().root.add_child(screen)
	var checks: Dictionary = screen._checks
	var pause_on: bool = (checks["pause_anywhere"] as CheckButton).button_pressed
	var contrast_on: bool = (checks["high_contrast"] as CheckButton).button_pressed
	screen.queue_free()
	AccessibilityManager.pause_anywhere = false
	AccessibilityManager.high_contrast_mode = false
	return pause_on and contrast_on
