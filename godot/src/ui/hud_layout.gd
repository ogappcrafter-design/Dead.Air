# hud_layout.gd — Diegetic CRT HUD layout for Deadair.
# DEA-108: Diegetic CRT HUD
# All UI is rendered through the CRT shader as part of the game world.
# Source: GDD UI spec (docs/plans/redesign-gdd.md lines 1451-1510)
#
# This Control builds all HUD elements programmatically and wires them
# to the core game systems. CRT shader integration (DEA-107) is a thin
# layer applied on top later — this file handles data + layout only.
class_name HUDLayout
extends Control

## --- Data bindings (set in editor or via code) ---

@export var radio_tuner: RadioTuner
@export var signal_strength: SignalStrength
@export var dread_composure: DreadComposure
@export var tape_inventory: Node  ## No class_name; uses duck-typed methods.

## Max tapes for the counter display. GDD says ~8-10 total.
const MAX_TAPES: int = 10

## Clock update interval (seconds).
const CLOCK_UPDATE_INTERVAL: float = 1.0

## Pulsate speed for low composure warning (radians/sec).
const PULSATE_SPEED: float = 6.0

## Breathing indicator pulse speed (radians/sec).
const BREATHING_SPEED: float = 2.0

## Composure threshold for text corruption.
const CORRUPTION_THRESHOLD: float = 30.0

## --- Internal UI components ---

# Meters
var _signal_bar: ProgressBar
var _composure_bar: ProgressBar
var _dread_bar: ProgressBar

# Band display (top-left)
var _band_name_label: Label
var _freq_label: Label

# Call text (center-bottom)
var _call_text_label: Label
var _subtitle_label: Label

# Tape counter (bottom-right)
var _tape_counter_label: Label
var _is_recording: bool = false
var _tape_flash_timer: float = 0.0

# Clock (top-right)
var _clock_label: Label
var _clock_timer: float = 0.0

# Control hints (bottom)
var _control_hints_label: Label

# Breathing indicator (hide mode)
var _breathing_overlay: ColorRect
var _breathing_intensity: float = 0.0

# Vignette overlay (hide mode)
var _vignette_overlay: ColorRect

# Hide mode state
var _is_hide_mode: bool = false

# Saved meter offsets for hide mode restoration.
var _signal_bar_offset_top: float = 0.0
var _signal_bar_offset_bottom: float = 0.0
var _composure_bar_offset_top: float = 0.0
var _composure_bar_offset_bottom: float = 0.0

# Corruption seed for deterministic-ish corruption
var _corruption_rng: int = 0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_build_ui()
	_connect_signals()
	_update_all()
	_check_hide_mode()


func _build_ui() -> void:
	# --- Signal meter (vertical, LEFT edge, phosphor green) ---
	_signal_bar = ProgressBar.new()
	_signal_bar.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	_signal_bar.anchors_preset = Control.PRESET_LEFT_WIDE
	_signal_bar.anchor_left = 0.0
	_signal_bar.anchor_right = 0.0
	_signal_bar.anchor_top = 0.0
	_signal_bar.anchor_bottom = 1.0
	_signal_bar.offset_left = 8.0
	_signal_bar.offset_top = 40.0
	_signal_bar.offset_right = 24.0
	_signal_bar.offset_bottom = -60.0
	_signal_bar.min_value = 0.0
	_signal_bar.max_value = 100.0
	_signal_bar.show_percentage = false
	_signal_bar.vertical = true
	_signal_bar.fill_mode = ProgressBar.FILL_BEGIN_TO_END
	_signal_bar.modulate = CRTText.PHOSPHOR_GREEN
	_signal_bar_offset_top = _signal_bar.offset_top
	_signal_bar_offset_bottom = _signal_bar.offset_bottom
	add_child(_signal_bar)

	# --- Composure meter (vertical, RIGHT edge, amber) ---
	_composure_bar = ProgressBar.new()
	_composure_bar.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	_composure_bar.anchor_left = 1.0
	_composure_bar.anchor_right = 1.0
	_composure_bar.anchor_top = 0.0
	_composure_bar.anchor_bottom = 1.0
	_composure_bar.offset_left = -24.0
	_composure_bar.offset_top = 40.0
	_composure_bar.offset_right = -8.0
	_composure_bar.offset_bottom = -60.0
	_composure_bar.min_value = 0.0
	_composure_bar.max_value = 100.0
	_composure_bar.show_percentage = false
	_composure_bar.vertical = true
	_composure_bar.modulate = CRTText.AMBER
	_composure_bar_offset_top = _composure_bar.offset_top
	_composure_bar_offset_bottom = _composure_bar.offset_bottom
	add_child(_composure_bar)

	# --- Dread meter (horizontal, BOTTOM edge, blood red) ---
	_dread_bar = ProgressBar.new()
	_dread_bar.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_dread_bar.anchor_left = 0.0
	_dread_bar.anchor_right = 1.0
	_dread_bar.anchor_top = 1.0
	_dread_bar.anchor_bottom = 1.0
	_dread_bar.offset_left = 30.0
	_dread_bar.offset_top = -24.0
	_dread_bar.offset_right = -30.0
	_dread_bar.offset_bottom = -8.0
	_dread_bar.min_value = 0.0
	_dread_bar.max_value = 100.0
	_dread_bar.show_percentage = false
	_dread_bar.modulate = CRTText.BLOOD_RED
	_dread_bar.visible = false
	add_child(_dread_bar)

	# --- Band display (top-LEFT, band name + frequency) ---
	var band_container := VBoxContainer.new()
	band_container.anchor_left = 0.0
	band_container.anchor_right = 0.4
	band_container.anchor_top = 0.0
	band_container.anchor_bottom = 0.0
	band_container.offset_left = 30.0
	band_container.offset_top = 8.0
	band_container.offset_right = 0.0
	band_container.offset_bottom = 36.0
	band_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(band_container)

	_band_name_label = Label.new()
	_band_name_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_band_name_label.add_theme_font_size_override("font_size", 16)
	band_container.add_child(_band_name_label)

	_freq_label = Label.new()
	_freq_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_freq_label.add_theme_font_size_override("font_size", 14)
	band_container.add_child(_freq_label)

	# --- Clock (top-RIGHT, 24h, only Phase 1) ---
	_clock_label = Label.new()
	_clock_label.anchor_left = 1.0
	_clock_label.anchor_right = 1.0
	_clock_label.anchor_top = 0.0
	_clock_label.anchor_bottom = 0.0
	_clock_label.offset_left = -80.0
	_clock_label.offset_top = 8.0
	_clock_label.offset_right = -10.0
	_clock_label.offset_bottom = 30.0
	_clock_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_clock_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_clock_label.add_theme_font_size_override("font_size", 14)
	_clock_label.text = "--:--"
	add_child(_clock_label)

	# --- Call text (center-bottom, caller ID + subtitles) ---
	var call_container := VBoxContainer.new()
	call_container.anchor_left = 0.2
	call_container.anchor_right = 0.8
	call_container.anchor_top = 1.0
	call_container.anchor_bottom = 1.0
	call_container.offset_left = 0.0
	call_container.offset_top = -80.0
	call_container.offset_right = 0.0
	call_container.offset_bottom = -50.0
	call_container.alignment = BoxContainer.ALIGNMENT_CENTER
	call_container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(call_container)

	_call_text_label = Label.new()
	_call_text_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_call_text_label.add_theme_color_override("font_color", CRTText.AMBER)
	_call_text_label.add_theme_font_size_override("font_size", 14)
	call_container.add_child(_call_text_label)

	_subtitle_label = Label.new()
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_subtitle_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_subtitle_label.add_theme_font_size_override("font_size", 12)
	call_container.add_child(_subtitle_label)

	# --- Tape counter (bottom-RIGHT) ---
	_tape_counter_label = Label.new()
	_tape_counter_label.anchor_left = 1.0
	_tape_counter_label.anchor_right = 1.0
	_tape_counter_label.anchor_top = 1.0
	_tape_counter_label.anchor_bottom = 1.0
	_tape_counter_label.offset_left = -100.0
	_tape_counter_label.offset_top = -40.0
	_tape_counter_label.offset_right = -10.0
	_tape_counter_label.offset_bottom = -28.0
	_tape_counter_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_tape_counter_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_tape_counter_label.add_theme_font_size_override("font_size", 12)
	_tape_counter_label.text = "0/%d" % MAX_TAPES
	add_child(_tape_counter_label)

	# --- Control hints (bottom center) ---
	_control_hints_label = Label.new()
	_control_hints_label.anchor_left = 0.0
	_control_hints_label.anchor_right = 1.0
	_control_hints_label.anchor_top = 1.0
	_control_hints_label.anchor_bottom = 1.0
	_control_hints_label.offset_left = 0.0
	_control_hints_label.offset_top = -22.0
	_control_hints_label.offset_right = 0.0
	_control_hints_label.offset_bottom = -4.0
	_control_hints_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_control_hints_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	_control_hints_label.add_theme_font_size_override("font_size", 10)
	_control_hints_label.text = "[L-Stick: Tune]  [Y: Record]  [X: Play]  [A: Interact]"
	add_child(_control_hints_label)

	# --- Breathing overlay (hide mode only, screen-edge pulse) ---
	_breathing_overlay = ColorRect.new()
	_breathing_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_breathing_overlay.color = Color(0.0, 0.0, 0.0, 0.0)
	_breathing_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_breathing_overlay.visible = false
	add_child(_breathing_overlay)

	# --- Vignette overlay (hide mode, +20% darkening) ---
	_vignette_overlay = ColorRect.new()
	_vignette_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_vignette_overlay.color = Color(0.0, 0.0, 0.0, 0.0)
	_vignette_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vignette_overlay.visible = false
	add_child(_vignette_overlay)


## Connect signals from core systems to HUD handlers.
func _connect_signals() -> void:
	if radio_tuner != null:
		radio_tuner.frequency_changed.connect(_on_frequency_changed)
		radio_tuner.band_changed.connect(_on_band_changed)
		radio_tuner.signal_changed.connect(_on_signal_changed)

	if signal_strength != null:
		signal_strength.signal_changed.connect(_on_signal_strength_changed)

	if dread_composure != null:
		dread_composure.dread_changed.connect(_on_dread_changed)
		dread_composure.composure_changed.connect(_on_composure_changed)

	if tape_inventory != null:
		if tape_inventory.has_signal("tape_collected"):
			tape_inventory.tape_collected.connect(_on_tape_collected)
		if tape_inventory.has_signal("tape_consumed"):
			tape_inventory.tape_consumed.connect(_on_tape_consumed)

	# PhaseManager is an autoload — connect mode change.
	var pm := _get_phase_manager()
	if pm != null:
		if pm.has_signal("mode_context_changed"):
			pm.mode_context_changed.connect(_on_mode_context_changed)
		if pm.has_signal("phase_changed"):
			pm.phase_changed.connect(_on_phase_changed)


## Get PhaseManager autoload from the scene tree.
func _get_phase_manager() -> Node:
	return get_node_or_null("/root/PhaseManager")


# --- Signal handlers ---

func _on_frequency_changed(freq: float) -> void:
	_update_frequency_display(freq)


func _on_band_changed(_band_id: int) -> void:
	_update_band_display()


func _on_signal_changed(signal_value: float) -> void:
	_signal_bar.value = signal_value


func _on_signal_strength_changed(signal_value: float) -> void:
	_signal_bar.value = signal_value


func _on_dread_changed(dread: float) -> void:
	_dread_bar.value = dread
	_dread_bar.visible = dread > 0.0 and not _is_hide_mode


func _on_composure_changed(composure: float) -> void:
	_composure_bar.value = composure


func _on_tape_collected(_tape_id) -> void:
	_update_tape_counter()


func _on_tape_consumed(_tape_id) -> void:
	_update_tape_counter()


func _on_mode_context_changed(_old_mode: int, new_mode: int) -> void:
	_is_hide_mode = (new_mode == PhaseEnums.ModeContext.HIDE)
	_apply_hide_mode()


func _on_phase_changed(_old_phase: int, new_phase: int) -> void:
	_update_clock_visibility(new_phase)


# --- Update helpers ---

## Pull current values from all systems and refresh the HUD.
func _update_all() -> void:
	if radio_tuner != null:
		_update_band_display()
		_update_frequency_display(radio_tuner.current_frequency)
		_signal_bar.value = radio_tuner.get_signal()

	if signal_strength != null:
		_signal_bar.value = signal_strength.signal_value

	if dread_composure != null:
		_composure_bar.value = dread_composure.composure
		_dread_bar.value = dread_composure.dread
		_dread_bar.visible = dread_composure.dread > 0.0 and not _is_hide_mode

	_update_tape_counter()

	var pm := _get_phase_manager()
	if pm != null:
		_update_clock_visibility(pm.get_phase())
		_is_hide_mode = (pm.get_mode() == PhaseEnums.ModeContext.HIDE)
		_apply_hide_mode()


func _update_band_display() -> void:
	if radio_tuner == null:
		return
	var band: BandData = radio_tuner.get_current_band()
	if band != null:
		var band_name: String = _corrupt_text(band.name)
		_band_name_label.text = band_name
		_band_name_label.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)


func _update_frequency_display(freq: float) -> void:
	var freq_text: String = "%.1f MHz" % freq
	_freq_label.text = _corrupt_text(freq_text)


func _update_tape_counter() -> void:
	if tape_inventory == null:
		_tape_counter_label.text = "0/%d" % MAX_TAPES
		return
	var collected: int = tape_inventory.get_collected_count()
	_tape_counter_label.text = "%d/%d" % [collected, MAX_TAPES]


func _update_clock_visibility(phase: int) -> void:
	# Clock only visible in Phase 1 (Station).
	_clock_label.visible = (phase == PhaseEnums.Phase.PHASE_1_STATION) and not _is_hide_mode


func _update_clock() -> void:
	var time := Time.get_time_dict_from_system()
	var hours: int = time["hour"]
	var minutes: int = time["minute"]
	_clock_label.text = "%02d:%02d" % [hours, minutes]


## Apply text corruption based on current composure.
func _corrupt_text(text: String) -> String:
	if dread_composure == null:
		return text
	return CRTText.corrupt_text(text, dread_composure.composure)


## Check and set hide mode state.
func _check_hide_mode() -> void:
	var pm := _get_phase_manager()
	if pm != null:
		_is_hide_mode = (pm.get_mode() == PhaseEnums.ModeContext.HIDE)
		_apply_hide_mode()


## Apply hide mode: contract UI to tiny signal+composure meters only.
func _apply_hide_mode() -> void:
	if _is_hide_mode:
		# Hide all non-essential UI.
		_band_name_label.visible = false
		_freq_label.visible = false
		_call_text_label.visible = false
		_subtitle_label.visible = false
		_tape_counter_label.visible = false
		_clock_label.visible = false
		_control_hints_label.visible = false
		_dread_bar.visible = false

		# Shrink signal and composure meters to tiny dimensions.
		_signal_bar.offset_top = 200.0
		_signal_bar.offset_bottom = -200.0
		_composure_bar.offset_top = 200.0
		_composure_bar.offset_bottom = -200.0

		# Show breathing + vignette.
		_breathing_overlay.visible = true
		_vignette_overlay.visible = true
		_vignette_overlay.color = Color(0.0, 0.0, 0.0, 0.2)
	else:
		# Restore all UI.
		_band_name_label.visible = true
		_freq_label.visible = true
		_call_text_label.visible = true
		_subtitle_label.visible = true
		_tape_counter_label.visible = true
		_control_hints_label.visible = true

		# Restore meter dimensions.
		_signal_bar.offset_top = _signal_bar_offset_top
		_signal_bar.offset_bottom = _signal_bar_offset_bottom
		_composure_bar.offset_top = _composure_bar_offset_top
		_composure_bar.offset_bottom = _composure_bar_offset_bottom

		# Clock visibility depends on phase.
		var pm := _get_phase_manager()
		if pm != null:
			_update_clock_visibility(pm.get_phase())
		else:
			_clock_label.visible = true

		# Dread bar visible only when dread > 0.
		if dread_composure != null:
			_dread_bar.visible = dread_composure.dread > 0.0
		else:
			_dread_bar.visible = false

		# Hide breathing + vignette.
		_breathing_overlay.visible = false
		_vignette_overlay.visible = false


# --- Process loop ---

func _process(delta: float) -> void:
	# Clock update.
	if _clock_label.visible:
		_clock_timer += delta
		if _clock_timer >= CLOCK_UPDATE_INTERVAL:
			_clock_timer = 0.0
			_update_clock()

	# Composure pulsate when low.
	if dread_composure != null and _composure_bar.visible:
		if dread_composure.composure < CORRUPTION_THRESHOLD:
			var pulse: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.001 * PULSATE_SPEED)
			_composure_bar.modulate = CRTText.AMBER * Color(1.0, 1.0, 1.0, 0.5 + 0.5 * pulse)
		else:
			_composure_bar.modulate = CRTText.AMBER

	# Tape counter flash when recording.
	if _is_recording and not _is_hide_mode:
		_tape_flash_timer += delta
		if _tape_flash_timer >= 0.5:
			_tape_flash_timer = 0.0
			_tape_counter_label.visible = not _tape_counter_label.visible

	# Breathing indicator pulse (hide mode).
	if _is_hide_mode and _breathing_overlay.visible:
		_breathing_intensity += delta * BREATHING_SPEED
		var breath_pulse: float = 0.5 + 0.5 * sin(_breathing_intensity)
		_breathing_overlay.color = Color(0.0, 0.0, 0.0, 0.1 * breath_pulse)

	# Periodic text corruption refresh for band display.
	if dread_composure != null and dread_composure.composure < CORRUPTION_THRESHOLD:
		if radio_tuner != null:
			_corruption_rng += 1
			if _corruption_rng % 30 == 0:
				_update_band_display()
				if radio_tuner.current_frequency > 0.0:
					_update_frequency_display(radio_tuner.current_frequency)


# --- Public API ---

## Set the call text displayed in the center-bottom area.
func set_call_text(caller_id: String, call_type: String) -> void:
	var text: String = "%s — %s" % [caller_id, call_type]
	_call_text_label.text = _corrupt_text(text)


## Set the subtitle text (phosphor green, below call text).
func set_subtitle(text: String) -> void:
	_subtitle_label.text = _corrupt_text(text)


## Set recording state (tape counter flashes when true).
func set_recording(recording: bool) -> void:
	_is_recording = recording
	if not recording:
		_tape_counter_label.visible = not _is_hide_mode
		_tape_flash_timer = 0.0


## Force a full HUD refresh from all connected systems.
func refresh() -> void:
	_update_all()
