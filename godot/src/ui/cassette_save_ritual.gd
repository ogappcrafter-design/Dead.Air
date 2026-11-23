## CassetteSaveRitual — Visual and audio save-room ritual for DEA-192.
## Implements the 90s horror save-room ritual: cassette deck insertion,
## "SAVING…" CRT phosphor text, tape clicking at high dread (cosmetic flavour),
## and cassette ejection upon completion.
class_name CassetteSaveRitual
extends Control

signal ritual_started(slot_id: String)
signal ritual_completed(slot_id: String, success: bool)
## Fires the moment the slot file has landed, before the ejection animation.
## The cassette that opened the browser spends itself by its per-shift key, and
## that key is read when the spend is recorded: reporting only at the end of the
## animation lets a shift that advances mid-ejection charge the next night's key
## while tonight's cassette stays on offer.
signal slot_written(slot_id: String, success: bool)

enum State { IDLE, INSERTING, SAVING, EJECTING, FINISHED }

const PHOSPHOR_GREEN := Color(0.0, 1.0, 0.25)
const AMBER_ALERT := Color(1.0, 0.65, 0.0)
const DREAD_THRESHOLD := 60.0

var current_state: State = State.IDLE
## Checkpoint saves (post-shift summary) are permitted outside a safe room;
## the browser sets this so the write-time policy check matches the policy
## its RECORD buttons were enabled under.
var checkpoint_save: bool = false
var is_high_dread_flavour_active: bool = false
var audio_play_count: int = 0
var animation_play_count: int = 0

# UI Components
var _dim_rect: ColorRect
var _deck_panel: Panel
var _deck_slot_rect: ColorRect
var _tape_visual: CassetteTapeVisual
var _crt_label: Label
var _status_label: Label
var _audio_player: AudioStreamPlayer

# Tween & Animation state
var _pulse_tween: Tween
var _current_slot_id: String = ""
var _current_save_data: SaveData = null


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build_ui()
	hide()


func _build_ui() -> void:
	# Fullscreen dark atmosphere dim
	_dim_rect = ColorRect.new()
	_dim_rect.color = Color(0.02, 0.02, 0.03, 0.88)
	_dim_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_dim_rect)

	# Cassette Deck Housing Panel
	_deck_panel = Panel.new()
	_deck_panel.custom_minimum_size = Vector2(480, 420)
	_deck_panel.set_anchors_preset(Control.PRESET_CENTER)
	_deck_panel.offset_left = -240
	_deck_panel.offset_top = -210
	_deck_panel.offset_right = 240
	_deck_panel.offset_bottom = 210

	var deck_style := StyleBoxFlat.new()
	deck_style.bg_color = Color(0.06, 0.06, 0.08, 0.98)
	deck_style.border_color = Color(0.25, 0.25, 0.3)
	deck_style.border_width_left = 3
	deck_style.border_width_right = 3
	deck_style.border_width_top = 3
	deck_style.border_width_bottom = 3
	deck_style.corner_radius_top_left = 6
	deck_style.corner_radius_top_right = 6
	deck_style.corner_radius_bottom_left = 6
	deck_style.corner_radius_bottom_right = 6
	_deck_panel.add_theme_stylebox_override("panel", deck_style)
	add_child(_deck_panel)

	# Deck slot well (recess where cassette sits)
	_deck_slot_rect = ColorRect.new()
	_deck_slot_rect.custom_minimum_size = Vector2(240, 180)
	_deck_slot_rect.color = Color(0.015, 0.015, 0.02, 1.0)
	_deck_slot_rect.position = Vector2(120, 60)
	_deck_panel.add_child(_deck_slot_rect)

	# Cassette Tape Visual
	_tape_visual = CassetteTapeVisual.new()
	_tape_visual.custom_minimum_size = Vector2(200, 150)
	_tape_visual.position = Vector2(20, 15)
	_deck_slot_rect.add_child(_tape_visual)

	# CRT "SAVING…" Text Label
	_crt_label = Label.new()
	_crt_label.name = "CrtLabel"
	_crt_label.text = "SAVING…"
	_crt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_crt_label.add_theme_font_size_override("font_size", 24)
	_crt_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)
	_crt_label.position = Vector2(40, 260)
	_crt_label.size = Vector2(400, 36)
	_deck_panel.add_child(_crt_label)

	# Subtitle / Status Label
	_status_label = Label.new()
	_status_label.name = "StatusLabel"
	_status_label.text = "SAFE ROOM CASSETTE DECK"
	_status_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_status_label.add_theme_font_size_override("font_size", 13)
	_status_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	_status_label.position = Vector2(40, 305)
	_status_label.size = Vector2(400, 24)
	_deck_panel.add_child(_status_label)

	# Audio stream player for procedural mechanical clicks
	_audio_player = AudioStreamPlayer.new()
	_audio_player.name = "RitualAudioPlayer"
	_audio_player.bus = "Master"
	add_child(_audio_player)


## Play the save ritual for the target slot.
## If instant is true, executes immediately without timers (for tests and headless mode).
func play_ritual(slot_id: String, save_data: SaveData, instant: bool = false) -> void:
	# Reject re-entry while a ritual is in flight: the browser disables its
	# buttons when the ritual starts, but the overlay only stops the mouse, so
	# a keyboard activation on the focused button could otherwise start a
	# second insertion and a second save to the same slot.
	if current_state == State.INSERTING or current_state == State.SAVING or current_state == State.EJECTING:
		return
	_current_slot_id = slot_id
	_current_save_data = save_data
	current_state = State.INSERTING
	animation_play_count = 0
	audio_play_count = 0

	# Check high-dread flavour condition (dread >= 60.0)
	var dread_val: float = 0.0
	if save_data != null:
		dread_val = save_data.dread
	elif DreadComposure.instance != null:
		dread_val = DreadComposure.instance.dread
	is_high_dread_flavour_active = (dread_val >= DREAD_THRESHOLD)

	show()
	ritual_started.emit(slot_id)

	if instant:
		_execute_instant_ritual()
	else:
		_start_animated_sequence()


## Synchronous path for headless test suites or instant transitions.
func _execute_instant_ritual() -> void:
	animation_play_count += 1
	audio_play_count += 1

	current_state = State.INSERTING
	_play_click_sfx(180.0, 0.04)

	current_state = State.SAVING
	_crt_label.text = "SAVING…"
	_crt_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)

	if is_high_dread_flavour_active:
		# Tape clicking at high dread (cosmetic flavour per GDD)
		_play_click_sfx(850.0, 0.06)

	# Perform save operation (high-dread cosmetic flavour does NOT alter data)
	var success := true
	if _current_save_data != null:
		if not _write_allowed():
			success = false
		else:
			success = SaveManager.save_slot(_current_slot_id, _current_save_data)
		# No data means no write happened, so there is nothing to announce.
		slot_written.emit(_current_slot_id, success)

	current_state = State.EJECTING
	_crt_label.text = "SAVE COMPLETED" if success else "SAVE FAILED"
	_play_click_sfx(220.0, 0.05)

	current_state = State.FINISHED
	hide()
	ritual_completed.emit(_current_slot_id, success)


## Animated asynchronous path with tweening and CRT pulse.
func _start_animated_sequence() -> void:
	animation_play_count += 1
	current_state = State.INSERTING

	# Cassette insert animation: tape slides down into deck
	_play_click_sfx(180.0, 0.08)
	_tape_visual.position = Vector2(20, -50)

	var insert_tween := create_tween()
	insert_tween.tween_property(_tape_visual, "position", Vector2(20, 15), 0.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	insert_tween.tween_callback(_on_insert_finished)


func _on_insert_finished() -> void:
	current_state = State.SAVING
	_crt_label.text = "SAVING…"
	_crt_label.add_theme_color_override("font_color", PHOSPHOR_GREEN)

	# Phosphor green CRT pulsing
	_pulse_tween = create_tween().set_loops(3)
	_pulse_tween.tween_property(_crt_label, "modulate:a", 0.3, 0.15)
	_pulse_tween.tween_property(_crt_label, "modulate:a", 1.0, 0.15)

	if is_high_dread_flavour_active:
		# High-dread cosmetic tape clicking/shudder
		_status_label.text = "TAPE SHUDDER DETECTED"
		_status_label.add_theme_color_override("font_color", AMBER_ALERT)
		_play_click_sfx(850.0, 0.12)
	else:
		_status_label.text = "RECORDING TO MAGNETIC TAPE…"
		_status_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))

	# Wait brief duration for ritual feel, then save and eject
	var save_timer := get_tree().create_timer(0.4)
	save_timer.timeout.connect(_on_save_timer_timeout)


## The write-time policy gate: the safe-room window can close during the
## insert tween, so eligibility has to hold at the write, not only when the
## ritual started. Checkpoint saves use the checkpoint policy.
func _write_allowed() -> bool:
	if checkpoint_save:
		return SaveManager.can_save_checkpoint()
	return SaveManager.can_save()


func _on_save_timer_timeout() -> void:
	# Save the game to the slot
	var success := true
	if _current_save_data != null:
		if not _write_allowed():
			success = false
		else:
			success = SaveManager.save_slot(_current_slot_id, _current_save_data)
		# No data means no write happened, so there is nothing to announce.
		slot_written.emit(_current_slot_id, success)

	if _pulse_tween != null and _pulse_tween.is_valid():
		_pulse_tween.kill()
	_crt_label.modulate.a = 1.0

	current_state = State.EJECTING
	_crt_label.text = "SAVE COMPLETED" if success else "SAVE FAILED"
	_status_label.text = "EJECTING CASSETTE"
	_play_click_sfx(220.0, 0.08)

	# Cassette eject animation
	var eject_tween := create_tween()
	eject_tween.tween_property(_tape_visual, "position", Vector2(20, -20), 0.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	eject_tween.tween_callback(func() -> void:
		current_state = State.FINISHED
		hide()
		ritual_completed.emit(_current_slot_id, success)
	)


## Synthesize a procedural mechanical click SFX.
func _play_click_sfx(freq: float, duration: float) -> void:
	audio_play_count += 1
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = 22050
	var sample_count := int(duration * 22050)
	var bytes := PackedByteArray()
	bytes.resize(sample_count * 2)

	for i in range(sample_count):
		var t := float(i) / 22050.0
		var envelope := exp(-35.0 * t)
		var sample := sin(TAU * freq * t) * envelope * 0.6
		var val := int(clampf(sample, -1.0, 1.0) * 32767.0)
		bytes.encode_s16(i * 2, val)

	wav.data = bytes
	_audio_player.stream = wav
	_audio_player.play()
