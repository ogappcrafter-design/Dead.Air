## fmv_player.gd — Launch FMV (attract-mode) player for the Dead Air intro.
## DEA-199: plays the rendered intro clip through VideoStreamPlayer, skips on
## any input, routes audio through the Master bus, and falls back to the title
## screen when the clip is missing or fails to load.
##
## Godot 4 ships only the Ogg Theora decoder (VideoStreamTheora), so the
## runtime asset is `assets/fmv/deadair_intro.ogv` transcoded from the H.264
## delivery master (see scripts/fmv/render_masters.py).
class_name FMVPlayer
extends Control

## Packed Ogg Theora clip played at launch.
const INTRO_STREAM_PATH := "res://assets/fmv/deadair_intro.ogv"
## Title screen shown after the clip — and on every failure path.
const NEXT_SCENE_PATH := "res://scenes/main_menu.tscn"
## Seconds of playback before the skip hint appears.
const SKIP_HINT_DELAY := 3.0

signal intro_started
signal intro_finished
signal intro_skipped
signal intro_unavailable

@onready var _player: VideoStreamPlayer = $VideoStreamPlayer
@onready var _skip_hint: Label = $SkipHint

## Clip to play. Tests point this at a missing path to exercise the fallback.
var intro_stream_path: String = INTRO_STREAM_PATH
## Scene loaded once the intro ends. Tests may redirect it.
var next_scene_path: String = NEXT_SCENE_PATH
## Callable that performs the scene swap. Bound to the SceneTree in _ready;
## tests shadow it with a recording stub so the runner's tree is never swapped.
var request_scene_change: Callable = Callable()
## True once the intro ended for any reason (guards double transitions).
var finished: bool = false

var _hint_timer: float = 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	if request_scene_change.is_null() or not request_scene_change.is_valid():
		request_scene_change = Callable(get_tree(), "change_scene_to_file")
	if _player != null:
		_player.bus = AudioBusManager.BUS_MASTER
		_player.volume_db = 0.0
		_player.finished.connect(_on_player_finished)
	if _skip_hint != null:
		_skip_hint.visible = false
	start_intro()


func _process(delta: float) -> void:
	if _skip_hint == null or _skip_hint.visible or finished:
		return
	_hint_timer += delta
	if _hint_timer >= SKIP_HINT_DELAY:
		_skip_hint.visible = true


## Begin playback. Emits intro_unavailable and moves on when the clip is
## absent or undecodable instead of leaving the player on a black screen.
func start_intro() -> void:
	if finished:
		return
	if not has_intro_stream(intro_stream_path):
		_abort_missing_stream()
		return
	var stream := load(intro_stream_path) as VideoStream
	if stream == null:
		_abort_missing_stream()
		return
	if _player == null:
		_abort_missing_stream()
		return
	_player.stream = stream
	_player.play()
	intro_started.emit()


## True when `path` resolves to a loadable video stream.
static func has_intro_stream(path: String) -> bool:
	if path.is_empty() or not ResourceLoader.exists(path, "VideoStream"):
		return false
	return true


## End the intro early on player input.
func skip() -> void:
	if finished:
		return
	intro_skipped.emit()
	_finish()


func _on_player_finished() -> void:
	if finished:
		return
	intro_finished.emit()
	_finish()


## Any key, joypad button, mouse button or touch press skips the intro.
func _is_skip_event(event: InputEvent) -> bool:
	if event is InputEventKey:
		return event.pressed and not event.echo
	if event is InputEventJoypadButton:
		return event.pressed
	if event is InputEventMouseButton:
		return event.pressed
	if event is InputEventScreenTouch:
		return event.pressed
	return false


func _input(event: InputEvent) -> void:
	if finished:
		return
	if _is_skip_event(event):
		get_viewport().set_input_as_handled()
		skip()


func _abort_missing_stream() -> void:
	push_warning(
		"[FMVPlayer] Intro clip missing or undecodable at '%s' — falling back to %s"
		% [intro_stream_path, next_scene_path]
	)
	intro_unavailable.emit()
	_finish()


func _finish() -> void:
	if finished:
		return
	finished = true
	if _player != null:
		_player.stop()
		_player.stream = null
	_request_next_scene()


func _request_next_scene() -> void:
	if request_scene_change.is_valid():
		request_scene_change.call(next_scene_path)
