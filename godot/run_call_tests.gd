extends SceneTree

func _init():
    call_deferred("_run")

func _run():
    var script = load("res://tests/test_call_manager.gd")
    if script == null:
        print("FAILED: Could not load test_call_manager.gd")
        quit()
        return
    var suite = script.new()
    var results = suite.run_tests()
    print("\n=== CallManager Test Results ===")
    var passed = 0
    var failed = 0
    for test_name in results:
        var ok = results[test_name]
        if ok:
            print("  PASS: %s" % test_name)
            passed += 1
        else:
            print("  FAIL: %s" % test_name)
            failed += 1
    print("\n%d passed, %d failed" % [passed, failed])
    quit()
