## main_menu.gd — CRT-styled main menu for Dead Air.
## The UI (title, subtitle, buttons, credits, completion label) is built in
## res://scenes/main_menu.tscn; this script wires the buttons to game state.
class_name MainMenu
extends Control

## The gameplay scene loaded on New Game / Continue.
const NIGHT_SHIFT_SCENE := "res://scenes/night_shift.tscn"
## The settings screen loaded from the Settings button.
const SETTINGS_SCENE := "res://scenes/settings.tscn"

signal new_game_started
signal continue_started
signal open_settings

@onready var _new_game_button: Button = $PanelCenter/VBox/NewGameButton
@onready var _continue_button: Button = $PanelCenter/VBox/ContinueButton
@onready var _settings_button: Button = $PanelCenter/VBox/SettingsButton
@onready var _completion_label: Label = $PanelCenter/VBox/CompletionLabel

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
	_refresh_continue_state()
	_update_completion_label()


## Disable Continue when no cassette saves exist (the button is meant for
## resuming; a missing save is not a valid Continue target).
func _refresh_continue_state() -> void:
	_continue_button.disabled = SaveManager.get_save_count() == 0


## Show which ending was reached, if any. Empty (and hidden) otherwise.
func _update_completion_label() -> void:
	var marker := EndingSequences.get_completion_marker()
	if marker.is_empty():
		_completion_label.visible = false
		return
	_completion_label.text = "COMPLETED — " + marker.replace("_", " ")
	_completion_label.visible = true


func _on_new_game() -> void:
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
	ShiftController.start_shift(shift_number)
	new_game_started.emit()
	_request_scene(NIGHT_SHIFT_SCENE)


func _on_continue() -> void:
	var save_data: SaveData = null
	var tapes := SaveManager.get_used_tapes()
	if not tapes.is_empty():
		save_data = SaveManager.load_game(tapes[0])
		if save_data != null:
			print(
				"[MainMenu] Save loaded: phase=%d shift=%d"
				% [save_data.phase, save_data.shift]
			)
	# Saves in Phase 2 and beyond cannot be resumed in the station scene yet;
	# fall back to the first re-playable shift (1) and log it until those
	# phases get their own load flow. A missing or corrupt save also falls
	# back to a fresh shift 1.
	var resume_shift: int = 1
	if save_data != null:
		resume_shift = maxi(1, int(save_data.shift))
		if int(save_data.phase) > PhaseEnums.Phase.PHASE_1_STATION:
			print(
				("[MainMenu] Save is in phase %d — resume support pending, "
				+ "starting shift %d") % [save_data.phase, resume_shift]
			)
	load_game(resume_shift)


## Load the gameplay scene with the given shift started. Emits
## continue_started.
func load_game(shift_number: int) -> void:
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	ShiftController.start_shift(shift_number)
	continue_started.emit()
	_request_scene(NIGHT_SHIFT_SCENE)


func _on_settings() -> void:
	print("[MainMenu] Settings selected")
	open_settings.emit()
	_request_scene(SETTINGS_SCENE)


func _request_scene(scene_path: String) -> void:
	last_requested_scene = scene_path
	if request_scene_change.is_valid():
		request_scene_change.call(scene_path)
