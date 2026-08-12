# input_manager.gd — Central input coordinator (autoload singleton)
# DEA-152: Control Scheme Implementation
# Issue #115 (authoritative — differs from GDD in several mappings)
extends Node

## InputManager manages mode-based input routing, hold vs press detection,
## 100ms input buffering, configurable deadzones, mouse tuning, and band
## selection via number keys.
##
## Autoload: registered in project.godot as "InputManager".
## Access via InputManager from any script.

signal mode_changed(old_mode: int, new_mode: int)
signal action_triggered(action: String, type: int)
signal band_selected(band_index: int)

var settings: ControlSettings
var buffer: InputBuffer

# --- Mode state ---
var _mode: ControlEnums.ControlMode = ControlEnums.ControlMode.EXPLORE
var _previous_mode: ControlEnums.ControlMode = ControlEnums.ControlMode.EXPLORE

# --- Hold state tracking ---
# For toggle-mode actions: true = currently active (toggled on)
# For hold-mode actions: true = physically held
var _hold_active: Dictionary = {}         # action → bool (currently active)
var _hold_start_time: Dictionary = {}      # action → float (msec when first pressed)
var _toggle_state: Dictionary = {}         # action → bool (toggled on/off for toggle mode)

# --- Mouse tuning state ---
var _mouse_delta_x: float = 0.0
var _mouse_tuning_active: bool = false

# --- Active device tracking ---
var _last_device: ControlEnums.DeviceType = ControlEnums.DeviceType.KEYBOARD

# --- Constants ---
const HOLD_ACTIONS: Array[String] = ["record", "hide", "hold_breath", "fine_tune"]
const PRESS_ACTIONS: Array[String] = ["interact", "play_tape", "band_prev", "band_next", "band_cycle", "pause", "skip_call"]
const BAND_KEY_START: int = 49   # KEY_1
const BAND_KEY_END: int = 56     # KEY_8
const SETTINGS_PATH: String = "user://control_settings.cfg"


func _ready() -> void:
	settings = ControlSettings.new()
	buffer = InputBuffer.new(settings.input_buffer_ms)
	_load_settings()
	_apply_deadzones()
	_init_hold_states()


# ============================================================
# Settings
# ============================================================

func _load_settings() -> void:
	var err: Error = settings.load_from_config(SETTINGS_PATH)
	if err != OK:
		# Use defaults — save them for next time
		settings.save_to_config(SETTINGS_PATH)
	buffer._buffer_ms = float(settings.input_buffer_ms)


func save_settings() -> void:
	settings.save_to_config(SETTINGS_PATH)
	_apply_deadzones()
	buffer._buffer_ms = float(settings.input_buffer_ms)


func _apply_deadzones() -> void:
	# Apply deadzone to all joypad motion actions in the InputMap
	var motion_actions: Array[String] = [
		"move_left", "move_right", "move_up", "move_down",
		"radio_tune_left", "radio_tune_right",
		"fine_tune", "hold_breath"
	]
	for action_name in motion_actions:
		if not InputMap.has_action(action_name):
			continue
		for event in InputMap.action_get_events(action_name):
			if event is InputEventJoypadMotion:
				if event.axis >= 4:  # Trigger axes
					event.deadzone = settings.trigger_deadzone
				else:
					event.deadzone = settings.stick_deadzone


func _init_hold_states() -> void:
	for action in HOLD_ACTIONS:
		_hold_active[action] = false
		_hold_start_time[action] = 0.0
		_toggle_state[action] = false


# ============================================================
# Mode management
# ============================================================

func get_mode() -> ControlEnums.ControlMode:
	return _mode


func set_mode(new_mode: ControlEnums.ControlMode) -> void:
	if new_mode == _mode:
		return
	_previous_mode = _mode
	_mode = new_mode
	mode_changed.emit(_previous_mode, _mode)

	# Clear hold states when leaving a mode (except for persistent toggles)
	if _mode != ControlEnums.ControlMode.HIDE:
		_hold_active["hold_breath"] = false
		_toggle_state["hold_breath"] = false
	if _mode != ControlEnums.ControlMode.RADIO and _mode != ControlEnums.ControlMode.EXPLORE:
		_hold_active["fine_tune"] = false

	# Clear buffer on mode change to prevent stale inputs
	buffer.clear()


func get_previous_mode() -> ControlEnums.ControlMode:
	return _previous_mode


func is_movement_enabled() -> bool:
	return _mode == ControlEnums.ControlMode.EXPLORE


func is_radio_active() -> bool:
	return _mode == ControlEnums.ControlMode.EXPLORE or _mode == ControlEnums.ControlMode.RADIO


func is_hiding() -> bool:
	return _mode == ControlEnums.ControlMode.HIDE


# ============================================================
# Input processing
# ============================================================

func _input(event: InputEvent) -> void:
	# Track last device type
	if event is InputEventKey or event is InputEventMouseButton or event is InputEventMouseMotion:
		_last_device = ControlEnums.DeviceType.KEYBOARD
	elif event is InputEventJoypadButton or event is InputEventJoypadMotion:
		_last_device = ControlEnums.DeviceType.GAMEPAD

	# Handle mouse motion for radio tuning
	if event is InputEventMouseMotion:
		_handle_mouse_motion(event)

	# Handle number keys band selection (1-8)
	if event is InputEventKey and event.pressed and not event.echo:
		_handle_band_keys(event)

	# Process hold/toggle actions
	if event is InputEventJoypadButton or event is InputEventKey:
		_process_hold_events(event)


func _handle_mouse_motion(event: InputEventMouseMotion) -> void:
	if is_radio_active():
		var delta: float = float(event.relative.x) * settings.mouse_sensitivity
		_mouse_delta_x = delta
		_mouse_tuning_active = true
	else:
		_mouse_tuning_active = false
		_mouse_delta_x = 0.0


func _handle_band_keys(event: InputEventKey) -> void:
	if _mode == ControlEnums.ControlMode.PAUSED or _mode == ControlEnums.ControlMode.MENU:
		return
	var key: int = event.keycode
	if key >= BAND_KEY_START and key <= BAND_KEY_END:
		var band_index: int = key - BAND_KEY_START
		band_selected.emit(band_index)
		get_viewport().set_input_as_handled()


func _process_hold_events(event: InputEvent) -> void:
	for action in HOLD_ACTIONS:
		if not InputMap.has_action(action):
			continue
		if not _is_action_event(event, action):
			continue

		# Only process if this action is valid in the current mode
		if not _is_action_active_in_mode(action):
			continue

		var is_toggle: bool = _is_toggle_action(action)

		if event.pressed and not _hold_active[action]:
			if is_toggle:
				# Toggle mode: flip state on press
				_toggle_state[action] = not _toggle_state[action]
				_hold_active[action] = _toggle_state[action]
				if _hold_active[action]:
					_hold_start_time[action] = Time.get_ticks_msec()
				else:
					_hold_start_time[action] = 0.0
				action_triggered.emit(action, ControlEnums.ActionType.HOLD)
			else:
				# Hold mode: activate on press
				_hold_active[action] = true
				_hold_start_time[action] = Time.get_ticks_msec()
				action_triggered.emit(action, ControlEnums.ActionType.HOLD)

		elif not event.pressed and _hold_active[action] and not is_toggle:
			# Hold mode: deactivate on release
			_hold_active[action] = false
			_hold_start_time[action] = 0.0
			action_triggered.emit(action, ControlEnums.ActionType.HOLD)


func _is_action_event(event: InputEvent, action: String) -> bool:
	for ev in InputMap.action_get_events(action):
		if ev is InputEventJoypadButton and event is InputEventJoypadButton:
			if ev.button_index == event.button_index:
				return true
		elif ev is InputEventKey and event is InputEventKey:
			if ev.keycode == event.keycode:
				return true
		elif ev is InputEventJoypadMotion and event is InputEventJoypadMotion:
			if ev.axis == event.axis and sign(ev.axis_value) == sign(event.axis_value):
				return true
	return false


func _is_toggle_action(action: String) -> bool:
	match action:
		"hide":
			return settings.hide_toggle_mode
		"hold_breath":
			return settings.hold_breath_toggle_mode
		_:
			return false


func _is_action_active_in_mode(action: String) -> bool:
	match _mode:
		ControlEnums.ControlMode.EXPLORE:
			return action in ["record", "hide", "fine_tune"]
		ControlEnums.ControlMode.RADIO:
			return action in ["record", "fine_tune"]
		ControlEnums.ControlMode.HIDE:
			return action in ["hold_breath", "hide"]
		ControlEnums.ControlMode.CALL:
			return false
		ControlEnums.ControlMode.PAUSED:
			return false
		ControlEnums.ControlMode.MENU:
			return false
		_:
			return false


# ============================================================
# Per-frame processing
# ============================================================

func _process(_delta: float) -> void:
	buffer.update()
	_process_press_actions()


func _process_press_actions() -> void:
	var active: Array[String] = _get_active_press_actions()
	for action in active:
		# Buffer on first press
		if Input.is_action_just_pressed(action):
			buffer.buffer_action(action)
			action_triggered.emit(action, ControlEnums.ActionType.PRESS)
		# Consume buffered action if still relevant
		elif buffer.has_action(action):
			buffer.consume_action(action)
			action_triggered.emit(action, ControlEnums.ActionType.PRESS)


func _get_active_press_actions() -> Array[String]:
	match _mode:
		ControlEnums.ControlMode.EXPLORE:
			return ["interact", "play_tape", "band_prev", "band_next", "band_cycle", "pause"]
		ControlEnums.ControlMode.RADIO:
			return ["interact", "play_tape", "band_prev", "band_next", "band_cycle", "pause"]
		ControlEnums.ControlMode.CALL:
			return ["skip_call", "pause"]
		ControlEnums.ControlMode.HIDE:
			return ["pause"]
		ControlEnums.ControlMode.PAUSED:
			return ["pause"]
		ControlEnums.ControlMode.MENU:
			return ["pause"]
		_:
			return []


# ============================================================
# Public API — Input getters
# ============================================================

## Get the movement vector (Left Stick / WASD). Returns Vector2.ZERO if movement is disabled.
func get_movement() -> Vector2:
	if not is_movement_enabled():
		return Vector2.ZERO

	var v: Vector2 = Input.get_vector("move_left", "move_right", "move_up", "move_down")

	# Apply deadzone to analog input
	var mag: float = v.length()
	if mag > 0.0 and mag < settings.stick_deadzone:
		return Vector2.ZERO

	if settings.invert_y:
		v.y = -v.y
	if settings.left_handed_mode:
		v.x = -v.x

	return v


## Get the radio tuning value (Right Stick X / Mouse X). Returns 0.0 if radio is not active.
func get_tune_value() -> float:
	if not is_radio_active():
		_mouse_tuning_active = false
		_mouse_delta_x = 0.0
		return 0.0

	var tune: float = 0.0

	# Gamepad: Right Stick X via input actions
	tune = Input.get_axis("radio_tune_left", "radio_tune_right")

	# Apply deadzone to analog input
	if abs(tune) < settings.stick_deadzone:
		tune = 0.0

	# Mouse: use accumulated delta (consumed each frame)
	if _mouse_tuning_active:
		tune += _mouse_delta_x
		_mouse_delta_x = 0.0
		_mouse_tuning_active = false

	# Fine tune modifier reduces tuning speed
	if is_action_held("fine_tune") and _mode != ControlEnums.ControlMode.HIDE:
		tune *= 0.25  # Fine tune = 25% speed

	return tune


## Check if a hold action is currently active (held or toggled on).
func is_action_held(action: String) -> bool:
	if _hold_active.has(action):
		return _hold_active[action]
	return Input.is_action_pressed(action)


## Get how long a hold action has been active (seconds). Returns 0.0 if not active.
func get_hold_duration(action: String) -> float:
	if not _hold_active.get(action, false):
		return 0.0
	var start: float = _hold_start_time.get(action, 0.0)
	if start == 0.0:
		return 0.0
	return (Time.get_ticks_msec() - start) / 1000.0


## Check if an action was just pressed this frame (from buffer or direct).
func is_action_just_pressed(action: String) -> bool:
	return Input.is_action_just_pressed(action) or buffer.consume_action(action)


## Get the last-used input device type.
func get_last_device() -> ControlEnums.DeviceType:
	return _last_device


## Check if the last-used device was a gamepad.
func is_gamepad_active() -> bool:
	return _last_device == ControlEnums.DeviceType.GAMEPAD


# ============================================================
# Public API — Remapping
# ============================================================

## Rebind an action to a new input event. Updates the InputMap and saves to settings.
func rebind_action(action: String, new_event: InputEvent, old_event: InputEvent = null) -> void:
	if not InputMap.has_action(action):
		return

	if old_event != null:
		InputMap.action_erase_event(action, old_event)
	else:
		# Clear existing events for full rebind
		InputMap.action_erase_events(action)

	InputMap.action_add_event(action, new_event)

	# Store in custom bindings
	var events: Array = InputMap.action_get_events(action)
	settings.rebind_action(action, events)
	save_settings()


## Reset an action to its default binding from project.godot.
## Note: Godot 4 does not store default bindings separately, so this reloads the project.
func reset_action(action: String) -> void:
	# Clear custom binding so defaults are used on next project load
	if settings.custom_bindings.has(action):
		settings.custom_bindings.erase(action)
		save_settings()


# ============================================================
# Public API — Settings accessors
# ============================================================

func set_stick_deadzone(value: float) -> void:
	settings.stick_deadzone = value
	_apply_deadzones()
	save_settings()


func set_trigger_deadzone(value: float) -> void:
	settings.trigger_deadzone = value
	_apply_deadzones()
	save_settings()


func set_mouse_sensitivity(value: float) -> void:
	settings.mouse_sensitivity = value
	save_settings()


func set_invert_y(value: bool) -> void:
	settings.invert_y = value
	save_settings()


func set_hide_toggle_mode(value: bool) -> void:
	settings.hide_toggle_mode = value
	save_settings()


func set_hold_breath_toggle_mode(value: bool) -> void:
	settings.hold_breath_toggle_mode = value
	save_settings()


func set_left_handed_mode(value: bool) -> void:
	settings.left_handed_mode = value
	save_settings()


func set_input_buffer_ms(value: int) -> void:
	settings.input_buffer_ms = value
	buffer._buffer_ms = float(value)
	save_settings()
