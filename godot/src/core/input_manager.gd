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
signal device_changed(new_device: int)
signal bindings_changed

var settings: ControlSettings
var buffer: InputBuffer

# --- Mode state ---
var _mode: ControlEnums.ControlMode = ControlEnums.ControlMode.EXPLORE
var _previous_mode: ControlEnums.ControlMode = ControlEnums.ControlMode.EXPLORE

# --- Hold state tracking ---
# Motion holds track the previous threshold crossing separately, so an
# already-latched toggle can still flip on the next press.
var _motion_held_state: Dictionary = {}
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

# --- Default bindings cache ---
var _default_bindings: Dictionary = {}

# --- Constants ---
const HOLD_ACTIONS: Array[String] = ["record", "hide", "hold_breath", "fine_tune"]
const PRESS_ACTIONS: Array[String] = ["interact", "play_tape", "band_prev", "band_next", "band_cycle", "pause", "skip_call"]
const BAND_KEY_START: int = 49   # KEY_1
const BAND_KEY_END: int = 56     # KEY_8
const SETTINGS_PATH: String = "user://control_settings.cfg"
const CONTROLS_PATH: String = "user://controls.cfg"
## Where rebind/reset persistence writes. Tests redirect this so the suite
## never touches a player's real bindings file.
var controls_path: String = CONTROLS_PATH
## Where general preference persistence writes; tests redirect this too, so
## preference setters (deadzone, toggle modes, ...) stay off the player's
## real settings file during the suite.
var settings_path: String = SETTINGS_PATH


func _ready() -> void:
	# Keep receiving input while the tree is paused so device switches made
	# in the paused Controls screen still update glyphs (DEA-191). Action
	# handling below is explicitly skipped while paused.
	process_mode = Node.PROCESS_MODE_ALWAYS
	settings = ControlSettings.new()
	buffer = InputBuffer.new(settings.input_buffer_ms)
	_cache_default_bindings()
	_load_settings()
	load_controls()
	_apply_deadzones()
	_init_hold_states()


func _cache_default_bindings() -> void:
	_default_bindings.clear()
	for action in InputMap.get_actions():
		var events: Array = []
		for ev in InputMap.action_get_events(action):
			events.append(ev.duplicate(true))
		_default_bindings[action] = events


# ============================================================
# Settings
# ============================================================

func _load_settings() -> void:
	var err: Error = settings.load_from_config(settings_path)
	if err != OK:
		# Use defaults — save them for next time
		settings.save_to_config(settings_path)
	buffer._buffer_ms = float(settings.input_buffer_ms)


func save_settings() -> void:
	settings.save_to_config(settings_path)
	_apply_deadzones()
	buffer._buffer_ms = float(settings.input_buffer_ms)


func save_controls(path: String = "") -> Error:
	if path.is_empty():
		path = controls_path
	var err: Error = settings.save_to_config(path)
	save_settings()
	return err


func load_controls(path: String = "") -> Error:
	if path.is_empty():
		path = controls_path
	# Bindings only: general preferences live in control_settings.cfg and must
	# not be clobbered by stale values carried in the bindings file.
	var err: Error = settings.load_bindings_from_config(path)
	if err == OK and not settings.custom_bindings.is_empty():
		for action in settings.custom_bindings.keys():
			if not InputMap.has_action(action):
				continue
			InputMap.action_erase_events(action)
			for ev in settings.custom_bindings[action]:
				InputMap.action_add_event(action, ev)
		_apply_deadzones()
	return err


func _apply_deadzones() -> void:
	# Apply deadzone to all joypad motion actions in the InputMap.
	# Deadzone lives on the action, not the event — InputEventJoypadMotion
	# rejects a per-event assignment in Godot 4.7.
	var motion_actions: Array[String] = [
		"move_left", "move_right", "move_up", "move_down",
		"radio_tune_left", "radio_tune_right",
		"fine_tune", "hold_breath", "sprint"
	]
	for action_name in motion_actions:
		if not InputMap.has_action(action_name):
			continue
		var is_trigger := false
		for event in InputMap.action_get_events(action_name):
			if event is InputEventJoypadMotion and event.axis >= 4:
				is_trigger = true
				break
		var deadzone: float = settings.trigger_deadzone if is_trigger else settings.stick_deadzone
		InputMap.action_set_deadzone(action_name, deadzone)


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
	set_device_from_event(event)

	# While paused only device tracking runs — no tuning, band keys or
	# action processing (the pre-PROCESS_MODE_ALWAYS behaviour). Release
	# events still clear tracked holds, or a fine tune held when the pause
	# opened survives the pause as a stuck half-speed tuning multiplier.
	if get_tree().paused:
		if event is InputEventJoypadMotion:
			_clear_paused_motion_holds(event)
		elif (event is InputEventKey or event is InputEventJoypadButton or event is InputEventMouseButton) and not event.pressed:
			_clear_paused_press_holds(event)
		return

	# Handle mouse motion for radio tuning
	if event is InputEventMouseMotion:
		_handle_mouse_motion(event)

	# Handle number keys band selection (1-8)
	if event is InputEventKey and event.pressed and not event.echo:
		_handle_band_keys(event)

	# Process hold/toggle actions (mouse buttons are bindable since DEA-191)
	if event is InputEventJoypadButton or event is InputEventKey or event is InputEventMouseButton:
		_process_hold_events(event)
	# Hold actions bound to stick/trigger motion (e.g. the default L2 fine
	# tune) never reach _process_hold_events, so motion gets its own dispatch.
	elif event is InputEventJoypadMotion:
		_process_hold_motion(event)


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
			# Hold mode: deactivate on release — unless another bound source
			# (e.g. the keyboard key while a trigger was released) still holds
			# the action.
			if not Input.is_action_pressed(action):
				_hold_active[action] = false
				_hold_start_time[action] = 0.0
				action_triggered.emit(action, ControlEnums.ActionType.HOLD)


## Hold/toggle handling for motion-bound actions (stick or trigger, e.g. the
## default L2 fine tune). "Press" is the axis crossing the action's deadzone
## in the bound direction; "release" is crossing back under it — the neutral
## position carries no direction, so the hold is recomputed from the value
## instead of matched against the binding's sign. Toggles flip on every
## released-to-pressed crossing; the previous crossing state is tracked
## separately from the latched toggle, which stays on past the release.
func _process_hold_motion(event: InputEventJoypadMotion) -> void:
	for action in HOLD_ACTIONS:
		if not InputMap.has_action(action):
			continue
		if not _is_action_active_in_mode(action):
			continue
		var deadzone: float = InputMap.action_get_deadzone(action)
		var is_toggle: bool = _is_toggle_action(action)
		for ev in InputMap.action_get_events(action):
			if not (ev is InputEventJoypadMotion):
				continue
			var binding := ev as InputEventJoypadMotion
			if binding.axis != event.axis or binding.axis_value == 0.0:
				continue
			var held: bool = event.axis_value >= deadzone if binding.axis_value > 0.0 else event.axis_value <= -deadzone
			var was_held: bool = _motion_held_state.get(action, false)
			_motion_held_state[action] = held
			if held and not was_held:
				if is_toggle:
					_toggle_state[action] = not _toggle_state[action]
					_hold_active[action] = _toggle_state[action]
					_hold_start_time[action] = Time.get_ticks_msec() if _hold_active[action] else 0.0
				else:
					_hold_active[action] = true
					_hold_start_time[action] = Time.get_ticks_msec()
				action_triggered.emit(action, ControlEnums.ActionType.HOLD)
			elif not held and _hold_active[action] and not is_toggle and not Input.is_action_pressed(action):
				_hold_active[action] = false
				_hold_start_time[action] = 0.0
				action_triggered.emit(action, ControlEnums.ActionType.HOLD)


## Release events during pause: clear tracked non-toggle holds whose binding
## went up while the tree was paused, without dispatching gameplay actions.
func _clear_paused_motion_holds(event: InputEventJoypadMotion) -> void:
	for action in HOLD_ACTIONS:
		if not _hold_active.get(action, false) or _is_toggle_action(action):
			continue
		var deadzone: float = InputMap.action_get_deadzone(action)
		for ev in InputMap.action_get_events(action):
			if ev is InputEventJoypadMotion and (ev as InputEventJoypadMotion).axis == event.axis:
				if abs(event.axis_value) < deadzone:
					_hold_active[action] = false
					_hold_start_time[action] = 0.0
					# Reset the crossing state too, or the first squeeze
					# after resuming looks like a held trigger and is
					# ignored as a repeat rather than a new press.
					_motion_held_state[action] = false
				break


func _clear_paused_press_holds(event: InputEvent) -> void:
	for action in HOLD_ACTIONS:
		if not _hold_active.get(action, false) or _is_toggle_action(action):
			continue
		for ev in InputMap.action_get_events(action):
			if _event_triggers_binding(ev, event):
				_hold_active[action] = false
				_hold_start_time[action] = 0.0
				break


func _is_action_event(event: InputEvent, action: String) -> bool:
	for ev in InputMap.action_get_events(action):
		if _event_triggers_binding(ev, event):
			return true
	return false


## Dispatch predicate: does `event` trigger `binding` the way Godot's own
## action matching does? A key binding fires while every modifier it requires
## is held — extra modifiers on the input are ignored — and a key release
## matches on the main key alone, so a hold ends no matter in which order
## keys and modifiers come up. Non-key events match exactly.
func _event_triggers_binding(binding: InputEvent, event: InputEvent) -> bool:
	if binding is InputEventKey and event is InputEventKey:
		var key_binding := binding as InputEventKey
		var key_event := event as InputEventKey
		# Compare the field the binding selects: logical keycode for logical
		# bindings, physical_keycode for physical-only ones (an AZERTY press
		# of the Q position carries keycode A + physical Q).
		var same_key: bool = false
		if key_binding.keycode != 0:
			same_key = key_event.keycode == key_binding.keycode
		else:
			same_key = key_event.physical_keycode == key_binding.physical_keycode
		if not same_key:
			return false
		if not key_event.pressed:
			return true
		return (
			(not key_binding.ctrl_pressed or key_event.ctrl_pressed)
			and (not key_binding.shift_pressed or key_event.shift_pressed)
			and (not key_binding.alt_pressed or key_event.alt_pressed)
			and (not key_binding.meta_pressed or key_event.meta_pressed)
		)
	if binding is InputEventJoypadButton and event is InputEventJoypadButton:
		return (binding as InputEventJoypadButton).button_index == (event as InputEventJoypadButton).button_index
	if binding is InputEventJoypadMotion and event is InputEventJoypadMotion:
		var motion_binding := binding as InputEventJoypadMotion
		var motion_event := event as InputEventJoypadMotion
		return motion_binding.axis == motion_event.axis and sign(motion_binding.axis_value) == sign(motion_event.axis_value)
	if binding is InputEventMouseButton and event is InputEventMouseButton:
		return (binding as InputEventMouseButton).button_index == (event as InputEventMouseButton).button_index
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
	if get_tree().paused:
		return
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
		tune *= 0.5  # Fine tune = 50% speed (GDD: sensitivity ×0.5)

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


func _set_device(new_device: ControlEnums.DeviceType) -> void:
	if _last_device != new_device:
		_last_device = new_device
		device_changed.emit(_last_device)


func set_device(device: ControlEnums.DeviceType) -> void:
	_set_device(device)


## Update device tracking from a raw input event — the same classification
## _input uses. The remap screen calls this for events it consumes before
## InputManager ever sees them, so the glyphs refresh with the device that
## produced the binding.
func set_device_from_event(event: InputEvent) -> void:
	if event is InputEventKey or event is InputEventMouseButton or event is InputEventMouseMotion:
		_set_device(ControlEnums.DeviceType.KEYBOARD)
	elif event is InputEventJoypadButton or event is InputEventJoypadMotion:
		var joy_name := Input.get_joy_name(event.device).to_lower()
		if "ps" in joy_name or "playstation" in joy_name or "dualshock" in joy_name or "dualsense" in joy_name or "sony" in joy_name:
			_set_device(ControlEnums.DeviceType.PLAYSTATION)
		else:
			_set_device(ControlEnums.DeviceType.XBOX)


## Get the last-used input device type.
func get_last_device() -> ControlEnums.DeviceType:
	return _last_device


## Check if the last-used device was a gamepad.
func is_gamepad_active() -> bool:
	return _last_device != ControlEnums.DeviceType.KEYBOARD


# ============================================================
# Public API — Remapping
# ============================================================

## Rebind an action to a new input event. Updates the InputMap and saves to settings/controls.cfg.
func rebind_action(action: String, new_event: InputEvent, old_event: InputEvent = null) -> void:
	if not InputMap.has_action(action):
		return

	if old_event != null:
		InputMap.action_erase_event(action, old_event)
	else:
		# Replace matching device category (keyboard/mouse vs gamepad)
		var is_gamepad_new: bool = (new_event is InputEventJoypadButton or new_event is InputEventJoypadMotion)
		for ev in InputMap.action_get_events(action):
			var is_gamepad_ev: bool = (ev is InputEventJoypadButton or ev is InputEventJoypadMotion)
			if is_gamepad_new == is_gamepad_ev:
				InputMap.action_erase_event(action, ev)

	InputMap.action_add_event(action, new_event)

	# Store in custom bindings
	var events: Array = InputMap.action_get_events(action)
	settings.rebind_action(action, events)
	save_controls()
	_apply_deadzones()
	bindings_changed.emit()


## Reset an action to its default binding from project.godot.
func reset_action(action: String) -> void:
	if not InputMap.has_action(action):
		return
	if _default_bindings.has(action):
		InputMap.action_erase_events(action)
		for ev in _default_bindings[action]:
			InputMap.action_add_event(action, (ev as InputEvent).duplicate(true))
	if settings.custom_bindings.has(action):
		settings.custom_bindings.erase(action)
	save_controls()
	_apply_deadzones()
	bindings_changed.emit()


## Reset all actions to default bindings.
func reset_all_actions() -> void:
	for action in _default_bindings.keys():
		if InputMap.has_action(action):
			InputMap.action_erase_events(action)
			for ev in _default_bindings[action]:
				InputMap.action_add_event(action, (ev as InputEvent).duplicate(true))
	settings.custom_bindings.clear()
	save_controls()
	_apply_deadzones()
	bindings_changed.emit()


## Remove an input event from an action (conflict resolution) and persist the
## result. The action's unrelated bindings are preserved.
func remove_conflicting_event(action: String, event: InputEvent) -> void:
	if not InputMap.has_action(action):
		return
	for ev in InputMap.action_get_events(action):
		if event_overlaps_binding(ev, event):
			InputMap.action_erase_event(action, ev)
			break
	var remaining: Array = InputMap.action_get_events(action)
	# An action whose last binding was taken away stays explicitly unbound:
	# persist an empty override so the default cannot return on restart.
	settings.rebind_action(action, remaining)
	save_controls()
	_apply_deadzones()
	bindings_changed.emit()


## Conflict predicate: can some physical input trigger both? Godot fires a
## plain-key binding even with extra modifiers held, so any two bindings on
## the same main key share a trigger and overlap. Non-key events overlap only
## on the exact button/axis.
static func event_overlaps_binding(binding: InputEvent, event: InputEvent) -> bool:
	if binding is InputEventKey and event is InputEventKey:
		# Same field-consistent comparison as _event_triggers_binding.
		if (binding as InputEventKey).keycode != 0:
			return (event as InputEventKey).keycode == (binding as InputEventKey).keycode
		return (event as InputEventKey).physical_keycode == (binding as InputEventKey).physical_keycode
	if binding is InputEventJoypadButton and event is InputEventJoypadButton:
		return (binding as InputEventJoypadButton).button_index == (event as InputEventJoypadButton).button_index
	if binding is InputEventJoypadMotion and event is InputEventJoypadMotion:
		var m1: InputEventJoypadMotion = binding as InputEventJoypadMotion
		var m2: InputEventJoypadMotion = event as InputEventJoypadMotion
		return m1.axis == m2.axis and sign(m1.axis_value) == sign(m2.axis_value)
	if binding is InputEventMouseButton and event is InputEventMouseButton:
		return (binding as InputEventMouseButton).button_index == (event as InputEventMouseButton).button_index
	return false


## Detect conflicting actions already using candidate_event.
func detect_conflicts(action: String, candidate_event: InputEvent) -> Array[String]:
	var conflicts: Array[String] = []
	for act in InputMap.get_actions():
		if act == action or act.begins_with("ui_"):
			continue
		for ev in InputMap.action_get_events(act):
			if event_overlaps_binding(ev, candidate_event):
				if not conflicts.has(act):
					conflicts.append(act)
	return conflicts


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
