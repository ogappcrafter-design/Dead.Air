## pause_menu.gd — DEA-189. The game's pause flow.
## Registered as the `PauseMenu` autoload so every scene gets it without wiring.
## The GDD rule: pausing is a safe-room privilege, never allowed while the Suit
## is hunting. The accessibility option `pause_anywhere` overrides that.
extends CanvasLayer

const MENU_SCENE := "res://scenes/main_menu.tscn"
const SETTINGS_SCENE := "res://scenes/settings.tscn"
const REFUSAL_SECONDS := 2.5

var is_open: bool = false

var _panel: PanelContainer
var _status: Label
var _refusal_timer: float = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = 100
	_build()
	hide()


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
	_button(vbox, "SETTINGS", _open_settings)
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


func _quit_to_title() -> void:
	resume()
	get_tree().change_scene_to_file(MENU_SCENE)


func _quit_game() -> void:
	resume()
	get_tree().quit()
