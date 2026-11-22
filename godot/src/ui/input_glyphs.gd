# input_glyphs.gd — Device-aware glyph formatting for HUD and UI prompts.
# DEA-191: Controls remapping UI and input-glyph switching
class_name InputGlyphs
extends RefCounted

## Returns a formatted glyph representation for a given InputEvent.
static func get_event_glyph(event: InputEvent, device_type: ControlEnums.DeviceType = ControlEnums.DeviceType.KEYBOARD) -> String:
	if event is InputEventKey:
		return _get_key_glyph(event as InputEventKey)
	elif event is InputEventMouseButton:
		return _get_mouse_button_glyph(event as InputEventMouseButton)
	elif event is InputEventJoypadButton:
		return _get_joy_button_glyph((event as InputEventJoypadButton).button_index, device_type)
	elif event is InputEventJoypadMotion:
		return _get_joy_motion_glyph(event as InputEventJoypadMotion, device_type)
	return "[?]"


static func _get_key_glyph(event: InputEventKey) -> String:
	var code := event.keycode
	if code == 0:
		code = event.physical_keycode
	var base := ""
	match code:
		KEY_ESCAPE:
			base = "Esc"
		KEY_TAB:
			base = "Tab"
		KEY_BACKSPACE:
			base = "Backspace"
		KEY_ENTER, KEY_KP_ENTER:
			base = "Enter"
		KEY_INSERT:
			base = "Ins"
		KEY_DELETE:
			base = "Del"
		KEY_PAUSE:
			base = "Pause"
		KEY_PRINT:
			base = "Print"
		KEY_HOME:
			base = "Home"
		KEY_END:
			base = "End"
		KEY_LEFT:
			base = "Left"
		KEY_UP:
			base = "Up"
		KEY_RIGHT:
			base = "Right"
		KEY_DOWN:
			base = "Down"
		KEY_PAGEUP:
			base = "PgUp"
		KEY_PAGEDOWN:
			base = "PgDn"
		KEY_SHIFT:
			base = "Shift"
		KEY_CTRL:
			base = "Ctrl"
		KEY_ALT:
			base = "Alt"
		KEY_CAPSLOCK:
			base = "Caps"
		KEY_SPACE:
			base = "Space"
		_:
			var key_str := OS.get_keycode_string(code)
			if key_str.is_empty():
				base = "Key %d" % code
			else:
				base = key_str.to_upper()
	# Modifier prefix so a chord reads as e.g. [Ctrl+V]; a modifier key does
	# not prefix itself.
	var mod := ""
	if event.ctrl_pressed and code != KEY_CTRL:
		mod += "Ctrl+"
	if event.alt_pressed and code != KEY_ALT:
		mod += "Alt+"
	if event.shift_pressed and code != KEY_SHIFT:
		mod += "Shift+"
	if event.meta_pressed:
		mod += "Meta+"
	return "[%s%s]" % [mod, base]


static func _get_mouse_button_glyph(event: InputEventMouseButton) -> String:
	match event.button_index:
		MOUSE_BUTTON_LEFT: return "[LMB]"
		MOUSE_BUTTON_RIGHT: return "[RMB]"
		MOUSE_BUTTON_MIDDLE: return "[MMB]"
		MOUSE_BUTTON_WHEEL_UP: return "[Wheel Up]"
		MOUSE_BUTTON_WHEEL_DOWN: return "[Wheel Down]"
		_: return "[Mouse %d]" % event.button_index


static func _get_joy_button_glyph(button_index: int, device_type: ControlEnums.DeviceType) -> String:
	var is_ps: bool = (device_type == ControlEnums.DeviceType.PLAYSTATION)
	match button_index:
		JOY_BUTTON_A:
			return "[✕]" if is_ps else "[A]"
		JOY_BUTTON_B:
			return "[○]" if is_ps else "[B]"
		JOY_BUTTON_X:
			return "[□]" if is_ps else "[X]"
		JOY_BUTTON_Y:
			return "[△]" if is_ps else "[Y]"
		JOY_BUTTON_BACK:
			return "[Share]" if is_ps else "[View]"
		JOY_BUTTON_GUIDE:
			return "[PS]" if is_ps else "[Xbox]"
		JOY_BUTTON_START:
			return "[Options]" if is_ps else "[Menu]"
		JOY_BUTTON_LEFT_STICK:
			return "[L3]" if is_ps else "[LS]"
		JOY_BUTTON_RIGHT_STICK:
			return "[R3]" if is_ps else "[RS]"
		JOY_BUTTON_LEFT_SHOULDER:
			return "[L1]" if is_ps else "[LB]"
		JOY_BUTTON_RIGHT_SHOULDER:
			return "[R1]" if is_ps else "[RB]"
		JOY_BUTTON_DPAD_UP:
			return "[D-Pad Up]"
		JOY_BUTTON_DPAD_DOWN:
			return "[D-Pad Down]"
		JOY_BUTTON_DPAD_LEFT:
			return "[D-Pad Left]"
		JOY_BUTTON_DPAD_RIGHT:
			return "[D-Pad Right]"
		_:
			return "[Btn %d]" % button_index


static func _get_joy_motion_glyph(event: InputEventJoypadMotion, device_type: ControlEnums.DeviceType) -> String:
	var is_ps: bool = (device_type == ControlEnums.DeviceType.PLAYSTATION)
	match event.axis:
		JOY_AXIS_LEFT_X:
			return "[L-Stick Left]" if event.axis_value < 0 else "[L-Stick Right]"
		JOY_AXIS_LEFT_Y:
			return "[L-Stick Up]" if event.axis_value < 0 else "[L-Stick Down]"
		JOY_AXIS_RIGHT_X:
			return "[R-Stick Left]" if event.axis_value < 0 else "[R-Stick Right]"
		JOY_AXIS_RIGHT_Y:
			return "[R-Stick Up]" if event.axis_value < 0 else "[R-Stick Down]"
		JOY_AXIS_TRIGGER_LEFT:
			return "[L2]" if is_ps else "[LT]"
		JOY_AXIS_TRIGGER_RIGHT:
			return "[R2]" if is_ps else "[RT]"
		_:
			return "[Axis %d]" % event.axis


## Get glyph for a specific action and device type.
static func get_action_glyph(action: String, device_type: ControlEnums.DeviceType = ControlEnums.DeviceType.KEYBOARD) -> String:
	if not InputMap.has_action(action):
		return "[?]"

	var is_gamepad: bool = (device_type != ControlEnums.DeviceType.KEYBOARD)
	var events: Array[InputEvent] = InputMap.action_get_events(action)

	# Prefer matching device type
	for ev in events:
		if is_gamepad and (ev is InputEventJoypadButton or ev is InputEventJoypadMotion):
			return get_event_glyph(ev, device_type)
		elif not is_gamepad and (ev is InputEventKey or ev is InputEventMouseButton):
			return get_event_glyph(ev, device_type)

	# Fallback to any event if matching device not found
	if not events.is_empty():
		return get_event_glyph(events[0], device_type)

	return "[Unbound]"


## Format a prompt string with the active device's glyph (e.g. "[E] Interact" or "[A] Interact").
static func format_prompt(action: String, description: String, device_type: ControlEnums.DeviceType = ControlEnums.DeviceType.KEYBOARD) -> String:
	var glyph := get_action_glyph(action, device_type)
	if description.is_empty():
		return glyph
	return "%s %s" % [glyph, description]


## Returns the HUD control hints string formatted for the given device.
## Built from the live InputMap so rebinding is reflected immediately.
static func get_hud_control_hints(device_type: ControlEnums.DeviceType) -> String:
	var tune := _hint(_tune_hint_keys(device_type), "Tune")
	var record := _hint(_glyph_inner(get_action_glyph("record", device_type)), "Record")
	var play := _hint(_glyph_inner(get_action_glyph("play_tape", device_type)), "Play")
	var interact := _hint(_glyph_inner(get_action_glyph("interact", device_type)), "Interact")
	return "%s  %s  %s  %s" % [tune, record, play, interact]


static func _hint(keys: String, label: String) -> String:
	return "[%s: %s]" % [keys, label]


static func _glyph_inner(glyph: String) -> String:
	return glyph.trim_prefix("[").trim_suffix("]")


## Collapse the tune-left/tune-right pair into one hint: "A"/"D" -> "A/D",
## "L-Stick Left"/"L-Stick Right" -> "L-Stick".
static func _tune_hint_keys(device_type: ControlEnums.DeviceType) -> String:
	var left := _glyph_inner(get_action_glyph("radio_tune_left", device_type))
	var right := _glyph_inner(get_action_glyph("radio_tune_right", device_type))
	var left_h := left.trim_suffix(" Left")
	var right_h := right.trim_suffix(" Right")
	if left_h != left and right_h != right and left_h == right_h:
		return left_h
	var left_v := left.trim_suffix(" Up")
	var right_v := right.trim_suffix(" Down")
	if left_v != left and right_v != right and left_v == right_v:
		return left_v
	return "%s/%s" % [left, right]
