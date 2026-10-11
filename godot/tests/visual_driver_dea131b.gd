extends Node
## Visual verification driver for the post-completion polish (DEA-131 follow-up).
## Verifies: title card after post-credits, hint fade, menu completion label.
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea131b.tscn
## Screenshots to user://screenshot/. Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _seq: Node = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	_run()


func _run() -> void:
	_seq = EndingSequences.new()
	_seq.name = "Endings"
	get_tree().root.add_child.call_deferred(_seq)
	await get_tree().process_frame
	await get_tree().process_frame
	await _test_title_card()
	await _test_menu_label()
	_finish()


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea131b_%02d_%s.png" % [_step, name]
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png("user://" + path)
	print("[Driver] snapshot user://%s (err=%d)" % [path, err])


func _check(cond: bool, label: String) -> void:
	if cond:
		_checks.append("PASS: " + label)
	else:
		_failures += 1
		_checks.append("FAIL: " + label)
		print("[Driver] *** FAIL: %s" % label)


func _test_title_card() -> void:
	print("[Driver] Title card flow")
	_seq.return_to_menu = true
	_seq.play_choice("A")
	_check(_seq.is_running(), "ending started")
	# Fast-forward to the title card.
	_seq._process(3.5)
	_seq._process(EndingSequences.CREDITS_DURATION)
	_seq._process(EndingSequences.POST_CREDITS_DURATION)
	_check(_seq.is_title_card_showing(), "title card showing")
	_seq._process(1.0)
	_check(not _seq.is_card_ready_for_input(), "hint hidden before delay")
	_snap("card_early")
	_seq._process(1.5)
	_check(_seq.is_card_ready_for_input(), "hint ready after delay")
	_snap("card_ready")
	# Input before the menu switch: verify the handler accepts the key event
	# by checking phase changed (we intercept before the actual scene change).
	_seq.suppress_scene_change = true
	var ev := InputEventKey.new()
	ev.pressed = true
	var phase_before: int = _seq.get_phase_id()
	_seq._unhandled_input(ev)
	_check(_seq.get_phase_id() != phase_before, "key advances past card")
	_seq._reset_for_testing()


func _test_menu_label() -> void:
	print("[Driver] Menu completion label")
	# Write a marker, build the menu, verify the label, remove the menu.
	var f := FileAccess.open("user://ending_marker.txt", FileAccess.WRITE)
	f.store_string("DEAD_AIR")
	f.close()
	var menu: Node = load("res://scenes/main_menu.tscn").instantiate()
	get_tree().root.add_child.call_deferred(menu)
	await get_tree().process_frame
	await get_tree().process_frame
	print("[Driver] menu added: valid=%s" % is_instance_valid(menu))
	var found := false
	for child in _all_children(menu):
		if child is Label and (child as Label).text.begins_with("COMPLETED"):
			found = true
	print("[Driver] menu label search done, found=%s" % found)
	_check(found, "menu shows completion label")
	_snap("menu_label")
	menu.queue_free()
	# No marker: label hidden.
	if FileAccess.file_exists("user://ending_marker.txt"):
		DirAccess.remove_absolute("user://ending_marker.txt")
	var menu2: Node = load("res://scenes/main_menu.tscn").instantiate()
	get_tree().root.add_child.call_deferred(menu2)
	await get_tree().process_frame
	await get_tree().process_frame
	var found2 := false
	for child in _all_children(menu2):
		if child is Label and (child as Label).text.begins_with("COMPLETED"):
			found2 = true
	_check(not found2, "label hidden without marker")
	menu2.queue_free()


func _all_children(node: Node) -> Array:
	var out: Array = []
	for child in node.get_children():
		out.append(child)
		out.append_array(_all_children(child))
	return out


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
