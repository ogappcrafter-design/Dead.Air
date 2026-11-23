## main_menu.gd — CRT-styled main menu for Dead Air.
## The UI (title, subtitle, buttons, credits, completion label) is built in
## res://scenes/main_menu.tscn; this script wires the buttons to game state.
class_name MainMenu
extends Control

## The gameplay scene loaded on New Game / Continue.
const NIGHT_SHIFT_SCENE := "res://scenes/night_shift.tscn"
## The settings screen loaded from the Settings button.
const SETTINGS_SCENE := "res://scenes/settings.tscn"
const SaveLoadScreen := preload("res://src/ui/save_load_screen.gd")

signal new_game_started
signal continue_started
signal open_settings

@onready var _new_game_button: Button = $PanelCenter/VBox/NewGameButton
@onready var _continue_button: Button = $PanelCenter/VBox/ContinueButton
@onready var _settings_button: Button = $PanelCenter/VBox/SettingsButton
@onready var _completion_label: Label = $PanelCenter/VBox/CompletionLabel

var _load_button: Button = null
var _save_load_screen: SaveLoadScreen = null

# Last scene path requested via start_game / load_game / settings.
# Read by tests; not part of runtime behavior.
var last_requested_scene: String = ""

# Callable that performs the actual scene swap. Bound to the SceneTree in
# _ready; tests may shadow it with a stub to avoid a real scene change.
var request_scene_change: Callable = Callable()


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	if request_scene_change.is_null() or not request_scene_change.is_valid():
		request_scene_change = Callable(get_tree(), "change_scene_to_file")
	_new_game_button.pressed.connect(_on_new_game)
	_continue_button.pressed.connect(_on_continue)
	_settings_button.pressed.connect(_on_settings)

	# Wire Load Game button below Continue
	var vbox := _continue_button.get_parent()
	if vbox:
		_load_button = Button.new()
		_load_button.name = "LoadButton"
		_load_button.text = "LOAD GAME"
		_load_button.custom_minimum_size = Vector2(320, 52)
		_load_button.add_theme_font_size_override("font_size", 20)
		_load_button.add_theme_color_override("font_color", Color(0, 1, 0.254902, 1))
		_load_button.add_theme_color_override("font_hover_color", Color(1, 0.647059, 0, 1))
		_load_button.add_theme_color_override("font_pressed_color", Color(1, 0.2, 0, 1))
		_load_button.add_theme_color_override("font_disabled_color", Color(0.2, 0.2, 0.2, 1))
		vbox.add_child(_load_button)
		vbox.move_child(_load_button, _continue_button.get_index() + 1)
		_load_button.pressed.connect(_on_load_menu_pressed)

	_refresh_continue_state()
	_update_completion_label()


## Disable Continue and Load when no cassette saves exist.
func _refresh_continue_state() -> void:
	var count := SaveManager.get_save_count()
	_continue_button.disabled = (count == 0)
	if _load_button != null:
		_load_button.disabled = (count == 0)


## Show which ending was reached, if any. Empty (and hidden) otherwise.
func _update_completion_label() -> void:
	var marker := EndingSequences.get_completion_marker()
	if marker.is_empty():
		_completion_label.visible = false
		return
	_completion_label.text = "COMPLETED — " + marker.replace("_", " ")
	_completion_label.visible = true


func _on_new_game() -> void:
	# A fresh run must never inherit a snapshot staged by a load whose scene
	# request never landed.
	SaveManager.clear_pending_scene_state()
	# A load that never reached its scene leaves dread and composure behind,
	# so a fresh run starts from neutral values.
	if DreadComposure.instance != null:
		DreadComposure.instance.reset()
	start_game(1)


## Start a fresh game: reset to Phase 1 and load the gameplay scene with
## the given shift (default 1) active. Emits new_game_started.
func start_game(shift_number: int = 1) -> void:
	print("[MainMenu] New Game selected — starting Phase 1 Station")
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	# A shift can already be active if the player bailed out mid-shift;
	# tear it down so start_shift accepts the (re)start.
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	# Cassettes spent during an earlier run carry the same shift-scoped keys, so
	# a fresh start clears them or the shift 1 booth cassette arrives used.
	SaveManager.clear_spent_save_points()
	ShiftController.start_shift(shift_number)
	new_game_started.emit()
	_request_scene(NIGHT_SHIFT_SCENE)


func _on_continue() -> void:
	var latest_tape := SaveManager.get_latest_tape_id()
	if latest_tape.is_empty():
		start_game(1)
		return
	# Decide from the side-effect-free metadata first: load_game applies the
	# moral-choice and CRT state, so a refused tape must never reach it.
	var decision := SaveManager.inspect_slot_for_load(latest_tape)
	if bool(decision["unreadable"]):
		# A missing or corrupt save falls back to a fresh shift 1.
		start_game(1)
		return
	if not bool(decision["resumable"]):
		# Continue skips the browser's own gate, so open it and show the same
		# refusal there instead of resuming a tape it would refuse.
		_open_load_browser()
		if _save_load_screen != null:
			_save_load_screen.show_load_error(str(decision["message"]))
		return
	var save_data := SaveManager.load_game(latest_tape)
	if save_data == null:
		start_game(1)
		return
	print("[MainMenu] Save loaded: phase=%d shift=%d" % [save_data.phase, save_data.shift])
	start_loaded_game(save_data)


## Resume a loaded save: start its shift, then restore the saved phase and
## live state after start_shift has applied the station defaults, so the
## loaded game continues in its own phase. Emits continue_started.
func start_loaded_game(save_data: SaveData) -> void:
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	ShiftController.start_shift(maxi(1, int(save_data.shift)))
	PhaseManager.set_phase(save_data.phase)
	SaveManager.apply_loaded_game_state(save_data)
	# A tape ejected in the post-shift room resumes there, with the banked call
	# count it was saved with, instead of dropping the player back into the shift
	# with no summary to reach.
	var phases := ShiftController.ShiftPhase.values()
	if not phases.is_empty():
		var saved_phase: int = int(phases[clampi(int(save_data.shift_phase), 0, phases.size() - 1)])
		if saved_phase == ShiftController.ShiftPhase.POST_SHIFT:
			ShiftController.resume_post_shift(save_data.completed_calls)
	continue_started.emit()
	_request_scene(NIGHT_SHIFT_SCENE)


func _on_settings() -> void:
	print("[MainMenu] Settings selected")
	open_settings.emit()
	_request_scene(SETTINGS_SCENE)


func _on_load_menu_pressed() -> void:
	_open_load_browser()


## Open or refresh the LOAD browser and take the title buttons out of the
## focus chain while it is up. Continue reuses it to surface a refusal.
func _open_load_browser() -> void:
	if _save_load_screen == null:
		_save_load_screen = SaveLoadScreen.new()
		_save_load_screen.name = "SaveLoadScreen"
		_save_load_screen.set_mode(SaveLoadScreen.Mode.LOAD)
		_save_load_screen.closed.connect(_on_load_screen_closed)
		_save_load_screen.load_requested.connect(_on_load_screen_requested)
		add_child(_save_load_screen)
	else:
		_save_load_screen.set_mode(SaveLoadScreen.Mode.LOAD)
		_save_load_screen.show()
	_save_load_screen.refresh()
	_save_load_screen.grab_default_focus()
	# The overlay blocks mouse clicks, not focus traversal: disable the title
	# buttons while the browser is open so Tab cannot leave the browser.
	_set_menu_buttons_disabled(true)


func _on_load_screen_closed() -> void:
	if _save_load_screen != null:
		_save_load_screen.hide()
	_set_menu_buttons_disabled(false)
	_refresh_continue_state()
	if _load_button != null and not _load_button.disabled:
		_load_button.grab_focus()


func _set_menu_buttons_disabled(disabled: bool) -> void:
	for btn: Button in [_new_game_button, _continue_button, _settings_button, _load_button]:
		if btn != null:
			btn.disabled = disabled


func _on_load_screen_requested(slot_id: String) -> void:
	# Decide from the side-effect-free metadata first: load_slot applies the
	# moral-choice and CRT state, so a refused tape must never reach it. The
	# tape and its saved phase, meters and position stay intact for when the
	# segment-restore flow lands.
	var decision := SaveManager.inspect_slot_for_load(slot_id)
	if not bool(decision["resumable"]):
		if _save_load_screen != null:
			_save_load_screen.show_load_error(str(decision["message"]))
		return
	var save_data := SaveManager.load_slot(slot_id)
	if save_data == null:
		if _save_load_screen != null:
			_save_load_screen.show_load_error()
		return
	if _save_load_screen != null:
		_save_load_screen.hide()
	_set_menu_buttons_disabled(false)
	start_loaded_game(save_data)


func _request_scene(scene_path: String) -> void:
	last_requested_scene = scene_path
	if request_scene_change.is_valid():
		request_scene_change.call(scene_path)
