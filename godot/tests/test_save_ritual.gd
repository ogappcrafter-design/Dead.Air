## test_save_ritual.gd — Unit tests for DEA-192 save-room ritual and 3-slot management.
## Acceptance:
## 1. Three slots save, load, overwrite, and delete without data loss.
## 2. Animation and audio play once per save; high-dread flavour does not alter data.
## 3. Safe room gating is strictly enforced (with pause_anywhere override).
## 4. Overwrite and delete confirmation dialogs work as expected.
## 5. Backward compatibility with legacy SaveManager tape saves is preserved.
## 6. Load flow integration in MainMenu and PauseMenu: full browser-driven load
##    that restores phase, shift, stress meters, playtime, and the pending
##    scene state, with failure paths keeping the browser open.
extends RefCounted

var test_name: String = "SaveRitual"

const CassetteSaveRitualScene := preload("res://src/ui/cassette_save_ritual.gd")
const CassetteTapeScene := preload("res://src/interactables/cassette_tape.gd")
const SaveLoadScreenScene := preload("res://src/ui/save_load_screen.gd")
const PauseMenuScene := preload("res://src/ui/pause_menu.gd")
const MainMenuScene := preload("res://scenes/main_menu.tscn")

const NIGHT_SHIFT_SCENE_PATH := "res://scenes/night_shift.tscn"

var _save_failed_count := 0


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	_setup()

	results["test_three_slots_save_and_load"] = test_three_slots_save_and_load()
	results["test_slot_overwrite_without_data_loss"] = test_slot_overwrite_without_data_loss()
	results["test_slot_deletion"] = test_slot_deletion()
	results["test_metadata_extraction"] = test_metadata_extraction()
	results["test_high_dread_cosmetic_flavour"] = test_high_dread_cosmetic_flavour()
	results["test_animation_and_audio_play_once"] = test_animation_and_audio_play_once()
	results["test_safe_room_gating_refusal"] = test_safe_room_gating_refusal()
	results["test_safe_room_gating_override"] = test_safe_room_gating_override()
	results["test_save_availability_gating"] = test_save_availability_gating()
	results["test_save_slot_failure_preserves_previous_save"] = (
		test_save_slot_failure_preserves_previous_save()
	)
	results["test_ritual_rejects_reentrancy"] = test_ritual_rejects_reentrancy()
	results["test_confirmation_dialog_overwrite"] = test_confirmation_dialog_overwrite()
	results["test_confirmation_dialog_delete"] = test_confirmation_dialog_delete()
	results["test_backward_compatibility_legacy_tapes"] = test_backward_compatibility_legacy_tapes()
	results["test_browser_lists_legacy_tapes"] = test_browser_lists_legacy_tapes()
	results["test_load_browser_fits_logical_viewport"] = await test_load_browser_fits_logical_viewport()
	results["test_capture_includes_position_playtime_ending"] = (
		test_capture_includes_position_playtime_ending()
	)
	results["test_main_menu_load_flow_restores_state"] = test_main_menu_load_flow_restores_state()
	results["test_pause_menu_load_resets_browser_and_panel"] = (
		test_pause_menu_load_resets_browser_and_panel()
	)
	results["test_load_failure_keeps_browser_open"] = test_load_failure_keeps_browser_open()
	results["test_journey_checkpoint_load_refused"] = test_journey_checkpoint_load_refused()
	results["test_break_checkpoint_load_refused"] = test_break_checkpoint_load_refused()
	results["test_position_application_guard_matrix"] = test_position_application_guard_matrix()
	results["test_playtime_resets_on_new_run"] = test_playtime_resets_on_new_run()
	results["test_journey_coordinates_not_applied_to_station_player"] = (
		test_journey_coordinates_not_applied_to_station_player()
	)
	results["test_pause_menu_load_integration"] = test_pause_menu_load_integration()
	results["test_main_menu_load_integration"] = test_main_menu_load_integration()
	results["test_slot_saved_fires_at_write_not_at_ejection_end"] = (
		await test_slot_saved_fires_at_write_not_at_ejection_end()
	)
	results["test_browser_save_spends_only_the_cassette_that_opened_it"] = (
		test_browser_save_spends_only_the_cassette_that_opened_it()
	)

	_teardown()
	return results


func _setup() -> void:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	_reset_dread()


func _teardown() -> void:
	SaveManager._reset_for_testing()
	_reset_dread()


func _reset_dread() -> void:
	if DreadComposure.instance != null:
		DreadComposure.instance.in_safe_room = true
		DreadComposure.instance.dread = 0.0
		DreadComposure.instance.composure = 100.0
	if AccessibilityManager != null:
		AccessibilityManager.pause_anywhere = false
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()


func _make_sample_data(shift_num: int, phase_num: int, dread_val: float) -> SaveData:
	var sd := SaveData.new()
	sd.shift = shift_num
	sd.phase = phase_num
	sd.dread = dread_val
	sd.composure = 85.0
	sd.playtime_seconds = 1250.0
	sd.position_x = 4.0
	sd.position_y = 1.0
	sd.position_z = -2.0
	sd.camera_zone = "booth"
	sd.bands_unlocked = ["AM", "FM"]
	sd.tapes_collected = ["tape_alpha"]
	sd.ending_flags = {"marker": "THE_WITNESS"}
	return sd


func _on_test_save_failed(_tape_id: String, _reason: String) -> void:
	_save_failed_count += 1


## 1. Verify three distinct slots can save and load independently without cross-talk.
func test_three_slots_save_and_load() -> bool:
	SaveManager.delete_all_saves()

	var data1 := _make_sample_data(1, 1, 10.0)
	var data2 := _make_sample_data(2, 1, 25.0)
	var data3 := _make_sample_data(3, 2, 40.0)

	var ok1 := SaveManager.save_slot("slot_1", data1)
	var ok2 := SaveManager.save_slot("slot_2", data2)
	var ok3 := SaveManager.save_slot("slot_3", data3)

	if not (ok1 and ok2 and ok3):
		print("  FAIL: save_slot failed for one or more slots")
		return false

	var loaded1 := SaveManager.load_slot("slot_1")
	var loaded2 := SaveManager.load_slot("slot_2")
	var loaded3 := SaveManager.load_slot("slot_3")

	var valid := (
		loaded1 != null and loaded1.shift == 1 and loaded1.dread == 10.0
		and loaded2 != null and loaded2.shift == 2 and loaded2.dread == 25.0
		and loaded3 != null and loaded3.shift == 3 and loaded3.phase == 2 and loaded3.dread == 40.0
	)
	return valid


## 2. Verify overwriting an existing slot updates the data cleanly without corruption.
func test_slot_overwrite_without_data_loss() -> bool:
	SaveManager.delete_all_saves()

	var initial := _make_sample_data(1, 1, 15.0)
	SaveManager.save_slot("slot_1", initial)

	var updated := _make_sample_data(4, 2, 70.0)
	updated.playtime_seconds = 4500.0
	var overwrite_ok := SaveManager.save_slot("slot_1", updated)
	if not overwrite_ok:
		print("  FAIL: overwrite save_slot returned false")
		return false

	var reloaded := SaveManager.load_slot("slot_1")
	if reloaded == null:
		print("  FAIL: reloaded save was null after overwrite")
		return false

	# A completed overwrite must not leave temp/backup files behind.
	var slot_path := SaveManager.get_save_path("slot_1")
	var leftovers: bool = (
		FileAccess.file_exists(slot_path + ".tmp") or FileAccess.file_exists(slot_path + ".bak")
	)

	var data_ok: bool = (
		reloaded.shift == 4
		and reloaded.phase == 2
		and reloaded.dread == 70.0
		and reloaded.playtime_seconds == 4500.0
	)
	return data_ok and not leftovers


## 3. Verify slot deletion removes the file and updates index.
func test_slot_deletion() -> bool:
	SaveManager.delete_all_saves()

	SaveManager.save_slot("slot_1", _make_sample_data(1, 1, 0.0))
	SaveManager.save_slot("slot_2", _make_sample_data(2, 1, 0.0))

	if not SaveManager.has_slot("slot_2"):
		return false

	var deleted := SaveManager.delete_slot("slot_2")
	if not deleted:
		return false

	var slot2_gone := not SaveManager.has_slot("slot_2")
	var slot1_kept := SaveManager.has_slot("slot_1")
	return slot2_gone and slot1_kept


## 4. Verify metadata extraction from slot save without loading entire world.
func test_metadata_extraction() -> bool:
	SaveManager.delete_all_saves()

	var data := _make_sample_data(3, 2, 45.0)
	data.playtime_seconds = 3665.0
	SaveManager.save_slot("slot_1", data)

	var meta := SaveManager.get_slot_metadata("slot_1")
	if not meta.get("exists", false):
		return false
	if meta.get("corrupted", true):
		return false
	if meta.get("shift", 0) != 3:
		return false
	if meta.get("phase", 0) != 2:
		return false
	if meta.get("dread", 0.0) != 45.0:
		return false
	if meta.get("playtime_seconds", 0.0) != 3665.0:
		return false
	if meta.get("ending_marker", "") != "THE_WITNESS":
		return false

	return true


## 5. Verify high-dread cosmetic flavour triggers clicking but DOES NOT alter saved data.
func test_high_dread_cosmetic_flavour() -> bool:
	SaveManager.delete_all_saves()

	var ritual := CassetteSaveRitualScene.new()
	Engine.get_main_loop().root.add_child(ritual)

	# High dread >= 60.0
	var data := _make_sample_data(2, 1, 75.0)
	data.composure = 35.0
	data.position_x = 12.34

	ritual.play_ritual("slot_1", data, true)

	var flavour_active := ritual.is_high_dread_flavour_active
	ritual.queue_free()

	if not flavour_active:
		print("  FAIL: High dread flavour was not activated at dread=75")
		return false

	# Assert persisted data was NOT mutated by the cosmetic flavour
	var loaded := SaveManager.load_slot("slot_1")
	if loaded == null:
		return false

	var uncorrupted := (
		loaded.dread == 75.0
		and loaded.composure == 35.0
		and loaded.position_x == 12.34
		and loaded.shift == 2
	)
	return uncorrupted


## 6. Verify animation and audio play once per save.
func test_animation_and_audio_play_once() -> bool:
	var ritual := CassetteSaveRitualScene.new()
	Engine.get_main_loop().root.add_child(ritual)

	var data := _make_sample_data(1, 1, 10.0)
	ritual.play_ritual("slot_2", data, true)

	var anim_count := ritual.animation_play_count
	var audio_count := ritual.audio_play_count
	ritual.queue_free()

	# Animation sequence executes once per save; audio plays insertion, saving/click, and eject SFX (>=1)
	return anim_count == 1 and audio_count >= 1


## 7. Verify safe room gating: saving is refused when in_safe_room is false.
func test_safe_room_gating_refusal() -> bool:
	var dread := DreadComposure.instance
	if dread == null:
		dread = DreadComposure.new()
		Engine.get_main_loop().root.add_child(dread)

	dread.in_safe_room = false
	if AccessibilityManager:
		AccessibilityManager.pause_anywhere = false

	var can_save_state := SaveManager.can_save()
	_reset_dread()

	return can_save_state == false


## 8. Verify pause_anywhere overrides safe room gating.
func test_safe_room_gating_override() -> bool:
	var dread := DreadComposure.instance
	if dread == null:
		dread = DreadComposure.new()
		Engine.get_main_loop().root.add_child(dread)

	dread.in_safe_room = false
	if AccessibilityManager:
		AccessibilityManager.pause_anywhere = true

	var can_save_state := SaveManager.can_save()
	_reset_dread()

	return can_save_state == true


## 9. Verify can_save also honours shift availability and phase rules.
func test_save_availability_gating() -> bool:
	# Start from a known phase so the gating assertions do not depend on the
	# order the suite registers its tests in.
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var dread := DreadComposure.instance
	if dread == null:
		dread = DreadComposure.new()
		Engine.get_main_loop().root.add_child(dread)
	dread.in_safe_room = true

	SaveManager.set_save_available(false)
	var blocked_without_shift: bool = not SaveManager.can_save()

	SaveManager.set_save_available(true)
	var allowed_in_safe_room: bool = SaveManager.can_save()

	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	var blocked_in_no_save_phase: bool = not SaveManager.can_save()

	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	var checkpoint_allowed: bool = SaveManager.can_save_checkpoint()

	_reset_dread()
	return blocked_without_shift and allowed_in_safe_room and blocked_in_no_save_phase and checkpoint_allowed


## 10. Verify a failed slot write leaves the previous save intact.
func test_save_slot_failure_preserves_previous_save() -> bool:
	SaveManager.delete_all_saves()

	var initial := _make_sample_data(1, 1, 10.0)
	if not SaveManager.save_slot("slot_1", initial):
		return false

	if not SaveManager.save_failed.is_connected(_on_test_save_failed):
		SaveManager.save_failed.connect(_on_test_save_failed)
	_save_failed_count = 0

	# Force the temporary write to fail: a directory squatting on the temp
	# path makes FileAccess.open(tmp, WRITE) fail while the previous save
	# must survive untouched.
	var tmp_dir := ProjectSettings.globalize_path(SaveManager.get_save_path("slot_1") + ".tmp")
	DirAccess.make_dir_recursive_absolute(tmp_dir)

	var updated := _make_sample_data(5, 2, 80.0)
	var overwrite_ok: bool = SaveManager.save_slot("slot_1", updated)

	DirAccess.remove_absolute(tmp_dir)

	var reloaded := SaveManager.load_slot("slot_1")
	var previous_intact: bool = reloaded != null and reloaded.shift == 1 and reloaded.dread == 10.0
	var no_leftovers: bool = not FileAccess.file_exists(SaveManager.get_save_path("slot_1") + ".bak")
	return not overwrite_ok and _save_failed_count >= 1 and previous_intact and no_leftovers


## 11. Verify the ritual rejects re-entry while already running.
func test_ritual_rejects_reentrancy() -> bool:
	SaveManager.delete_all_saves()

	var ritual := CassetteSaveRitualScene.new()
	Engine.get_main_loop().root.add_child(ritual)

	# ritual_started fires once per accepted ritual; an unguarded second call
	# would emit again and retarget the slot mid-flight.
	var started := {"count": 0}
	ritual.ritual_started.connect(func(_id: String): started["count"] = int(started["count"]) + 1)

	var data := _make_sample_data(1, 1, 10.0)
	ritual.play_ritual("slot_1", data, false)
	var state_after_first: int = ritual.current_state

	ritual.play_ritual("slot_2", data, false)
	var rejected: bool = (
		int(started["count"]) == 1
		and ritual.current_state == state_after_first
		and ritual._current_slot_id == "slot_1"
	)

	ritual.queue_free()
	return rejected and state_after_first == CassetteSaveRitualScene.State.INSERTING


## 12. Verify overwrite confirmation dialog in SaveLoadScreen.
func test_confirmation_dialog_overwrite() -> bool:
	SaveManager.delete_all_saves()

	# Seed slot_1 with shift 1
	SaveManager.save_slot("slot_1", _make_sample_data(1, 1, 10.0))

	var screen := SaveLoadScreenScene.new()
	Engine.get_main_loop().root.add_child(screen)
	screen.set_mode(SaveLoadScreen.Mode.SAVE)

	# Overwrite button on slot_1 triggers confirmation dialog
	var card_data: Dictionary = screen._slot_cards["slot_1"]
	var action_btn: Button = card_data["action_btn"]
	action_btn.pressed.emit()

	var overlay: Control = screen.find_child("ConfirmOverlay", true, false)
	var dialog_open: bool = (overlay != null and overlay.visible)

	# Cancel the dialog -> old data must remain shift 1
	var cancel_btn: Button = screen.find_child("ConfirmCancelButton", true, false)
	cancel_btn.pressed.emit()
	var cancelled: bool = (not overlay.visible)
	var meta_after_cancel: Dictionary = SaveManager.get_slot_metadata("slot_1")
	var shift_still_1: bool = int(meta_after_cancel.get("shift", 0)) == 1

	screen.queue_free()
	return dialog_open and cancelled and shift_still_1


## 13. Verify delete confirmation dialog in SaveLoadScreen.
func test_confirmation_dialog_delete() -> bool:
	SaveManager.delete_all_saves()

	# Seed slot_1
	SaveManager.save_slot("slot_1", _make_sample_data(1, 1, 10.0))

	var screen := SaveLoadScreenScene.new()
	Engine.get_main_loop().root.add_child(screen)
	screen.set_mode(SaveLoadScreen.Mode.LOAD)

	var card_data: Dictionary = screen._slot_cards["slot_1"]
	var delete_btn: Button = card_data["delete_btn"]
	delete_btn.pressed.emit()

	var overlay: Control = screen.find_child("ConfirmOverlay", true, false)
	var dialog_open: bool = (overlay != null and overlay.visible)

	# Confirm delete
	var ok_btn: Button = screen.find_child("ConfirmOkButton", true, false)
	ok_btn.pressed.emit()

	var slot_deleted: bool = not SaveManager.has_slot("slot_1")
	screen.queue_free()

	return dialog_open and slot_deleted


## 14. Verify backward compatibility with legacy save_game() and load_game().
func test_backward_compatibility_legacy_tapes() -> bool:
	SaveManager.delete_all_saves()

	var legacy_sd := _make_sample_data(2, 1, 12.0)
	var saved := SaveManager.save_game("tape_legacy_test", legacy_sd)
	if not saved:
		return false

	var loaded := SaveManager.load_game("tape_legacy_test")
	if loaded == null or loaded.shift != 2:
		return false

	SaveManager.delete_save("tape_legacy_test")
	return true


## 15. Verify the load browser lists legacy tapes alongside the numbered slots.
func test_browser_lists_legacy_tapes() -> bool:
	SaveManager.delete_all_saves()

	SaveManager.save_slot("slot_1", _make_sample_data(2, 1, 5.0))
	SaveManager.save_game("night_2", _make_sample_data(2, 1, 20.0))

	var screen := SaveLoadScreenScene.new()
	Engine.get_main_loop().root.add_child(screen)
	screen.set_mode(SaveLoadScreen.Mode.LOAD)

	var has_night_row: bool = screen._slot_cards.has("night_2")
	var loadable: bool = false
	if has_night_row:
		var legacy: Dictionary = screen._slot_cards["night_2"]
		var action: Button = legacy["action_btn"]
		loadable = action.text == "LOAD" and not action.disabled

	screen.queue_free()
	return has_night_row and loadable


## 16. Verify the browser fits the 320x240 logical viewport (DEA-174).
func test_load_browser_fits_logical_viewport() -> bool:
	SaveManager.delete_all_saves()
	SaveManager.save_slot("slot_1", _make_sample_data(2, 1, 5.0))
	SaveManager.save_slot("slot_2", _make_sample_data(3, 1, 5.0))
	SaveManager.save_slot("slot_3", _make_sample_data(4, 1, 5.0))

	var screen := SaveLoadScreenScene.new()
	var vp := SubViewport.new()
	vp.size = Vector2i(320, 240)
	Engine.get_main_loop().root.add_child(vp)
	vp.add_child(screen)
	screen.set_mode(SaveLoadScreen.Mode.LOAD)
	await Engine.get_main_loop().process_frame
	# A refusal is the widest text the browser shows; it must wrap inside the
	# panel instead of widening the rows and pushing DELETE out of reach.
	screen.show_load_error(SaveManager.get_load_refusal_message(PhaseEnums.Phase.PHASE_3_JOURNEY))
	await Engine.get_main_loop().process_frame

	var viewport_rect := Rect2(Vector2.ZERO, Vector2(320, 240))
	var warning: Label = screen._warning_label
	var warning_rect := warning.get_global_rect()
	var message_wrapped: bool = (
		warning.autowrap_mode != TextServer.AUTOWRAP_OFF
		and warning.get_line_count() > 1
		and viewport_rect.encloses(warning_rect)
		and warning.get_combined_minimum_size().x <= viewport_rect.size.x
	)
	var fits := message_wrapped and viewport_rect.encloses(screen._back_button.get_global_rect())
	for elements in screen._slot_cards.values():
		var action: Button = elements["action_btn"]
		if action.visible:
			fits = fits and viewport_rect.encloses(action.get_global_rect())
		var delete_btn: Button = elements["delete_btn"]
		if delete_btn.visible:
			fits = fits and viewport_rect.encloses(delete_btn.get_global_rect())
		# The metadata line keeps the full card width so save details are
		# readable, not clipped into the space beside two buttons.
		var meta_label: Label = elements["meta"]
		var meta_rect := meta_label.get_global_rect()
		fits = fits and viewport_rect.encloses(meta_rect) and meta_rect.size.x >= 200.0

	vp.queue_free()
	return fits


## 17. Verify the slot snapshot captures position, playtime, and ending marker.
func test_capture_includes_position_playtime_ending() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.tracked_playtime_seconds = 500.0

	var player := Node3D.new()
	Engine.get_main_loop().root.add_child(player)
	player.add_to_group("player")
	player.global_position = Vector3(4.0, 1.0, -2.0)

	# Never touch a player's real ending marker: remember what is already there,
	# write the fixture, then restore it (or remove the file if this test made it).
	var marker_file := "user://ending_marker.txt"
	var marker_existed := FileAccess.file_exists(marker_file)
	var previous_marker := FileAccess.get_file_as_string(marker_file) if marker_existed else ""
	var mf := FileAccess.open(marker_file, FileAccess.WRITE)
	if mf != null:
		mf.store_line("THE_WITNESS")
		mf.close()

	var screen := SaveLoadScreenScene.new()
	Engine.get_main_loop().root.add_child(screen)
	var data := screen._capture_current_game_state("slot_1")
	screen.queue_free()
	# Leave the group immediately so the deferred free cannot shadow the
	# "player" group for later tests in the same frame.
	player.remove_from_group("player")
	player.queue_free()
	if marker_existed:
		var restore := FileAccess.open(marker_file, FileAccess.WRITE)
		if restore != null:
			restore.store_string(previous_marker)
			restore.close()
	else:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(marker_file))

	if data == null:
		return false
	var position_ok: bool = (
		data.position_x == 4.0 and data.position_y == 1.0 and data.position_z == -2.0
	)
	var playtime_ok: bool = data.playtime_seconds == 500.0
	var ending_ok: bool = data.ending_flags.get("marker", "") == "THE_WITNESS"
	SaveManager._reset_for_testing()
	return position_ok and playtime_ok and ending_ok


## 18. Verify a full browser-driven load in MainMenu restores the saved game.
func test_main_menu_load_flow_restores_state() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)

	# Only the Station has a resumable scene route, so the fixture records one.
	var sd := _make_sample_data(3, PhaseEnums.Phase.PHASE_1_STATION, 42.0)
	sd.composure = 55.0
	sd.playtime_seconds = 1234.0
	sd.position_x = 4.0
	sd.position_y = 1.0
	sd.position_z = -2.0
	if not SaveManager.save_slot("slot_1", sd):
		return false

	var menu := MainMenuScene.instantiate()
	Engine.get_main_loop().root.add_child(menu)
	var requested := {"scene": ""}
	menu.request_scene_change = func(path: String): requested["scene"] = path

	menu._on_load_menu_pressed()
	var browser: SaveLoadScreen = menu._save_load_screen
	if browser == null:
		menu.queue_free()
		return false
	var title_buttons_disabled: bool = menu._new_game_button.disabled

	var card_data: Dictionary = browser._slot_cards["slot_1"]
	(card_data["action_btn"] as Button).pressed.emit()

	var scene_ok: bool = requested["scene"] == NIGHT_SHIFT_SCENE_PATH
	var shift_ok: bool = ShiftController.is_shift_active() and ShiftController.get_current_shift() == 3
	var phase_ok: bool = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_1_STATION
	var dread_ok: bool = (
		DreadComposure.instance != null
		and is_equal_approx(DreadComposure.instance.dread, 42.0)
		and is_equal_approx(DreadComposure.instance.composure, 55.0)
	)
	var playtime_ok: bool = is_equal_approx(SaveManager.tracked_playtime_seconds, 1234.0)
	var staged: SaveData = SaveManager.consume_pending_scene_state()
	var pending_ok: bool = (
		staged != null
		and staged.position_x == 4.0
		and staged.position_y == 1.0
		and staged.position_z == -2.0
	)
	var browser_hidden: bool = not browser.visible
	var title_buttons_restored: bool = not menu._new_game_button.disabled

	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	menu.queue_free()
	_reset_dread()

	return (
		scene_ok and shift_ok and phase_ok and dread_ok and playtime_ok and pending_ok
		and browser_hidden and title_buttons_disabled and title_buttons_restored
	)


## 19. Verify a browser-driven load in PauseMenu resets the browser and panel.
func test_pause_menu_load_resets_browser_and_panel() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	if AccessibilityManager != null:
		AccessibilityManager.pause_anywhere = true

	var pause_menu := PauseMenuScene.new()
	Engine.get_main_loop().root.add_child(pause_menu)
	var requested := {"scene": ""}
	pause_menu.request_scene_change = func(path: String): requested["scene"] = path

	if not pause_menu.try_pause():
		pause_menu.queue_free()
		return false
	var panel: PanelContainer = pause_menu._panel
	pause_menu._open_load()
	var browser: SaveLoadScreen = pause_menu._save_load_screen
	var browser_open: bool = browser != null and browser.visible and not panel.visible
	if browser == null:
		pause_menu.queue_free()
		return false

	SaveManager.save_slot("slot_1", _make_sample_data(2, PhaseEnums.Phase.PHASE_1_STATION, 30.0))
	var card_data: Dictionary = browser._slot_cards["slot_1"]
	(card_data["action_btn"] as Button).pressed.emit()

	var menu_closed: bool = not pause_menu.is_open and not pause_menu.visible
	var panel_restored: bool = panel.visible
	var browser_reset: bool = not browser.visible
	var scene_ok: bool = requested["scene"] == NIGHT_SHIFT_SCENE_PATH

	# The next pause must show the pause controls, not the load browser.
	pause_menu.try_pause()
	var next_pause_clean: bool = pause_menu.is_open and panel.visible and not browser.visible
	pause_menu.resume()

	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	PhaseManager.set_phase(PhaseEnums.Phase.PHASE_1_STATION)
	pause_menu.queue_free()
	_reset_dread()

	return (
		browser_open and menu_closed and panel_restored and browser_reset
		and scene_ok and next_pause_clean
	)


## 20. Verify an unreadable tape keeps the browser open and shows the error.
func test_load_failure_keeps_browser_open() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)

	var sd := _make_sample_data(2, 1, 10.0)
	if not SaveManager.save_slot("slot_1", sd):
		return false
	# Corrupt the slot so the checksum no longer matches.
	var path := SaveManager.get_save_path("slot_1")
	var f := FileAccess.open(path, FileAccess.WRITE)
	if f != null:
		f.store_string("{ truncated")
		f.close()

	var menu := MainMenuScene.instantiate()
	Engine.get_main_loop().root.add_child(menu)
	var requested := {"scene": ""}
	menu.request_scene_change = func(path: String): requested["scene"] = path

	menu._on_load_menu_pressed()
	var browser: SaveLoadScreen = menu._save_load_screen
	if browser == null:
		menu.queue_free()
		return false

	menu._on_load_screen_requested("slot_1")

	var browser_still_open: bool = browser.visible
	var error_visible: bool = browser._warning_label.visible
	var no_scene_change: bool = requested["scene"] == ""
	var no_shift_started: bool = not ShiftController.is_shift_active()

	menu.queue_free()
	return browser_still_open and error_visible and no_scene_change and no_shift_started


## A Journey-phase checkpoint cannot be resumed yet (no segment-scene load
## path exists), so both load flows refuse it honestly instead of dropping
## the player into the station with half the state applied.
func test_journey_checkpoint_load_refused() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	var sd := _make_sample_data(2, 2, 20.0)
	sd.has_position = true
	if not SaveManager.save_slot("slot_1", sd):
		return false

	var menu := MainMenuScene.instantiate()
	Engine.get_main_loop().root.add_child(menu)
	var requested := {"scene": ""}
	menu.request_scene_change = func(path: String): requested["scene"] = path
	menu._on_load_menu_pressed()
	var browser: SaveLoadScreen = menu._save_load_screen
	if browser == null:
		menu.queue_free()
		return false

	menu._on_load_screen_requested("slot_1")

	var browser_open: bool = browser.visible
	var error_visible: bool = browser._warning_label.visible
	var no_scene_change: bool = requested["scene"] == ""
	var no_shift: bool = not ShiftController.is_shift_active()
	# The tape and its saved journey state stay intact.
	var kept: SaveData = SaveManager.load_slot("slot_1")
	var tape_kept: bool = kept != null and kept.phase == 2 and kept.has_position

	menu.queue_free()
	_reset_dread()
	return browser_open and error_visible and no_scene_change and no_shift and tape_kept


## The Break is a linear walk with no resumable scene, so a Break tape must
## be refused like a Journey checkpoint instead of opening the station room.
func test_break_checkpoint_load_refused() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	var sd := _make_sample_data(2, PhaseEnums.Phase.PHASE_2_BREAK, 20.0)
	if not SaveManager.save_slot("slot_1", sd):
		return false
	var decision := SaveManager.inspect_slot_for_load("slot_1")
	var refused_for_phase: bool = (
		not bool(decision["resumable"]) and not bool(decision["unreadable"])
	)
	var slot_path := SaveManager.get_save_path("slot_1")
	var bytes_before := FileAccess.get_file_as_bytes(slot_path)

	var menu := MainMenuScene.instantiate()
	Engine.get_main_loop().root.add_child(menu)
	var requested := {"scene": ""}
	menu.request_scene_change = func(path: String): requested["scene"] = path
	menu._on_load_menu_pressed()
	var browser: SaveLoadScreen = menu._save_load_screen
	if browser == null:
		menu.queue_free()
		return false

	menu._on_load_screen_requested("slot_1")

	var browser_open: bool = browser.visible
	var error_visible: bool = browser._warning_label.visible
	var no_scene_change: bool = requested["scene"] == ""
	var no_shift: bool = not ShiftController.is_shift_active()
	# The refusal must not consume or rewrite the tape: re-read it through the
	# same metadata and checksum path a load uses, then compare the raw bytes
	# so a rewritten slot fails even when its checksum is self-consistent.
	var meta_after := SaveManager.get_slot_metadata("slot_1")
	var tape_intact: bool = (
		SaveManager.has_slot("slot_1")
		and SaveManager.validate_save("slot_1")
		and bool(meta_after.get("exists", false))
		and not bool(meta_after.get("corrupted", false))
		and int(meta_after.get("phase", -1)) == PhaseEnums.Phase.PHASE_2_BREAK
		and not bytes_before.is_empty()
		and FileAccess.get_file_as_bytes(slot_path) == bytes_before
	)

	menu.queue_free()
	_reset_dread()
	return (
		refused_for_phase and browser_open and error_visible and no_scene_change
		and no_shift and tape_intact
	)


## Only a captured Phase 1 position may move the station player: journey
## coordinates belong to segment scenes this load flow does not build, and a
## tape that stored progress alone must not teleport the player to the origin.
func test_position_application_guard_matrix() -> bool:
	SaveManager._reset_for_testing()
	var player := Node3D.new()
	Engine.get_main_loop().root.add_child(player)
	player.add_to_group("player")
	player.global_position = Vector3(10.0, 2.0, 10.0)
	var gd := GameDirector.new()
	Engine.get_main_loop().root.add_child(gd)

	var journey := _make_sample_data(3, 2, 20.0)
	journey.has_position = true
	journey.position_x = -50.0
	journey.position_y = 99.0
	journey.position_z = -50.0
	SaveManager.apply_loaded_game_state(journey)
	gd._apply_loaded_scene_state()
	var journey_skipped: bool = player.global_position == Vector3(10.0, 2.0, 10.0)

	var station := _make_sample_data(1, 0, 20.0)
	station.has_position = true
	station.position_x = 4.0
	station.position_y = 1.0
	station.position_z = -2.0
	SaveManager.apply_loaded_game_state(station)
	gd._apply_loaded_scene_state()
	var station_applied: bool = player.global_position == Vector3(4.0, 1.0, -2.0)

	var bare := _make_sample_data(1, 0, 20.0)
	bare.has_position = false
	bare.position_x = -99.0
	bare.position_y = -99.0
	bare.position_z = -99.0
	SaveManager.apply_loaded_game_state(bare)
	gd._apply_loaded_scene_state()
	var uncaptured_skipped: bool = player.global_position == Vector3(4.0, 1.0, -2.0)

	gd.queue_free()
	player.remove_from_group("player")
	player.queue_free()
	SaveManager._reset_for_testing()
	return journey_skipped and station_applied and uncaptured_skipped


## 21. Verify starting a new run zeroes the playtime accumulated by a stale
## active shift (e.g. after Quit to Title).
func test_playtime_resets_on_new_run() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.tracked_playtime_seconds = 999.0
	if ShiftController.is_shift_active():
		ShiftController.reset_shift()
	ShiftController.start_shift(2)
	var zeroed: bool = SaveManager.tracked_playtime_seconds == 0.0
	ShiftController.reset_shift()
	SaveManager._reset_for_testing()
	return zeroed


## 22. Verify a Journey-phase checkpoint's coordinates are not applied to the
## station player — they belong to segment scenes this load flow does not build.
func test_journey_coordinates_not_applied_to_station_player() -> bool:
	SaveManager._reset_for_testing()
	var player := Node3D.new()
	Engine.get_main_loop().root.add_child(player)
	player.add_to_group("player")
	player.global_position = Vector3(10.0, 2.0, 10.0)
	var gd := GameDirector.new()
	Engine.get_main_loop().root.add_child(gd)

	var sd := _make_sample_data(3, 3, 20.0)
	sd.position_x = -50.0
	sd.position_y = 99.0
	sd.position_z = -50.0
	SaveManager.apply_loaded_game_state(sd)
	gd._apply_loaded_scene_state()
	var untouched: bool = player.global_position == Vector3(10.0, 2.0, 10.0)

	gd.queue_free()
	player.remove_from_group("player")
	player.queue_free()
	SaveManager._reset_for_testing()
	return untouched


## 23. Verify LOAD button exists in PauseMenu and connects to load flow.
func test_pause_menu_load_integration() -> bool:
	var pause_menu := PauseMenuScene.new()
	Engine.get_main_loop().root.add_child(pause_menu)

	var load_btn: Button = null
	var buttons := pause_menu.find_children("*", "Button", true, false)
	for b in buttons:
		if b is Button and (b as Button).text == "LOAD":
			load_btn = b as Button
			break

	var exists := (load_btn != null)
	pause_menu.queue_free()
	return exists


## 24. Verify LOAD GAME button exists in MainMenu.
func test_main_menu_load_integration() -> bool:
	var main_menu: MainMenu = MainMenuScene.instantiate()
	Engine.get_main_loop().root.add_child(main_menu)

	var load_btn: Button = null
	var buttons := main_menu.find_children("*", "Button", true, false)
	for b in buttons:
		if b is Button and (b as Button).text == "LOAD GAME":
			load_btn = b as Button
			break

	var exists := (load_btn != null)
	main_menu.queue_free()
	return exists

## 25. A slot write announces itself when the file lands, not when the ejection
## animation finishes: the cassette that opened the browser spends itself by its
## per-shift key, read at the moment the spend is recorded, so a shift that
## advances mid-animation must not charge the next night's key while tonight's
## cassette stays on offer.
func test_slot_saved_fires_at_write_not_at_ejection_end() -> bool:
	SaveManager._reset_for_testing()
	SaveManager.set_save_available(true)
	var pause_anywhere: bool = AccessibilityManager.pause_anywhere
	AccessibilityManager.pause_anywhere = true

	var browser: SaveLoadScreen = SaveLoadScreenScene.new()
	Engine.get_main_loop().root.add_child(browser)
	var saved: Array = []
	var closed: Array = []
	browser.slot_saved.connect(func(slot_id: String): saved.append(slot_id))
	browser.closed.connect(func(): closed.append(true))

	var ritual: CassetteSaveRitual = browser._save_ritual
	ritual._current_slot_id = "slot_1"
	ritual._current_save_data = _make_sample_data(2, PhaseEnums.Phase.PHASE_1_STATION, 10.0)
	ritual._on_save_timer_timeout()

	var announced_at_write: bool = saved == ["slot_1"] and closed.is_empty()
	var still_ejecting: bool = int(ritual.current_state) == int(CassetteSaveRitual.State.EJECTING)
	var on_disk: bool = bool(SaveManager.get_slot_metadata("slot_1").get("exists", false))

	# The ejection animation then ends and closes the browser, without
	# announcing the write a second time.
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	var deadline: int = Time.get_ticks_msec() + 2000
	while closed.is_empty() and Time.get_ticks_msec() < deadline:
		await tree.process_frame
	var closed_without_double_announce: bool = not closed.is_empty() and saved == ["slot_1"]

	browser.queue_free()
	AccessibilityManager.pause_anywhere = pause_anywhere
	SaveManager._reset_for_testing()
	return announced_at_write and still_ejecting and on_disk and closed_without_double_announce


## Beyond the signal timing, the room-browser save must spend only the cassette
## that opened it: the next night's cassette stays on offer, tonight's cannot
## save twice, and a fresh run starts with nothing spent.
func test_browser_save_spends_only_the_cassette_that_opened_it() -> bool:
	SaveManager._reset_for_testing()
	var gd := GameDirector.new()
	Engine.get_main_loop().root.add_child(gd)

	var tonight := CassetteTapeScene.new()
	tonight.is_save_point = true
	tonight.tape_id = "booth"
	tonight.save_shift = 1
	var tomorrow := CassetteTapeScene.new()
	tomorrow.is_save_point = true
	tomorrow.tape_id = "booth"
	tomorrow.save_shift = 2
	var tonight_id: String = tonight.get_save_id()
	var tomorrow_id: String = tomorrow.get_save_id()
	var distinct_keys: bool = tonight_id != tomorrow_id

	gd._open_save_room_browser(tonight)
	var browser: Node = gd.get_node_or_null("SaveRoomBrowser")
	var browser_wired: bool = browser != null and browser.slot_saved.is_connected(Callable(gd, "_on_save_point_saved"))
	if browser != null:
		browser.slot_saved.emit("slot_1")
	var tonight_spent: bool = SaveManager.is_save_point_spent(tonight_id)
	var tomorrow_offered: bool = not SaveManager.is_save_point_spent(tomorrow_id)

	# The post-shift summary saves through SaveManager.save_completed, so that
	# signal firing after the browser spent its tape must not spend another one.
	SaveManager.save_completed.emit("slot_2")
	var summary_write_kept_tomorrow: bool = (
		SaveManager.is_save_point_spent(tonight_id)
		and not SaveManager.is_save_point_spent(tomorrow_id)
	)

	SaveManager.clear_spent_save_points()
	var fresh_run_clears: bool = not SaveManager.is_save_point_spent(tonight_id)
	gd.queue_free()
	SaveManager._reset_for_testing()
	return (
		browser_wired
		and distinct_keys
		and tonight_spent
		and tomorrow_offered
		and summary_write_kept_tomorrow
		and fresh_run_clears
	)
