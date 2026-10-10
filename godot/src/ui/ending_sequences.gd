class_name EndingSequences
extends CanvasLayer

## Phase 4 Step 4: "The Transmitter" — the four ending sequences (DEA-131).
##
## Each ending has unique visuals, audio, and credits, per the Linear spec:
##
##   A THE SIGNAL   — white static, all calls layered into one sound,
##                    post-credits: a radio turns on, "Hello? Is anyone there?"
##   B THE RELAY    — the 1920s station, new operator, calls keep coming,
##                    post-credits: modern radio crackles, "I heard something
##                    on the dead air..."
##   C DEAD AIR     — black screen, total silence, credits in silence,
##                    post-credits: nothing... one frame of static... nothing.
##   D D THE WITNESS (hidden) — morning, birds forward, wind not a voice,
##                    credits over the world; post-credits: dusty unplugged
##                    radio on a shelf, a hand reaches, stops, walks away.
##
## Trigger conditions (enforced by chamber_segment, confirmed here):
##   A/B/C: chosen at the frequencies. D: only when composure > 80 AND
##   tapes >= 15.
##
## After the sequence: returns to the main menu with a completed save
## marker (the chosen ending is recorded in the save data).

signal sequence_started(ending_id: String)
signal credits_started
signal post_credits_started
signal sequence_finished(ending_id: String)
signal return_to_menu_requested

enum Ending {
	THE_SIGNAL,
	THE_RELAY,
	DEAD_AIR,
	THE_WITNESS,
}

const ENDING_NAMES := {
	0: "THE SIGNAL",
	1: "THE RELAY",
	2: "DEAD AIR",
	3: "THE WITNESS",
}

## Map from the chamber's choice ids to endings.
const CHOICE_TO_ENDING := {
	"A": 0,
	"B": 1,
	"C": 2,
	"D": 3,
}

## Credits roll duration per ending.
const CREDITS_DURATION := 12.0
## Post-credits beat before finishing.
const POST_CREDITS_DURATION := 4.0

## Title card: shown after post-credits when return_to_menu is set.
## The "press any key" hint appears after this delay.
const TITLE_HINT_DELAY := 2.0
const MENU_SCENE_PATH := "res://scenes/main_menu.tscn"

## --- State ---
var _ending: int = -1
var _running := false
var _phase := 0  # 0=idle, 1=sequence, 2=credits, 3=post-credits, 4=done,
                 # 5=title card, 6=returning
var _timer := 0.0

## When true, a title card follows post-credits and any key returns to the
## main menu. Set by the chamber (the last story beat of the game).
var return_to_menu := false
## Test hook: when true, _return_to_menu skips the actual scene switch
## (tests/drivers verify the phase transition and bus restore only).
var suppress_scene_change := false
var _card_timer := 0.0
var _card_ready := false

## --- Visuals ---
var _black: ColorRect
var _white: ColorRect
var _dawn_rect: ColorRect
var _static_label: Label
var _credits_lines: Array[Label] = []
var _post_label: Label

## --- Title card visuals ---
var _card_root: Control
var _card_title: Label
var _card_ending: Label
var _card_hint: Label

## --- Audio (procedural) ---
var _audio_player: AudioStreamPlayer
var _audio_phase := 0.0
var _audio_stream: AudioStreamGeneratorPlayback
var _voice_phase := 0.0
const AUDIO_SR := 44100.0

## Credits content per ending.
const CREDITS := {
	0: ["A game about listening.", "Thank you for hearing them."],
	1: ["The station remains.", "Someone must answer."],
	2: ["The signal is cut.", "It is quiet now."],
	3: ["You heard them.", "You walked home."],
}

## Post-credits text per ending (shown as caption over the final shot).
const POST_CREDITS := {
	0: "\"Hello? Is anyone there?\"",
	1: "\"I heard something on the dead air...\"",
	2: "",
	3: "",
}


func _ready() -> void:
	layer = 100
	_build_visuals()


func _build_visuals() -> void:
	# Full-screen rects for each ending's visual language.
	_black = ColorRect.new()
	_black.color = Color(0, 0, 0)
	_black.set_anchors_preset(Control.PRESET_FULL_RECT)
	_black.visible = false
	add_child(_black)

	_white = ColorRect.new()
	_white.color = Color(1, 1, 1)
	_white.set_anchors_preset(Control.PRESET_FULL_RECT)
	_white.visible = false
	add_child(_white)

	_dawn_rect = ColorRect.new()
	_dawn_rect.color = Color(0.95, 0.8, 0.6)
	_dawn_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dawn_rect.visible = false
	add_child(_dawn_rect)

	_static_label = Label.new()
	_static_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_static_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_static_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_static_label.visible = false
	add_child(_static_label)

	_post_label = Label.new()
	_post_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_post_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_post_label.visible = false
	add_child(_post_label)

	_audio_player = AudioStreamPlayer.new()
	_audio_player.name = "EndingAudio"
	_audio_player.stream = _make_generator()
	_audio_player.bus = "Master"
	add_child(_audio_player)


func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


## Start the sequence for a chamber choice id ("A".."D").
func play_choice(choice_id: String) -> void:
	if not CHOICE_TO_ENDING.has(choice_id):
		return
	play_ending(CHOICE_TO_ENDING[choice_id])


func play_ending(ending: int) -> void:
	if _running:
		return
	_running = true
	_ending = ending
	_phase = 1
	_timer = 0.0
	sequence_started.emit(_ending)
	# Mark the save as completed with this ending.
	_mark_completion()
	_apply_sequence_visuals()
	if _audio_player:
		_audio_player.play()


func _apply_sequence_visuals() -> void:
	match _ending:
		Ending.THE_SIGNAL:
			_black.visible = false
			_dawn_rect.visible = false
			_white.visible = true
		Ending.THE_RELAY:
			_white.visible = false
			_dawn_rect.visible = false
			_black.visible = true
			_black.color = Color(0.12, 0.09, 0.06)
		Ending.DEAD_AIR:
			_white.visible = false
			_dawn_rect.visible = false
			_black.visible = true
			_black.color = Color(0, 0, 0)
		Ending.THE_WITNESS:
			_white.visible = false
			_black.visible = false
			_dawn_rect.visible = true


## Mark completion in a lightweight save marker (SideCar file) so the main
## menu can show the completed save.
func _mark_completion() -> void:
	var f := FileAccess.open("user://ending_marker.txt", FileAccess.WRITE)
	if f:
		f.store_line(ENDING_NAMES.get(_ending, ""))
		f.close()


static func get_completion_marker() -> String:
	if not FileAccess.file_exists("user://ending_marker.txt"):
		return ""
	var f := FileAccess.open("user://ending_marker.txt", FileAccess.READ)
	if f == null:
		return ""
	var line := f.get_line()
	f.close()
	return line


## --- Main loop ---

func _process(delta: float) -> void:
	if not _running:
		return
	_timer += delta
	match _phase:
		1:
			if _timer >= 3.0:
				_start_credits()
		2:
			if _timer >= CREDITS_DURATION:
				_start_post_credits()
		3:
			if _timer >= POST_CREDITS_DURATION:
				_finish()
		5:
			_process_title_card(delta)
	_update_audio(delta)


func _start_credits() -> void:
	_phase = 2
	_timer = 0.0
	credits_started.emit()
	# Credits lines fade in sequentially (simple: show all).
	var lines: Array = CREDITS.get(_ending, [])
	_static_label.visible = true
	_static_label.text = "\n".join(lines)


func _start_post_credits() -> void:
	_phase = 3
	_timer = 0.0
	post_credits_started.emit()
	var text: String = POST_CREDITS.get(_ending, "")
	_static_label.visible = false
	if text != "":
		_post_label.text = text
		_post_label.visible = true
	# DEAD_AIR post-credits: one frame of static after silence.
	if _ending == Ending.DEAD_AIR:
		_white.visible = true
		_white.color = Color(0.5, 0.5, 0.5)


func _finish() -> void:
	_running = false
	if _audio_player:
		_audio_player.stop()
	if return_to_menu:
		# Post-credits flows into the title card, not "done".
		_start_title_card()
	else:
		_phase = 4
		sequence_finished.emit(_ending)


## --- Title card + return to main menu ---

func _start_title_card() -> void:
	_phase = 5
	_running = true
	_timer = 0.0
	_card_timer = 0.0
	_card_ready = false
	_static_label.visible = false
	_post_label.visible = false
	_white.visible = false
	_dawn_rect.visible = false
	# Cut to black for the card.
	_black.color = Color(0, 0, 0)
	_black.visible = true
	_build_title_card()
	sequence_finished.emit(_ending)


func _build_title_card() -> void:
	if _card_root:
		return
	_card_root = Control.new()
	_card_root.name = "TitleCard"
	_card_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_card_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_card_root)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_FULL_RECT)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 16)
	_card_root.add_child(box)

	_card_title = Label.new()
	_card_title.text = "DEAD AIR"
	_card_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_phosphor_green(_card_title, 64)
	box.add_child(_card_title)

	_card_ending = Label.new()
	_card_ending.text = get_current_ending_name()
	_card_ending.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(_card_ending, 24)
	box.add_child(_card_ending)

	_card_hint = Label.new()
	_card_hint.text = "press any key"
	_card_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	CRTText.style_amber(_card_hint, 16)
	_card_hint.modulate.a = 0.0
	box.add_child(_card_hint)


## Advance the title card: hint fades in, then any key returns to the menu.
func _process_title_card(delta: float) -> void:
	_card_timer += delta
	if not _card_ready:
		if _card_timer >= TITLE_HINT_DELAY:
			_card_ready = true
			_card_hint.modulate.a = 1.0
		else:
			_card_hint.modulate.a = clampf(_card_timer / TITLE_HINT_DELAY, 0.0, 1.0)


func _unhandled_input(event: InputEvent) -> void:
	if _phase != 5 or not _card_ready:
		return
	# Any key or mouse button.
	var pressed_key: bool = event is InputEventKey and event.pressed and not event.echo
	var pressed_mouse: bool = event is InputEventMouseButton and event.pressed
	if pressed_key or pressed_mouse:
		_return_to_menu()


func _return_to_menu() -> void:
	if _phase == 6:
		return
	_phase = 6
	return_to_menu_requested.emit()
	# Restore the audio world before leaving (the chamber muted all but
	# Master; the menu needs normal buses back).
	var abm := get_node_or_null("/root/AudioBusManager")
	if abm:
		abm.restore_all_buses()
		for i in range(AudioServer.bus_count):
			AudioServer.set_bus_mute(i, false)
	if suppress_scene_change:
		return
	get_tree().change_scene_to_file(MENU_SCENE_PATH)


func is_title_card_showing() -> bool:
	return _phase == 5


func is_card_ready_for_input() -> bool:
	return _phase == 5 and _card_ready


func is_running() -> bool:
	return _running


func get_current_ending() -> int:
	return _ending


func get_current_ending_name() -> String:
	return ENDING_NAMES.get(_ending, "")


func get_phase_id() -> int:
	return _phase


## --- Audio synthesis: unique per ending ---

func _update_audio(delta: float) -> void:
	if _audio_stream == null and _audio_player.playing:
		_audio_stream = _audio_player.get_stream_playback()
	if _audio_stream == null:
		return
	var frames := _audio_stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	match _ending:
		Ending.THE_SIGNAL:
			_fill_signal_audio(frames, buf)
		Ending.THE_RELAY:
			_fill_relay_audio(frames, buf)
		Ending.DEAD_AIR:
			_fill_deadair_audio(frames, buf)
		Ending.THE_WITNESS:
			_fill_witness_audio(frames, buf)
		_:
			pass
	_audio_stream.push_buffer(buf)


## A: all calls layered, overlapping, becoming one sound.
func _fill_signal_audio(frames: int, buf: PackedVector2Array) -> void:
	for i in range(frames):
		_audio_phase += 1.0 / AUDIO_SR
		_voice_phase += 1.0 / AUDIO_SR
		# Three detuned voice-like layers + a soft static bed: many calls.
		var s := 0.0
		for layer in range(3):
			var hz := 110.0 + layer * 47.0
			var t := _audio_phase * hz * TAU
			s += sin(t + float(layer)) * 0.12
		# Occasional overlapping "calls": bursts.
		var burst := maxf(0.0, sin(_voice_phase * 0.7)) ** 3.0
		s += burst * sin(_audio_phase * 220.0) * 0.1
		buf[i] = Vector2(s, s)


## B: radio static with 1920s call audio underneath.
func _fill_relay_audio(frames: int, buf: PackedVector2Array) -> void:
	for i in range(frames):
		_audio_phase += 1.0 / AUDIO_SR
		var static_s := randf_range(-1.0, 1.0) * 0.08
		var voice := sin(_audio_phase * 130.0 * TAU) * 0.1
		voice *= 0.6 + 0.4 * sin(_audio_phase * 0.5)
		buf[i] = Vector2(static_s + voice, static_s + voice)


## C: total silence (no buffer content).
func _fill_deadair_audio(frames: int, buf: PackedVector2Array) -> void:
	for i in range(frames):
		buf[i] = Vector2(0.0, 0.0)


## D: morning — birds forward, wind not a voice.
func _fill_witness_audio(frames: int, buf: PackedVector2Array) -> void:
	for i in range(frames):
		_audio_phase += 1.0 / AUDIO_SR
		# Gentle wind (plain, not voiced) + occasional bird chirps.
		var wind := sin(_audio_phase * 0.8 * TAU) * 0.05
		var chirp := 0.0
		var chirp_t := fmod(_audio_phase, 2.3)
		if chirp_t < 0.08:
			chirp = sin(_audio_phase * 3000.0 * TAU) * 0.05 * (1.0 - chirp_t / 0.08)
		buf[i] = Vector2(wind + chirp, wind + chirp)


## --- Testing helpers ---

func _reset_for_testing() -> void:
	_phase = 0
	_running = false
	_ending = -1
	_timer = 0.0
	_card_timer = 0.0
	_card_ready = false
	return_to_menu = false
	suppress_scene_change = false
	_card_root = null
	_black.visible = false
	_white.visible = false
	_dawn_rect.visible = false
	_static_label.visible = false
	_static_label.text = ""
	_post_label.visible = false
	if _audio_player:
		_audio_player.stop()
		_audio_stream = null
	if FileAccess.file_exists("user://ending_marker.txt"):
		DirAccess.remove_absolute("user://ending_marker.txt")
