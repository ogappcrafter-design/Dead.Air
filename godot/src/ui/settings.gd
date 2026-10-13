## settings.gd — CRT-styled settings screen for Dead Air.
## Volume sliders (driven by AccessibilityManager), subtitle and reduce-horror
## toggles, and a BACK button that returns to the main menu.
## The node tree is built in res://scenes/settings.tscn.
extends Control

const MENU_SCENE := "res://scenes/main_menu.tscn"

## AccessibilityManager volume bus keys (see VOLUME_KEYS there).
const BUS_MASTER := "master"
const BUS_RADIO := "radio"
const BUS_ROOM := "room"  # the in-game ambient bed

signal back_to_menu

@onready var _master_volume: HSlider = $Panel/VBox/MasterVolume
@onready var _radio_volume: HSlider = $Panel/VBox/RadioVolume
@onready var _ambient_volume: HSlider = $Panel/VBox/AmbientVolume
@onready var _subtitles_toggle: CheckButton = $Panel/VBox/SubtitlesToggle
@onready var _reduce_horror_toggle: CheckButton = $Panel/VBox/ReduceHorrorToggle
@onready var _back_button: Button = $Panel/VBox/BackButton


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_master_volume.value_changed.connect(_on_master_volume_changed)
	_radio_volume.value_changed.connect(_on_radio_volume_changed)
	_ambient_volume.value_changed.connect(_on_ambient_volume_changed)
	_subtitles_toggle.toggled.connect(_on_subtitles_toggled)
	_reduce_horror_toggle.toggled.connect(_on_reduce_horror_toggled)
	_back_button.pressed.connect(_on_back)
	_load_from_accessibility()


## Pull the current accessibility state into the controls (one-shot, so
## dragging a slider does not fight the user).
func _load_from_accessibility() -> void:
	if AccessibilityManager == null:
		return
	AccessibilityManager.set_volume(BUS_MASTER, _master_volume.value)
	AccessibilityManager.set_volume(BUS_RADIO, _radio_volume.value)
	AccessibilityManager.set_volume(BUS_ROOM, _ambient_volume.value)
	AccessibilityManager.set_subtitles_enabled(_subtitles_toggle.button_pressed)
	AccessibilityManager.set_reduce_audio_horror(_reduce_horror_toggle.button_pressed)


func _on_master_volume_changed(value: float) -> void:
	if AccessibilityManager:
		AccessibilityManager.set_volume(BUS_MASTER, value)


func _on_radio_volume_changed(value: float) -> void:
	if AccessibilityManager:
		AccessibilityManager.set_volume(BUS_RADIO, value)


func _on_ambient_volume_changed(value: float) -> void:
	if AccessibilityManager:
		AccessibilityManager.set_volume(BUS_ROOM, value)


func _on_subtitles_toggled(pressed: bool) -> void:
	if AccessibilityManager:
		AccessibilityManager.set_subtitles_enabled(pressed)


func _on_reduce_horror_toggled(pressed: bool) -> void:
	if AccessibilityManager:
		AccessibilityManager.set_reduce_audio_horror(pressed)


func _on_back() -> void:
	print("[Settings] Returning to main menu")
	back_to_menu.emit()
	if is_inside_tree():
		get_tree().change_scene_to_file(MENU_SCENE)
