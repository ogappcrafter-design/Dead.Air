# gdlint:ignore=max-public-methods
## test_signal_decay.gd — Unit tests for DEA-98 Signal Strength & Decay System.
## Tests: initial signal, base decay, dread scaling, weather, retuning, breather,
## entity interference, signal 0 silence + must-retune, safe room hold.
## Run via: godot --headless --script res://tests/test_runner.gd
extends RefCounted

var test_name: String = "SignalDecay"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_initial_signal_80"] = test_initial_signal_80()
	results["test_signal_clamped_0_100"] = test_signal_clamped_0_100()
	results["test_base_decay_rate"] = test_base_decay_rate()
	results["test_dread_scaling_50"] = test_dread_scaling_50()
	results["test_dread_scaling_75"] = test_dread_scaling_75()
	results["test_dread_scaling_multiplicative"] = test_dread_scaling_multiplicative()
	results["test_weather_multiplies_decay"] = test_weather_multiplies_decay()
	results["test_weather_stacks_with_dread"] = test_weather_stacks_with_dread()
	results["test_retuning_regen_plus_2"] = test_retuning_regen_plus_2()
	results["test_breather_regen_plus_1"] = test_breather_regen_plus_1()
	results["test_entity_drain_per_entity"] = test_entity_drain_per_entity()
	results["test_multiple_entities_drain"] = test_multiple_entities_drain()
	results["test_safe_room_holds_signal"] = test_safe_room_holds_signal()
	results["test_signal_0_silence"] = test_signal_0_silence()
	results["test_signal_0_must_retune"] = test_signal_0_must_retune()
	results["test_retuning_clears_must_retune"] = test_retuning_clears_must_retune()
	results["test_signal_changed_emitted"] = test_signal_changed_emitted()
	results["test_signal_lost_emitted_at_0"] = test_signal_lost_emitted_at_0()
	results["test_signal_restored_on_retune"] = test_signal_restored_on_retune()
	results["test_start_shift_resets_to_80"] = test_start_shift_resets_to_80()
	return results


## Build a BandConfig with band 0 (LIVING) for testing.
func _make_band_config() -> BandConfig:
	var config := BandConfig.new()
	var b0 := BandData.new()
	b0.id = 0
	b0.name = "LIVING"
	b0.center_frequency = 88.7
	b0.sensitivity = 8.0
	b0.freq_range_min = 87.5
	b0.freq_range_max = 92.0
	config.bands = [b0]
	return config


## Build a RadioTuner with test config, simulating _ready().
func _make_tuner() -> RadioTuner:
	var tuner := RadioTuner.new()
	tuner.band_config = _make_band_config()
	tuner.set_band(0)
	tuner.set_frequency(88.7)  # At center = signal 100
	return tuner


## Build a SignalStrength node with a tuner at full signal.
func _make_signal_strength() -> SignalStrength:
	var ss := SignalStrength.new()
	ss.radio_tuner = _make_tuner()
	# Simulate _ready() — just ensure radio_tuner is set
	return ss


## Manually advance the signal strength by simulating _process logic.
## Since SignalStrength._process requires a scene tree, we test the
## decay/regen math directly by calling internal methods and applying
## the net change ourselves, matching the _process implementation.
func _simulate_process(ss: SignalStrength, delta: float) -> void:
	var base_signal: float = ss.radio_tuner.get_signal()
	var decay_rate: float = ss._get_decay_rate()
	var regen_rate: float = ss._get_regen_rate()
	var net: float = regen_rate - decay_rate

	if ss.must_retune:
		if ss.is_retuning:
			ss.must_retune = false
			ss.signal_restored.emit()
		else:
			ss.signal_value = 0.0
			ss.signal_changed.emit(ss.signal_value)
			return

	ss.signal_value = clamp(ss.signal_value + net * delta, 0.0, 100.0)
	if ss.signal_value > base_signal:
		ss.signal_value = base_signal
	if ss.signal_value <= 0.0 and not ss.must_retune:
		ss.must_retune = true
		ss.signal_lost.emit()
	ss.signal_changed.emit(ss.signal_value)


# --- AC1: Initial signal is 80 ---

func test_initial_signal_80() -> bool:
	var ss := _make_signal_strength()
	return abs(ss.signal_value - 80.0) < 0.01


# --- AC1: Signal clamped to 0-100 ---

func test_signal_clamped_0_100() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(150.0)
	if ss.signal_value > 100.0:
		return false
	ss.set_signal(-50.0)
	return ss.signal_value >= 0.0


# --- AC2: Base decay rate is 1.5/sec ---

func test_base_decay_rate() -> bool:
	var ss := _make_signal_strength()
	# No dread, no weather, no entities, not retuning, not in breather
	ss.dread_level = 0.0
	ss.weather_interference = false
	ss.active_entity_count = 0
	ss.is_retuning = false
	ss.in_breather = false
	# Decay over 1 second
	_simulate_process(ss, 1.0)
	# Should be 80 - 1.5 = 78.5
	return abs(ss.signal_value - 78.5) < 0.01


# --- AC3: Dread scaling (×1.5 at dread > 50) ---

func test_dread_scaling_50() -> bool:
	var ss := _make_signal_strength()
	ss.dread_level = 55.0
	_simulate_process(ss, 1.0)
	# 80 - (1.5 * 1.5) = 80 - 2.25 = 77.75
	return abs(ss.signal_value - 77.75) < 0.01


# --- AC3: Dread scaling (×2.0 at dread > 75) ---

func test_dread_scaling_75() -> bool:
	var ss := _make_signal_strength()
	ss.dread_level = 80.0
	_simulate_process(ss, 1.0)
	# 80 - (1.5 * 2.0) = 80 - 3.0 = 77.0
	return abs(ss.signal_value - 77.0) < 0.01


# --- AC3: Dread scaling is multiplicative ---

func test_dread_scaling_multiplicative() -> bool:
	var ss := _make_signal_strength()
	# At dread 60 (×1.5) with weather (×1.3): decay = 1.5 * 1.5 * 1.3
	ss.dread_level = 60.0
	ss.weather_interference = true
	_simulate_process(ss, 1.0)
	# 80 - (1.5 * 1.5 * 1.3) = 80 - 2.925 = 77.075
	return abs(ss.signal_value - 77.075) < 0.01


# --- AC4: Weather multiplies decay by 1.3 ---

func test_weather_multiplies_decay() -> bool:
	var ss := _make_signal_strength()
	ss.weather_interference = true
	_simulate_process(ss, 1.0)
	# 80 - (1.5 * 1.3) = 80 - 1.95 = 78.05
	return abs(ss.signal_value - 78.05) < 0.01


# --- AC4: Weather stacks multiplicatively with dread scaling ---

func test_weather_stacks_with_dread() -> bool:
	var ss := _make_signal_strength()
	ss.dread_level = 80.0  # ×2.0
	ss.weather_interference = true  # ×1.3
	_simulate_process(ss, 1.0)
	# 80 - (1.5 * 2.0 * 1.3) = 80 - 3.9 = 76.1
	return abs(ss.signal_value - 76.1) < 0.01


# --- AC5: Active retuning gives +2/sec regen ---

func test_retuning_regen_plus_2() -> bool:
	var ss := _make_signal_strength()
	# Set signal low so regen is visible
	ss.set_signal(50.0)
	ss.is_retuning = true
	_simulate_process(ss, 1.0)
	# Net = 2.0 - 1.5 = +0.5, so 50 + 0.5 = 50.5
	return abs(ss.signal_value - 50.5) < 0.01


# --- AC6: Breather gives +1/sec regen ---

func test_breather_regen_plus_1() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(50.0)
	ss.in_breather = true
	_simulate_process(ss, 1.0)
	# Net = 1.0 - 1.5 = -0.5, so 50 - 0.5 = 49.5
	return abs(ss.signal_value - 49.5) < 0.01


# --- AC7: Entity interference is -0.5/sec per entity ---

func test_entity_drain_per_entity() -> bool:
	var ss := _make_signal_strength()
	ss.active_entity_count = 1
	_simulate_process(ss, 1.0)
	# 80 - (1.5 + 0.5) = 80 - 2.0 = 78.0
	return abs(ss.signal_value - 78.0) < 0.01


# --- AC7: Multiple entities stack drain ---

func test_multiple_entities_drain() -> bool:
	var ss := _make_signal_strength()
	ss.active_entity_count = 3
	_simulate_process(ss, 1.0)
	# 80 - (1.5 + 0.5*3) = 80 - 3.0 = 77.0
	return abs(ss.signal_value - 77.0) < 0.01


# --- Safe room: signal holds steady ---

func test_safe_room_holds_signal() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(50.0)
	ss.in_safe_room = true
	ss.dread_level = 80.0  # Would normally double decay
	ss.weather_interference = true
	ss.active_entity_count = 5
	_simulate_process(ss, 5.0)
	# Should remain at 50.0 — no decay, no regen
	return abs(ss.signal_value - 50.0) < 0.01


# --- AC8: Signal 0 = silence ---

func test_signal_0_silence() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(0.0)
	return ss.is_silent() == true


# --- AC8: Signal 0 = must retune ---

func test_signal_0_must_retune() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(0.0)
	return ss.must_retune == true


# --- AC8: Retuning clears must_retune ---

func test_retuning_clears_must_retune() -> bool:
	var ss := _make_signal_strength()
	ss.set_signal(0.0)
	# must_retune is now true
	if not ss.must_retune:
		return false
	# Simulate player starting to retune
	ss.is_retuning = true
	_simulate_process(ss, 0.1)
	# must_retune should be cleared
	return ss.must_retune == false


# --- signal_changed is emitted ---

func test_signal_changed_emitted() -> bool:
	var ss := _make_signal_strength()
	var received: Array = []
	ss.signal_changed.connect(func(v: float) -> void: received.append(v))
	_simulate_process(ss, 1.0)
	# Should have received at least one signal_changed emission
	return received.size() > 0


# --- signal_lost is emitted when signal hits 0 ---

func test_signal_lost_emitted_at_0() -> bool:
	var ss := _make_signal_strength()
	var lost: Array = []
	ss.signal_lost.connect(func() -> void: lost.append(true))
	# Force signal to very low, then let decay push it to 0
	ss.set_signal(1.0)
	_simulate_process(ss, 2.0)  # 1.0 - 1.5*2 = -2 → clamped to 0
	return lost.size() > 0 and ss.must_retune == true


# --- signal_restored is emitted when retune clears must_retune ---

func test_signal_restored_on_retune() -> bool:
	var ss := _make_signal_strength()
	var restored: Array = []
	ss.signal_restored.connect(func() -> void: restored.append(true))
	ss.set_signal(0.0)
	# must_retune is true, signal_restored not yet emitted
	if restored.size() > 0:
		return false
	# Start retuning to clear
	ss.is_retuning = true
	_simulate_process(ss, 0.1)
	return restored.size() > 0


# --- start_shift resets signal to 80 ---

func test_start_shift_resets_to_80() -> bool:
	var ss := _make_signal_strength()
	# Tank the signal
	ss.set_signal(20.0)
	ss.must_retune = true
	ss.start_shift()
	return abs(ss.signal_value - 80.0) < 0.01 and ss.must_retune == false
