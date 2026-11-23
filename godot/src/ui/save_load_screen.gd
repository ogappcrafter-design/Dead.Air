## SaveLoadScreen — 3-slot cassette tape save/load management screen.
## Handles slot metadata inspection (timestamp, shift, phase, playtime, ending marker),
## overwrite & delete confirmations, safe-room gating, and cassette ritual playback.
## DEA-192 acceptance: 3 slots save, load, overwrite, delete without data loss.
## DEA-174: the layout fits the 320×240 logical viewport — slots are compact
## rows inside a scroll area with Back pinned below it, and legacy tapes are
## listed alongside the numbered slots so every indexed save is reachable.
class_name SaveLoadScreen
extends Control

const CassetteSaveRitualScene := preload("res://src/ui/cassette_save_ritual.gd")

signal save_requested(tape_id: String)
signal load_requested(tape_id: String)
## A slot write landed through this browser's own ritual. Owners attribute the
## write from here rather than from SaveManager.save_completed, which also fires
## for saves written by other panels.
signal slot_saved(slot_id: String)
signal closed

enum Mode { SAVE, LOAD }

@export var mode: Mode = Mode.SAVE
## Whether SAVE-mode recording requires a safe room. The in-world save-room
## ritual keeps it on; checkpoint surfaces (post-shift summary) turn it off
## because the summary itself is the save point.
@export var enforce_safe_room: bool = true

# UI Components
var _title_label: Label
var _subtitle_label: Label
var _warning_label: Label
var _slot_container: VBoxContainer
var _back_button: Button
var _confirm_overlay: Control
var _confirm_title: Label
var _confirm_desc: Label
var _confirm_ok_btn: Button
var _confirm_cancel_btn: Button
var _pending_confirm_action: Callable = Callable()

var _save_ritual: CassetteSaveRitual

# Row elements dictionary: tape_id -> { card, title, meta_label, action_btn, delete_btn }
var _slot_cards: Dictionary = {}


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	_refresh_display()


func _build_ui() -> void:
	# Dark background with CRT vignette tone
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.03, 0.05, 0.98)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)

	var root_vbox := VBoxContainer.new()
	root_vbox.set_anchors_preset(Control.PRESET_FULL_RECT)
	root_vbox.add_theme_constant_override("separation", 4)
	root_vbox.offset_left = 8
	root_vbox.offset_top = 4
	root_vbox.offset_right = -8
	root_vbox.offset_bottom = -4
	add_child(root_vbox)

	# Title
	_title_label = Label.new()
	_title_label.name = "TitleLabel"
	_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_title_label.add_theme_font_size_override("font_size", 16)
	_title_label.add_theme_color_override("font_color", Color(0.85, 0.85, 0.9))
	root_vbox.add_child(_title_label)

	# Subtitle / instructions
	_subtitle_label = Label.new()
	_subtitle_label.name = "SubtitleLabel"
	_subtitle_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_subtitle_label.add_theme_font_size_override("font_size", 10)
	_subtitle_label.add_theme_color_override("font_color", Color(0.5, 0.5, 0.55))
	root_vbox.add_child(_subtitle_label)

	# Safe room refusal / load error notice
	_warning_label = Label.new()
	_warning_label.name = "WarningLabel"
	_warning_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_warning_label.add_theme_font_size_override("font_size", 10)
	_warning_label.add_theme_color_override("font_color", Color(1.0, 0.25, 0.2))
	# Wrap inside the panel: a long refusal must grow downward instead of
	# widening the column and pushing the slot rows' DELETE buttons out of
	# the 320-pixel viewport.
	_warning_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_warning_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_warning_label.text = "SAVING REFUSED: You can only save in a safe room."
	_warning_label.visible = false
	root_vbox.add_child(_warning_label)

	# Scrollable slot rows: three numbered slots plus any legacy tapes. The
	# Back button stays outside the scroll area so it never scrolls away.
	var scroll := ScrollContainer.new()
	scroll.name = "SlotScroll"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	# Keep a focused row visible when keyboard/controller focus moves past the fold.
	scroll.follow_focus = true
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root_vbox.add_child(scroll)

	_slot_container = VBoxContainer.new()
	_slot_container.name = "SlotContainer"
	_slot_container.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_slot_container.add_theme_constant_override("separation", 4)
	scroll.add_child(_slot_container)

	_build_slot_cards()

	# Back button
	_back_button = Button.new()
	_back_button.name = "BackButton"
	_back_button.text = "BACK"
	_back_button.custom_minimum_size = Vector2(96, 26)
	_back_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	_back_button.pressed.connect(_on_back_pressed)
	root_vbox.add_child(_back_button)

	_build_confirmation_dialog()

	# Save ritual component. Its write-time policy gate must match the policy
	# this browser's RECORD buttons use: checkpoint browsers may record outside
	# a safe room, so their ritual must not re-apply the safe-room rule.
	_save_ritual = CassetteSaveRitualScene.new()
	_save_ritual.name = "CassetteSaveRitual"
	_save_ritual.checkpoint_save = not enforce_safe_room
	_save_ritual.ritual_started.connect(_on_ritual_started)
	_save_ritual.slot_written.connect(_on_slot_written)
	_save_ritual.ritual_completed.connect(_on_ritual_completed)
	add_child(_save_ritual)


## Every tape that can appear as a row: the three numbered slots, then any
## indexed legacy tapes (night_N) that older flows wrote.
func _tape_ids() -> Array[String]:
	var ids: Array[String] = []
	for slot_id in SaveManager.SLOT_IDS:
		ids.append(slot_id)
	for tape_id in SaveManager.get_used_tapes():
		if not (tape_id in SaveManager.SLOT_IDS) and not ids.has(tape_id):
			ids.append(tape_id)
	return ids


func _build_slot_cards() -> void:
	for tape_id in _tape_ids():
		_build_slot_card(tape_id)


func _build_slot_card(tape_id: String) -> void:
	var slot_card := PanelContainer.new()
	slot_card.name = "Card_" + tape_id
	slot_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.08, 0.1, 0.95)
	style.border_color = Color(0.25, 0.25, 0.3)
	style.border_width_left = 2
	style.border_width_right = 2
	style.border_width_top = 2
	style.border_width_bottom = 2
	style.corner_radius_top_left = 4
	style.corner_radius_top_right = 4
	style.corner_radius_bottom_left = 4
	style.corner_radius_bottom_right = 4
	slot_card.add_theme_stylebox_override("panel", style)

	# Two-line row: the button line keeps the slot title and actions, the
	# full-width metadata line below it carries the save details that a
	# single cramped line would clip at 320 logical pixels.
	var card_vbox := VBoxContainer.new()
	card_vbox.add_theme_constant_override("separation", 2)
	slot_card.add_child(card_vbox)

	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	card_vbox.add_child(row)

	# Slot header
	var slot_title := Label.new()
	slot_title.name = "SlotTitle"
	slot_title.text = tape_id.replace("_", " ").to_upper()
	slot_title.add_theme_font_size_override("font_size", 12)
	slot_title.add_theme_color_override("font_color", Color(0, 1, 0.25))
	slot_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	slot_title.clip_text = true
	row.add_child(slot_title)

	# Primary Action Button (Save / Load / Overwrite)
	var action_btn := Button.new()
	action_btn.name = "ActionButton"
	action_btn.custom_minimum_size = Vector2(72, 24)
	action_btn.add_theme_font_size_override("font_size", 10)
	row.add_child(action_btn)

	# Secondary Delete Button (Load mode only)
	var delete_btn := Button.new()
	delete_btn.name = "DeleteButton"
	delete_btn.text = "DELETE"
	delete_btn.custom_minimum_size = Vector2(58, 22)
	delete_btn.add_theme_font_size_override("font_size", 9)
	delete_btn.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))
	row.add_child(delete_btn)

	# Metadata line, full card width
	var meta_label := Label.new()
	meta_label.name = "MetaLabel"
	meta_label.add_theme_font_size_override("font_size", 10)
	meta_label.add_theme_color_override("font_color", Color(0.7, 0.7, 0.75))
	meta_label.clip_text = true
	card_vbox.add_child(meta_label)

	# Connect button actions
	var captured_id := tape_id
	action_btn.pressed.connect(func() -> void: _on_action_button_pressed(captured_id))
	delete_btn.pressed.connect(func() -> void: _on_delete_button_pressed(captured_id))

	_slot_container.add_child(slot_card)
	_slot_cards[tape_id] = {
		"card": slot_card,
		"title": slot_title,
		"meta": meta_label,
		"action_btn": action_btn,
		"delete_btn": delete_btn,
	}


func _build_confirmation_dialog() -> void:
	_confirm_overlay = ColorRect.new()
	_confirm_overlay.name = "ConfirmOverlay"
	_confirm_overlay.color = Color(0, 0, 0, 0.8)
	_confirm_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirm_overlay.visible = false
	add_child(_confirm_overlay)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirm_overlay.add_child(center)

	var dialog_panel := PanelContainer.new()
	dialog_panel.custom_minimum_size = Vector2(280, 120)
	var d_style := StyleBoxFlat.new()
	d_style.bg_color = Color(0.1, 0.1, 0.12, 0.98)
	d_style.border_color = Color(1.0, 0.65, 0.0)
	d_style.border_width_left = 2
	d_style.border_width_right = 2
	d_style.border_width_top = 2
	d_style.border_width_bottom = 2
	dialog_panel.add_theme_stylebox_override("panel", d_style)
	center.add_child(dialog_panel)

	var d_vbox := VBoxContainer.new()
	d_vbox.add_theme_constant_override("separation", 10)
	d_vbox.offset_left = 14
	d_vbox.offset_top = 14
	d_vbox.offset_right = -14
	d_vbox.offset_bottom = -14
	dialog_panel.add_child(d_vbox)

	_confirm_title = Label.new()
	_confirm_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_confirm_title.add_theme_font_size_override("font_size", 16)
	_confirm_title.add_theme_color_override("font_color", Color(1.0, 0.65, 0.0))
	d_vbox.add_child(_confirm_title)

	_confirm_desc = Label.new()
	_confirm_desc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_confirm_desc.add_theme_font_size_override("font_size", 11)
	_confirm_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d_vbox.add_child(_confirm_desc)

	var btn_hbox := HBoxContainer.new()
	btn_hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	btn_hbox.add_theme_constant_override("separation", 14)
	d_vbox.add_child(btn_hbox)

	_confirm_ok_btn = Button.new()
	_confirm_ok_btn.name = "ConfirmOkButton"
	_confirm_ok_btn.custom_minimum_size = Vector2(90, 28)
	_confirm_ok_btn.pressed.connect(_on_confirm_ok_pressed)
	btn_hbox.add_child(_confirm_ok_btn)

	_confirm_cancel_btn = Button.new()
	_confirm_cancel_btn.name = "ConfirmCancelButton"
	_confirm_cancel_btn.text = "CANCEL"
	_confirm_cancel_btn.custom_minimum_size = Vector2(90, 28)
	_confirm_cancel_btn.pressed.connect(_on_confirm_cancel_pressed)
	btn_hbox.add_child(_confirm_cancel_btn)


## Set mode (SAVE or LOAD) and refresh display.
func set_mode(new_mode: Mode) -> void:
	mode = new_mode
	if is_inside_tree():
		_rebuild_rows()
		_refresh_display()


func refresh() -> void:
	if is_inside_tree():
		_rebuild_rows()
		_refresh_display()


## Rows are rebuilt so tapes created or deleted elsewhere — including legacy
## night_N tapes written by older flows — appear without recreating the screen.
func _rebuild_rows() -> void:
	for key in _slot_cards.keys():
		if not (key in SaveManager.SLOT_IDS) and not SaveManager.is_tape_used(key):
			var stale: Dictionary = _slot_cards[key]
			var card: Control = stale["card"]
			_slot_cards.erase(key)
			card.queue_free()
	for tape_id in _tape_ids():
		if not _slot_cards.has(tape_id):
			_build_slot_card(tape_id)


## Move keyboard/gamepad focus to the always-present Back button so opening
## the browser never leaves focus on the covered menu behind it.
func grab_default_focus() -> void:
	if _back_button != null and _back_button.is_visible_in_tree():
		_back_button.grab_focus()


## Surface a load failure without closing the browser.
func show_load_error(message: String = "") -> void:
	var shown := message if not message.is_empty() else SaveManager.UNREADABLE_TAPE_MESSAGE
	_warning_label.text = shown
	_warning_label.visible = true


func _current_can_save() -> bool:
	return SaveManager.can_save() if enforce_safe_room else SaveManager.can_save_checkpoint()


func _refresh_display() -> void:
	var can_save_state := _current_can_save()

	match mode:
		Mode.SAVE:
			_title_label.text = "SAVE CASSETTE TAPE"
			_subtitle_label.text = "Select a slot to record your progress."
			_warning_label.visible = not can_save_state
		Mode.LOAD:
			_title_label.text = "LOAD CASSETTE TAPE"
			_subtitle_label.text = "Select a saved tape to resume your broadcast."
			_warning_label.visible = false

	for tape_id in _slot_cards.keys():
		_refresh_slot_card(tape_id, can_save_state)


func _refresh_slot_card(tape_id: String, can_save_state: bool) -> void:
	var elements: Dictionary = _slot_cards.get(tape_id, {})
	if elements.is_empty():
		return

	var card: Control = elements["card"]
	var meta_label: Label = elements["meta"]
	# The metadata row outgrows a single line once the ending marker is present,
	# so wrap it instead of clipping the fields the player is comparing.
	meta_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var action_btn: Button = elements["action_btn"]
	var delete_btn: Button = elements["delete_btn"]

	# The numbered slots are the recordable surface; legacy tapes are history
	# and only ever appear in LOAD mode.
	var is_numbered_slot: bool = tape_id in SaveManager.SLOT_IDS
	if not is_numbered_slot and mode == Mode.SAVE:
		card.visible = false
		return
	card.visible = true

	var meta := SaveManager.get_slot_metadata(tape_id)
	var has_save: bool = meta.get("exists", false)
	var is_corrupt: bool = meta.get("corrupted", false)

	if is_corrupt:
		meta_label.text = "DAMAGED TAPE — checksum failure"
		meta_label.add_theme_color_override("font_color", Color(0.9, 0.2, 0.2))
		# A damaged numbered slot stays unreadable in LOAD mode, but in SAVE mode
		# it is still a recordable row: let the player overwrite it (with the
		# usual confirmation) instead of stranding the slot forever.
		if mode == Mode.SAVE and is_numbered_slot:
			action_btn.text = "OVERWRITE"
			action_btn.disabled = not can_save_state
			delete_btn.visible = false
		else:
			action_btn.text = "UNREADABLE"
			action_btn.disabled = true
			delete_btn.visible = (mode == Mode.LOAD)
			delete_btn.disabled = false
		return

	if not has_save:
		meta_label.text = "— no broadcast recorded —"
		meta_label.add_theme_color_override("font_color", Color(0.4, 0.4, 0.45))

		if mode == Mode.SAVE:
			action_btn.text = "RECORD"
			action_btn.disabled = not can_save_state
			action_btn.visible = true
			delete_btn.visible = false
		else:
			action_btn.text = "NO DATA"
			action_btn.disabled = true
			action_btn.visible = true
			delete_btn.visible = false
		return

	# Format metadata
	var shift_val: int = meta.get("shift", 1)
	var phase_val: int = meta.get("phase", 1)
	var timestamp_val: String = meta.get("timestamp", "")
	var playtime_sec: float = meta.get("playtime_seconds", 0.0)
	var dread_val: float = meta.get("dread", 0.0)
	var composure_val: float = meta.get("composure", 100.0)
	var ending_marker: String = meta.get("ending_marker", "")

	# Shortened save timestamp ("2026-11-22T23:59:59" -> "11-22 23:59") so two
	# tapes from the same shift are still distinguishable at a glance.
	var saved_at := "UNKNOWN"
	if timestamp_val.length() >= 16:
		saved_at = timestamp_val.substr(5, 11).replace("T", " ")

	var hours := int(playtime_sec / 3600.0)
	var minutes := int(fmod(playtime_sec, 3600.0) / 60.0)
	var seconds := int(fmod(playtime_sec, 60.0))
	var info := "Ph%d Sh%d • Saved %s • %02d:%02d:%02d • D%d%% C%d%%" % [
		phase_val, shift_val, saved_at, hours, minutes, seconds, int(dread_val), int(composure_val)
	]
	if not ending_marker.is_empty():
		info += " • " + ending_marker.replace("_", " ")

	meta_label.text = info
	meta_label.add_theme_color_override("font_color", Color(0.75, 0.75, 0.8))

	if mode == Mode.SAVE:
		action_btn.text = "OVERWRITE"
		action_btn.disabled = not can_save_state
		action_btn.visible = true
		delete_btn.visible = false
	else:
		action_btn.text = "LOAD"
		action_btn.disabled = false
		action_btn.visible = true
		delete_btn.visible = true
		delete_btn.disabled = false


func _on_action_button_pressed(slot_id: String) -> void:
	if mode == Mode.SAVE:
		if not _current_can_save():
			_warning_label.visible = true
			return

		var meta := SaveManager.get_slot_metadata(slot_id)
		if meta.get("exists", false):
			# Overwrite confirmation
			_show_confirm_dialog(
				"OVERWRITE SLOT?",
				"Existing broadcast data in %s will be replaced. Continue?" % slot_id.replace("_", " ").to_upper(),
				"OVERWRITE",
				func() -> void:
					# The safe-room window can close while the dialog is up, so the
					# eligibility check has to run again before the slot is written.
					if not _current_can_save():
						_warning_label.visible = true
						return
					_execute_slot_save(slot_id)
			)
		else:
			_execute_slot_save(slot_id)

	elif mode == Mode.LOAD:
		load_requested.emit(slot_id)


func _on_delete_button_pressed(slot_id: String) -> void:
	_show_confirm_dialog(
		"DELETE TAPE?",
		"Delete %s permanently? This cannot be undone." % slot_id.replace("_", " ").to_upper(),
		"DELETE",
		func() -> void:
			var deleted := SaveManager.delete_slot(slot_id)
			# Refresh first: rendering the cards clears the warning banner, so the
			# failure has to be raised after the list has been rebuilt.
			refresh()
			if not deleted:
				var label := slot_id.replace("_", " ").to_upper()
				_warning_label.text = "DELETE FAILED: %s is still on the tape." % label
				_warning_label.visible = true
	)


func _execute_slot_save(slot_id: String) -> void:
	save_requested.emit(slot_id)
	# Trigger cassette save ritual
	var current_save_data := _capture_current_game_state(slot_id)
	_save_ritual.play_ritual(slot_id, current_save_data, false)


## Builds SaveData snapshot from live game state or defaults.
func _capture_current_game_state(slot_id: String) -> SaveData:
	var data := SaveData.new()
	data.tape_id = slot_id
	data.shift = ShiftController.get_current_shift() if ShiftController else 1
	data.phase = PhaseManager.get_phase() if PhaseManager else 1
	if DreadComposure.instance:
		data.dread = DreadComposure.instance.dread
		data.composure = DreadComposure.instance.composure
	data.playtime_seconds = SaveManager.tracked_playtime_seconds
	# The post-shift room is a real place to be standing when the tape is
	# ejected, so the snapshot has to carry which phase it was taken in and how
	# many calls had been banked; loading restores both.
	if ShiftController:
		data.shift_phase = int(ShiftController.get_current_phase())
		data.completed_calls = ShiftController.get_completed_call_count()

	# Player position: the same "player" group the level segments read.
	var players := get_tree().get_nodes_in_group("player")
	if not players.is_empty() and players[0] is Node3D:
		var player_pos: Vector3 = (players[0] as Node3D).global_position
		data.position_x = player_pos.x
		data.position_y = player_pos.y
		data.position_z = player_pos.z
		data.has_position = true

	var marker := EndingSequences.get_completion_marker()
	if not marker.is_empty():
		data.ending_flags = {"marker": marker}

	var tuner := _find_radio_tuner()
	if tuner != null:
		var band: BandData = tuner.get_current_band()
		if band != null:
			data.radio_band = band.name
		data.radio_frequency = tuner.current_frequency
		data.radio_signal = tuner.get_signal()

	if TapeSaveBridge:
		TapeSaveBridge.apply_inventory_to_save_data(data)
	return data


func _find_radio_tuner() -> RadioTuner:
	var night_root := get_tree().root.get_node_or_null("NightShift")
	if night_root == null:
		return null
	var tuner := night_root.get_node_or_null("RadioConsole/RadioTuner")
	return tuner if tuner is RadioTuner else null


func _on_ritual_started(_slot_id: String) -> void:
	# The ritual overlay only stops the mouse; keyboard activation on the
	# still-focused row buttons must not start a second ritual.
	for elements in _slot_cards.values():
		(elements["action_btn"] as Button).disabled = true
		(elements["delete_btn"] as Button).disabled = true
	if _confirm_overlay.visible:
		_confirm_overlay.visible = false
		_pending_confirm_action = Callable()


func _on_ritual_completed(_slot_id: String, _success: bool) -> void:
	_refresh_display()
	grab_default_focus()
	# A successful ejection is the end of this browser's errand: close it so the
	# owner can take back over. A failed ritual stays open for a retry.
	# slot_saved already fired when the file landed, so closing must not re-announce
	# the write.
	if _success:
		closed.emit()


## Announce the write as soon as the slot file lands. The owner spends the
## cassette that opened this browser by its per-shift key and reads that key
## when the spend is recorded, so waiting for the ejection animation would let a
## shift that advances mid-animation charge the next night's key instead.
func _on_slot_written(slot_id: String, success: bool) -> void:
	if success:
		slot_saved.emit(slot_id)


func _show_confirm_dialog(title: String, desc: String, ok_text: String, on_confirm: Callable) -> void:
	_confirm_title.text = title
	_confirm_desc.text = desc
	_confirm_ok_btn.text = ok_text
	_pending_confirm_action = on_confirm
	_confirm_overlay.visible = true


func _on_confirm_ok_pressed() -> void:
	_confirm_overlay.visible = false
	if _pending_confirm_action.is_valid():
		_pending_confirm_action.call()
		_pending_confirm_action = Callable()


func _on_confirm_cancel_pressed() -> void:
	_confirm_overlay.visible = false
	_pending_confirm_action = Callable()


## Drop any pending confirmation so a browser that is hidden by its owner
## (pause key, resume, scene change) cannot reuse the old selection.
func cancel_pending_confirmation() -> void:
	if _confirm_overlay != null:
		_confirm_overlay.visible = false
	_pending_confirm_action = Callable()


func _on_back_pressed() -> void:
	closed.emit()
