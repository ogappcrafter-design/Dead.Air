# control_enums.gd — Control mode and action type enums
# DEA-152: Control Scheme Implementation
class_name ControlEnums
extends RefCounted

## Control modes determine which input actions are active.
## The InputManager uses these to route inputs to the correct game systems.
enum ControlMode {
	EXPLORE,    ## Free movement enabled, radio tuning via Right Stick
	RADIO,       ## Radio-focused, movement disabled, full radio controls
	CALL,        ## Call dialogue, movement disabled, skip_call active
	HIDE,        ## Hiding, movement disabled, hold_breath active, radio muted
	PAUSED,      ## Game paused, only pause toggle active
	MENU,        ## In menu/settings, only pause toggle active
}

## Action types for hold vs press detection.
enum ActionType {
	PRESS,      ## Trigger on button press (instant)
	HOLD,       ## Active while button is held (continuous)
	TAP,         ## Quick press detection (for skip_call during dialogue)
}

## Input device types for tracking last-used device.
enum DeviceType {
	KEYBOARD,
	GAMEPAD,
}
