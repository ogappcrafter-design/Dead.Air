## main_menu.gd — CRT-styled main menu for Dead Air.
## Displays title "DEAD AIR", subtitle "Late Night Radio",
## buttons: New Game / Continue / Settings.
class_name MainMenu
extends Control

signal new_game_pressed
signal continue_pressed
signal settings_pressed

var _title_label: Label
var _subtitle_label: Label
var _new_game_button: Button
var _continue_button: Button
var _settings_button: Button
var _background: ColorRect


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()


func _build_ui() -> void:
	# Background — dark CRT black
	_background = ColorRect.new()
	_background.color = CRTText.BG_BLACK
	_background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_background)

	# Root container
	var root := VBoxContainer.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(root)

	# Spacer
	var spacer_top := Control.new()
	spacer_top.custom_minimum_size = Vector2(0, 80)
	root.add_child(spacer_top)

	# Title — "DEAD AIR"
	_title_label = Label.new()
	_title_label.text = "DEAD AIR"
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_phosphor_green(_title_label, 72)
	root.add_child(_title_label)

	# Subtitle — "Late Night Radio"
	_subtitle_label = Label.new()
	_subtitle_label.text = "Late Night Radio"
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(_subtitle_label, 24)
	root.add_child(_subtitle_label)

	# Spacer
	var spacer_mid := Control.new()
	spacer_mid.custom_minimum_size = Vector2(0, 60)
	root.add_child(spacer_mid)

	# Buttons container
	var button_container := VBoxContainer.new()
	button_container.alignment = BoxContainer.ALIGNMENT_CENTER
	button_container.custom_minimum_size = Vector2(300, 0)
	button_container.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	root.add_child(button_container)

	# New Game
	_new_game_button = Button.new()
	_new_game_button.text = "New Game"
	_style_button(_new_game_button)
	_new_game_button.pressed.connect(_on_new_game)
	button_container.add_child(_new_game_button)

	# Continue
	_continue_button = Button.new()
	_continue_button.text = "Continue"
	_style_button(_continue_button)
	_continue_button.pressed.connect(_on_continue)
	button_container.add_child(_continue_button)

	# Settings
	_settings_button = Button.new()
	_settings_button.text = "Settings"
	_style_button(_settings_button)
	_settings_button.pressed.connect(_on_settings)
	button_container.add_child(_settings_button)

	# Disable Continue if no saves
	if SaveManager.get_save_count() == 0:
		_continue_button.disabled = true


func _style_button(btn: Button) -> void:
	btn.custom_minimum_size = Vector2(300, 50)
	btn.add_theme_color_override("font_color", CRTText.PHOSPHOR_GREEN)
	btn.add_theme_color_override("font_hover_color", CRTText.AMBER)
	btn.add_theme_color_override("font_pressed_color", CRTText.BLOOD_RED)
	btn.add_theme_color_override("font_disabled_color", Color(0.2, 0.2, 0.2))
	btn.add_theme_font_size_override("font_size", 20)


func _on_new_game() -> void:
	print("[MainMenu] New Game selected — starting Phase 1 Station")
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	new_game_pressed.emit()
	get_tree().change_scene_to_file("res://scenes/night_shift.tscn")


func _on_continue() -> void:
	print("[MainMenu] Continue selected — loading save")
	var tapes := SaveManager.get_used_tapes()
	if tapes.is_empty():
		print("[MainMenu] No saves found")
		return
	var save_data: SaveData = SaveManager.load_game(tapes[0])
	if save_data == null:
		print("[MainMenu] Save load failed")
		return
	print("[MainMenu] Save loaded: phase=%d shift=%d" % [save_data.phase, save_data.shift])
	continue_pressed.emit()
	get_tree().change_scene_to_file("res://scenes/night_shift.tscn")


func _on_settings() -> void:
	print("[MainMenu] Settings selected — stub")
	settings_pressed.emit()
