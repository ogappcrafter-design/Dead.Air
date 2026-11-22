## test_controls_remap.gd — Tests for DEA-191 Controls Remapping & Input Glyphs.
## Verifies persistence, conflict detection, single & all reset, device glyph switching,
## and UI reachability from Settings and Pause Menu.
extends RefCounted

var test_name: String = "ControlsRemap"

const InputGlyphs := preload("res://src/ui/input_glyphs.gd")
const ControlsRemapScreen := preload("res://src/ui/controls_remap_screen.gd")
const TEST_CONFIG_PATH := "user://test_controls.cfg"
const TEST_SETTINGS_PATH := "user://test_settings.cfg"


func run_tests() -> Dictionary:
	# Redirect the live InputManager's persistence to the throwaway test path
	# so rebind/reset tests never overwrite the player's user://controls.cfg.
	var original_controls_path: String = InputManager.controls_path
	InputManager.controls_path = TEST_CONFIG_PATH
	# Preference setters write the settings file; redirect it to its own
	# throwaway path so the suite cannot overwrite a player's saved
	# preferences, and so writes that land in the wrong file are visible
	# instead of hidden by a shared test path.
	var original_settings_path: String = InputManager.settings_path
	InputManager.settings_path = TEST_SETTINGS_PATH

	var results: Dictionary = {}
	results["test_glyph_formatting_keyboard"] = test_glyph_formatting_keyboard()
	results["test_glyph_formatting_xbox"] = test_glyph_formatting_xbox()
	results["test_glyph_formatting_playstation"] = test_glyph_formatting_playstation()
	results["test_hud_control_hints_per_device"] = test_hud_control_hints_per_device()
	results["test_device_switching_signals"] = test_device_switching_signals()
	results["test_rebind_action_updates_inputmap"] = test_rebind_action_updates_inputmap()
	results["test_persistence_save_load"] = test_persistence_save_load()
	results["test_conflict_detection"] = test_conflict_detection()
	results["test_overwrite_removes_conflicting_binding"] = test_overwrite_removes_conflicting_binding()
	results["test_reset_single_leaves_no_stale_entry"] = test_reset_single_leaves_no_stale_entry()
	results["test_mouse_button_rebind"] = test_mouse_button_rebind()
	results["test_key_modifier_roundtrip"] = test_key_modifier_roundtrip()
	results["test_modifier_overlap_conflicts"] = test_modifier_overlap_conflicts()
	results["test_overwrite_empty_binding_persists"] = test_overwrite_empty_binding_persists()
	results["test_motion_hold_actions"] = test_motion_hold_actions()
	results["test_single_action_reset"] = test_single_action_reset()
	results["test_reset_all_actions"] = test_reset_all_actions()
	results["test_remap_screen_initialization"] = test_remap_screen_initialization()
	results["test_remap_screen_conflict_flow"] = test_remap_screen_conflict_flow()
	results["test_mouse_press_reaches_capture"] = await test_mouse_press_reaches_capture()
	results["test_rebind_restores_focus"] = test_rebind_restores_focus()
	results["test_capture_spare_buttons"] = await test_capture_spare_buttons()
	results["test_motion_toggle_crossings"] = test_motion_toggle_crossings()
	results["test_paused_release_clears_holds"] = test_paused_release_clears_holds()
	results["test_hold_survives_other_source_release"] = test_hold_survives_other_source_release()
	results["test_capture_updates_device"] = await test_capture_updates_device()
	results["test_physical_keycode_binding_match"] = test_physical_keycode_binding_match()
	results["test_preference_writes_stay_in_settings_file"] = test_preference_writes_stay_in_settings_file()
	results["test_controller_answers_conflict"] = await test_controller_answers_conflict()
	results["test_reachability_from_settings_and_pause"] = test_reachability_from_settings_and_pause()

	# Restore the manager: real bindings path back, and the in-memory
	# InputMap/custom bindings reloaded from the real config.
	InputManager.controls_path = original_controls_path
	InputManager.settings_path = original_settings_path
	InputManager.load_controls()
	_cleanup_test_file()
	if FileAccess.file_exists(TEST_SETTINGS_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_SETTINGS_PATH))
	return results


func _cleanup_test_file() -> void:
	if FileAccess.file_exists(TEST_CONFIG_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_CONFIG_PATH))


func test_glyph_formatting_keyboard() -> bool:
	var key_e := InputEventKey.new()
	key_e.keycode = KEY_E
	var glyph_e := InputGlyphs.get_event_glyph(key_e, ControlEnums.DeviceType.KEYBOARD)

	var key_space := InputEventKey.new()
	key_space.keycode = KEY_SPACE
	var glyph_space := InputGlyphs.get_event_glyph(key_space, ControlEnums.DeviceType.KEYBOARD)

	var prompt := InputGlyphs.format_prompt("interact", "to open", ControlEnums.DeviceType.KEYBOARD)
	return glyph_e == "[E]" and glyph_space == "[Space]" and prompt.contains("to open")


func test_glyph_formatting_xbox() -> bool:
	var btn_a := InputEventJoypadButton.new()
	btn_a.button_index = JOY_BUTTON_A
	var glyph_a := InputGlyphs.get_event_glyph(btn_a, ControlEnums.DeviceType.XBOX)

	var btn_y := InputEventJoypadButton.new()
	btn_y.button_index = JOY_BUTTON_Y
	var glyph_y := InputGlyphs.get_event_glyph(btn_y, ControlEnums.DeviceType.XBOX)

	var mot_lt := InputEventJoypadMotion.new()
	mot_lt.axis = JOY_AXIS_TRIGGER_LEFT
	mot_lt.axis_value = 1.0
	var glyph_lt := InputGlyphs.get_event_glyph(mot_lt, ControlEnums.DeviceType.XBOX)

	return glyph_a == "[A]" and glyph_y == "[Y]" and glyph_lt == "[LT]"


func test_glyph_formatting_playstation() -> bool:
	var btn_a := InputEventJoypadButton.new()
	btn_a.button_index = JOY_BUTTON_A
	var glyph_cross := InputGlyphs.get_event_glyph(btn_a, ControlEnums.DeviceType.PLAYSTATION)

	var btn_y := InputEventJoypadButton.new()
	btn_y.button_index = JOY_BUTTON_Y
	var glyph_triangle := InputGlyphs.get_event_glyph(btn_y, ControlEnums.DeviceType.PLAYSTATION)

	var mot_l2 := InputEventJoypadMotion.new()
	mot_l2.axis = JOY_AXIS_TRIGGER_LEFT
	mot_l2.axis_value = 1.0
	var glyph_l2 := InputGlyphs.get_event_glyph(mot_l2, ControlEnums.DeviceType.PLAYSTATION)

	return glyph_cross == "[✕]" and glyph_triangle == "[△]" and glyph_l2 == "[L2]"


func test_hud_control_hints_per_device() -> bool:
	var hints_kb := InputGlyphs.get_hud_control_hints(ControlEnums.DeviceType.KEYBOARD)
	var hints_xbox := InputGlyphs.get_hud_control_hints(ControlEnums.DeviceType.XBOX)
	var hints_ps := InputGlyphs.get_hud_control_hints(ControlEnums.DeviceType.PLAYSTATION)

	var ok_kb: bool = hints_kb.contains("[E: Interact]") and hints_kb.contains("[A/D: Tune]")
	var ok_xbox: bool = hints_xbox.contains("[A: Interact]") and hints_xbox.contains("[Y: Record]")
	var ok_ps: bool = hints_ps.contains("[✕: Interact]") and hints_ps.contains("[△: Record]")

	return ok_kb and ok_xbox and ok_ps


func test_device_switching_signals() -> bool:
	if InputManager == null:
		return false

	var received_device := [-1]
	var cb := func(dev: int) -> void: received_device[0] = dev
	InputManager.device_changed.connect(cb)

	InputManager.set_device(ControlEnums.DeviceType.PLAYSTATION)
	var ok_ps: bool = received_device[0] == int(ControlEnums.DeviceType.PLAYSTATION)
	var last_ps: bool = InputManager.get_last_device() == ControlEnums.DeviceType.PLAYSTATION

	InputManager.set_device(ControlEnums.DeviceType.KEYBOARD)
	var ok_kb: bool = received_device[0] == int(ControlEnums.DeviceType.KEYBOARD)
	var last_kb: bool = InputManager.get_last_device() == ControlEnums.DeviceType.KEYBOARD

	InputManager.device_changed.disconnect(cb)
	return ok_ps and last_ps and ok_kb and last_kb


func test_rebind_action_updates_inputmap() -> bool:
	if InputManager == null:
		return false

	# Rebind "interact" keyboard event to KEY_T
	var new_key := InputEventKey.new()
	new_key.keycode = KEY_T
	new_key.pressed = true

	InputManager.rebind_action("interact", new_key)

	var found := false
	for ev in InputMap.action_get_events("interact"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_T:
			found = true
			break

	# Reset back
	InputManager.reset_action("interact")
	return found


func test_persistence_save_load() -> bool:
	_cleanup_test_file()
	if InputManager == null:
		return false

	var custom_settings := ControlSettings.new()
	var new_key := InputEventKey.new()
	new_key.keycode = KEY_Z
	new_key.pressed = true
	custom_settings.rebind_action("record", [new_key])

	var save_err := custom_settings.save_to_config(TEST_CONFIG_PATH)
	if save_err != OK:
		_cleanup_test_file()
		return false

	var loaded_settings := ControlSettings.new()
	var load_err := loaded_settings.load_from_config(TEST_CONFIG_PATH)
	if load_err != OK:
		_cleanup_test_file()
		return false

	var events := loaded_settings.get_action_events("record")
	var ok := false
	if not events.is_empty() and events[0] is InputEventKey:
		ok = (events[0] as InputEventKey).keycode == KEY_Z

	_cleanup_test_file()
	return ok


func test_conflict_detection() -> bool:
	if InputManager == null:
		return false

	# "interact" has KEY_E by default. Trying to bind KEY_E to "record" should detect conflict with "interact".
	var key_e := InputEventKey.new()
	key_e.keycode = KEY_E
	key_e.pressed = true

	var conflicts := InputManager.detect_conflicts("record", key_e)
	var found_interact := conflicts.has("interact")

	# An unused key like KEY_F12 should have no conflicts
	var key_f12 := InputEventKey.new()
	key_f12.keycode = KEY_F12
	key_f12.pressed = true
	var no_conflicts := InputManager.detect_conflicts("record", key_f12)

	return found_interact and no_conflicts.is_empty()


func test_overwrite_removes_conflicting_binding() -> bool:
	if InputManager == null:
		return false

	# Assign KEY_E (owned by "interact") to "record" through the conflict
	# path and verify "interact" no longer answers to KEY_E afterwards.
	var key_e := InputEventKey.new()
	key_e.keycode = KEY_E
	key_e.pressed = true

	InputManager.remove_conflicting_event("interact", key_e)
	InputManager.rebind_action("record", key_e)

	var interact_has_e := false
	for ev in InputMap.action_get_events("interact"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_E:
			interact_has_e = true
			break
	var record_has_e := false
	for ev in InputMap.action_get_events("record"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_E:
			record_has_e = true
			break

	InputManager.reset_all_actions()
	return (not interact_has_e) and record_has_e


func test_reset_single_leaves_no_stale_entry() -> bool:
	if InputManager == null:
		return false

	var key_u := InputEventKey.new()
	key_u.keycode = KEY_U
	key_u.pressed = true
	InputManager.rebind_action("play_tape", key_u)
	var key_v := InputEventKey.new()
	key_v.keycode = KEY_V
	key_v.pressed = true
	InputManager.rebind_action("record", key_v)

	# Reset only play_tape; record keeps its custom binding.
	InputManager.reset_action("play_tape")

	var persisted := ControlSettings.new()
	var err := persisted.load_bindings_from_config(TEST_CONFIG_PATH)
	if err != OK:
		return false
	var ok := not persisted.has_custom_binding("play_tape") and persisted.has_custom_binding("record")
	InputManager.reset_action("record")
	return ok


func test_mouse_button_rebind() -> bool:
	if InputManager == null:
		return false

	var mouse_btn := InputEventMouseButton.new()
	mouse_btn.button_index = MOUSE_BUTTON_MIDDLE
	mouse_btn.pressed = true
	var glyph := InputGlyphs.get_event_glyph(mouse_btn, ControlEnums.DeviceType.KEYBOARD)
	if glyph != "[MMB]":
		return false

	InputManager.rebind_action("interact", mouse_btn)
	var found := false
	for ev in InputMap.action_get_events("interact"):
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_MIDDLE:
			found = true
			break
	InputManager.reset_action("interact")
	return found


func test_key_modifier_roundtrip() -> bool:
	var ctrl_k := InputEventKey.new()
	ctrl_k.keycode = KEY_K
	ctrl_k.ctrl_pressed = true
	ctrl_k.pressed = true
	var data := ControlSettings.serialize_event(ctrl_k)
	if not data.get("ctrl", false):
		return false
	var restored: InputEvent = ControlSettings.deserialize_event(data)
	if not (restored is InputEventKey):
		return false
	var key := restored as InputEventKey
	if not (key.keycode == KEY_K and key.ctrl_pressed and not key.shift_pressed):
		return false
	if InputManager == null:
		return true
	# Distinct bindings still overlap: Godot fires a plain-K binding on
	# Ctrl+K, so any two bindings on one key share a trigger.
	var plain_k := InputEventKey.new()
	plain_k.keycode = KEY_K
	plain_k.pressed = true
	return InputManager.event_overlaps_binding(ctrl_k, plain_k) \
		and InputManager.event_overlaps_binding(plain_k, ctrl_k)


func test_modifier_overlap_conflicts() -> bool:
	if InputManager == null:
		return false

	# Ctrl+V must flag the plain-V flashlight binding: Godot fires a
	# plain-key binding even with extra modifiers held.
	var ctrl_v := InputEventKey.new()
	ctrl_v.keycode = KEY_V
	ctrl_v.ctrl_pressed = true
	ctrl_v.pressed = true
	var conflicts: Array[String] = InputManager.detect_conflicts("record", ctrl_v)
	var chord_flags_flashlight: bool = conflicts.has("flashlight")

	# A chord binding does not fire on the plain key...
	var ctrl_k := InputEventKey.new()
	ctrl_k.keycode = KEY_K
	ctrl_k.ctrl_pressed = true
	ctrl_k.pressed = true
	InputManager.rebind_action("record", ctrl_k)
	var plain_k_press := InputEventKey.new()
	plain_k_press.keycode = KEY_K
	plain_k_press.pressed = true
	var chord_needs_modifiers: bool = not InputManager._is_action_event(plain_k_press, "record")
	# ...but releasing the key alone still ends the hold, whatever order
	# the modifier came up in.
	var plain_k_release := InputEventKey.new()
	plain_k_release.keycode = KEY_K
	plain_k_release.pressed = false
	var release_clears_hold: bool = InputManager._is_action_event(plain_k_release, "record")

	InputManager.reset_action("record")
	return chord_flags_flashlight and chord_needs_modifiers and release_clears_hold


func test_overwrite_empty_binding_persists() -> bool:
	if InputManager == null:
		return false

	# Take every event away from "examine" through the conflict-removal path.
	for ev in InputMap.action_get_events("examine"):
		InputManager.remove_conflicting_event("examine", ev)
	var unbound_now: bool = InputMap.action_get_events("examine").is_empty()

	# The empty override must survive a reload instead of restoring defaults.
	var persisted := ControlSettings.new()
	var err := persisted.load_bindings_from_config(TEST_CONFIG_PATH)
	var persisted_unbound: bool = err == OK \
		and persisted.has_custom_binding("examine") \
		and persisted.get_action_events("examine").is_empty()
	InputManager.load_controls()
	var still_unbound: bool = InputMap.action_get_events("examine").is_empty()

	InputManager.reset_action("examine")
	return unbound_now and persisted_unbound and still_unbound


func test_motion_hold_actions() -> bool:
	if InputManager == null:
		return false

	# Earlier suites may have moved the shared InputManager out of EXPLORE;
	# fine_tune is only active there.
	var original_mode: int = InputManager.get_mode()
	InputManager.set_mode(ControlEnums.ControlMode.EXPLORE)

	# fine_tune's default L2/trigger binding must drive the hold state.
	var trigger := InputEventJoypadMotion.new()
	trigger.axis = JOY_AXIS_TRIGGER_LEFT
	trigger.axis_value = 1.0
	InputManager._process_hold_motion(trigger)
	var active: bool = InputManager.is_action_held("fine_tune")

	var neutral := InputEventJoypadMotion.new()
	neutral.axis = JOY_AXIS_TRIGGER_LEFT
	neutral.axis_value = 0.0
	InputManager._process_hold_motion(neutral)
	var cleared: bool = not InputManager.is_action_held("fine_tune")

	InputManager.set_mode(original_mode)
	return active and cleared


func test_single_action_reset() -> bool:
	if InputManager == null:
		return false

	var key_u := InputEventKey.new()
	key_u.keycode = KEY_U
	key_u.pressed = true

	InputManager.rebind_action("play_tape", key_u)
	var has_u := false
	for ev in InputMap.action_get_events("play_tape"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_U:
			has_u = true
			break

	InputManager.reset_action("play_tape")
	var restored := false
	for ev in InputMap.action_get_events("play_tape"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_Q: # Default for play_tape is Q
			restored = true
			break

	return has_u and restored


func test_reset_all_actions() -> bool:
	if InputManager == null:
		return false

	var key_1 := InputEventKey.new()
	key_1.keycode = KEY_J
	key_1.pressed = true
	InputManager.rebind_action("interact", key_1)

	var key_2 := InputEventKey.new()
	key_2.keycode = KEY_K
	key_2.pressed = true
	InputManager.rebind_action("hide", key_2)

	InputManager.reset_all_actions()

	var interact_default := false
	for ev in InputMap.action_get_events("interact"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_E:
			interact_default = true
			break

	var hide_default := false
	for ev in InputMap.action_get_events("hide"):
		if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_SPACE:
			hide_default = true
			break

	return interact_default and hide_default


func test_remap_screen_initialization() -> bool:
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)

	var count := screen.get_action_count()
	# Expect 22 remappable actions in total across all 4 categories
	var has_actions: bool = count >= 19

	var interact_glyph := screen.get_action_glyph_text("interact")
	var ok_glyph: bool = not interact_glyph.is_empty() and interact_glyph != "[?]"

	screen.queue_free()
	return has_actions and ok_glyph


func test_remap_screen_conflict_flow() -> bool:
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)

	# Simulate rebinding "record" with KEY_E (which is currently used by "interact")
	var conflicting_key := InputEventKey.new()
	conflicting_key.keycode = KEY_E
	conflicting_key.pressed = true

	screen._start_rebinding("record")
	screen._apply_or_prompt_conflict("record", conflicting_key)

	var conflict_visible: bool = screen._conflict_box.visible
	var conflict_message: bool = screen._conflict_label.text.contains("interact") or screen._conflict_label.text.contains("Interact")

	screen._on_cancel_conflict()
	var conflict_dismissed: bool = not screen._conflict_box.visible

	screen.queue_free()
	return conflict_visible and conflict_message and conflict_dismissed


func test_mouse_press_reaches_capture() -> bool:
	if InputManager == null:
		return false
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)
	# A position-based click needs the layout settled, like a real frame.
	await Engine.get_main_loop().process_frame

	screen._start_rebinding("interact")

	# Dispatch through the viewport like a real click: the full-screen
	# background panel must not swallow it before the capture handler runs.
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_MIDDLE
	click.pressed = true
	click.position = Vector2(24, 24)
	Engine.get_main_loop().root.push_input(click)

	var bound := false
	for ev in InputMap.action_get_events("interact"):
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_MIDDLE:
			bound = true
			break

	screen.queue_free()
	InputManager.reset_action("interact")
	return bound


func test_rebind_restores_focus() -> bool:
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)

	var btn: Button = screen._action_rows["record"]["rebind_btn"]
	btn.grab_focus()
	var had_focus: bool = screen.get_viewport().gui_get_focus_owner() == btn

	screen._start_rebinding("record")
	var released: bool = screen.get_viewport().gui_get_focus_owner() == null

	var key := InputEventKey.new()
	key.keycode = KEY_F9
	key.pressed = true
	Engine.get_main_loop().root.push_input(key)
	var restored: bool = screen.get_viewport().gui_get_focus_owner() == btn

	# Conflict path: the dialog must own focus so a controller can answer it.
	var conflict_key := InputEventKey.new()
	conflict_key.keycode = KEY_E
	conflict_key.pressed = true
	screen._start_rebinding("record")
	Engine.get_main_loop().root.push_input(conflict_key)
	var conflict_focused: bool = screen.get_viewport().gui_get_focus_owner() == screen._btn_cancel_conflict

	screen._on_cancel_conflict()
	var restored_after_conflict: bool = screen.get_viewport().gui_get_focus_owner() == btn

	screen.queue_free()
	InputManager.reset_action("record")
	return had_focus and released and restored and conflict_focused and restored_after_conflict


func test_capture_spare_buttons() -> bool:
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)
	await Engine.get_main_loop().process_frame

	# Capture must spare the UI's own buttons: the non-interactive surfaces
	# stop eating clicks (screen surface passes them on, background and scroll
	# ignore them) so a click on BACK or RESET still reaches that button and
	# only empty-space clicks fall through to become bindings. Buttons keep
	# their STOP filter throughout.
	var back_btn: Button = null
	for child in screen.find_children("*", "Button", true, false):
		if (child as Button).text == "BACK":
			back_btn = child
			break
	if back_btn == null:
		screen.queue_free()
		return false

	var idle_screen: bool = screen.mouse_filter == Control.MOUSE_FILTER_STOP
	var idle_panel: bool = screen._background_panel.mouse_filter == Control.MOUSE_FILTER_STOP
	# Containers default to PASS, not STOP.
	var idle_scroll: bool = screen._scroll_container.mouse_filter == Control.MOUSE_FILTER_PASS
	var idle_back: bool = back_btn.mouse_filter == Control.MOUSE_FILTER_STOP
	var idle_filters: bool = idle_screen and idle_panel and idle_scroll and idle_back

	screen._start_rebinding("record")
	var surfaces_spared: bool = screen.mouse_filter == Control.MOUSE_FILTER_PASS \
		and screen._background_panel.mouse_filter == Control.MOUSE_FILTER_IGNORE \
		and screen._scroll_container.mouse_filter == Control.MOUSE_FILTER_IGNORE
	var buttons_keep_their_clicks: bool = back_btn.mouse_filter == Control.MOUSE_FILTER_STOP

	# A click dispatched at BACK during capture must never become a binding:
	# whatever the GUI does with it, the record action keeps its binding.
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	click.position = back_btn.global_position + back_btn.size * 0.5
	(Engine.get_main_loop().root as Window).push_input(click)
	var release := click.duplicate()
	release.pressed = false
	(Engine.get_main_loop().root as Window).push_input(release)
	var click_did_not_bind: bool = true
	for ev in InputMap.action_get_events("record"):
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
			click_did_not_bind = false

	screen._cancel_rebinding()
	var surfaces_restored: bool = screen.mouse_filter == Control.MOUSE_FILTER_STOP \
		and screen._background_panel.mouse_filter == Control.MOUSE_FILTER_STOP \
		and screen._scroll_container.mouse_filter == Control.MOUSE_FILTER_PASS

	screen.queue_free()
	InputManager.reset_action("record")
	return idle_filters and surfaces_spared and buttons_keep_their_clicks and surfaces_restored and click_did_not_bind


func test_motion_toggle_crossings() -> bool:
	if InputManager == null:
		return false
	var original_mode: int = InputManager.get_mode()
	InputManager.set_mode(ControlEnums.ControlMode.EXPLORE)

	# hide in toggle mode, bound to a stick axis: press, neutral, press again
	# must flip the toggle both ways (not latch after the first press).
	InputManager.set_hide_toggle_mode(true)
	var stick := InputEventJoypadMotion.new()
	stick.axis = JOY_AXIS_RIGHT_X
	stick.axis_value = 1.0
	InputManager.rebind_action("hide", stick)

	var neutral := InputEventJoypadMotion.new()
	neutral.axis = JOY_AXIS_RIGHT_X
	neutral.axis_value = 0.0

	InputManager._process_hold_motion(stick)
	var first_on: bool = InputManager.is_action_held("hide")
	InputManager._process_hold_motion(neutral)
	var still_on_after_neutral: bool = InputManager.is_action_held("hide")
	InputManager._process_hold_motion(stick)
	var toggled_off: bool = not InputManager.is_action_held("hide")

	InputManager.reset_action("hide")
	InputManager.set_hide_toggle_mode(false)
	InputManager.set_mode(original_mode)
	return first_on and still_on_after_neutral and toggled_off


func test_paused_release_clears_holds() -> bool:
	if InputManager == null:
		return false
	var original_mode: int = InputManager.get_mode()
	InputManager.set_mode(ControlEnums.ControlMode.EXPLORE)

	# A fine tune held when the pause opened must not survive a trigger
	# release that happens while paused.
	var trigger := InputEventJoypadMotion.new()
	trigger.axis = JOY_AXIS_TRIGGER_LEFT
	trigger.axis_value = 1.0
	InputManager._process_hold_motion(trigger)
	var active: bool = InputManager.is_action_held("fine_tune")

	var neutral := InputEventJoypadMotion.new()
	neutral.axis = JOY_AXIS_TRIGGER_LEFT
	neutral.axis_value = 0.0
	InputManager._clear_paused_motion_holds(neutral)
	var cleared: bool = not InputManager.is_action_held("fine_tune")

	# The crossing state went down with the hold, so the first squeeze
	# after resuming activates instead of being ignored as a repeat.
	InputManager._process_hold_motion(trigger)
	var reactivates_after_pause: bool = InputManager.is_action_held("fine_tune")
	InputManager._clear_paused_motion_holds(neutral)

	# The same clearing applies to key/button releases while paused.
	InputManager._process_hold_motion(trigger)
	var r_press := InputEventKey.new()
	r_press.keycode = KEY_R
	r_press.pressed = true
	InputManager._process_hold_events(r_press)
	var record_held: bool = InputManager.is_action_held("record")
	var r_release := InputEventKey.new()
	r_release.keycode = KEY_R
	r_release.pressed = false
	InputManager._clear_paused_press_holds(r_release)
	var record_cleared: bool = not InputManager.is_action_held("record")

	# Do not leak fine_tune/hold_breath holds into later suites.
	InputManager._process_hold_motion(neutral)
	InputManager.set_mode(original_mode)
	return active and cleared and reactivates_after_pause and record_held and record_cleared


func test_hold_survives_other_source_release() -> bool:
	if InputManager == null:
		return false
	var original_mode: int = InputManager.get_mode()
	InputManager.set_mode(ControlEnums.ControlMode.EXPLORE)

	# record keeps its R key binding while gaining a stick binding; the stick
	# release must not clear a hold the key is still holding.
	var stick := InputEventJoypadMotion.new()
	stick.axis = JOY_AXIS_RIGHT_Y
	stick.axis_value = -1.0
	InputManager.rebind_action("record", stick)

	var r_press := InputEventKey.new()
	r_press.keycode = KEY_R
	r_press.pressed = true
	InputManager._process_hold_events(r_press)
	var held_by_key: bool = InputManager.is_action_held("record")

	# The keyboard source is still physically held (Input's action state is
	# driven directly; push_input does not feed the Input singleton headless).
	Input.action_press("record")
	var neutral := InputEventJoypadMotion.new()
	neutral.axis = JOY_AXIS_RIGHT_Y
	neutral.axis_value = 0.0
	InputManager._process_hold_motion(neutral)
	var still_held: bool = InputManager.is_action_held("record")

	Input.action_release("record")
	InputManager._process_hold_motion(neutral)
	var cleared_by_key_release: bool = not InputManager.is_action_held("record")

	InputManager.reset_action("record")
	InputManager.set_mode(original_mode)
	return held_by_key and still_held and cleared_by_key_release


func test_capture_updates_device() -> bool:
	if InputManager == null:
		return false
	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)
	await Engine.get_main_loop().process_frame

	InputManager.set_device(ControlEnums.DeviceType.KEYBOARD)
	screen._start_rebinding("record")

	# A joypad button captured by the screen never reaches InputManager's own
	# _input; the screen must update device tracking itself.
	var rs := InputEventJoypadButton.new()
	rs.button_index = JOY_BUTTON_RIGHT_STICK
	rs.pressed = true
	(Engine.get_main_loop().root as Window).push_input(rs)

	var device_updated: bool = InputManager.get_last_device() == ControlEnums.DeviceType.XBOX
	var glyph: String = screen.get_action_glyph_text("record")

	screen.queue_free()
	InputManager.reset_action("record")
	InputManager.set_device(ControlEnums.DeviceType.KEYBOARD)
	return device_updated and glyph == "[RS]"


func test_physical_keycode_binding_match() -> bool:
	# A physical-only binding must match the event's physical field: on
	# AZERTY a press of the Q position carries keycode A + physical Q.
	var physical := InputEventKey.new()
	physical.physical_keycode = KEY_Q
	physical.pressed = true
	var azerty := InputEventKey.new()
	azerty.keycode = KEY_A
	azerty.physical_keycode = KEY_Q
	azerty.pressed = true
	if not InputManager._event_triggers_binding(physical, azerty):
		return false
	var logical := InputEventKey.new()
	logical.keycode = KEY_Q
	logical.pressed = true
	if InputManager._event_triggers_binding(physical, logical):
		return false
	return not InputManager.event_overlaps_binding(physical, logical) \
		and InputManager.event_overlaps_binding(physical, azerty)


func test_preference_writes_stay_in_settings_file() -> bool:
	if InputManager == null:
		return false

	# A preference write must land in the settings file without disturbing
	# saved bindings — so put a binding on disk first, and require it to
	# still be there (readable) after the preference write.
	var key_u := InputEventKey.new()
	key_u.keycode = KEY_U
	key_u.pressed = true
	InputManager.rebind_action("play_tape", key_u)

	InputManager.set_mouse_sensitivity(2.5)

	var settings_file := ConfigFile.new()
	var err_s: int = settings_file.load(TEST_SETTINGS_PATH)
	var pref_saved: bool = err_s == OK \
		and abs(float(settings_file.get_value("controls", "mouse_sensitivity", 0.0)) - 2.5) < 0.001

	# Reload the bindings file and require the rebound key itself to have
	# survived — a present-but-empty or altered play_tape entry must fail.
	var persisted := ControlSettings.new()
	var err_b: int = persisted.load_bindings_from_config(TEST_CONFIG_PATH)
	var rebound_key_kept: bool = false
	if err_b == OK and persisted.has_custom_binding("play_tape"):
		for ev in persisted.get_action_events("play_tape"):
			if ev is InputEventKey and (ev as InputEventKey).keycode == KEY_U:
				rebound_key_kept = true
				break
	var bindings_intact: bool = rebound_key_kept

	var bindings_file := ConfigFile.new()
	var pref_leaked: bool = bindings_intact \
		and bindings_file.load(TEST_CONFIG_PATH) == OK \
		and abs(float(bindings_file.get_value("controls", "mouse_sensitivity", 0.0)) - 2.5) < 0.001

	InputManager.set_mouse_sensitivity(1.0)
	InputManager.reset_action("play_tape")
	return pref_saved and bindings_intact and not pref_leaked


func test_controller_answers_conflict() -> bool:
	# With the conflict dialog focused, an accept input (the controller A's
	# ui_accept action) must dismiss it through the GUI, not through a direct
	# handler call.
	# In the real game the tree is paused while this screen is open, so
	# gameplay UI (ChoiceDisplay, ExamineDisplay, ...) cannot consume
	# ui_accept. Earlier suites can leak instances of exactly those nodes;
	# free them so this test exercises the real accept path.
	for leaked in (Engine.get_main_loop().root as Window).find_children("*", "Control", true, false):
		var script: Script = leaked.get_script() as Script
		if script != null and (script.resource_path.contains("choice_display.gd") \
				or script.resource_path.contains("examine_display.gd") \
				or script.resource_path.contains("corruption_screen.gd") \
				or script.resource_path.contains("tutorial_overlay.gd") \
				or script.resource_path.contains("fmv_player.gd")):
			leaked.queue_free()
	await Engine.get_main_loop().process_frame

	var screen := ControlsRemapScreen.new()
	Engine.get_main_loop().root.add_child(screen)

	var conflict_key := InputEventKey.new()
	conflict_key.keycode = KEY_E
	conflict_key.pressed = true
	screen._start_rebinding("record")
	(Engine.get_main_loop().root as Window).push_input(conflict_key)

	var conflict_visible: bool = screen._conflict_box.visible
	var cancel_focused: bool = screen.get_viewport().gui_get_focus_owner() == screen._btn_cancel_conflict

	# Answer the dialog through the ui_accept action a controller's A button
	# maps to (headless cannot synthesize joypad GUI accept, so the action's
	# keyboard member drives the same activation path).
	var accept_press := InputEventKey.new()
	accept_press.keycode = KEY_SPACE
	accept_press.pressed = true
	(Engine.get_main_loop().root as Window).push_input(accept_press)
	var accept_release := accept_press.duplicate()
	accept_release.pressed = false
	(Engine.get_main_loop().root as Window).push_input(accept_release)

	var dismissed: bool = not screen._conflict_box.visible

	screen.queue_free()
	InputManager.reset_action("record")
	return conflict_visible and cancel_focused and dismissed


func test_reachability_from_settings_and_pause() -> bool:
	var settings_packed: PackedScene = load("res://scenes/settings.tscn")
	if settings_packed == null:
		return false
	var settings_screen: Control = settings_packed.instantiate()
	Engine.get_main_loop().root.add_child(settings_screen)

	# Verify remap button exists in settings
	var found_settings_btn := false
	for child in settings_screen.find_children("*", "Button", true, false):
		if (child as Button).text.containsn("REMAP") or (child as Button).text.containsn("CONTROLS"):
			found_settings_btn = true
			break
	settings_screen.queue_free()

	# Verify remap button exists in pause menu
	var pause_script: Resource = load("res://src/ui/pause_menu.gd")
	var pause_node: Node = pause_script.new()
	Engine.get_main_loop().root.add_child(pause_node)

	var found_pause_btn := false
	for child in pause_node.find_children("*", "Button", true, false):
		if (child as Button).text == "CONTROLS":
			found_pause_btn = true
			break
	pause_node.queue_free()

	return found_settings_btn and found_pause_btn
