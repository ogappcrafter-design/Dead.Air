extends Control
## SignalDecodeDisplay — UI Control for SIGNAL_DECODE calls (ARIA-9, DEA-114).
##
## Shows the sequence length as empty slots, five symbol buttons to tap,
## and a CLEAR button. When the player has entered as many symbols as the
## sequence has, the input is auto-checked:
##   match   -> slots turn green, decodedMessage shows, then decode_result(true)
##   no match -> slots turn red, "SIGNAL LOST" shows, then decode_result(false)
## Mirrors the RN reference (components/calls/SignalDecodeCall.tsx).

signal decode_result(decoded: bool)

const CRTText = preload("res://src/ui/crt_text.gd")

const SYM: Array[String] = ["◈", "◇", "◉", "◎", "◊"]
const SLOT_MIN_SIZE := Vector2(46, 46)
const SLOT_FONT_SIZE := 22
const BUTTON_SIZE := Vector2(64, 64)
const BUTTON_FONT_SIZE := 26
const SUCCESS_HOLD := 3.0
const FAILURE_HOLD := 2.0

enum Phase { HIDDEN, INPUT, SUCCESS, FAILURE }

var _sequence: Array = []
var _input: Array = []
var _phase: Phase = Phase.HIDDEN
var _hold_timer: float = 0.0
var _result_sent: bool = false

var _slots_row: HBoxContainer
var _slot_labels: Array[Label] = []
var _symbol_pad: HBoxContainer
var _message_label: Label
var _clear_button: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	visible = false
	set_process(false)


func _build_ui() -> void:
	var center := VBoxContainer.new()
	center.set_anchors_preset(Control.PRESET_CENTER)
	center.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_theme_constant_override("separation", 14)
	center.custom_minimum_size = Vector2(420, 0)
	add_child(center)

	var title := Label.new()
	title.text = "TRANSMISSION DECODE"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(title, 18)
	center.add_child(title)

	_slots_row = HBoxContainer.new()
	_slots_row.name = "SlotsRow"
	_slots_row.alignment = BoxContainer.ALIGNMENT_CENTER
	_slots_row.add_theme_constant_override("separation", 8)
	center.add_child(_slots_row)

	_message_label = Label.new()
	_message_label.name = "MessageLabel"
	_message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_message_label.custom_minimum_size = Vector2(420, 0)
	center.add_child(_message_label)

	_symbol_pad = HBoxContainer.new()
	_symbol_pad.name = "SymbolPad"
	_symbol_pad.alignment = BoxContainer.ALIGNMENT_CENTER
	_symbol_pad.add_theme_constant_override("separation", 10)
	center.add_child(_symbol_pad)

	for i in range(SYM.size()):
		var btn := Button.new()
		btn.text = SYM[i]
		btn.custom_minimum_size = BUTTON_SIZE
		btn.add_theme_font_size_override("font_size", BUTTON_FONT_SIZE)
		btn.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
		btn.pressed.connect(_on_symbol_pressed.bind(i))
		_symbol_pad.add_child(btn)

	_clear_button = Button.new()
	_clear_button.text = "CLEAR"
	_clear_button.custom_minimum_size = Vector2(120, 30)
	_clear_button.add_theme_font_size_override("font_size", 12)
	_clear_button.add_theme_color_override("font_color", Color(0.5, 0.7, 0.5))
	_clear_button.pressed.connect(_on_clear_pressed)
	center.add_child(_clear_button)


func _process(delta: float) -> void:
	if _phase != Phase.SUCCESS and _phase != Phase.FAILURE:
		return
	_hold_timer -= delta
	if _hold_timer <= 0.0 and not _result_sent:
		_result_sent = true
		decode_result.emit(_phase == Phase.SUCCESS)
		hide_display()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

func show_sequence(sequence: Array, decoded_message: String) -> void:
	_sequence = sequence
	_decoded_message = decoded_message
	_input.clear()
	_phase = Phase.INPUT if not sequence.is_empty() else Phase.HIDDEN
	_hold_timer = 0.0
	_result_sent = false
	visible = true
	_rebuild_slots()
	_symbol_pad.visible = _phase == Phase.INPUT
	_clear_button.visible = _phase == Phase.INPUT
	_message_label.text = ""


func hide_display() -> void:
	visible = false
	_phase = Phase.HIDDEN


func is_active() -> bool:
	return visible and _phase != Phase.HIDDEN


var _decoded_message: String = ""


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

func _rebuild_slots() -> void:
	for child in _slots_row.get_children():
		child.queue_free()
	_slot_labels.clear()
	for i in range(_sequence.size()):
		var slot := Label.new()
		slot.text = "·"
		slot.custom_minimum_size = SLOT_MIN_SIZE
		slot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		slot.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		slot.add_theme_font_size_override("font_size", SLOT_FONT_SIZE)
		slot.add_theme_color_override("font_color", Color(0.35, 0.45, 0.35))
		# Slot background via a PanelContainer-style border is skipped for
		# simplicity; the color change on fill is the state indicator.
		_slots_row.add_child(slot)
		_slot_labels.append(slot)


func _on_symbol_pressed(index: int) -> void:
	if _phase != Phase.INPUT or _input.size() >= _sequence.size():
		return
	_input.append(index)
	_update_slot_display()


func _on_clear_pressed() -> void:
	if _phase != Phase.INPUT:
		return
	_input.clear()
	_update_slot_display()


func _update_slot_display() -> void:
	for i in range(_slot_labels.size()):
		if i < _input.size():
			_slot_labels[i].text = SYM[_input[i]]
			var color: Color
			if _phase == Phase.FAILURE:
				color = Color(0.9, 0.2, 0.13)  # red
			elif _phase == Phase.SUCCESS:
				color = Color(0.0, 0.9, 0.25)  # green
			else:
				color = Color(1.0, 0.65, 0.0)  # amber
			_slot_labels[i].add_theme_color_override("font_color", color)
		else:
			_slot_labels[i].text = "·"
			_slot_labels[i].add_theme_color_override("font_color", Color(0.35, 0.45, 0.35))

	# Auto-check when the input is full
	if _phase == Phase.INPUT and _input.size() == _sequence.size():
		var matches := true
		for i in range(_sequence.size()):
			if _input[i] != int(_sequence[i]):
				matches = false
				break
		if matches:
			_phase = Phase.SUCCESS
			_hold_timer = SUCCESS_HOLD
			_message_label.text = _decoded_message
			CRTText.style_phosphor_green(_message_label, 18)
			_symbol_pad.visible = false
			_clear_button.visible = false
		else:
			_phase = Phase.FAILURE
			_hold_timer = FAILURE_HOLD
			_message_label.text = "SIGNAL LOST"
			CRTText.style_blood_red(_message_label, 18)
			_symbol_pad.visible = false
			_clear_button.visible = false
			# Repaint slots red
			for i2 in range(_slot_labels.size()):
				_slot_labels[i2].add_theme_color_override("font_color", Color(0.9, 0.2, 0.13))


func _reset_for_testing() -> void:
	_sequence = []
	_input.clear()
	_phase = Phase.HIDDEN
	_hold_timer = 0.0
	_result_sent = false
	visible = false
