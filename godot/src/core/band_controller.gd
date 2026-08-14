## BandController — autoload singleton managing active band, cross-pollination, and PIRATE drift.
##
## Centralizes band system logic previously scattered across RadioTuner and SignalStrength.
## Loaded as autoload after ShiftController in project.godot.
extends Node
class_name BandController

signal band_changed(band_id: int)
signal pirate_drift_changed(offset: float)

const PIRATE_BAND_ID: int = 6
const REDACTED_BAND_ID: int = 4
const PIRATE_DRIFT_INTERVAL: float = 30.0
const PIRATE_DRIFT_RANGE: float = 0.3
const NATIVE_MULTIPLIER: float = 1.0
const NON_NATIVE_MULTIPLIER: float = 0.4

var band_config: BandConfig
var active_band_id: int = 0
var _pirate_drift_offset: float = 0.0
var _pirate_drift_timer: Timer


func _ready() -> void:
	_load_band_config()
	_setup_pirate_drift_timer()


func _load_band_config() -> void:
	band_config = load("res://src/data/band_config.tres")
	if band_config == null:
		push_error("BandController: Failed to load band_config.tres")


func _setup_pirate_drift_timer() -> void:
	_pirate_drift_timer = Timer.new()
	_pirate_drift_timer.name = "PirateDriftTimer"
	_pirate_drift_timer.wait_time = PIRATE_DRIFT_INTERVAL
	_pirate_drift_timer.autostart = true
	_pirate_drift_timer.timeout.connect(_on_pirate_drift_timeout)
	add_child(_pirate_drift_timer)


## Returns the BandData for the currently active band.
func get_active_band() -> BandData:
	if band_config == null:
		return null
	return band_config.get_band(active_band_id)


## Sets the active band and emits band_changed.
func set_active_band(band_id: int) -> void:
	if band_id < 0 or band_id >= band_config.get_band_count():
		push_warning("BandController: Invalid band_id %d" % band_id)
		return
	if band_id == active_band_id:
		return
	active_band_id = band_id
	band_changed.emit(band_id)


## Called by RadioTuner.set_band() to directly set the active band by ID.
func on_band_changed(band_id: int) -> void:
	if band_config == null:
		return
	if band_id < 0 or band_id >= band_config.get_band_count():
		return
	if band_id != active_band_id:
		active_band_id = band_id
		band_changed.emit(band_id)


## Called by RadioTuner when frequency changes to update active band tracking.
## known_band_id is the tuner's current_band_id, used as fallback when the
## frequency falls outside any band's range or in another band's range.
func on_frequency_changed(freq: float, known_band_id: int = -1) -> void:
	if band_config == null:
		return
	var band_id: int = band_config.find_band_by_frequency(freq)
	if known_band_id != -1 and (band_id == -1 or band_id != known_band_id):
		band_id = known_band_id
	if band_id != -1 and band_id != active_band_id:
		active_band_id = band_id
		band_changed.emit(band_id)


## Returns cross-pollination multiplier: native bands get 1.0, non-native get 0.4.
## location_id maps to phase: 0=LIVING, 1=LIMINAL, 2=LOST, 3=████████ (redacted).
func get_cross_pollination_multiplier(band_id: int, location_id: int) -> float:
	var native_band_id: int = _get_native_band_id(location_id)
	if band_id == native_band_id:
		return NATIVE_MULTIPLIER
	return NON_NATIVE_MULTIPLIER


## Returns PIRATE band center frequency with current drift offset applied.
func get_pirate_center_frequency() -> float:
	if band_config == null:
		return 0.0
	var pirate: BandData = band_config.get_band(PIRATE_BAND_ID)
	if pirate == null:
		return 0.0
	return pirate.center_frequency + _pirate_drift_offset


## Returns current PIRATE drift offset.
func get_pirate_drift_offset() -> float:
	return _pirate_drift_offset


## Returns true if the redacted band (████████) is the active band.
func is_redacted_band_active() -> bool:
	return active_band_id == REDACTED_BAND_ID


## Returns true if the redacted band (████████) has been unlocked.
## Delegates to BandUnlockManager if present in the scene tree.
func is_redacted_band_unlocked() -> bool:
	var unlock_manager: Node = get_node_or_null("/root/BandUnlockManager")
	if unlock_manager and unlock_manager.has_method("is_redacted_band_unlocked"):
		return unlock_manager.is_redacted_band_unlocked()
	return false


## Maps location/phase ID to native band ID.
static func _get_native_band_id(location_id: int) -> int:
	# Phase 0 (P1) → LIVING (0), 1 (P2) → LIMINAL (1), 2 (P3) → LOST (2), 3 (P4) → ████████ (4)
	match location_id:
		0: return 0  # LIVING
		1: return 1  # LIMINAL
		2: return 2  # LOST
		3: return 4  # ████████ (REDACTED)
		_: return 0  # Default to LIVING


func _on_pirate_drift_timeout() -> void:
	_pirate_drift_offset = randf_range(-PIRATE_DRIFT_RANGE, PIRATE_DRIFT_RANGE)
	pirate_drift_changed.emit(_pirate_drift_offset)
