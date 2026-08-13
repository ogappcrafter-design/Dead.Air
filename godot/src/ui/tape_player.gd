class_name TapePlayer
extends Control

## Full-screen overlay tape player. Plays/pauses/stops tape audio.
## Overlay mode during radio silence or specific game phases.
## Uses the TAPE audio bus (index 8) for playback.

signal playback_started(tape_id: String)
signal playback_stopped(tape_id: String)
signal playback_paused(tape_id: String)
signal player_closed

const _TAPE_LIBRARY_PATH := "res://src/data/tapes.tres"

@export var fade_duration: float = 0.5
@export var tape_bus_index: int = 8

var _current_tape_id: String = ""
var _current_tape_data: TapeData = null
var _audio_player: AudioStreamPlayer = null
var _is_playing: bool = false
var _is_paused: bool = false
var _is_visible: bool = false

# UI elements
var _bg_panel: ColorRect = null
var _title_label: Label = null
var _band_label: Label = null
var _status_label: Label = null
var _close_button: Button = null
var _progress_bar: ProgressBar = null


func _ready() -> void:
	set_process(false)
	_build_ui()
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP


func _build_ui() -> void:
	# Full screen dark background
	_bg_panel = ColorRect.new()
	_bg_panel.color = Color(0.02, 0.02, 0.03, 0.92)
	_bg_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_bg_panel)

	# Container
	var container := VBoxContainer.new()
	container.set_anchors_preset(Control.PRESET_FULL_RECT)
	container.add_theme_constant_override("separation", 16)
	container.alignment = BoxContainer.ALIGNMENT_CENTER
	add_child(container)

	# Title label
	_title_label = Label.new()
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_font_size_override("font_size", 28)
	_title_label.add_theme_color_override("font_color", Color(0.4, 0.8, 0.6))
	container.add_child(_title_label)

	# Band label
	_band_label = Label.new()
	_band_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_band_label.add_theme_font_size_override("font_size", 20)
	_band_label.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
	container.add_child(_band_label)

	# Progress bar
	_progress_bar = ProgressBar.new()
	_progress_bar.custom_minimum_size = Vector2(400, 8)
	_progress_bar.min_value = 0.0
	_progress_bar.max_value = 100.0
	_progress_bar.value = 0.0
	_progress_bar.show_percentage = false
	container.add_child(_progress_bar)

	# Status label (play/pause/stop indicator)
	_status_label = Label.new()
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 16)
	_status_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.5))
	_status_label.text = ""
	container.add_child(_status_label)

	# Close button
	_close_button = Button.new()
	_close_button.text = "CLOSE [Space]"
	_close_button.custom_minimum_size = Vector2(120, 40)
	_close_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	container.add_child(_close_button)
	_close_button.pressed.connect(close_player)

	# Audio player setup
	_audio_player = AudioStreamPlayer.new()
	_audio_player.bus = "TAPE"
	add_child(_audio_player)


func play_tape(p_tape_id: String) -> void:
	if _is_playing and _current_tape_id == p_tape_id:
		return

	# Stop current playback
	if _is_playing:
		stop_playback()

	_current_tape_id = p_tape_id

	# Load tape data
	var library := load(_TAPE_LIBRARY_PATH) as TapeLibrary
	if library:
		_current_tape_data = library.get_tape_by_id(p_tape_id)
	else:
		_current_tape_data = null

	# Update UI
	if _current_tape_data:
		_title_label.text = _current_tape_data.title
		_band_label.text = _current_tape_data.band
	else:
		_title_label.text = p_tape_id
		_band_label.text = ""

	# Show overlay
	show_overlay()

	# Start playback
	_is_playing = true
	_is_paused = false
	_status_label.text = "[ PLAYING ]"
	_audio_player.play()

	playback_started.emit(p_tape_id)
	set_process(true)


func pause_playback() -> void:
	if not _is_playing or _is_paused:
		return
	_is_paused = true
	_audio_player.stream_paused = true
	_status_label.text = "[ PAUSED ]"
	playback_paused.emit(_current_tape_id)


func resume_playback() -> void:
	if not _is_paused:
		return
	_is_paused = false
	_audio_player.stream_paused = false
	_status_label.text = "[ PLAYING ]"


func stop_playback() -> void:
	if not _is_playing:
		return
	var old_id := _current_tape_id
	_is_playing = false
	_is_paused = false
	_audio_player.stop()
	_status_label.text = "[ STOPPED ]"
	_progress_bar.value = 0.0
	playback_stopped.emit(old_id)
	set_process(false)


func close_player() -> void:
	stop_playback()
	hide_overlay()
	player_closed.emit()


func show_overlay() -> void:
	_is_visible = true
	visible = true
	# Fade in
	modulate.a = 0.0
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 1.0, fade_duration)


func hide_overlay() -> void:
	_is_visible = false
	var tween := create_tween()
	tween.tween_property(self, "modulate:a", 0.0, fade_duration)
	tween.tween_callback(func(): visible = false)


func is_playing() -> bool:
	return _is_playing


func is_paused() -> bool:
	return _is_paused


func is_visible_overlay() -> bool:
	return _is_visible


func get_current_tape_id() -> String:
	return _current_tape_id


func get_current_tape_data() -> TapeData:
	return _current_tape_data


func _unhandled_input(event: InputEvent) -> void:
	if not _is_visible:
		return

	if event.is_action_pressed("play_tape"):
		if _is_playing and not _is_paused:
			pause_playback()
		elif _is_paused:
			resume_playback()
		get_viewport().set_input_as_handled()

	if event.is_action_pressed("hide"):
		close_player()
		get_viewport().set_input_as_handled()

	if event.is_action_pressed("pause"):
		close_player()
		get_viewport().set_input_as_handled()


func _process(_delta: float) -> void:
	if not _is_playing:
		return

	# Update progress bar based on audio playback position
	if _audio_player.stream:
		var total := _audio_player.stream.get_length()
		if total > 0:
			_progress_bar.value = (_audio_player.get_playback_position() / total) * 100.0

	# Check if playback finished
	if not _audio_player.playing and not _is_paused:
		stop_playback()
