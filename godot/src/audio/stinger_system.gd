## StingerSystem
## Autoload singleton for one-shot horror stinger audio cues.
## Stingers duck all other audio by -6 dB for 2 seconds.
## 60-second cooldown per stinger type prevents repetition.
## Reference: DEA-101, GDD §Stinger Bus
extends Node

# ─── Stinger types ─────────────────────────────────────────────────────
enum StingerType {
	WRONGNESS,      # Shift 1-4: dissonant sting (0.5-1 sec)
	SUITS_DETECTED,  # The Suits detected player: low brass swell (2 sec, building)
	COMPOSURE_LOW,  # Composure < 20: CRT shutdown sound (electronic whine down)
	COMPOSURE_CRIT, # Composure < 10: radio feedback scream (1 sec → silence)
	DEAD_AIR,       # Signal = 0 during call: dead air silence hit (negative space)
	MORAL_CHOICE,   # Moral choice made: subtle string pluck (note varies by choice type)
	FALSE_CALL,     # Phase 4 false call begins: corrupted Shift 1-5 call intro
}

# ─── Configuration ──────────────────────────────────────────────────────
const STINGER_VOLUME_DB: float = -6.0
const DUCK_DURATION: float = 2.0
const COOLDOWN_SECONDS: float = 60.0

const COMPOSURE_LOW_THRESHOLD: float = 20.0
const COMPOSURE_CRIT_THRESHOLD: float = 10.0

# ─── Signals ───────────────────────────────────────────────────────────
signal stinger_triggered(stinger_type: int)
signal stinger_cooldown_blocked(stinger_type: int)

# ─── State ─────────────────────────────────────────────────────────────
var _last_trigger_time: Dictionary = {}  # StingerType -> float (seconds)
var _duck_timer: Timer
var _stinger_player: AudioStreamPlayer
var _composure: DreadComposure
var _signal_strength: SignalStrength
var _phase_manager: Node

# Track previous composure to detect threshold crossing
var _prev_composure: float = 100.0


# ─── Lifecycle ─────────────────────────────────────────────────────────
func _ready() -> void:
	# Create stinger AudioStreamPlayer on STINGER bus
	_stinger_player = AudioStreamPlayer.new()
	_stinger_player.name = "StingerPlayer"
	_stinger_player.bus = AudioBusManager.BUS_STINGER
	_stinger_player.volume_db = STINGER_VOLUME_DB
	add_child(_stinger_player)

	# Create duck timer (2 sec, one-shot)
	_duck_timer = Timer.new()
	_duck_timer.name = "DuckTimer"
	_duck_timer.one_shot = true
	_duck_timer.wait_time = DUCK_DURATION
	_duck_timer.timeout.connect(_on_duck_timer_timeout)
	add_child(_duck_timer)

	# Connect to PhaseManager autoload
	_phase_manager = get_tree().root.get_node_or_null("/root/PhaseManager")
	if _phase_manager and _phase_manager.has_signal("phase_changed"):
		_phase_manager.phase_changed.connect(_on_phase_changed)


# ─── Public API: Connection ────────────────────────────────────────────

## Connect to a DreadComposure instance for composure threshold stingers.
func connect_composure(dc: DreadComposure) -> void:
	if _composure and _composure.composure_changed.is_connected(_on_composure_changed):
		_composure.composure_changed.disconnect(_on_composure_changed)
	_composure = dc
	_prev_composure = dc.composure
	dc.composure_changed.connect(_on_composure_changed)


## Connect to a SignalStrength instance for dead air stinger.
func connect_signal_strength(ss: SignalStrength) -> void:
	if _signal_strength and _signal_strength.signal_lost.is_connected(_on_signal_lost):
		_signal_strength.signal_lost.disconnect(_on_signal_lost)
	_signal_strength = ss
	ss.signal_lost.connect(_on_signal_lost)


# ─── Public API: Trigger stingers ──────────────────────────────────────

## Trigger a stinger by type. Returns true if triggered, false if on cooldown.
func trigger_stinger(stinger_type: StingerType) -> bool:
	if is_on_cooldown(stinger_type):
		stinger_cooldown_blocked.emit(stinger_type)
		return false

	# Record trigger time
	_last_trigger_time[stinger_type] = Time.get_ticks_msec() / 1000.0

	# Activate ducking
	AudioBusManager.duck_for_stinger(true)
	_duck_timer.start()

	# Play stinger audio (only if a stream is assigned)
	if _stinger_player.stream != null:
		_stinger_player.play()

	stinger_triggered.emit(stinger_type)
	return true


## Check if a stinger type is on cooldown.
func is_on_cooldown(stinger_type: StingerType) -> bool:
	if not _last_trigger_time.has(stinger_type):
		return false
	var elapsed: float = (Time.get_ticks_msec() / 1000.0) - _last_trigger_time[stinger_type]
	return elapsed < COOLDOWN_SECONDS


## Get remaining cooldown time for a stinger type (0.0 if not on cooldown).
func get_cooldown_remaining(stinger_type: StingerType) -> float:
	if not _last_trigger_time.has(stinger_type):
		return 0.0
	var elapsed: float = (Time.get_ticks_msec() / 1000.0) - _last_trigger_time[stinger_type]
	var remaining: float = COOLDOWN_SECONDS - elapsed
	return maxf(remaining, 0.0)


## Force-clear cooldown for a stinger type (for testing).
func clear_cooldown(stinger_type: StingerType) -> void:
	_last_trigger_time.erase(stinger_type)


## Force-clear all cooldowns (for testing).
func clear_all_cooldowns() -> void:
	_last_trigger_time.clear()


## End ducking immediately (for testing or manual control).
func end_duck() -> void:
	_duck_timer.stop()
	AudioBusManager.duck_for_stinger(false)


## Check if ducking is currently active.
func is_duck_active() -> bool:
	return _duck_timer.time_left > 0.0


# ─── Public API: Convenience triggers ──────────────────────────────────

## Trigger wrongness stinger (Shift 1-4: dissonant sting).
func trigger_wrongness() -> bool:
	return trigger_stinger(StingerType.WRONGNESS)


## Trigger suits detected stinger (low brass swell).
func trigger_suits_detected() -> bool:
	return trigger_stinger(StingerType.SUITS_DETECTED)


## Trigger moral choice stinger (subtle string pluck).
func trigger_moral_choice() -> bool:
	return trigger_stinger(StingerType.MORAL_CHOICE)


## Trigger false call stinger (corrupted call intro, Phase 4).
func trigger_false_call() -> bool:
	return trigger_stinger(StingerType.FALSE_CALL)


# ─── Signal handlers ───────────────────────────────────────────────────

func _on_composure_changed(composure: float) -> void:
	if _composure == null:
		return
	# Detect downward threshold crossing
	if _prev_composure >= COMPOSURE_LOW_THRESHOLD and composure < COMPOSURE_LOW_THRESHOLD:
		trigger_stinger(StingerType.COMPOSURE_LOW)
	if _prev_composure >= COMPOSURE_CRIT_THRESHOLD and composure < COMPOSURE_CRIT_THRESHOLD:
		trigger_stinger(StingerType.COMPOSURE_CRIT)
	_prev_composure = composure


func _on_signal_lost() -> void:
	trigger_stinger(StingerType.DEAD_AIR)


func _on_phase_changed(_old_phase: int, new_phase: int) -> void:
	# Phase 4 descent → false call stinger
	if new_phase == PhaseEnums.Phase.PHASE_4_DESCENT:
		trigger_stinger(StingerType.FALSE_CALL)


func _on_duck_timer_timeout() -> void:
	AudioBusManager.duck_for_stinger(false)
