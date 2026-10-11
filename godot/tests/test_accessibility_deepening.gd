extends RefCounted
## test_accessibility_deepening.gd — Tests for DEA-88 accessibility
## deepening: radio text mode (transcript panel), colorblind-safe band
## symbols in the HUD, and call-type pulse patterns.

var test_name: String = "AccessibilityDeepening"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_radio_text_mode_starts_hidden"] = await test_radio_text_mode_starts_hidden()
	results["test_radio_text_mode_entries"] = await test_radio_text_mode_entries()
	results["test_radio_text_mode_call_lines"] = await test_radio_text_mode_call_lines()
	results["test_radio_text_mode_cap"] = await test_radio_text_mode_cap()
	results["test_setting_persists_and_toggles"] = await test_setting_persists_and_toggles()
	results["test_band_symbols_exist"] = test_band_symbols_exist()
	results["test_band_symbol_hidden_by_default"] = await test_band_symbol_hidden_by_default()
	results["test_call_type_pulse_patterns_defined"] = test_call_type_pulse_patterns_defined()
	results["test_call_type_pulse_blinks"] = await test_call_type_pulse_blinks()
	return results


func _make_rtm() -> Node:
	var rtm := RadioTextMode.new()
	(Engine.get_main_loop() as SceneTree).root.add_child(rtm)
	for i in 2:
		await (Engine.get_main_loop() as SceneTree).process_frame
	return rtm


func _cleanup_rtm(rtm: Node) -> void:
	if rtm and is_instance_valid(rtm):
		rtm._reset_for_testing()
		rtm.queue_free()


func test_radio_text_mode_starts_hidden() -> bool:
	var rtm: Node = await _make_rtm()
	# Default: disabled (unless a previous run's config enabled it; force off).
	rtm.set_enabled(false)
	var ok: bool = not rtm.is_enabled()
	_cleanup_rtm(rtm)
	return ok


func test_radio_text_mode_entries() -> bool:
	var rtm: Node = await _make_rtm()
	rtm.set_enabled(true)
	rtm.add_entry("hello world", "system")
	rtm.add_entry("the rain goes up", "call")
	var ok: bool = rtm.get_entry_count() == 2
	# Disabled: entries are ignored.
	rtm.set_enabled(false)
	rtm.add_entry("ignored", "system")
	ok = ok and rtm.get_entry_count() == 2
	_cleanup_rtm(rtm)
	return ok


func test_radio_text_mode_call_lines() -> bool:
	var rtm: Node = await _make_rtm()
	rtm.set_enabled(true)
	# Empty lines renders static entry.
	rtm.add_call_lines("SOMEONE", [])
	var ok: bool = rtm.get_entry_count() == 2  # header + static
	if ok:
		rtm.add_call_lines("SOMEONE", ["line one", "line two"])
		# header + 2 lines.
		ok = rtm.get_entry_count() == 2 + 3
	_cleanup_rtm(rtm)
	return ok


func test_radio_text_mode_cap() -> bool:
	var rtm: Node = await _make_rtm()
	rtm.set_enabled(true)
	for i in range(80):
		rtm.add_entry("entry %d" % i, "system")
	var ok: bool = rtm.get_entry_count() <= 60
	_cleanup_rtm(rtm)
	return ok


func test_setting_persists_and_toggles() -> bool:
	var am := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("AccessibilityManager")
	if am == null:
		return false
	var got := {"val": null}
	am.radio_text_mode_toggled.connect(func(v: bool): got["val"] = v)
	am.set_radio_text_mode(true)
	var ok: bool = am.radio_text_mode == true and got["val"] == true
	if ok:
		am.set_radio_text_mode(false)
		ok = am.radio_text_mode == false
	# Duplicate set is a no-op (no signal).
	if ok:
		var fired := {"n": 0}
		am.radio_text_mode_toggled.connect(func(_v): fired["n"] += 1)
		am.set_radio_text_mode(false)
		ok = fired["n"] == 0
	return ok


func test_band_symbols_exist() -> bool:
	var ok: bool = HUDLayout.BAND_SYMBOLS.size() >= 8
	if ok:
		ok = HUDLayout.BAND_SYMBOLS.get(0, "") == "●"
	if ok:
		ok = HUDLayout.BAND_SYMBOLS.get(4, "") == "✕"
	return ok


func test_band_symbol_hidden_by_default() -> bool:
	# Logic-level check: _update_band_symbol hides the label unless the
	# manager has colorblind_patterns enabled. The HUD must be in the tree
	# so get_node_or_null can find the manager (off-tree lookups return null).
	var hud := HUDLayout.new()
	# Disable processing: the headless-incomplete _build_ui leaves nil labels
	# that _process/_update_all would hit every frame.
	hud.set_process(false)
	(Engine.get_main_loop() as SceneTree).root.add_child(hud)
	var am := (Engine.get_main_loop() as SceneTree).root.get_node_or_null("AccessibilityManager")
	var original := false
	if am:
		original = am.colorblind_patterns
		am.colorblind_patterns = false
	hud._band_symbol_label = Label.new()
	hud._band_symbol_label.visible = true
	hud._update_band_symbol_by_id_for_testing(0)
	var ok: bool = not hud._band_symbol_label.visible
	if ok and am:
		am.colorblind_patterns = true
		hud._update_band_symbol_by_id_for_testing(0)
		ok = hud._band_symbol_label.visible and hud._band_symbol_label.text == "●"
		am.colorblind_patterns = original
	hud.queue_free()
	return ok


func test_call_type_pulse_patterns_defined() -> bool:
	var ok: bool = HUDLayout.CALL_TYPE_PULSE.has("RIGHT_ANSWER")
	if ok:
		ok = HUDLayout.CALL_TYPE_PULSE.has("DEAD_AIR")
	if ok:
		# DEAD_AIR pattern: brief blink then long silence — second segment > 0.5s.
		var pattern: Array = HUDLayout.CALL_TYPE_PULSE["DEAD_AIR"]
		ok = float(pattern[1]) > 0.5
	return ok


func test_call_type_pulse_blinks() -> bool:
	# Logic-level check on a bare HUD instance (headless _build_ui is
	# unreliable — see the HUDLayout baseline failures).
	var hud := HUDLayout.new()
	# Off-tree: the engine won't tick the headless-broken _process/_ready,
	# and _process_call_type_pulse doesn't need the tree.
	hud._call_text_label = Label.new()
	hud._call_type_pulse_type = "JUST_LISTEN"
	var alphas := {}
	for t in [0.05, 0.55]:
		hud._call_type_pulse_timer = t
		hud._process_call_type_pulse(0.0)
		alphas[t] = hud._call_text_label.modulate.a
	# JUST_LISTEN pattern [0.6]: on the whole cycle.
	var ok: bool = alphas[0.05] == 1.0 and alphas[0.55] == 1.0
	if ok:
		# DEAD_AIR: off during the long segment.
		hud._call_type_pulse_type = "DEAD_AIR"
		hud._call_type_pulse_timer = 0.3
		hud._process_call_type_pulse(0.0)
		ok = absf(hud._call_text_label.modulate.a - 0.45) < 0.01
	hud.queue_free()
	return ok
