## SubtitleDisplay
## CRT green text subtitle overlay at the bottom of the screen.
## Shows call audio lines when subtitles are enabled via AccessibilityManager.
## Reference: DEA-141, GDD §Accessibility
## "All call audio subtitled (text already exists from call data)"
extends Control

# ─── Visual constants ────────────────────────────────────────────────
const PHOSPHOR_GREEN := Color(0.0, 1.0, 0.255)  # #00FF41 (from CRTText)
const BG_COLOR := Color(0.039, 0.039, 0.039, 0.7)  # Semi-transparent black
const FONT_SIZE := 18
const MAX_WIDTH_RATIO := 0.8  # Max width as fraction of screen
const BOTTOM_MARGIN := 60.0  # Pixels from bottom
const DISPLAY_DURATION := 4.0  # Seconds to show each line

# ─── State ────────────────────────────────────────────────────────────
var _label: Label = null
var _bg_panel: ColorRect = null
var _display_timer: float = 0.0
var _is_showing: bool = false

# ─── Lifecycle ────────────────────────────────────────────────────────


func _ready() -> void:
	_setup_ui()
	_connect_signals()
	_update_visibility()


func _process(delta: float) -> void:
	if _is_showing:
		_display_timer -= delta
		if _display_timer <= 0.0:
			_hide_subtitle()


# ─── UI Setup ─────────────────────────────────────────────────────────


func _setup_ui() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Background panel (optional, toggled by subtitle_bg_enabled)
	_bg_panel = ColorRect.new()
	_bg_panel.name = "SubtitleBackground"
	_bg_panel.color = BG_COLOR
	_bg_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_bg_panel.visible = false
	add_child(_bg_panel)

	# Subtitle label
	_label = Label.new()
	_label.name = "SubtitleLabel"
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label.visible = false
	# Apply CRT phosphor green styling
	_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)
	_label.add_theme_color_override("font_outline_color", Color.BLACK)
	_label.add_theme_constant_override("outline_size", 2)
	_label.add_theme_font_size_override("font_size", FONT_SIZE)
	add_child(_label)

	_layout_elements()


func _layout_elements() -> void:
	var screen_size := get_viewport_rect().size if get_viewport() else Vector2(1920, 1080)
	var max_width := screen_size.x * MAX_WIDTH_RATIO

	# Position background panel at bottom center
	_bg_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_bg_panel.position = Vector2(0, screen_size.y - BOTTOM_MARGIN - 40)
	_bg_panel.size = Vector2(screen_size.x, 40)

	# Position label at bottom center
	_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	var label_x := screen_size.x * (1.0 - MAX_WIDTH_RATIO) / 2.0
	_label.position = Vector2(label_x, screen_size.y - BOTTOM_MARGIN - 30)
	_label.size = Vector2(max_width, 30)


func _connect_signals() -> void:
	# Connect to AccessibilityManager signals
	if AccessibilityManager:
		AccessibilityManager.subtitles_toggled.connect(_on_subtitles_toggled)
		AccessibilityManager.subtitle_bg_toggled.connect(_on_subtitle_bg_toggled)

	# Connect to CallPlayer for line display
	if CallPlayer and CallPlayer.has_signal("line_displayed"):
		CallPlayer.line_displayed.connect(_on_line_displayed)


# ─── Public API ──────────────────────────────────────────────────────


## Show a subtitle line with optional caller name prefix.
func show_subtitle(text: String, caller_name: String = "") -> void:
	if not AccessibilityManager or not AccessibilityManager.subtitles_enabled:
		return

	var display_text := text
	if caller_name != "" and caller_name != "Unknown":
		display_text = "[" + caller_name + "] " + text

	_label.text = display_text
	_label.visible = true
	_bg_panel.visible = AccessibilityManager.subtitle_bg_enabled
	_is_showing = true
	_display_timer = DISPLAY_DURATION


## Hide the currently displayed subtitle.
func _hide_subtitle() -> void:
	_label.visible = false
	_bg_panel.visible = false
	_is_showing = false


## Check if a subtitle is currently displayed.
func is_showing() -> bool:
	return _is_showing


# ─── Signal handlers ─────────────────────────────────────────────────


func _on_subtitles_toggled(enabled: bool) -> void:
	if not enabled:
		_hide_subtitle()
	_update_visibility()


func _on_subtitle_bg_toggled(enabled: bool) -> void:
	if _is_showing:
		_bg_panel.visible = enabled


func _on_line_displayed(line_text: String, caller_name: String) -> void:
	show_subtitle(line_text, caller_name)


func _update_visibility() -> void:
	# The control itself is always present; individual elements toggle
	if AccessibilityManager and not AccessibilityManager.subtitles_enabled:
		_hide_subtitle()


# ─── Resize handling ─────────────────────────────────────────────────


func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED:
		_layout_elements()
