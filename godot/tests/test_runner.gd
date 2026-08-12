## test_runner.gd — Headless test runner for DEA-153 save system.
## Run with: godot --headless --script res://tests/test_runner.gd
extends SceneTree


func _init() -> void:
	var all_passed := true
	var total_tests := 0
	var total_passed := 0
	var total_failed := 0

	print("=== DEA-153 Save System Test Suite ===")
	print("")

	# Run SaveData tests
	print("Running SaveData tests...")
	var save_data_tests := preload("res://tests/test_save_data.gd").new()
	var sd_results: Dictionary = save_data_tests.run_tests()
	for test_name in sd_results.keys():
		total_tests += 1
		var passed: bool = sd_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [save_data_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [save_data_tests.test_name, test_name])

	print("")

	# Run SaveManager tests
	print("Running SaveManager tests...")
	var save_manager_tests := preload("res://tests/test_save_manager.gd").new()
	var sm_results: Dictionary = save_manager_tests.run_tests()
	for test_name in sm_results.keys():
		total_tests += 1
		var passed: bool = sm_results[test_name]
		if passed:
			total_passed += 1
			print("  [PASS] %s::%s" % [save_manager_tests.test_name, test_name])
		else:
			total_failed += 1
			all_passed = false
			print("  [FAIL] %s::%s" % [save_manager_tests.test_name, test_name])

	print("")
	print("=== Results ===")
	print("Total: %d | Passed: %d | Failed: %d" % [total_tests, total_passed, total_failed])
	print(all_passed ? "ALL TESTS PASSED" : "SOME TESTS FAILED")

	quit(0 if all_passed else 1)
