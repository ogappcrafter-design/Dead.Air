## GameDirector
## Central signal wiring hub for night_shift.tscn.
## Connects all subsystems: RadioTuner, CallManager, InteractionRaycast,
## TapePickup, SignalStrength, DreadComposure, HUD, CameraManager, PhaseManager,
## SaveManager, TapeInventory, AudioBusManager, ShiftStub, DegradationStub.
##
## Systems already wired internally (NOT duplicated here):
## - CallManager → PhaseManager (enter/exit call mode) — done in call_manager.gd
## - CallManager → AudioBusManager (duck_for_call) — done in call_manager.gd
## - HUD → RadioTuner/SignalStrength/DreadComposure/TapeInventory/PhaseManager
##   — auto-connected in hud_layout.gd
## - RadioIntegration → InputManager/RadioTuner — done in radio_integration.gd
##
## This node is a child of NightShift root in night_shift.tscn.
extends Node
class_name GameDirector

const InputGlyphs := preload("res://src/ui/input_glyphs.gd")
const PHASE2_SCENE := "res://scenes/phase2/threshold.tscn"
const SaveLoadScreen := preload("res://src/ui/save_load_screen.gd")

## Emitted when all systems are wired and the shift is ready to start.
signal systems_ready
## Emitted when the night shift ends.
signal night_complete(shift_num: int, success: bool)

## Track wiring state for verification.
var _wiring_complete: bool = false
var _shift_number: int = 1
# Scene-change seam: tests shadow this instead of swapping the runner scene.
var request_scene_change: Callable = Callable()

## References resolved at runtime via the scene tree.
var _radio_tuner: Node
var _call_manager: Node
var _signal_strength: Node
var _dread_composure: Node
var _hud: Node
var _interact_prompt: Node
var _examine_display: Node
var _shift_summary: ShiftSummary
var _shift_stub: Node
var _degradation_stub: Node
var _interaction_raycast: Node
var _camera_manager: Node
# DEA-111: ShiftController autoload (shift data lookup) + TutorialManager
var _shift_controller: Node
var _tutorial_manager: Node
var _save_load_screen: SaveLoadScreen = null
# Save cassette that opened the room browser, so a completed slot write can
# spend it: the numbered slot is not the tape's own key.
var _active_save_point: CassetteTape = null


func _ready() -> void:
	_resolve_references()
	if request_scene_change.is_null() or not request_scene_change.is_valid():
		request_scene_change = Callable(get_tree(), "change_scene_to_file")
	# Create TutorialManager as child of GameDirector
	_tutorial_manager = TutorialManager.new()
	_tutorial_manager.name = "TutorialManager"
	add_child(_tutorial_manager)
	_wire_signals()
	_refresh_save_points()
	_apply_loaded_scene_state()
	# A tape loaded from the title restores its shift phase before this scene is
	# built, so shift_phase_changed has already fired and the summary would stay
	# hidden. Re-apply the controller's phase once the listeners exist.
	_sync_restored_shift_phase()
	_wiring_complete = true
	systems_ready.emit()
	print("[GameDirector] All systems wired. Shift %d ready." % _shift_number)


func _resolve_references() -> void:
	# Autoloads
	_call_manager = get_node_or_null("/root/CallManager")
	# SignalStrength and DreadComposure are owned by CallManager (single instances)
	if _call_manager:
		_signal_strength = _call_manager.get_node_or_null("SignalStrength")
		_dread_composure = _call_manager.get_node_or_null("DreadComposure")
	# RadioTuner is a child of RadioConsole (instance of radio_integration.tscn)
	var radio_console := get_node_or_null("../RadioConsole")
	if radio_console:
		_radio_tuner = radio_console.get_node_or_null("RadioTuner")
	# HUD is a child of NightShift root
	_hud = get_node_or_null("../HUD")
	# Dedicated interaction prompt + close-up display (night_shift.tscn InteractionUI)
	_interact_prompt = get_node_or_null("../InteractionUI/InteractPrompt")
	_examine_display = get_node_or_null("../InteractionUI/ExamineDisplay")
	_shift_summary = get_node_or_null("../InteractionUI/ShiftSummary") as ShiftSummary
	# Stubs are siblings
	_shift_stub = get_node_or_null("../ShiftController")
	_degradation_stub = get_node_or_null("../StationDegradation")
	# InteractionRaycast is under StationEnvironment/Player
	var station_env := get_node_or_null("../StationEnvironment")
	if station_env:
		var player := station_env.get_node_or_null("Player")
		if player:
			_interaction_raycast = player.get_node_or_null("InteractionRaycast")
	# CameraManager autoload
	_camera_manager = get_node_or_null("/root/CameraManager")
	# DEA-111: ShiftController autoload (authoritative shift data)
	_shift_controller = get_node_or_null("/root/ShiftController")


func _wire_signals() -> void:
	# 1. RadioTuner.frequency_changed → check for incoming calls
	if _radio_tuner and _call_manager:
		if _radio_tuner.has_signal("frequency_changed"):
			_radio_tuner.frequency_changed.connect(_on_frequency_changed)
	# 2. CallManager.call_started → HUD.show_call_info + shift progress
	if _call_manager:
		if _call_manager.has_signal("call_started"):
			_call_manager.call_started.connect(_on_call_started)
		if _call_manager.has_signal("call_ended"):
			_call_manager.call_ended.connect(_on_call_ended)
		if _call_manager.has_signal("shift_started"):
			_call_manager.shift_started.connect(_on_shift_started)
		if _call_manager.has_signal("shift_ended"):
			_call_manager.shift_ended.connect(_on_shift_ended)
	# 3. SignalStrength.signal_changed → HUD update (if HUD doesn't auto-connect)
	if _signal_strength and _signal_strength.has_signal("signal_changed"):
		_signal_strength.signal_changed.connect(_on_signal_changed)
	# 4. DreadComposure.dread_changed → degradation + audio
	if _dread_composure and _dread_composure.has_signal("dread_changed"):
		_dread_composure.dread_changed.connect(_on_dread_changed)
	if _dread_composure and _dread_composure.has_signal("composure_break"):
		_dread_composure.composure_break.connect(_on_composure_break)
	if _dread_composure and _dread_composure.has_signal("composure_changed"):
		_dread_composure.composure_changed.connect(_on_composure_changed)
	# 5. InteractionRaycast.target_changed → HUD prompt
	if _interaction_raycast and _interaction_raycast.has_signal("target_changed"):
		_interaction_raycast.target_changed.connect(_on_interaction_target_changed)
	if _interaction_raycast and _interaction_raycast.has_signal("interact_performed"):
		_interaction_raycast.interact_performed.connect(_on_interact_performed)
	if _interaction_raycast and _interaction_raycast.has_signal("examine_performed"):
		_interaction_raycast.examine_performed.connect(_on_examine_performed)
	# 6. TapePickup.tape_picked_up → TapeInventory (handled in tape_pickup.gd itself)
	# But we wire it for notification + degradation
	# 7. ShiftStub signals
	if _shift_stub:
		if _shift_stub.has_signal("shift_started"):
			_shift_stub.shift_started.connect(_on_stub_shift_started)
		if _shift_stub.has_signal("shift_ended"):
			_shift_stub.shift_ended.connect(_on_stub_shift_ended)
	# The ShiftController autoload is authoritative for the shift number and
	# save availability, so refresh save slots when it starts a shift.
	if _shift_controller and _shift_controller.has_signal("shift_started"):
		_shift_controller.shift_started.connect(_on_controller_shift_started)
	if _shift_controller and _shift_controller.has_signal("shift_phase_changed"):
		_shift_controller.shift_phase_changed.connect(_on_shift_phase_changed)
	if _shift_controller and _shift_controller.has_signal("phase2_transition_ready"):
		_shift_controller.phase2_transition_ready.connect(_on_phase2_transition_ready)
	# 8. DegradationStub signals
	if _degradation_stub:
		if _degradation_stub.has_signal("degradation_changed"):
			_degradation_stub.degradation_changed.connect(_on_degradation_changed)
	# 9. CameraManager signals
	if _camera_manager:
		if _camera_manager.has_signal("camera_transition_started"):
			_camera_manager.camera_transition_started.connect(_on_camera_transition_started)
		if _camera_manager.has_signal("camera_transition_completed"):
			_camera_manager.camera_transition_completed.connect(_on_camera_transition_completed)


func end_night_shift(success: bool = true) -> void:
	if _call_manager and _call_manager.has_method("end_shift"):
		_call_manager.end_shift()
	elif _shift_stub and _shift_stub.has_method("end_shift"):
		_shift_stub.end_shift()
	night_complete.emit(_shift_number, success)
	print("[GameDirector] Night shift %d ended. Success: %s" % [_shift_number, success])


func is_wiring_complete() -> bool:
	return _wiring_complete


func get_shift_number() -> int:
	return _shift_number


# --- Signal Handlers ---


func _on_frequency_changed(_freq: float) -> void:
	# RadioTuner frequency changed — check if CallManager should trigger a call
	# CallManager manages its own call state machine; this is a hook point
	pass


func _on_call_started(call_data: Dictionary) -> void:
	# CallManager already calls PhaseManager.enter_call_mode internally
	# Update HUD call info
	if _hud and _hud.has_method("set_call_text"):
		var caller_id: String = call_data.get("caller_id", "???")
		var call_type: String = call_data.get("call_type", "unknown")
		_hud.set_call_text(caller_id, call_type)
	# Update shift progress
	if _shift_stub and _shift_stub.has_method("update_progress"):
		_shift_stub.update_progress(0.1)
	# Notify TutorialManager (DEA-111)
	if _tutorial_manager and _tutorial_manager.has_method("on_call_started"):
		_tutorial_manager.on_call_started(call_data)


func _on_call_ended(_call_data: Dictionary, outcome: String) -> void:
	# CallManager already calls PhaseManager.exit_call_mode internally
	# Clear HUD call info
	if _hud and _hud.has_method("set_call_text"):
		_hud.set_call_text("", "")
	# Update shift progress
	if _shift_stub and _shift_stub.has_method("update_progress"):
		_shift_stub.update_progress(0.3)
	# Feed degradation based on outcome
	if _degradation_stub and _degradation_stub.has_method("add_degradation"):
		match outcome:
			"bad":
				_degradation_stub.add_degradation(0.15)
			"neutral":
				_degradation_stub.add_degradation(0.05)
			"good":
				_degradation_stub.add_degradation(-0.05)
			_:
				pass


func _on_shift_started(shift_num: int) -> void:
	# CallManager uses 0-indexed shift numbers; shift data and TutorialManager
	# are 1-indexed. Convert before storing or forwarding.
	var shift_num_1: int = shift_num + 1
	_shift_number = shift_num_1
	_refresh_save_points()
	# Initialize signal and dread for the shift
	if _signal_strength and _signal_strength.has_method("start_shift"):
		_signal_strength.start_shift()
	# Notify TutorialManager if tutorial is enabled for this shift (DEA-111/112)
	if _tutorial_manager and _tutorial_manager.has_method("on_shift_started"):
		var tutorial_enabled := false
		if _shift_controller and _shift_controller.has_method("get_shift_data"):
			var data: Dictionary = _shift_controller.get_shift_data(shift_num_1)
			tutorial_enabled = data.get("tutorial", false)
		_tutorial_manager.on_shift_started(shift_num_1, tutorial_enabled)


func _on_shift_ended(_shift_num: int) -> void:
	end_night_shift(true)


func _on_signal_changed(signal_value: float) -> void:
	# HUD auto-connects to signal_strength, but we also feed degradation
	if _degradation_stub and _degradation_stub.has_method("add_degradation"):
		if signal_value < 20.0:
			_degradation_stub.add_degradation(0.02)


func _on_dread_changed(dread: float) -> void:
	# HUD auto-connects to dread_composure
	# Feed degradation based on dread
	if _degradation_stub and _degradation_stub.has_method("add_degradation"):
		_degradation_stub.add_degradation(dread * 0.001)


func _on_composure_changed(value: float) -> void:
	# Forward to TutorialManager
	if _tutorial_manager and _tutorial_manager.has_method("on_composure_changed"):
		_tutorial_manager.on_composure_changed(value)


func _on_composure_break() -> void:
	# DreadComposure auto-tunes to REDACTED band on break
	# Additional: trigger stinger if available
	var stinger := get_node_or_null("/root/StingerSystem")
	if stinger and stinger.has_method("play_stinger"):
		stinger.play_stinger()
	# Spike degradation
	if _degradation_stub and _degradation_stub.has_method("add_degradation"):
		_degradation_stub.add_degradation(0.2)


func _on_interaction_target_changed(target: Node) -> void:
	# Update the interaction prompt with the live glyph for the "interact"
	# action so rebinding and device switches are reflected (DEA-191).
	var prompt := ""
	if target and target.has_method("get_prompt_text"):
		prompt = target.get_prompt_text()

	# Dedicated prompt surface: the glyph comes from the current InputMap.
	if _interact_prompt != null:
		if prompt.is_empty():
			_interact_prompt.hide_prompt()
		else:
			_interact_prompt.show_prompt_for_action("interact", prompt)

	if _hud and target and _hud.has_method("set_subtitle"):
		var subtitle := ""
		if not prompt.is_empty() and _interact_prompt == null:
			# No dedicated prompt node in this scene — fall back to the
			# subtitle, formatted with the current interact glyph.
			subtitle = InputGlyphs.format_prompt("interact", prompt, InputManager.get_last_device())
		_hud.set_subtitle(subtitle)


func _on_examine_performed(target: Node, text: String) -> void:
	# DEA-193: open the close-up overlay for the examined target.
	if _examine_display != null and _examine_display.has_method("show_examine"):
		_examine_display.show_examine(target, text)


func _on_interact_performed(target: Node) -> void:
	# Handle interaction — target.interact() is already called by InteractionRaycast
	# Only safe-room save cassettes save; pickup cassettes are consumed by
	# interact() and must not double as a save point.
	if target is CassetteTape:
		var tape := target as CassetteTape
		if not tape.is_save_point:
			return
		_open_save_room_browser(tape)
	# Check for tape pickup via type check
	elif target is TapePickup:
		# TapePickup handles its own collection
		# But we can add degradation feedback
		if _degradation_stub and _degradation_stub.has_method("add_degradation"):
			_degradation_stub.add_degradation(-0.02)  # collecting tapes reduces degradation


## Shift number the save slots belong to. The ShiftController autoload is
## authoritative; the stub and CallManager hooks keep _shift_number current.
func _current_shift_number() -> int:
	if _shift_controller != null and _shift_controller.has_method("get_current_shift"):
		var current := int(_shift_controller.get_current_shift())
		if current > 0:
			return current
	return _shift_number


## Give every save cassette the current shift's slot. A save in one shift then
## does not consume the booth cassette for the next shift (GDD: Shifts 2-4).
func _refresh_save_points() -> void:
	var shift := _current_shift_number()
	var save_available := true
	if _shift_controller != null and _shift_controller.has_method("is_save_available"):
		save_available = bool(_shift_controller.is_save_available())
	for node in get_tree().get_nodes_in_group("interactable"):
		var tape := node as CassetteTape
		if tape != null and tape.is_save_point:
			tape.configure_save_shift(shift, save_available)


func _on_controller_shift_started(shift_number: int) -> void:
	_shift_number = shift_number
	_refresh_save_points()


func _on_shift_phase_changed(phase: String) -> void:
	if _shift_summary == null:
		return
	if phase == "post_shift":
		var bands := 0
		if _shift_controller and _shift_controller.has_method("get_unlocked_bands"):
			bands = _shift_controller.get_unlocked_bands().size()
		var tapes := 0
		if TapeInventory != null and TapeInventory.has_method("get_collected_count"):
			tapes = TapeInventory.get_collected_count()
		var completed := 0
		if _shift_controller and _shift_controller.has_method("get_completed_call_count"):
			completed = _shift_controller.get_completed_call_count()
		_shift_summary.set_summary_data(_shift_number, completed, tapes, bands)
		var save_available := false
		if _shift_controller and _shift_controller.has_method("is_save_available"):
			save_available = bool(_shift_controller.is_save_available())
		_shift_summary.set_save_available(save_available)
		_shift_summary.visible = true
	else:
		_shift_summary.visible = false


## Re-apply the phase a loaded tape resumed into. The post-shift summary is the
## case that matters: resume_post_shift() runs from the title menu, before the
## gameplay scene that listens for it exists, so without this the loaded night
## opens with no summary and no Continue control.
func _sync_restored_shift_phase() -> void:
	if _shift_controller == null or not _shift_controller.has_method("is_shift_active"):
		return
	if not bool(_shift_controller.is_shift_active()):
		return
	if not _shift_controller.has_method("get_current_phase_name"):
		return
	if _shift_controller.has_method("get_current_shift"):
		_shift_number = int(_shift_controller.get_current_shift())
	_on_shift_phase_changed(String(_shift_controller.get_current_phase_name()))


func _on_phase2_transition_ready() -> void:
	if PhaseManager != null:
		PhaseManager.set_phase(PhaseEnums.Phase.PHASE_2_BREAK)
	request_scene_change.call(PHASE2_SCENE)

## Open the slot browser in SAVE mode: interacting with the save-room
## cassette no longer writes a bare legacy tape directly — the player picks
## a numbered slot and the cassette ritual plays.
func _open_save_room_browser(point: CassetteTape = null) -> void:
	_active_save_point = point
	if _save_load_screen == null:
		_save_load_screen = SaveLoadScreen.new()
		_save_load_screen.name = "SaveRoomBrowser"
		# The station cassette is itself the safe room, so a write from here is
		# always allowed. This has to land before add_child(): _ready() builds the
		# ritual and copies the policy from this flag, and a ritual still requiring
		# DreadComposure.in_safe_room reports SAVE FAILED on a slot the browser had
		# just offered.
		_save_load_screen.enforce_safe_room = false
		# Consume the cassette from this browser's own write, not from the global
		# SaveManager signal: the post-shift summary saves through the same signal,
		# and that must not spend a cassette that never opened a room.
		_save_load_screen.slot_saved.connect(_on_save_point_saved)
		_save_load_screen.closed.connect(_on_save_browser_closed)
		add_child(_save_load_screen)
	else:
		_save_load_screen.set_mode(SaveLoadScreen.Mode.SAVE)
		_save_load_screen.enforce_safe_room = false
		_save_load_screen.show()
	_save_load_screen.refresh()


## A slot write through the room browser consumes the cassette that opened it.
## The write lands in a numbered slot, so the tape's own save index stays empty
## and only this bookkeeping stops the same cassette saving twice tonight.
func _on_save_point_saved(_slot_id: String) -> void:
	var point := _active_save_point
	_active_save_point = null
	if point == null or not is_instance_valid(point):
		return
	var save_mgr := get_node_or_null("/root/SaveManager")
	if save_mgr != null and save_mgr.has_method("mark_save_point_spent"):
		save_mgr.mark_save_point_spent(point.get_save_id())
	if point.has_method("mark_spent"):
		point.mark_spent()


## Hide the save browser when it reports Back, so the full-screen panel does
## not sit over live gameplay.
func _on_save_browser_closed() -> void:
	if _save_load_screen != null:
		# Back can hide the browser while a confirmation is still armed; drop it so
		# reopening cannot replay the old callback.
		_save_load_screen.cancel_pending_confirmation()
		_save_load_screen.hide()
	# Back ends the errand: a cassette that opened the browser but wrote nothing
	# must not be spent by a later save from somewhere else.
	_active_save_point = null


## Apply the staged parts of a loaded save (player position, radio state)
## once the gameplay scene exists to own them.
func _apply_loaded_scene_state() -> void:
	var save_data: SaveData = SaveManager.consume_pending_scene_state()
	if save_data == null:
		return
	# Only a snapshot that actually captured a position may move the player;
	# a tape that stored progress alone would otherwise teleport it to the
	# origin. Coordinates stay scene-relative, so the station player takes
	# the snapshot that belongs to the scene this load flow builds: a Phase 1
	# position. Journey-segment coordinates (liminal safe rooms) belong to
	# scenes this flow does not load — the load paths refuse those tapes.
	var players := get_tree().get_nodes_in_group("player")
	if (
		save_data.has_position
		and save_data.phase == PhaseEnums.Phase.PHASE_1_STATION
		and not players.is_empty()
		and players[0] is Node3D
	):
		(players[0] as Node3D).global_position = Vector3(
			save_data.position_x, save_data.position_y, save_data.position_z
		)
	if save_data.radio_band.is_empty() or not (_radio_tuner is RadioTuner):
		return
	var tuner: RadioTuner = _radio_tuner as RadioTuner
	if not (save_data.radio_band in tuner.band_config.get_band_names()):
		return
	var band: BandData = tuner.band_config.get_band_by_name(save_data.radio_band)
	BandController.unlock_band(band.id)
	tuner.set_band(band.id)
	if save_data.radio_frequency > 0.0:
		tuner.set_frequency(save_data.radio_frequency)


func _on_stub_shift_started(shift_num: int) -> void:
	_shift_number = shift_num
	_refresh_save_points()
	print("[GameDirector] ShiftStub: shift %d started." % shift_num)


func _on_stub_shift_ended(shift_num: int) -> void:
	print("[GameDirector] ShiftStub: shift %d ended." % shift_num)


func _on_degradation_changed(level: float) -> void:
	# Update AudioBusManager dread level
	var abm := get_node_or_null("/root/AudioBusManager")
	if abm and abm.has_method("set_dread_level"):
		abm.set_dread_level(level)
	# Update HUD subtitle for critical degradation
	if level >= 0.75 and _hud and _hud.has_method("set_subtitle"):
		_hud.set_subtitle("The station is falling apart...")


func _on_camera_transition_started(new_id: String, old_id: String) -> void:
	print("[GameDirector] Camera transition: %s → %s" % [old_id, new_id])


func _on_camera_transition_completed(angle_id: String) -> void:
	if _hud and _hud.has_method("set_subtitle"):
		_hud.set_subtitle("Camera: %s" % angle_id)
