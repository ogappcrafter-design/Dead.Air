## run_room_tone_tests.gd — Standalone runner for RoomToneSystem tests (DEA-135)
## Run with: godot --headless --script res://run_room_tone_tests.gd --path godot/
extends SceneTree


func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame

	print("=== RoomToneSystem Test Suite (DEA-135) ===")
	print("")

	var script = load("res://tests/test_room_tone_system.gd")
	if script == null:
		print("FAILED: Could not load test_room_tone_system.gd")
		quit(1)
		return

	var suite = script.new()
	if suite == null or not suite.has_method("run_tests"):
		print("FAILED: test_room_tone_system.gd compilation error")
		quit(1)
		return

	var results: Dictionary = suite.run_tests()
	var passed := 0
	var failed := 0
	for test_name in results:
		var ok: bool = results[test_name]
		if ok:
			print("  [PASS] %s" % test_name)
			passed += 1
		else:
			print("  [FAIL] %s" % test_name)
			failed += 1

	print("")
	print("=== Results ===")
	print("Passed: %d | Failed: %d" % [passed, failed])
	if failed == 0:
		print("ALL TESTS PASSED")
	else:
		print("SOME TESTS FAILED")
	quit(0 if failed == 0 else 1)
