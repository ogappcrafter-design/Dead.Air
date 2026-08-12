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
	config.set_value("controls", "stick_deadzone", stick_deadzone)
	config.set_value("controls", "trigger_deadzone", trigger_deadzone)
	config.set_value("controls", "mouse_sensitivity", mouse_sensitivity)
	config.set_value("controls", "invert_y", invert_y)
	config.set_value("controls", "hide_toggle_mode", hide_toggle_mode)
	config.set_value("controls", "hold_breath_toggle_mode", hold_breath_toggle_mode)
	config.set_value("controls", "left_handed_mode", left_handed_mode)
	config.set_value("controls", "input_buffer_ms", input_buffer_ms)
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
	return OK


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
