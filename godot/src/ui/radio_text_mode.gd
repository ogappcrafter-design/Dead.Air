class_name RadioTextMode
extends CanvasLayer
## DEA-88 accessibility deepening: "radio text mode" for deaf and
## hard-of-hearing players.
##
## A persistent bottom-panel transcript of everything the radio "says":
## incoming call lines, band changes, signal events (static-only calls
## render as "— static —"), and system messages. Players can scroll back
## through the transcript. Works alongside (or instead of) the subtitle
## display, which covers short one-line captions.
##
## Toggle: AccessibilityManager.radio_text_mode, persisted in
## accessibility.cfg. When enabled the panel shows; when disabled it hides
## and stops collecting (cheap: nothing renders).

signal entry_added(text: String)

## Max entries kept in the scrolling buffer.
const MAX_ENTRIES := 60
## Colors per entry kind.
const COLOR_SYSTEM := Color(0.9, 0.9, 0.9)
const COLOR_CALL := Color(0.0, 1.0, 0.255)    # phosphor green
const COLOR_BAND := Color(1.0, 0.647, 0.0)    # amber
const COLOR_STATIC := Color(0.6, 0.6, 0.6)

## Node refs.
var _panel: PanelContainer
var _scroll: ScrollContainer
var _list: VBoxContainer
var _header: Label

## State.
var enabled: bool = false
var _entry_count := 0


func _ready() -> void:
	layer = 90
	_build_ui()
	set_enabled(_load_enabled())


func _build_ui() -> void:
	_panel = PanelContainer.new()
	_panel.name = "RadioTextPanel"
	_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_panel.anchor_top = 0.62
	_panel.anchor_bottom = 0.97
	_panel.offset_left = 40.0
	_panel.offset_right = -40.0
	_panel.offset_bottom = -8.0
	_panel.mouse_filter = Control.MOUSE_FILTER_PASS

	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 12)
	margin.add_theme_constant_override("margin_right", 12)
	margin.add_theme_constant_override("margin_top", 6)
	margin.add_theme_constant_override("margin_bottom", 6)
	_panel.add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	margin.add_child(box)

	_header = Label.new()
	_header.text = "— RADIO TEXT —"
	_header.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_header.add_theme_color_override("font_color", COLOR_BAND)
	_header.add_theme_font_size_override("font_size", 13)
	box.add_child(_header)

	_scroll = ScrollContainer.new()
	_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	box.add_child(_scroll)

	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 1)
	_scroll.add_child(_list)

	add_child(_panel)
	_panel.visible = false


## Add a transcript entry. kind: "system" | "call" | "band" | "static".
func add_entry(text: String, kind: String = "system") -> void:
	if not enabled:
		return
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	label.add_theme_font_size_override("font_size", 14)
	var color := COLOR_SYSTEM
	match kind:
		"call":
			color = COLOR_CALL
		"band":
			color = COLOR_BAND
		"static":
			color = COLOR_STATIC
	label.add_theme_color_override("font_color", color)
	_list.add_child(label)
	_entry_count += 1
	entry_added.emit(text)
	# Cap the buffer.
	while _entry_count > MAX_ENTRIES and _list.get_child_count() > 0:
		var oldest := _list.get_child(0)
		_list.remove_child(oldest)
		oldest.queue_free()
		_entry_count -= 1
	# Keep scrolled to the latest.
	await get_tree().process_frame
	_scroll.scroll_vertical = int(_scroll.get_v_scroll_bar().max_value)


func add_call_lines(caller_name: String, lines: Array) -> void:
	if not enabled:
		return
	add_entry("▶ " + caller_name, "band")
	if lines.is_empty():
		add_entry("— static —", "static")
		return
	for line in lines:
		add_entry(String(line), "call")


func add_band_change(band_name: String) -> void:
	if not enabled:
		return
	add_entry("» band: " + band_name, "band")


func set_enabled(on: bool) -> void:
	enabled = on
	if _panel:
		_panel.visible = on


func is_enabled() -> bool:
	return enabled


func get_entry_count() -> int:
	return _entry_count


## Load persisted toggle from AccessibilityManager (authoritative store).
func _load_enabled() -> bool:
	var am := get_node_or_null("/root/AccessibilityManager")
	if am and "radio_text_mode" in am:
		return bool(am.radio_text_mode)
	return false


## Connect to the manager's toggle signal so runtime changes apply.
func _on_manager_toggled(on: bool) -> void:
	set_enabled(on)


func _reset_for_testing() -> void:
	for child in _list.get_children():
		_list.remove_child(child)
		child.queue_free()
	_entry_count = 0
	set_enabled(false)
