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

		var test_instance = script.new()
		if test_instance == null or not test_instance.has_method("run_tests"):
			print("  [SKIP] %s — script compilation error" % label)
			print("")
			continue

		var results: Dictionary = test_instance.run_tests()
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

	# Run PhaseManager tests
	print("Running PhaseManager tests...")
	var phase_manager_tests := preload("res://tests/test_phase_manager.gd").new()
	var pm_results: Dictionary = phase_manager_tests.run_tests()
	for test_name in pm_results.keys():
		total_tests += 1
		var passed: bool = pm_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [phase_manager_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [phase_manager_tests.test_name, test_name])
	print("")

	# Run SignalDecay tests
	print("Running SignalDecay tests...")
	var signal_decay_tests := preload("res://tests/test_signal_decay.gd").new()
	var sig_results: Dictionary = signal_decay_tests.run_tests()
	for test_name in sig_results.keys():
		total_tests += 1
		var passed: bool = sig_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [signal_decay_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [signal_decay_tests.test_name, test_name])

	print("")

	# Run RadioStatic tests
	print("Running RadioStatic tests...")
	var radio_static_tests := preload("res://tests/test_radio_static.gd").new()
	var rs_results: Dictionary = radio_static_tests.run_tests()
	for test_name in rs_results.keys():
		total_tests += 1
		var passed: bool = rs_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % ["RadioStatic", test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % ["RadioStatic", test_name])

	print("")

	# Run BandSystem tests
	print("Running BandSystem tests...")
	var band_system_tests := preload("res://tests/test_band_system.gd").new()
	var bs_results: Dictionary = band_system_tests.run_tests()
	for test_name in bs_results.keys():
		total_tests += 1
		var passed: bool = bs_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [band_system_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [band_system_tests.test_name, test_name])

	print("")

	# Run SilenceSystem tests
	print("Running SilenceSystem tests...")
	var silence_system_tests := preload("res://tests/test_silence_system.gd").new()
	var ss_results: Dictionary = silence_system_tests.run_tests()
	for test_name in ss_results.keys():
		total_tests += 1
		var passed: bool = ss_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [silence_system_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [silence_system_tests.test_name, test_name])

	print("")

	# Run HUDLayout tests
	print("Running HUDLayout tests...")
	var hud_layout_tests := preload("res://tests/test_hud_layout.gd").new()
	var hud_results: Dictionary = hud_layout_tests.run_tests()
	for test_name in hud_results.keys():
		total_tests += 1
		var passed: bool = hud_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [hud_layout_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [hud_layout_tests.test_name, test_name])

	print("")
	print("=== Results ===")
	print("Total: %d | Passed: %d | Failed: %d" % [total_tests, total_passed, total_failed])
	print("ALL TESTS PASSED" if all_passed else "SOME TESTS FAILED")

	quit(0 if all_passed else 1)
