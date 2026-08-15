## GameDirector
## Central signal wiring hub for night_shift.tscn.
## Connects all subsystems: RadioTuner, CallManager, InteractionRaycast,
## TapePickup, SignalStrength, DreadComposure, HUD, CameraManager, PhaseManager,
## SaveManager, TapeInventory, AudioBusManager, ShiftController, StationDegradation.
##
## Systems already wired internally (NOT duplicated here):
## - CallManager → PhaseManager (enter/exit call mode) — done in call_manager.gd
## - CallManager → AudioBusManager (duck_for_call) — done in call_manager.gd
## - ShiftController → CallManager (shift_ended, call_started) — done in shift_controller.gd
## - HUD → RadioTuner/SignalStrength/DreadComposure/TapeInventory/PhaseManager
##   — auto-connected in hud_layout.gd
## - RadioIntegration → InputManager/RadioTuner — done in radio_integration.gd
##
## This node is a child of NightShift root in night_shift.tscn.
class_name GameDirector
extends Node

## Emitted when all systems are wired and the shift is ready to start.
signal systems_ready
## Emitted when the night shift ends.
signal night_complete(shift_num: int, success: bool)

## Flow state
const MAX_SHIFTS: int = 2

## Track wiring state for verification.
var _wiring_complete: bool = false
var _shift_number: int = 1

## References resolved at runtime via the scene tree.
var _radio_tuner: Node
var _call_manager: Node
var _signal_strength: Node
var _dread_composure: Node
var _hud: Node
var _shift_controller: Node
var _station_degradation: Node
var _interaction_raycast: Node
var _camera_manager: Node
var _night_transition: Node
var _shift_summary: Node


func _ready() -> void:
	_resolve_references()
	_wire_signals()
	_wiring_complete = true
	systems_ready.emit()
	print("[GameDirector] All systems wired. Starting flow.")
	_start_flow()


func _resolve_references() -> void:
	# Autoloads
	_call_manager = get_node_or_null("/root/CallManager")
	_shift_controller = get_node_or_null("/root/ShiftController")
	_station_degradation = get_node_or_null("/root/StationDegradation")
	# RadioTuner and friends are children of RadioConsole (instance of radio_integration.tscn)
	var radio_console := get_node_or_null("../RadioConsole")
	if radio_console:
		_radio_tuner = radio_console.get_node_or_null("RadioTuner")
		_signal_strength = radio_console.get_node_or_null("SignalStrength")
		_dread_composure = radio_console.get_node_or_null("DreadComposure")
	# Also try CallManager's children (it creates DreadComposure and SignalStrength)
	if not _signal_strength and _call_manager:
		_signal_strength = _call_manager.get_node_or_null("SignalStrength")
	if not _dread_composure and _call_manager:
		_dread_composure = _call_manager.get_node_or_null("DreadComposure")
	# HUD is a child of NightShift root
	_hud = get_node_or_null("../HUD")
	# NightTransition is a sibling
	_night_transition = get_node_or_null("../NightTransition")
	# ShiftSummary is a sibling
	_shift_summary = get_node_or_null("../ShiftSummary")
	# InteractionRaycast is under StationEnvironment/Player
	var station_env := get_node_or_null("../StationEnvironment")
	if station_env:
		var player := station_env.get_node_or_null("Player")
		if player:
			_interaction_raycast = player.get_node_or_null("InteractionRaycast")
	# CameraManager autoload
	_camera_manager = get_node_or_null("/root/CameraManager")


func _wire_signals() -> void:
	# 1. RadioTuner.frequency_changed → check for incoming calls
	if _radio_tuner and _radio_tuner.has_signal("frequency_changed"):
		_radio_tuner.frequency_changed.connect(_on_frequency_changed)
	# 2. CallManager.call_started/ended → HUD update (ShiftController handles shift lifecycle)
	if _call_manager:
		if _call_manager.has_signal("call_started"):
			_call_manager.call_started.connect(_on_call_started)
		if _call_manager.has_signal("call_ended"):
			_call_manager.call_ended.connect(_on_call_ended)
	# 3. SignalStrength.signal_changed → HUD update (if HUD doesn't auto-connect)
	if _signal_strength and _signal_strength.has_signal("signal_changed"):
		_signal_strength.signal_changed.connect(_on_signal_changed)
	# 4. DreadComposure.dread_changed → degradation + audio
	if _dread_composure and _dread_composure.has_signal("dread_changed"):
		_dread_composure.dread_changed.connect(_on_dread_changed)
	if _dread_composure and _dread_composure.has_signal("composure_break"):
		_dread_composure.composure_break.connect(_on_composure_break)
	# 5. InteractionRaycast.target_changed → HUD prompt
	if _interaction_raycast and _interaction_raycast.has_signal("target_changed"):
		_interaction_raycast.target_changed.connect(_on_interaction_target_changed)
	if _interaction_raycast and _interaction_raycast.has_signal("interact_performed"):
		_interaction_raycast.interact_performed.connect(_on_interact_performed)
	# 6. ShiftController signals (autoload, not scene stub)
	if _shift_controller:
		if _shift_controller.has_signal("shift_started"):
			_shift_controller.shift_started.connect(_on_shift_started)
		if _shift_controller.has_signal("shift_complete"):
			_shift_controller.shift_complete.connect(_on_shift_complete)
		if _shift_controller.has_signal("shift_phase_changed"):
			_shift_controller.shift_phase_changed.connect(_on_shift_phase_changed)
	# 7. StationDegradation signals (autoload, not scene stub)
	if _station_degradation:
		if _station_degradation.has_signal("degradation_applied"):
			_station_degradation.degradation_applied.connect(_on_degradation_applied)
		if _station_degradation.has_signal("wrongness_event_triggered"):
			_station_degradation.wrongness_event_triggered.connect(_on_wrongness_event)
	# 8. NightTransition
	if _night_transition and _night_transition.has_signal("transition_complete"):
		_night_transition.transition_complete.connect(_on_transition_complete)
	# 9. ShiftSummary
	if _shift_summary and _shift_summary.has_signal("continue_pressed"):
		_shift_summary.continue_pressed.connect(_on_summary_continue)
	# 10. CameraManager signals
	if _camera_manager:
		if _camera_manager.has_signal("camera_transition_started"):
			_camera_manager.camera_transition_started.connect(_on_camera_transition_started)
		if _camera_manager.has_signal("camera_transition_completed"):
			_camera_manager.camera_transition_completed.connect(_on_camera_transition_completed)


# --- Flow Orchestration ---


func _start_flow() -> void:
	# Begin Night 1 transition
	_transition_to_night(1)


func _transition_to_night(night_number: int) -> void:
	_shift_number = night_number
	if _night_transition and _night_transition.has_method("start_transition"):
		_night_transition.start_transition(night_number)
	else:
		# No transition available — start shift directly
		_begin_shift(night_number)


func _on_transition_complete() -> void:
	_begin_shift(_shift_number)


func _begin_shift(night_number: int) -> void:
	if _shift_controller and _shift_controller.has_method("start_shift"):
		_shift_controller.start_shift(night_number)
	else:
		print(
			(
				"[GameDirector] WARNING: ShiftController not available, cannot start shift %d"
				% night_number
			)
		)


func _on_shift_complete(shift_number: int) -> void:
	print("[GameDirector] Shift %d complete." % shift_number)
	_show_shift_summary(shift_number)


func _show_shift_summary(shift_number: int) -> void:
	if _shift_summary and _shift_summary.has_method("set_summary_data"):
		# Gather stats from various systems
		var calls_taken: int = 0
		var tapes_collected: int = 0
		var bands_unlocked: Array = []
		if _shift_controller and _shift_controller.has_method("get_call_count"):
			calls_taken = _shift_controller.get_call_count()
		var tape_inv := get_node_or_null("/root/TapeInventory")
		if tape_inv and tape_inv.has_method("get_collected_count"):
			tapes_collected = tape_inv.get_collected_count()
		if _shift_controller and _shift_controller.has_method("get_unlocked_bands"):
			bands_unlocked = _shift_controller.get_unlocked_bands()
		_shift_summary.set_summary_data(
			shift_number, calls_taken, tapes_collected, bands_unlocked.size()
		)
	if _shift_summary:
		_shift_summary.visible = true


func _on_summary_continue() -> void:
	if _shift_summary:
		_shift_summary.visible = false
	if _shift_number >= MAX_SHIFTS:
		_return_to_main_menu()
	else:
		_transition_to_night(_shift_number + 1)


func _return_to_main_menu() -> void:
	print("[GameDirector] All shifts complete. Returning to main menu.")
	get_tree().change_scene_to_file("res://scenes/main_menu.tscn")


# --- Public API (for tests) ---


func start_night_shift(shift_num: int = 1) -> void:
	_shift_number = shift_num
	if _shift_controller and _shift_controller.has_method("start_shift"):
		_shift_controller.start_shift(shift_num)
	print("[GameDirector] Night shift %d started." % shift_num)


func end_night_shift(success: bool = true) -> void:
	if _shift_controller and _shift_controller.has_method("end_shift"):
		_shift_controller.end_shift()
	night_complete.emit(_shift_number, success)
	print("[GameDirector] Night shift %d ended. Success: %s" % [_shift_number, success])


func is_wiring_complete() -> bool:
	return _wiring_complete


func get_shift_number() -> int:
	return _shift_number


# --- Signal Handlers ---


func _on_frequency_changed(_freq: float) -> void:
	# RadioTuner frequency changed — CallManager manages its own call state
	pass


func _on_call_started(call_data: Dictionary) -> void:
	# Update HUD call info
	if _hud and _hud.has_method("set_call_text"):
		var caller_id: String = call_data.get("caller_id", "???")
		var call_type: String = call_data.get("call_type", "unknown")
		_hud.set_call_text(caller_id, call_type)


func _on_call_ended(_call_data: Dictionary, _outcome: String) -> void:
	# Clear HUD call info
	if _hud and _hud.has_method("set_call_text"):
		_hud.set_call_text("", "")


func _on_shift_started(shift_num: int) -> void:
	_shift_number = shift_num
	# Initialize signal and dread for the shift
	if _signal_strength and _signal_strength.has_method("start_shift"):
		_signal_strength.start_shift()
	print("[GameDirector] Shift %d started." % shift_num)


func _on_shift_phase_changed(phase: String) -> void:
	print("[GameDirector] Shift phase: %s" % phase)


func _on_signal_changed(_signal_value: float) -> void:
	# HUD auto-connects to signal_strength
	pass


func _on_dread_changed(_dread: float) -> void:
	# HUD auto-connects to dread_composure
	pass


func _on_composure_break() -> void:
	# DreadComposure auto-tunes to REDACTED band on break
	# Additional: trigger stinger if available
	var stinger := get_node_or_null("/root/StingerSystem")
	if stinger and stinger.has_method("play_stinger"):
		stinger.play_stinger()


func _on_interaction_target_changed(target: Node) -> void:
	# Update HUD interaction prompt
	if _hud and target and _hud.has_method("set_subtitle"):
		var prompt := ""
		if target.has_method("get_prompt_text"):
			prompt = target.get_prompt_text()
		_hud.set_subtitle(prompt)


func _on_interact_performed(target: Node) -> void:
	# Handle interaction — target.interact() is already called by InteractionRaycast
	# Check for save cassette via type check
	if target is CassetteTape:
		var save_mgr := get_node_or_null("/root/SaveManager")
		if save_mgr and save_mgr.has_method("save_game"):
			var tape_id: String = target.get("tape_id") if "tape_id" in target else "auto"
			var save_data := SaveData.new()
			save_data.shift = _shift_number
			save_mgr.save_game(tape_id, save_data)
	# Check for tape pickup via type check
	elif target is TapePickup:
		# TapePickup handles its own collection
		pass


func _on_degradation_applied(shift_number: int) -> void:
	print("[GameDirector] Degradation applied for shift %d" % shift_number)


func _on_wrongness_event(event_id: String, description: String) -> void:
	print("[GameDirector] Wrongness event: %s — %s" % [event_id, description])
	if _hud and _hud.has_method("set_subtitle"):
		_hud.set_subtitle(description)


func _on_camera_transition_started(new_id: String, old_id: String) -> void:
	print("[GameDirector] Camera transition: %s → %s" % [old_id, new_id])


func _on_camera_transition_completed(angle_id: String) -> void:
	if _hud and _hud.has_method("set_subtitle"):
		_hud.set_subtitle("Camera: %s" % angle_id)
