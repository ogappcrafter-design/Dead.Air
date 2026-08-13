## SilenceSystem
## Dead air event manager — triggers silence/dead air moments where radio drops
## and the player is left with room tone, breathing, and dread.
## Reference: DEA-140, GDD §Godot Audio Bus Layout (SILENCE bus)
extends Node

# ─── Signals ───────────────────────────────────────────────────────────
signal dead_air_started
signal dead_air_ended
signal composure_changed(new_value: float)

# ─── State ─────────────────────────────────────────────────────────────
enum State { IDLE, DEAD_AIR }

var _state: State = State.IDLE
var _dead_air_duration: float = 0.0
var _muted_buses: Array[int] = []

# ─── Duration range (seconds) ──────────────────────────────────────────
const MIN_DURATION := 8.0
const MAX_DURATION := 20.0

# ─── Composure (0-100, 100 = calm, 0 = panicked) ───────────────────────
const MAX_COMPOSURE := 100.0
const MIN_COMPOSURE := 0.0
var _composure: float = MAX_COMPOSURE

# ─── Breathing volume mapping (dB) ────────────────────────────────────
# Low composure (0) → loud breathing (-6 dB)
# High composure (100) → quiet breathing (-24 dB)
const BREATHING_VOL_PANIC := -6.0
const BREATHING_VOL_CALM := -24.0

# ─── Buses muted during dead air (Phases 1-3) ─────────────────────────
# RadioAmbient, CallAudio, Stinger → muted
# RoomTone stays audible (becomes prominent), DreadLayer stays, Silence stays
const _PHASE_1_3_MUTED_BUSES: Array[int] = [
	2,  # IDX_RADIO_AMBIENT
	3,  # IDX_CALL_AUDIO
	5,  # IDX_STINGER
]

# ─── Buses additionally muted in Phase 4 (total silence) ──────────────
# ALL non-SILENCE, non-UI buses are muted — only breathing remains
const _PHASE_4_MUTED_BUSES: Array[int] = [
	1,  # IDX_ROOM_TONE
	2,  # IDX_RADIO_AMBIENT
	3,  # IDX_CALL_AUDIO
	4,  # IDX_DREAD_LAYER
	5,  # IDX_STINGER
]

# ─── Breathing AudioStreamPlayer (on SILENCE bus) ──────────────────────
var _breathing_player: AudioStreamPlayer

# ─── Dead air timer ──────────────────────────────────────────────────
var _dead_air_timer: Timer

# ─── Phase tracking ──────────────────────────────────────────────────
var _current_phase: int = 0  # PhaseEnums.Phase.PHASE_1_STATION


# ─── Lifecycle ────────────────────────────────────────────────────────
func _ready() -> void:
	# Create breathing player on SILENCE bus
	_breathing_player = AudioStreamPlayer.new()
	_breathing_player.name = "BreathingPlayer"
	_breathing_player.bus = AudioBusManager.BUS_SILENCE
	_breathing_player.volume_db = BREATHING_VOL_CALM
	add_child(_breathing_player)

	# Create dead air timer (one-shot)
	_dead_air_timer = Timer.new()
	_dead_air_timer.name = "DeadAirTimer"
	_dead_air_timer.one_shot = true
	_dead_air_timer.timeout.connect(_on_dead_air_timeout)
	add_child(_dead_air_timer)

	# Connect to PhaseManager if available
	if Engine.has_singleton("PhaseManager") or _has_autoload("PhaseManager"):
		var pm = _get_phase_manager()
		if pm and pm.has_signal("phase_changed"):
			_current_phase = pm.get_phase()
			pm.phase_changed.connect(_on_phase_changed)


# ─── Public API: Dead Air Control ────────────────────────────────────
## Trigger a dead air event. Mutes radio buses, starts breathing, sets a
## random duration timer (8-20s). In Phase 4, ALL audio buses are muted.
func trigger_dead_air() -> void:
	if _state == State.DEAD_AIR:
		return  # Already in dead air

	_state = State.DEAD_AIR
	_dead_air_duration = _generate_duration()

	# Determine which buses to mute based on phase
	# .duplicate() is critical: _get_buses_to_mute() returns a const array reference;
	# without duplication, _muted_buses.clear() in end_dead_air() crashes with
	# "Array is in read-only state" because the var holds a reference to the const.
	_muted_buses = _get_buses_to_mute().duplicate()

	# Mute the buses
	for bus_idx in _muted_buses:
		AudioBusManager.set_bus_mute(bus_idx, true)

	# Start breathing
	_update_breathing_volume()
	if _breathing_player.stream:
		_breathing_player.play()

	# Start the timer
	_dead_air_timer.start(_dead_air_duration)

	dead_air_started.emit()


## End the current dead air event. Unmutes all buses, stops breathing.
func end_dead_air() -> void:
	if _state != State.DEAD_AIR:
		return  # Not in dead air

	_state = State.IDLE
	_dead_air_timer.stop()

	# Unmute all previously muted buses
	for bus_idx in _muted_buses:
		AudioBusManager.set_bus_mute(bus_idx, false)
	_muted_buses.clear()

	# Stop breathing
	_breathing_player.stop()

	dead_air_ended.emit()


## Returns true if a dead air event is currently active.
func is_dead_air_active() -> bool:
	return _state == State.DEAD_AIR


## Returns the duration of the current/last dead air event (seconds).
func get_dead_air_duration() -> float:
	return _dead_air_duration


## Returns the current state.
func get_state() -> State:
	return _state


# ─── Public API: Composure ───────────────────────────────────────────
## Set composure level (0-100). Lower composure = louder breathing.
func set_composure(value: float) -> void:
	_composure = clampf(value, MIN_COMPOSURE, MAX_COMPOSURE)
	_update_breathing_volume()
	composure_changed.emit(_composure)


## Get current composure level.
func get_composure() -> float:
	return _composure


# ─── Public API: Breathing ────────────────────────────────────────────
## Set the breathing audio stream. Call this to assign a breathing sample.
func set_breathing_stream(stream: AudioStream) -> void:
	_breathing_player.stream = stream


## Get the breathing AudioStreamPlayer (for testing or external control).
func get_breathing_player() -> AudioStreamPlayer:
	return _breathing_player


# ─── Internal: Duration Generation ───────────────────────────────────
## Generate a random dead air duration between MIN_DURATION and MAX_DURATION.
## Separated for testability.
func _generate_duration() -> float:
	return randf_range(MIN_DURATION, MAX_DURATION)


# ─── Internal: Phase-Aware Bus Selection ─────────────────────────────
## Returns the list of bus indices to mute based on the current phase.
## Phases 1-3: mute RadioAmbient, CallAudio, Stinger.
## Phase 4: mute ALL non-SILENCE, non-UI buses (total silence).
func _get_buses_to_mute() -> Array[int]:
	if _current_phase == PhaseEnums.Phase.PHASE_4_DESCENT:
		return _PHASE_4_MUTED_BUSES
	return _PHASE_1_3_MUTED_BUSES


# ─── Internal: Breathing Volume ─────────────────────────────────────
## Update breathing volume based on current composure level.
## Low composure → loud breathing; high composure → quiet breathing.
func _update_breathing_volume() -> void:
	var t: float = 1.0 - (_composure / MAX_COMPOSURE)  # 0=calm, 1=panic
	_breathing_player.volume_db = lerpf(BREATHING_VOL_CALM, BREATHING_VOL_PANIC, t)


# ─── Internal: Phase Tracking ────────────────────────────────────────
func _on_phase_changed(_old_phase: int, new_phase: int) -> void:
	_current_phase = new_phase


# ─── Internal: Timer Callback ────────────────────────────────────────
func _on_dead_air_timeout() -> void:
	end_dead_air()


# ─── Internal: Autoload Access ───────────────────────────────────────
## Safely get PhaseManager autoload. Returns null if not available.
func _get_phase_manager() -> Node:
	var tree = get_tree()
	if tree and tree.root:
		return tree.root.get_node_or_null("/root/PhaseManager")
	return null


## Check if an autoload is registered.
func _has_autoload(name: String) -> bool:
	# In Godot 4, autoloads are accessible as global script variables.
	# This checks if the autoload node exists in the scene tree.
	var tree = get_tree()
	if tree and tree.root:
		return tree.root.has_node("/root/" + name)
	return false
