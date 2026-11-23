## pause_menu.gd — DEA-189. The game's pause flow.
## Registered as the `PauseMenu` autoload so every scene gets it without wiring.
## The GDD rule: pausing is a safe-room privilege, never allowed while the Suit
## is hunting. The accessibility option `pause_anywhere` overrides that.
extends CanvasLayer

const MENU_SCENE := "res://scenes/main_menu.tscn"
const SETTINGS_SCENE := "res://scenes/settings.tscn"
const ControlsRemapScreen := preload("res://src/ui/controls_remap_screen.gd")
const NIGHT_SHIFT_SCENE := "res://scenes/night_shift.tscn"
const REFUSAL_SECONDS := 2.5
const SaveLoadScreen := preload("res://src/ui/save_load_screen.gd")

var is_open: bool = false

var _panel: PanelContainer
var _status: Label
var _refusal_timer: float = 0.0
var _controls_screen: Control
var _save_load_screen: SaveLoadScreen = null

# Last scene path requested via _request_scene. Read by tests; not part of
# runtime behavior.
var last_requested_scene: String = ""
# Callable that performs the actual scene swap. Bound to the SceneTree in
# _ready; tests may shadow it with a stub to avoid a real scene change.
var request_scene_change: Callable = Callable()


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 100
	if request_scene_change.is_null() or not request_scene_change.is_valid():
		request_scene_change = Callable(get_tree(), "change_scene_to_file")
	_build()
	hide()


func _request_scene(scene_path: String) -> void:
	last_requested_scene = scene_path
	if request_scene_change.is_valid():
		request_scene_change.call(scene_path)


func _build() -> void:
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.72)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	_panel = PanelContainer.new()
	_panel.custom_minimum_size = Vector2(360, 0)
	center.add_child(_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	_panel.add_child(vbox)

	var title := Label.new()
	title.text = "PAUSED"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 28)
	vbox.add_child(title)

	_status = Label.new()
	_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status.text = "Safe room"
	_status.visible = false
	vbox.add_child(_status)

	_button(vbox, "RESUME", resume)
	_button(vbox, "LOAD", _open_load)
	_button(vbox, "SETTINGS", _open_settings)
	_button(vbox, "CONTROLS", _open_controls)
	_button(vbox, "QUIT TO TITLE", _quit_to_title)
	_button(vbox, "QUIT GAME", _quit_game)


func _button(parent: VBoxContainer, text: String, handler: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.pressed.connect(handler)
	parent.add_child(button)
	return button


func _unhandled_input(event: InputEvent) -> void:
	if not event.is_action_pressed("pause"):
		return
	if is_open:
		resume()
	else:
		try_pause()
	get_viewport().set_input_as_handled()


## Pause is refused outside a safe room unless the player allowed it in settings.
func can_pause() -> bool:
	if AccessibilityManager != null and AccessibilityManager.pause_anywhere:
		return true
	var dread: DreadComposure = DreadComposure.instance
	return dread != null and dread.in_safe_room


func try_pause() -> bool:
	if not can_pause():
		_show_refusal()
		return false
	is_open = true
	get_tree().paused = true
	show()
	return true


func resume() -> void:
	is_open = false
	_close_controls()
	_close_load_browser()
	get_tree().paused = false
	hide()


func _show_refusal() -> void:
	_refusal_timer = REFUSAL_SECONDS
	_status.text = "You can only pause in a safe room"
	_status.visible = true


func _process(delta: float) -> void:
	if _refusal_timer <= 0.0:
		return
	_refusal_timer -= delta
	if _refusal_timer <= 0.0 and not is_open:
		_status.visible = false


func _open_settings() -> void:
	resume()
	get_tree().change_scene_to_file(SETTINGS_SCENE)


func _open_controls() -> void:
	# Own the screen: one instance at a time, released on resume so it can
	# never outlive the pause session or stack up on repeated presses.
	if _controls_screen != null and is_instance_valid(_controls_screen):
		return
	var remap_screen := ControlsRemapScreen.new()
	remap_screen.back_pressed.connect(_close_controls)
	_controls_screen = remap_screen
	add_child(remap_screen)


func _close_controls() -> void:
	if _controls_screen != null and is_instance_valid(_controls_screen):
		_controls_screen.queue_free()
	_controls_screen = null
func _open_load() -> void:
	if _save_load_screen == null:
		_save_load_screen = SaveLoadScreen.new()
		_save_load_screen.set_mode(SaveLoadScreen.Mode.LOAD)
		_save_load_screen.closed.connect(_on_save_load_closed)
		_save_load_screen.load_requested.connect(_on_load_requested)
		add_child(_save_load_screen)
	else:
		_save_load_screen.set_mode(SaveLoadScreen.Mode.LOAD)
		_save_load_screen.show()
		_save_load_screen.refresh()
	_save_load_screen.grab_default_focus()
	_panel.hide()


## Reset the browser so every resume path — Back, pause key, or a successful
## load — leaves the autoloaded menu ready for a clean next pause.
func _close_load_browser() -> void:
	if _save_load_screen != null:
		_save_load_screen.cancel_pending_confirmation()
		_save_load_screen.hide()
	_panel.show()


func _on_save_load_closed() -> void:
	_close_load_browser()


func _on_load_requested(slot_id: String) -> void:
	# Decide from the side-effect-free metadata first: load_slot applies the
	# moral-choice and CRT state, so a refused tape must never reach it.
	var decision := SaveManager.inspect_slot_for_load(slot_id)
	if not bool(decision["resumable"]):
		# Unreadable or unresumable tape: keep the browser open and surface
		# the refusal instead of dropping the player into a fresh shift.
		if _save_load_screen != null:
			_save_load_screen.show_load_error(str(decision["message"]))
		return
	var save_data := SaveManager.load_slot(slot_id)
	if save_data == null:
		if _save_load_screen != null:
			_save_load_screen.show_load_error()
		return
	resume()
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	ShiftController.start_shift(maxi(1, int(save_data.shift)))
	# start_shift pins the phase to the station default; restoring the saved
	# phase after it means later-phase saves resume in their own phase.
	PhaseManager.set_phase(save_data.phase)
	SaveManager.apply_loaded_game_state(save_data)
	_request_scene(NIGHT_SHIFT_SCENE)


func _quit_to_title() -> void:
	resume()
	get_tree().change_scene_to_file(MENU_SCENE)


func _quit_game() -> void:
	resume()
	get_tree().quit()
