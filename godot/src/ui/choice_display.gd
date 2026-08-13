extends Control
## ChoiceDisplay — UI Control for RIGHT_ANSWER call choice selection.
##
## Displays choice options as a vertical list. Player navigates with
## ui_up/ui_down and confirms with ui_accept or interact.

signal choice_selected(index: int)

const CRTText = preload("res://src/ui/crt_text.gd")

var _vbox: VBoxContainer = null
var _labels: Array[Label] = []
var _selected_index: int = 0
var _choices: Array = []
var _visible: bool = false

# --- Config ---
const FONT_SIZE: int = 18
const PROMPT_TEXT: String = "> SELECT RESPONSE"
const PROMPT_FONT_SIZE: int = 14


func _ready() -> void:
	_build_ui()
	visible = false
	set_process_input(false)

func _build_ui() -> void:
	# Main container
	_vbox = VBoxContainer.new()
	_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	_vbox.add_theme_constant_override("separation", 8)
	_vbox.alignment = BoxContainer.ALIGNMENT_END
	_vbox.offset_left = 40
	_vbox.offset_right = -40
	_vbox.offset_bottom = -40
	add_child(_vbox)

	# Prompt label
	var prompt_label := Label.new()
	prompt_label.text = PROMPT_TEXT
	CRTText.style_phosphor_green(prompt_label, PROMPT_FONT_SIZE)
	_vbox.add_child(prompt_label)

	# Separator
	var sep := HSeparator.new()
	_vbox.add_child(sep)

	# Choices container
	var choices_container := VBoxContainer.new()
	choices_container.name = "ChoicesContainer"
	choices_container.add_theme_constant_override("separation", 6)
	_vbox.add_child(choices_container)

	# Store reference via metadata
	_vbox.set_meta("choices_container", choices_container)

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

func show_choices(choices: Array) -> void:
	_choices = choices
	_selected_index = 0
	_populate_choices(choices)
	visible = true
	_visible = true
	set_process_input(true)
	_update_selection_highlight()

func hide_choices() -> void:
	visible = false
	_visible = false
	set_process_input(false)
	_clear_choices()

# ---------------------------------------------------------------------------
# Choice population
# ---------------------------------------------------------------------------

func _populate_choices(choices: Array) -> void:
	var container: VBoxContainer = _vbox.get_meta("choices_container")
	_clear_choices()
	_labels.clear()

	for i in range(choices.size()):
		var choice: Dictionary = choices[i]
		var label := Label.new()
		label.text = choice.get("text", "???")
		CRTText.style_phosphor_green(label, FONT_SIZE)
		container.add_child(label)
		_labels.append(label)

func _clear_choices() -> void:
	var container: VBoxContainer = _vbox.get_meta("choices_container")
	if not container:
		return
	for child in container.get_children():
		child.queue_free()
	_labels.clear()

# ---------------------------------------------------------------------------
# Input handling
# ---------------------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if not _visible:
		return

	if event.is_action_pressed("ui_up") or event.is_action_pressed("ui_left"):
		_navigate(-1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_down") or event.is_action_pressed("ui_right"):
		_navigate(1)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept") or event.is_action_pressed("interact"):
		_confirm_selection()
		get_viewport().set_input_as_handled()

func _navigate(direction: int) -> void:
	_selected_index = wrapi(_selected_index + direction, 0, _choices.size())
	_update_selection_highlight()

func _confirm_selection() -> void:
	if _selected_index >= 0 and _selected_index < _choices.size():
		choice_selected.emit(_selected_index)
		hide_choices()

# ---------------------------------------------------------------------------
# Visual feedback
# ---------------------------------------------------------------------------

func _update_selection_highlight() -> void:
	for i in range(_labels.size()):
		if i == _selected_index:
			_labels[i].text = "> " + _choices[i].get("text", "???")
			CRTText.style_amber(_labels[i], FONT_SIZE)
		else:
			_labels[i].text = "  " + _choices[i].get("text", "???")
			CRTText.style_phosphor_green(_labels[i], FONT_SIZE)
