## HighContrastManager
## DEA-146: Applies high-contrast mode (UI borders + text background boxes)
## and text size scaling to UI elements.
## Created as a child of AccessibilityManager (like SubtitleDisplay / VisualAudioCues).
## Reference: DEA-146, GDD §Accessibility — "Composure effects", "Camera shake"
extends Control

# ─── Visual constants ────────────────────────────────────────────────
const BORDER_COLOR := Color(1.0, 1.0, 1.0, 0.9)  # High-contrast border
const TEXT_BG_COLOR := Color(0.0, 0.0, 0.0, 0.8)  # Text background box
const BORDER_WIDTH := 2.0  # Pixels

# Base font sizes for CRT text (matching existing UI patterns)
const BASE_FONT_SUBTITLE := 18
const BASE_FONT_HUD_LABEL := 14
const BASE_FONT_HUD_SMALL := 12
const BASE_FONT_HUD_TINY := 10
const BASE_FONT_BAND := 16

# ─── State ────────────────────────────────────────────────────────────
var _high_contrast: bool = false
var _text_scale: float = 1.0

# ─── Lifecycle ──────────────────────────────────────────────────────


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_connect_signals()
	_apply_settings()


# ─── Signal wiring ───────────────────────────────────────────────────


func _connect_signals() -> void:
	if not AccessibilityManager:
		return
	AccessibilityManager.high_contrast_toggled.connect(_on_high_contrast_toggled)
	AccessibilityManager.text_size_changed.connect(_on_text_size_changed)


# ─── Settings application ────────────────────────────────────────────


func _apply_settings() -> void:
	if not AccessibilityManager:
		return
	_high_contrast = AccessibilityManager.high_contrast_mode
	_text_scale = AccessibilityManager.get_text_size_scale()
	_apply_to_ui()


## Apply high contrast and text size to all discoverable UI elements.
func _apply_to_ui() -> void:
	var tree := get_tree()
	if tree == null:
		return
	# Walk the scene tree and style labels and panels
	_apply_to_node(tree.root)


## Recursively apply high-contrast borders and text scaling to UI nodes.
func _apply_to_node(node: Node) -> void:
	if node is Label:
		_apply_to_label(node as Label)
	elif node is ProgressBar:
		_apply_to_progress_bar(node as ProgressBar)
	elif node is Panel:
		_apply_to_panel(node as Panel)

	for child in node.get_children():
		_apply_to_node(child)


## Apply text background box and size scaling to a Label.
func _apply_to_label(label: Label) -> void:
	if _high_contrast:
		label.add_theme_color_override("font_shadow_color", TEXT_BG_COLOR)
		label.add_theme_constant_override("shadow_outline_size", 1)
		label.add_theme_constant_override("shadow_offset_x", 0)
		label.add_theme_constant_override("shadow_offset_y", 0)
		# Use outline as background box effect
		label.add_theme_color_override("font_outline_color", TEXT_BG_COLOR)
	else:
		# Remove overrides to restore default styling
		label.remove_theme_color_override("font_shadow_color")
		label.remove_theme_constant_override("shadow_outline_size")
		label.remove_theme_constant_override("shadow_offset_x")
		label.remove_theme_constant_override("shadow_offset_y")
		label.remove_theme_color_override("font_outline_color")
	# Text size scaling applies independently of high contrast mode
	var base_size := _get_base_font_size(label)
	label.add_theme_font_size_override("font_size", int(base_size * _text_scale))


## Apply border to ProgressBar (meters).
func _apply_to_progress_bar(bar: ProgressBar) -> void:
	if _high_contrast:
		# Add a visible border via modulate is not ideal; use a StyleBox override
		var style := StyleBoxFlat.new()
		style.border_color = BORDER_COLOR
		style.border_width_left = BORDER_WIDTH
		style.border_width_right = BORDER_WIDTH
		style.border_width_top = BORDER_WIDTH
		style.border_width_bottom = BORDER_WIDTH
		style.bg_color = Color(0.0, 0.0, 0.0, 0.3)
		bar.add_theme_stylebox_override("background", style)
	else:
		bar.remove_theme_stylebox_override("background")


## Apply border to Panel containers.
func _apply_to_panel(panel: Panel) -> void:
	if _high_contrast:
		var style := StyleBoxFlat.new()
		style.border_color = BORDER_COLOR
		style.border_width_left = BORDER_WIDTH
		style.border_width_right = BORDER_WIDTH
		style.border_width_top = BORDER_WIDTH
		style.border_width_bottom = BORDER_WIDTH
		style.bg_color = Color(0.0, 0.0, 0.0, 0.3)
		panel.add_theme_stylebox_override("panel", style)
	else:
		panel.remove_theme_stylebox_override("panel")


## Guess the base font size from a label's current theme override or defaults.
func _get_base_font_size(label: Label) -> int:
	# Remove any prior font_size override so we read the true theme default,
	# not a value we previously scaled.
	label.remove_theme_font_size_override("font_size")
	var current := label.get_theme_font_size("font_size")
	if current > 0:
		return current
	return BASE_FONT_HUD_LABEL


# ─── Signal handlers ─────────────────────────────────────────────────


func _on_high_contrast_toggled(enabled: bool) -> void:
	_high_contrast = enabled
	_apply_to_ui()


func _on_text_size_changed(_size: int) -> void:
	if AccessibilityManager:
		_text_scale = AccessibilityManager.get_text_size_scale()
	_apply_to_ui()
