## controls_remap_screen.gd — CRT-styled Controls Remapping UI.
## DEA-191: Remap every action, detect conflicts, reset single or all, device glyphs.
class_name ControlsRemapScreen
extends Control

const InputGlyphs := preload("res://src/ui/input_glyphs.gd")

signal back_pressed

const ACTION_GROUPS := [
	{
		"title": "MOVEMENT",
		"actions": [
			{"id": "move_up", "name": "Move Up"},
			{"id": "move_down", "name": "Move Down"},
			{"id": "move_left", "name": "Move Left"},
			{"id": "move_right", "name": "Move Right"},
			{"id": "sprint", "name": "Sprint"},
		]
	},
	{
		"title": "RADIO",
		"actions": [
			{"id": "radio_tune_left", "name": "Tune Left"},
			{"id": "radio_tune_right", "name": "Tune Right"},
			{"id": "fine_tune", "name": "Fine Tune"},
			{"id": "band_prev", "name": "Previous Band"},
			{"id": "band_next", "name": "Next Band"},
			{"id": "band_cycle", "name": "Cycle Band"},
		]
	},
	{
		"title": "ACTIONS",
		"actions": [
			{"id": "interact", "name": "Interact"},
			{"id": "examine", "name": "Examine"},
			{"id": "record", "name": "Record"},
			{"id": "play_tape", "name": "Play Tape"},
			{"id": "hide", "name": "Hide"},
			{"id": "flashlight", "name": "Flashlight"},
			{"id": "hold_breath", "name": "Hold Breath"},
		]
	},
	{
		"title": "SYSTEM & MENUS",
		"actions": [
			{"id": "pause", "name": "Pause Game"},
			{"id": "skip_call", "name": "Skip Dialogue"},
			{"id": "switch_tape_prev", "name": "Previous Tape"},
			{"id": "switch_tape_next", "name": "Next Tape"},
		]
	}
]

var _sections_container: VBoxContainer
var _device_label: Label
var _status_label: Label
var _action_rows: Dictionary = {}  # action_id -> Dictionary { "row": HBoxContainer, "badge": Label, "rebind_btn": Button }
var _rebinding_action: String = ""
var _pending_conflict_action: String = ""
var _pending_conflict_event: InputEvent = null
var _conflict_box: PanelContainer
var _conflict_label: Label
var _btn_overwrite: Button
var _btn_cancel_conflict: Button
var _focus_before_capture: Control = null
var _background_panel: Panel
var _scroll_container: ScrollContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	_update_device_label()
	_refresh_all_glyphs()
	if InputManager != null and InputManager.has_signal("device_changed"):
		InputManager.device_changed.connect(_on_device_changed)


func _build_ui() -> void:
	# Background panel
	var panel := Panel.new()
	panel.name = "Background"
	_background_panel = panel
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	panel.modulate = Color(0.08, 0.08, 0.08, 0.95)
	add_child(panel)

	# Main container
	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 32)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_right", 32)
	margin.add_theme_constant_override("margin_bottom", 24)
	add_child(margin)

	var root_vbox := VBoxContainer.new()
	root_vbox.add_theme_constant_override("separation", 12)
	margin.add_child(root_vbox)

	# Title bar
	var title_bar := HBoxContainer.new()
	root_vbox.add_child(title_bar)

	var title := Label.new()
	title.text = "CONTROLS REMAPPING"
	title.add_theme_font_size_override("font_size", 22)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	CRTText.style_phosphor_green(title, 22)
	title_bar.add_child(title)

	_device_label = Label.new()
	_device_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	CRTText.style_amber(_device_label, 14)
	title_bar.add_child(_device_label)

	# Status / feedback banner
	_status_label = Label.new()
	_status_label.text = "Select an action to rebind. Press ESC to cancel rebinding."
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(_status_label, 14)
	root_vbox.add_child(_status_label)

	# Conflict resolution dialog / banner
	_conflict_box = PanelContainer.new()
	_conflict_box.visible = false
	var conflict_vbox := VBoxContainer.new()
	conflict_vbox.add_theme_constant_override("separation", 8)
	_conflict_box.add_child(conflict_vbox)

	_conflict_label = Label.new()
	_conflict_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_conflict_label.add_theme_color_override("font_color", Color(1.0, 0.25, 0.25))
	conflict_vbox.add_child(_conflict_label)

	var conflict_btns := HBoxContainer.new()
	conflict_btns.alignment = BoxContainer.ALIGNMENT_CENTER
	conflict_vbox.add_child(conflict_btns)

	_btn_overwrite = Button.new()
	_btn_overwrite.text = "OVERWRITE"
	_btn_overwrite.pressed.connect(_on_confirm_overwrite)
	conflict_btns.add_child(_btn_overwrite)

	_btn_cancel_conflict = Button.new()
	_btn_cancel_conflict.text = "CANCEL"
	_btn_cancel_conflict.pressed.connect(_on_cancel_conflict)
	conflict_btns.add_child(_btn_cancel_conflict)

	root_vbox.add_child(_conflict_box)

	# Scrollable action list
	var scroll := ScrollContainer.new()
	_scroll_container = scroll
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root_vbox.add_child(scroll)

	_sections_container = VBoxContainer.new()
	_sections_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_sections_container.add_theme_constant_override("separation", 16)
	scroll.add_child(_sections_container)

	for group in ACTION_GROUPS:
		_build_group(group["title"], group["actions"])

	# Footer buttons
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 16)
	root_vbox.add_child(footer)

	var btn_reset_all := Button.new()
	btn_reset_all.text = "RESET ALL TO DEFAULTS"
	btn_reset_all.pressed.connect(_on_reset_all_pressed)
	footer.add_child(btn_reset_all)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(spacer)

	var btn_back := Button.new()
	btn_back.text = "BACK"
	btn_back.custom_minimum_size = Vector2(100, 0)
	btn_back.pressed.connect(_on_back_pressed)
	footer.add_child(btn_back)


func _build_group(title: String, actions: Array) -> void:
	var group_header := Label.new()
	group_header.text = title
	CRTText.style_amber(group_header, 16)
	_sections_container.add_child(group_header)

	var group_box := VBoxContainer.new()
	group_box.add_theme_constant_override("separation", 4)
	_sections_container.add_child(group_box)

	for act_info in actions:
		var action_id: String = act_info["id"]
		var action_name: String = act_info["name"]

		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL

		var name_label := Label.new()
		name_label.text = action_name
		name_label.custom_minimum_size = Vector2(220, 0)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		CRTText.style_phosphor_green(name_label, 14)
		row.add_child(name_label)

		var badge := Label.new()
		badge.text = "[...]"
		badge.custom_minimum_size = Vector2(160, 0)
		badge.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		CRTText.style_amber(badge, 14)
		row.add_child(badge)

		var rebind_btn := Button.new()
		rebind_btn.text = "REBIND"
		rebind_btn.custom_minimum_size = Vector2(90, 0)
		rebind_btn.pressed.connect(func() -> void: _start_rebinding(action_id))
		row.add_child(rebind_btn)

		var reset_btn := Button.new()
		reset_btn.text = "RESET"
		reset_btn.custom_minimum_size = Vector2(80, 0)
		reset_btn.pressed.connect(func() -> void: _reset_single_action(action_id))
		row.add_child(reset_btn)

		group_box.add_child(row)

		_action_rows[action_id] = {
			"row": row,
			"badge": badge,
			"rebind_btn": rebind_btn,
			"name": action_name
		}


func _start_rebinding(action_id: String) -> void:
	if _rebinding_action == action_id:
		_cancel_rebinding()
		return

	var focused := get_viewport().gui_get_focus_owner()
	_cancel_rebinding()
	_rebinding_action = action_id
	_set_capture_surfaces(true)

	# Drop GUI focus so Enter/Space/joypad A reach the capture handler as
	# rebind input instead of activating the focused REBIND button
	# (ui_accept). The control is remembered so navigation resumes afterwards.
	_focus_before_capture = focused
	if focused != null:
		focused.release_focus()

	if _action_rows.has(action_id):
		var info: Dictionary = _action_rows[action_id]
		(info["rebind_btn"] as Button).text = "PRESS..."
		_status_label.text = "Press any key or button for '%s' (Esc to cancel)..." % info["name"]


func _cancel_rebinding() -> void:
	if not _rebinding_action.is_empty() and _action_rows.has(_rebinding_action):
		var info: Dictionary = _action_rows[_rebinding_action]
		(info["rebind_btn"] as Button).text = "REBIND"
	_rebinding_action = ""
	_set_capture_surfaces(false)
	_status_label.text = "Select an action to rebind. Press ESC to cancel rebinding."
	_restore_focus()


## While a rebind is captured, the non-interactive surfaces stop eating mouse
## clicks: a click on a button still reaches that button (Back closes, Reset
## resets), and a click on empty space falls through to _unhandled_input and
## becomes the binding.
func _set_capture_surfaces(capturing: bool) -> void:
	# The screen surface itself must PASS, or its own STOP filter eats the
	# clicks its ignored children pass up before they can reach unhandled
	# input. Clicks still cannot escape to UI below the screen: PASS
	# propagates to the screen's parent, not under it.
	mouse_filter = Control.MOUSE_FILTER_PASS if capturing else Control.MOUSE_FILTER_STOP
	var mode := Control.MOUSE_FILTER_IGNORE if capturing else Control.MOUSE_FILTER_STOP
	if _background_panel != null:
		_background_panel.mouse_filter = mode
	if _scroll_container != null:
		# Containers default to PASS, not STOP — restore the real default.
		_scroll_container.mouse_filter = mode if capturing else Control.MOUSE_FILTER_PASS


## Give GUI focus back to the control that started capture. Without a focus
## owner the controller has no starting point for D-pad navigation.
func _restore_focus() -> void:
	var target: Control = _focus_before_capture
	_focus_before_capture = null
	if target != null and is_instance_valid(target) and target.is_inside_tree() and target.visible:
		target.grab_focus()


func _focus_row_rebind(action_id: String) -> void:
	if not _action_rows.has(action_id):
		return
	var btn: Button = _action_rows[action_id]["rebind_btn"]
	if btn != null and is_instance_valid(btn) and btn.is_inside_tree() and btn.visible:
		btn.grab_focus()


func _unhandled_input(event: InputEvent) -> void:
	# Mouse capture: the GUI had first claim on the click (buttons act), so a
	# click reaching here during capture was aimed at empty space and becomes
	# the binding.
	if not _rebinding_action.is_empty() and event is InputEventMouseButton:
		if (event as InputEventMouseButton).pressed:
			_apply_or_prompt_conflict(_rebinding_action, event)
			get_viewport().set_input_as_handled()
		return
	if not _rebinding_action.is_empty():
		return
	# Escape closes the screen when no rebind is being captured.
	if event is InputEventKey and (event as InputEventKey).pressed and (event as InputEventKey).keycode == KEY_ESCAPE:
		back_pressed.emit()
		queue_free()
		get_viewport().set_input_as_handled()


## Capture runs in _input, before GUI dispatch, so mouse presses reach it: the
## full-screen background panel would otherwise consume every click.
func _input(event: InputEvent) -> void:
	if _rebinding_action.is_empty():
		return

	# Keys and gamepad events are captured before GUI dispatch so the focused
	# REBIND button cannot swallow them as ui_accept. Mouse clicks are NOT
	# taken here: the GUI gets them first, so a click on Back or Reset still
	# activates that button, and only clicks the GUI does not want fall
	# through to _unhandled_input below to become the binding.
	if not (event is InputEventKey or event is InputEventJoypadButton or event is InputEventJoypadMotion):
		return


	# Ignore motion below trigger threshold
	if event is InputEventJoypadMotion and abs((event as InputEventJoypadMotion).axis_value) < 0.5:
		return

	# Cancel rebinding on Escape
	if event is InputEventKey and (event as InputEventKey).keycode == KEY_ESCAPE:
		_cancel_rebinding()
		get_viewport().set_input_as_handled()
		return

	# Only trigger on key down / button down
	if event is InputEventKey and not (event as InputEventKey).pressed:
		return
	if event is InputEventJoypadButton and not (event as InputEventJoypadButton).pressed:
		return

	# The captured event is marked handled and never reaches
	# InputManager._input, so update device tracking here or the glyphs
	# refresh with the previous device after a keyboard-to-gamepad rebind.
	if InputManager != null:
		InputManager.set_device_from_event(event)
	var action_to_rebind: String = _rebinding_action
	_apply_or_prompt_conflict(action_to_rebind, event)
	get_viewport().set_input_as_handled()


func _apply_or_prompt_conflict(action_id: String, event: InputEvent) -> void:
	var conflicts: Array[String] = InputManager.detect_conflicts(action_id, event) if InputManager != null else []
	if not conflicts.is_empty():
		# Conflict detected — flag it, do NOT silently accept
		_pending_conflict_action = action_id
		_pending_conflict_event = event
		var conflict_names: Array[String] = []
		for c in conflicts:
			var act_name: String = c
			if _action_rows.has(c):
				act_name = _action_rows[c]["name"]
			conflict_names.append(act_name)
		_conflict_label.text = "CONFLICT: '%s' is already used by [%s]! Overwrite?" % [
			InputGlyphs.get_event_glyph(event, _get_active_device()),
			", ".join(conflict_names)
		]
		_conflict_box.visible = true
		_cancel_rebinding()
		# The dialog needs a focus owner or a controller cannot answer it.
		if _btn_cancel_conflict != null and is_instance_valid(_btn_cancel_conflict):
			_btn_cancel_conflict.grab_focus()
		return

	# No conflict: apply rebind immediately
	_execute_rebind(action_id, event)
	_cancel_rebinding()


func _on_confirm_overwrite() -> void:
	if not _pending_conflict_action.is_empty() and _pending_conflict_event != null:
		var rebind_action: String = _pending_conflict_action
		# Take the event away from every conflicting action first, or both
		# actions would keep responding to the same input after the overwrite.
		if InputManager != null:
			for conflicting in InputManager.detect_conflicts(rebind_action, _pending_conflict_event):
				InputManager.remove_conflicting_event(conflicting, _pending_conflict_event)
		_execute_rebind(rebind_action, _pending_conflict_event)
		_pending_conflict_action = ""
		_pending_conflict_event = null
		_conflict_box.visible = false
		_focus_row_rebind(rebind_action)
	else:
		_on_cancel_conflict()


func _on_cancel_conflict() -> void:
	var cancelled_action: String = _pending_conflict_action
	_pending_conflict_action = ""
	_pending_conflict_event = null
	_conflict_box.visible = false
	_status_label.text = "Rebind cancelled. Select an action to rebind."
	_focus_row_rebind(cancelled_action)


func _execute_rebind(action_id: String, event: InputEvent) -> void:
	if InputManager != null:
		InputManager.rebind_action(action_id, event)
	_refresh_all_glyphs()
	_status_label.text = "Rebound '%s' successfully." % (_action_rows[action_id]["name"] if _action_rows.has(action_id) else action_id)
	_focus_row_rebind(action_id)


func _reset_single_action(action_id: String) -> void:
	_cancel_rebinding()
	if InputManager != null:
		InputManager.reset_action(action_id)
	_refresh_all_glyphs()
	_status_label.text = "Reset '%s' to default." % (_action_rows[action_id]["name"] if _action_rows.has(action_id) else action_id)


func _on_reset_all_pressed() -> void:
	_cancel_rebinding()
	if InputManager != null:
		InputManager.reset_all_actions()
	_refresh_all_glyphs()
	_status_label.text = "Reset all actions to default bindings."


func _on_back_pressed() -> void:
	_cancel_rebinding()
	back_pressed.emit()
	queue_free()


func _on_device_changed(_device: int) -> void:
	_update_device_label()
	_refresh_all_glyphs()


func _get_active_device() -> ControlEnums.DeviceType:
	if InputManager != null:
		return InputManager.get_last_device()
	return ControlEnums.DeviceType.KEYBOARD


func _update_device_label() -> void:
	if _device_label == null:
		return
	var dev: ControlEnums.DeviceType = _get_active_device()
	var dev_name := "KEYBOARD"
	match dev:
		ControlEnums.DeviceType.PLAYSTATION:
			dev_name = "PLAYSTATION"
		ControlEnums.DeviceType.XBOX, ControlEnums.DeviceType.GAMEPAD:
			dev_name = "XBOX / GAMEPAD"
		_:
			dev_name = "KEYBOARD"
	_device_label.text = "DEVICE: %s" % dev_name


func _refresh_all_glyphs() -> void:
	var dev: ControlEnums.DeviceType = _get_active_device()
	for action_id in _action_rows.keys():
		var glyph: String = InputGlyphs.get_action_glyph(action_id, dev)
		var badge: Label = _action_rows[action_id]["badge"]
		badge.text = glyph


## Test hooks
func get_action_count() -> int:
	return _action_rows.size()


func get_action_glyph_text(action_id: String) -> String:
	if _action_rows.has(action_id):
		return (_action_rows[action_id]["badge"] as Label).text
	return ""
