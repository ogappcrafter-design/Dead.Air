extends Node
## Debug-only integration test runner, attached as a child of night_shift.tscn.
## Extracted from an embedded GDScript sub_resource so the test code is not
## compiled into exported builds. The OS.is_debug_build() guard keeps it inert
## in release exports; the node itself is harmless either way.

func _ready() -> void:
	if not OS.is_debug_build():
		return
	var test_script: Script = load("res://tests/test_night_integration.gd")
	if test_script == null:
		print("[TestRunner] test_night_integration.gd not found")
		return
	var test_instance: Object = test_script.new()
	if not test_instance.has_method("run_tests"):
		print("[TestRunner] test script missing run_tests()")
		return
	var results: Dictionary = test_instance.run_tests()
	var passed := 0
	var total := 0
	for test_name in results:
		total += 1
		if results[test_name]:
			passed += 1
			print("[TestRunner] PASS: %s" % test_name)
		else:
			print("[TestRunner] FAIL: %s" % test_name)
	print("[TestRunner] Results: %d/%d passed" % [passed, total])
	if passed == total:
		print("[TestRunner] All integration tests PASSED")
	else:
		push_warning("[TestRunner] %d tests FAILED" % (total - passed))
