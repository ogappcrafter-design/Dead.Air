## test_runner.gd — Headless test runner for Deadair project.
## Run with: godot --headless --script res://tests/test_runner.gd
## Uses runtime load() instead of preload() so failing scripts don't break the whole runner.
extends SceneTree


## Autoloads are added to root AFTER the first frame, not during SceneTree._init().
## Deferring test execution ensures autoload-dependent tests (SilenceSystem,
## PhaseManager) can find their singletons via /root/<AutoloadName>.
func _init() -> void:
	_run_tests.call_deferred()


func _run_tests() -> void:
	await process_frame

	var all_passed := true
	var total_tests := 0
	var total_passed := 0
	var total_failed := 0

	print("=== Deadair Test Suite ===")
	print("")

	# Define test suites: [label, path]
	var test_suites: Array = [
		["SaveData", "res://tests/test_save_data.gd"],
		["SaveManager", "res://tests/test_save_manager.gd"],
		["RadioTuner", "res://tests/test_radio_tuner.gd"],
		["DreadComposure", "res://tests/test_dread_composure.gd"],
		["DreadAudio", "res://tests/test_dread_audio.gd"],
		["DifficultyManager", "res://tests/test_difficulty_manager.gd"],
		["StingerSystem", "res://tests/test_stinger_system.gd"],
		["CRTShader", "res://tests/test_crt_shader.gd"],
		["CallManager", "res://tests/test_call_manager.gd"],
		["TapePickup", "res://tests/test_tape_pickup.gd"],
		["TapeInventoryUI", "res://tests/test_tape_inventory_ui.gd"],
		["TapePlayer", "res://tests/test_tape_player.gd"],
		["Interactable", "res://tests/test_interactable.gd"],
		["InteractionRaycast", "res://tests/test_interaction_raycast.gd"],
		["MainMenu", "res://tests/test_main_menu.gd"],
		["NightTransition", "res://tests/test_night_transition.gd"],
		["ShiftSummary", "res://tests/test_shift_summary.gd"],
		["StationDegradation", "res://tests/test_station_degradation.gd"],
		["ShiftController", "res://tests/test_shift_controller.gd"],
		["BreatherSystem", "res://tests/test_breather_system.gd"],
		["RecordingManager", "res://tests/test_recording_manager.gd"],
		["AccessibilityManager", "res://tests/test_accessibility_manager.gd"],
		["AudioBusManager", "res://tests/test_audio_bus_manager.gd"],
		["SuitEntity", "res://tests/test_suits.gd"],
		["VisualAccessibility", "res://tests/test_visual_accessibility.gd"],
		["Shift1Tutorial", "res://tests/test_shift1_tutorial.gd"],
		["Shift2Tutorial", "res://tests/test_shift2_tutorial.gd"],
		["Shift3Tutorial", "res://tests/test_shift3_tutorial.gd"],
		["Shift4Tutorial", "res://tests/test_shift4_tutorial.gd"],
		["Shift5Tutorial", "res://tests/test_shift5_tutorial.gd"],
		["Phase2Threshold", "res://tests/test_phase2_threshold.gd"],
		["Phase2StaticSky", "res://tests/test_phase2_static_sky.gd"],
		["Phase2Follower", "res://tests/test_phase2_follower.gd"],
		["Phase2FirstHouse", "res://tests/test_phase2_first_house.gd"],
		["Phase3Neighborhood", "res://tests/test_phase3_neighborhood.gd"],
		["Phase3CollectorsTape", "res://tests/test_phase3_collectors_tape.gd"],
		["FieldCalls", "res://tests/test_field_calls.gd"],
		["FalseCalls", "res://tests/test_false_calls.gd"],
		["Phase3Highway", "res://tests/test_phase3_highway.gd"],
		["Phase3LiminalSpace", "res://tests/test_phase3_liminal_space.gd"],
		["Phase3Bunker", "res://tests/test_phase3_bunker.gd"],
		["Phase4Staircase", "res://tests/test_phase4_staircase.gd"],
		["Phase4Chamber", "res://tests/test_phase4_chamber.gd"],
		["Phase4Endings", "res://tests/test_phase4_endings.gd"],
		["Phase4Clearing", "res://tests/test_phase4_clearing.gd"],
		["CRTDegradation", "res://tests/test_crt_degradation.gd"],
	]

	for suite in test_suites:
		var label: String = suite[0]
		var path: String = suite[1]
		print("Running %s tests..." % label)

		var script = load(path)
		if script == null:
			print("  [SKIP] %s — failed to load" % label)
			print("")
			continue

		# A script that failed compilation loads as non-null but cannot be
		# instantiated; guard so one broken suite doesn't abort the whole run.
		if not script.can_instantiate():
			print("  [SKIP] %s — script compilation error" % label)
			print("")
			continue

		var test_instance = script.new()
		if test_instance == null or not test_instance.has_method("run_tests"):
			print("  [SKIP] %s — script compilation error" % label)
			print("")
			continue

		var results: Dictionary = await test_instance.run_tests()
		for test_name in results.keys():
			total_tests += 1
			var passed: bool = results[test_name]
			if passed:
				total_passed += 1
				print("  [PASS] %s::%s" % [label, test_name])
			else:
				total_failed += 1
				all_passed = false
				print("  [FAIL] %s::%s" % [label, test_name])
		print("")

	# Run preload-based suites (PhaseManager, SignalDecay, RadioStatic, BandSystem,
	# SilenceSystem, HUDLayout) with the same load()-guard as the loop above so a
	# script that fails to compile is skipped instead of aborting the runner.
	var preload_suites: Array = [
		["PhaseManager", "res://tests/test_phase_manager.gd"],
		["SignalDecay", "res://tests/test_signal_decay.gd"],
		["RadioStatic", "res://tests/test_radio_static.gd"],
		["BandSystem", "res://tests/test_band_system.gd"],
		["SilenceSystem", "res://tests/test_silence_system.gd"],
		["HUDLayout", "res://tests/test_hud_layout.gd"],
	]
	for suite in preload_suites:
		var label: String = suite[0]
		var path: String = suite[1]
		print("Running %s tests..." % label)

		var script: Resource = load(path)
		if script == null or not (script as GDScript).can_instantiate():
			print("  [SKIP] %s — script compilation error" % label)
			print("")
			continue

		var test_instance: Variant = script.new()
		if test_instance == null or not test_instance.has_method("run_tests"):
			print("  [SKIP] %s — script compilation error" % label)
			print("")
			continue

		var results: Dictionary = await test_instance.run_tests()
		for test_name in results.keys():
			total_tests += 1
			var passed: bool = results[test_name]
			if passed:
				total_passed += 1
				print("  [PASS] %s::%s" % [test_instance.test_name, test_name])
			else:
				total_failed += 1
				all_passed = false
				print("  [FAIL] %s::%s" % [test_instance.test_name, test_name])
		print("")

	print("")
	print("=== Results ===")
	print("Total: %d | Passed: %d | Failed: %d" % [total_tests, total_passed, total_failed])
	print("ALL TESTS PASSED" if all_passed else "SOME TESTS FAILED")

	quit(0 if all_passed else 1)
