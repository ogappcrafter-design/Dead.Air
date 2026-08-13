## test_night_transition.gd — Unit tests for NightTransition.
## Tests: overlay creation, start_transition sets label, re-entrance guard.
extends RefCounted

var test_name: String = "NightTransition"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_transition_creates_overlay"] = test_transition_creates_overlay()
	results["test_transition_creates_night_label"] = test_transition_creates_night_label()
	results["test_start_transition_sets_label"] = test_start_transition_sets_label()
	results["test_reentrance_guard"] = test_reentrance_guard()
	return results


func test_transition_creates_overlay() -> bool:
	var trans := NightTransition.new()
	Engine.get_main_loop().root.add_child(trans)
	var has_overlay := false
	for child in trans.get_children():
		if child is ColorRect:
			has_overlay = true
			break
	trans.queue_free()
	return has_overlay


func test_transition_creates_night_label() -> bool:
	var trans := NightTransition.new()
	Engine.get_main_loop().root.add_child(trans)
	var has_label := false
	for child in trans.get_children():
		if child is Label:
			has_label = true
			break
	trans.queue_free()
	return has_label


func test_start_transition_sets_label() -> bool:
	var trans := NightTransition.new()
	Engine.get_main_loop().root.add_child(trans)
	trans.start_transition(3)
	var label_text := ""
	for child in trans.get_children():
		if child is Label:
			label_text = (child as Label).text
			break
	trans.queue_free()
	return label_text == "Night 3"


func test_reentrance_guard() -> bool:
	var trans := NightTransition.new()
	Engine.get_main_loop().root.add_child(trans)
	trans.start_transition(1)
	trans.start_transition(2)
	var label_text := ""
	for child in trans.get_children():
		if child is Label:
			label_text = (child as Label).text
			break
	trans.queue_free()
	return label_text == "Night 1"
