# radio_integration.gd — Integration controller wiring all radio components
# DEA-97: Radio Tuning System Integration
# Wires: RadioTuner + SignalStrength + FrequencyDial + DreadComposure + InputManager
# Handles: band auto-detection, InputManager → RadioTuner tuning, difficulty scaling
class_name RadioIntegration
extends Node

## Reference to the RadioTuner node.
@export var radio_tuner: RadioTuner

## Reference to the SignalStrength node.
@export var signal_strength: SignalStrength

## Reference to the FrequencyDial UI control.
@export var frequency_dial: FrequencyDial

## Reference to the DreadComposure node.
@export var dread_composure: DreadComposure

## Reference to the DifficultyManager node.
@export var difficulty_manager: DifficultyManager

## Whether band auto-detection is enabled (auto-switch band when frequency crosses into a new band's range).
@export var auto_detect_band: bool = true

## Whether InputManager tuning is wired to RadioTuner.
@export var wire_input_to_tuner: bool = true

# Internal: track last auto-detected band to avoid redundant switches
var _last_auto_band: int = -1


func _ready() -> void:
	_connect_components()


func _process(delta: float) -> void:
	if not is_inside_tree():
		return
	# Wire InputManager tuning to RadioTuner each frame in RADIO mode
	if wire_input_to_tuner and radio_tuner != null and _is_radio_active():
		_sync_fine_tuning()
		var tune_value: float = _get_tune_value()
		if abs(tune_value) > 0.001:
			radio_tuner.tune(tune_value)


## Connect all component signals for integration.
func _connect_components() -> void:
	if radio_tuner == null:
		push_warning("RadioIntegration: No radio_tuner assigned.")
		return

	# Band auto-detection: when frequency changes, check if we crossed into a new band
	if auto_detect_band and radio_tuner.band_config != null:
		radio_tuner.frequency_changed.connect(_on_frequency_changed)

	# SignalStrength references RadioTuner
	if signal_strength != null:
		signal_strength.radio_tuner = radio_tuner

	# DreadComposure references SignalStrength and RadioTuner
	if dread_composure != null:
		dread_composure.signal_strength = signal_strength
		dread_composure.radio_tuner = radio_tuner

	# FrequencyDial references RadioTuner
	if frequency_dial != null:
		frequency_dial.radio_tuner = radio_tuner

	# DifficultyManager references RadioTuner
	if difficulty_manager != null:
		difficulty_manager.radio_tuner = radio_tuner


## Called when RadioTuner.frequency_changed fires. Auto-switches band if frequency crossed into a new band's range.
func _on_frequency_changed(freq: float) -> void:
	if radio_tuner == null or radio_tuner.band_config == null:
		return
	var detected_band: int = radio_tuner.band_config.find_band_by_frequency(freq)
	if detected_band == -1:
		return  # Frequency is between bands, don't switch
	if detected_band != _last_auto_band and detected_band != radio_tuner.current_band_id:
		_last_auto_band = detected_band
		radio_tuner.set_band(detected_band)


## Check if InputManager is in a radio-active mode (EXPLORE or RADIO).
func _is_radio_active() -> bool:
	# InputManager is an autoload singleton
	var im = get_node_or_null("/root/InputManager")
	if im == null:
		return false
	return im.is_radio_active()


## Sync fine-tuning state from InputManager to RadioTuner.
func _sync_fine_tuning() -> void:
	var im = get_node_or_null("/root/InputManager")
	if im == null:
		return
	radio_tuner.set_fine_tuning(im.is_action_held("fine_tune"))


## Get tuning input from InputManager.
func _get_tune_value() -> float:
	var im = get_node_or_null("/root/InputManager")
	if im == null:
		return 0.0
	return im.get_tune_value()
