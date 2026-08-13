## night_transition.gd — Fade-to-black transition with "Night N" display.
## Sequence: fade to black (2s) → hold "Night N" text (3s) → fade in (2s) → signal.
class_name NightTransition
extends CanvasLayer

signal transition_complete

const FADE_OUT_DURATION: float = 2.0
const HOLD_DURATION: float = 3.0
const FADE_IN_DURATION: float = 2.0

var _overlay: ColorRect
var _night_label: Label
var _is_transitioning: bool = false


func _ready() -> void:
	layer = 90

	# Full-screen black overlay (starts transparent)
	_overlay = ColorRect.new()
	_overlay.color = Color(0, 0, 0, 0)
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_overlay)

	# Night label (hidden initially)
	_night_label = Label.new()
	_night_label.text = ""
	_night_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_night_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_night_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_night_label.visible = false
	CRTText.style_phosphor_green(_night_label, 64)
	add_child(_night_label)


func start_transition(night_number: int) -> void:
	if _is_transitioning:
		return
	_is_transitioning = true
	_night_label.text = "Night %d" % night_number
	_overlay.mouse_filter = Control.MOUSE_FILTER_STOP

	# Phase 1: Fade to black
	var tween := create_tween()
	tween.tween_property(_overlay, "color:a", 1.0, FADE_OUT_DURATION)
	tween.tween_callback(_show_night_label)
	# Phase 2: Hold
	tween.tween_interval(HOLD_DURATION)
	# Phase 3: Fade in
	tween.tween_callback(_hide_night_label)
	tween.tween_property(_overlay, "color:a", 0.0, FADE_IN_DURATION)
	tween.tween_callback(_on_transition_done)


func _show_night_label() -> void:
	_night_label.visible = true


func _hide_night_label() -> void:
	_night_label.visible = false


func _on_transition_done() -> void:
	_is_transitioning = false
	_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	transition_complete.emit()
