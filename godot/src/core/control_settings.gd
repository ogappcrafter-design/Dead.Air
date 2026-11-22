# control_settings.gd — Remappable control settings resource
# DEA-152: Control Scheme Implementation
class_name ControlSettings
extends Resource

## Analog stick deadzone (0.0–1.0). Applied to Left Stick and Right Stick motion events.
@export var stick_deadzone: float = 0.15

## Trigger deadzone for L2/LT (0.0–1.0). Separate from stick deadzone because triggers have different travel.
@export var trigger_deadzone: float = 0.2

## Mouse sensitivity multiplier for radio tuning (pixels → tuning delta).
@export var mouse_sensitivity: float = 1.0

## Invert Y axis on sticks (Left Stick Y for movement, Right Stick Y if used).
@export var invert_y: bool = false

## Toggle vs hold for Hide action. true = press to toggle hiding, false = hold to hide.
@export var hide_toggle_mode: bool = false

## Toggle vs hold for Hold Breath action. true = press to toggle, false = hold to breathe-hold.
@export var hold_breath_toggle_mode: bool = false

## Left-handed mode mirrors left/right controls (A↔D, Left Stick X mirrored).
@export var left_handed_mode: bool = false

## Input buffer duration in milliseconds. Actions within this window are buffered.
@export var input_buffer_ms: int = 100

## Custom action bindings for full remapping support.
## Key: action name (String), Value: Array of InputEvent resources.
## Empty dictionary = use project.godot defaults.
@export var custom_bindings: Dictionary = {}


## Save settings to a config file.
func save_to_config(path: String) -> Error:
	var config: ConfigFile = ConfigFile.new()
	# Preserve any existing sections (e.g. if saving to controls.cfg or control_settings.cfg)
	config.load(path)
	config.set_value("controls", "stick_deadzone", stick_deadzone)
	config.set_value("controls", "trigger_deadzone", trigger_deadzone)
	config.set_value("controls", "mouse_sensitivity", mouse_sensitivity)
	config.set_value("controls", "invert_y", invert_y)
	config.set_value("controls", "hide_toggle_mode", hide_toggle_mode)
	config.set_value("controls", "hold_breath_toggle_mode", hold_breath_toggle_mode)
	config.set_value("controls", "left_handed_mode", left_handed_mode)
	config.set_value("controls", "input_buffer_ms", input_buffer_ms)

	# Serialize custom bindings — replace the section wholesale so a reset
	# action's stale entry cannot survive on disk and be re-applied on load.
	if config.has_section("bindings"):
		config.erase_section("bindings")
	for action in custom_bindings.keys():
		var ev_list: Array = []
		for ev in custom_bindings[action]:
			var d := serialize_event(ev)
			if not d.is_empty():
				ev_list.append(d)
		config.set_value("bindings", action, ev_list)

	return config.save(path)


## Load settings from a config file. Returns ERR_FILE_NOT_FOUND if missing.
func load_from_config(path: String) -> Error:
	var config: ConfigFile = ConfigFile.new()
	var err: Error = config.load(path)
	if err != OK:
		return err
	stick_deadzone = config.get_value("controls", "stick_deadzone", 0.15)
	trigger_deadzone = config.get_value("controls", "trigger_deadzone", 0.2)
	mouse_sensitivity = config.get_value("controls", "mouse_sensitivity", 1.0)
	invert_y = config.get_value("controls", "invert_y", false)
	hide_toggle_mode = config.get_value("controls", "hide_toggle_mode", false)
	hold_breath_toggle_mode = config.get_value("controls", "hold_breath_toggle_mode", false)
	left_handed_mode = config.get_value("controls", "left_handed_mode", false)
	input_buffer_ms = config.get_value("controls", "input_buffer_ms", 100)

	# Deserialize custom bindings
	_read_bindings(config)
	return OK


## Load only custom bindings from a config file, leaving every other setting
## untouched. Used by InputManager so the bindings file cannot clobber newer
## general preferences saved in control_settings.cfg.
func load_bindings_from_config(path: String) -> Error:
	var config: ConfigFile = ConfigFile.new()
	var err: Error = config.load(path)
	if err != OK:
		return err
	custom_bindings.clear()
	_read_bindings(config)
	return OK


func _read_bindings(config: ConfigFile) -> void:
	if config.has_section("bindings"):
		for action in config.get_section_keys("bindings"):
			var raw_list = config.get_value("bindings", action, [])
			if raw_list is Array:
				var events: Array = []
				for item in raw_list:
					if item is Dictionary:
						var ev := deserialize_event(item)
						if ev != null:
							events.append(ev)
				# An empty list is an intentional "unbound" override (an
				# overwrite removed the action's last binding); keep it so the
				# default cannot silently return on the next load.
				custom_bindings[action] = events


static func serialize_event(event: InputEvent) -> Dictionary:
	if event is InputEventKey:
		return {
			"type": "key",
			"keycode": event.keycode,
			"physical_keycode": event.physical_keycode,
			"ctrl": event.ctrl_pressed,
			"shift": event.shift_pressed,
			"alt": event.alt_pressed,
			"meta": event.meta_pressed
		}
	elif event is InputEventJoypadButton:
		return {
			"type": "joy_button",
			"button_index": event.button_index
		}
	elif event is InputEventJoypadMotion:
		return {
			"type": "joy_motion",
			"axis": event.axis,
			"axis_value": event.axis_value
		}
	elif event is InputEventMouseButton:
		return {
			"type": "mouse_button",
			"button_index": event.button_index
		}
	return {}


static func deserialize_event(data: Dictionary) -> InputEvent:
	var type: String = data.get("type", "")
	match type:
		"key":
			var ev := InputEventKey.new()
			ev.keycode = data.get("keycode", 0)
			ev.physical_keycode = data.get("physical_keycode", 0)
			# Modifier fields default to false so pre-DEA-191 plain-key
			# binding files keep loading unchanged.
			ev.ctrl_pressed = data.get("ctrl", false)
			ev.shift_pressed = data.get("shift", false)
			ev.alt_pressed = data.get("alt", false)
			ev.meta_pressed = data.get("meta", false)
			ev.pressed = true
			return ev
		"joy_button":
			var ev := InputEventJoypadButton.new()
			ev.button_index = data.get("button_index", 0)
			ev.pressed = true
			return ev
		"joy_motion":
			var ev := InputEventJoypadMotion.new()
			ev.axis = data.get("axis", 0)
			ev.axis_value = data.get("axis_value", 1.0)
			return ev
		"mouse_button":
			var ev := InputEventMouseButton.new()
			ev.button_index = data.get("button_index", 1)
			ev.pressed = true
			return ev
		_:
			return null


## Rebind an action to a new set of input events (full remapping support).
func rebind_action(action: String, events: Array) -> void:
	custom_bindings[action] = events


## Get the events for an action, preferring custom bindings over defaults.
func get_action_events(action: String) -> Array:
	if custom_bindings.has(action):
		return custom_bindings[action]
	return []


## Check if an action has custom bindings.
func has_custom_binding(action: String) -> bool:
	return custom_bindings.has(action)
