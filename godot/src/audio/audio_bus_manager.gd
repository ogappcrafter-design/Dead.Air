## AudioBusManager
## Autoload singleton for runtime audio bus volume control and ducking.
## Reference: DEA-134, GDD §Godot Audio Bus Layout
extends Node

# ─── Bus name constants ────────────────────────────────────────────────
const BUS_MASTER: StringName = &"Master"
const BUS_ROOM_TONE: StringName = &"ROOM_TONE"
const BUS_RADIO_AMBIENT: StringName = &"RADIO_AMBIENT"
const BUS_CALL_AUDIO: StringName = &"CALL_AUDIO"
const BUS_DREAD_LAYER: StringName = &"DREAD_LAYER"
const BUS_STINGER: StringName = &"STINGER"
const BUS_SILENCE: StringName = &"SILENCE"
const BUS_UI: StringName = &"UI"

# ─── Bus indices (must match default_bus_layout.tres order) ────────────
const IDX_MASTER := 0
const IDX_ROOM_TONE := 1
const IDX_RADIO_AMBIENT := 2
const IDX_CALL_AUDIO := 3
const IDX_DREAD_LAYER := 4
const IDX_STINGER := 5
const IDX_SILENCE := 6
const IDX_UI := 7

# ─── Ducking amounts (dB) ─────────────────────────────────────────────
## CallAudio ducks RadioAmbient by -6 dB
const DUCK_CALL_TO_RADIO := -6.0
## CallAudio ducks RoomTone by -8 dB (DEA-135)
const DUCK_CALL_TO_ROOM_TONE := -8.0
## Stinger ducks all other buses by -6 dB
const DUCK_STINGER_TO_OTHERS := -6.0
## Silence ducks all other buses by -12 dB
const DUCK_SILENCE_TO_OTHERS := -12.0

# ─── Baseline volume snapshot ─────────────────────────────────────────
# Stored at _ready() so ducking can restore to baseline when released.
var _baseline_volumes: Dictionary[int, float] = {}

# ─── Active duck states ───────────────────────────────────────────────
var _call_active: bool = false
var _stinger_active: bool = false
var _silence_active: bool = false

# ─── Effect indices per bus (for runtime effect parameter access) ────
# These correspond to the effect order in default_bus_layout.tres.
const FX_RADIO_AMBIENT_GAIN := 1  # BandPass=0 (Gain effect removed in Godot 4.7.1)
const FX_CALL_AUDIO_DISTORTION := 1  # Compressor=0, Distortion=1, Reverb=2
const FX_DREAD_LAYER_LOWPASS := 0  # LowPass=0


# ─── Lifecycle ────────────────────────────────────────────────────────
func _ready() -> void:
	_snapshot_baselines()


# ─── Baseline management ──────────────────────────────────────────────
## Capture current bus volumes as the baseline (un-ducked) state.
func _snapshot_baselines() -> void:
	_baseline_volumes.clear()
	for i in range(AudioServer.bus_count):
		_baseline_volumes[i] = AudioServer.get_bus_volume_db(i)


## Restore a single bus to its baseline volume.
func restore_bus(bus_idx: int) -> void:
	if _baseline_volumes.has(bus_idx):
		AudioServer.set_bus_volume_db(bus_idx, _baseline_volumes[bus_idx])


## Restore all buses to their baseline volumes.
func restore_all_buses() -> void:
	for bus_idx in _baseline_volumes:
		AudioServer.set_bus_volume_db(bus_idx, _baseline_volumes[bus_idx])


# ─── Public API: Volume control ───────────────────────────────────────
## Set the baseline volume for a bus (updates the stored baseline).
func set_bus_volume(bus_idx: int, volume_db: float) -> void:
	_baseline_volumes[bus_idx] = volume_db
	# Apply immediately unless a duck is active on this bus
	if not _is_bus_ducked(bus_idx):
		AudioServer.set_bus_volume_db(bus_idx, volume_db)


## Get the baseline volume for a bus.
func get_bus_volume(bus_idx: int) -> float:
	return _baseline_volumes.get(bus_idx, 0.0)


## Get the actual (current) volume of a bus, including any active ducking.
func get_bus_current_volume(bus_idx: int) -> float:
	return AudioServer.get_bus_volume_db(bus_idx)


# ─── Public API: Mute / Solo ──────────────────────────────────────────
func set_bus_mute(bus_idx: int, muted: bool) -> void:
	AudioServer.set_bus_mute(bus_idx, muted)


func is_bus_muted(bus_idx: int) -> bool:
	return AudioServer.is_bus_mute(bus_idx)


# ─── Public API: Ducking ─────────────────────────────────────────────
## Activate CallAudio ducking: RadioAmbient -6 dB.
func duck_for_call(active: bool) -> void:
	_call_active = active
	_recompute_ducks()


## Activate Stinger ducking: all other buses -6 dB.
func duck_for_stinger(active: bool) -> void:
	_stinger_active = active
	_recompute_ducks()


## Activate Silence bus: all other buses -12 dB.
func duck_for_silence(active: bool) -> void:
	_silence_active = active
	_recompute_ducks()


## Recompute all active duck offsets and apply to buses.
func _recompute_ducks() -> void:
	for bus_idx in range(AudioServer.bus_count):
		if bus_idx == IDX_MASTER:
			continue
		var duck_offset: float = _compute_duck_offset(bus_idx)
		if duck_offset < 0.0:
			AudioServer.set_bus_volume_db(
				bus_idx, _baseline_volumes.get(bus_idx, 0.0) + duck_offset
			)
		else:
			AudioServer.set_bus_volume_db(bus_idx, _baseline_volumes.get(bus_idx, 0.0))


## Compute the cumulative duck offset (dB) for a given bus based on active duck states.
func _compute_duck_offset(bus_idx: int) -> float:
	var offset: float = 0.0

	# CallAudio → RadioAmbient -6 dB
	if _call_active and bus_idx == IDX_RADIO_AMBIENT:
		offset += DUCK_CALL_TO_RADIO

	# CallAudio → RoomTone -8 dB (DEA-135)
	if _call_active and bus_idx == IDX_ROOM_TONE:
		offset += DUCK_CALL_TO_ROOM_TONE

	# Stinger → all others -6 dB
	if _stinger_active and bus_idx != IDX_STINGER:
		offset += DUCK_STINGER_TO_OTHERS

	# Silence → all others -12 dB
	if _silence_active and bus_idx != IDX_SILENCE:
		offset += DUCK_SILENCE_TO_OTHERS

	return offset


## Check if a bus currently has any active duck offset applied.
func _is_bus_ducked(bus_idx: int) -> bool:
	return _compute_duck_offset(bus_idx) < 0.0


# ─── Public API: Effect parameter control ────────────────────────────
## Get an AudioEffect from a bus by effect index.
func get_bus_effect(bus_idx: int, effect_idx: int) -> AudioEffect:
	return AudioServer.get_bus_effect(bus_idx, effect_idx)


## Set the RadioAmbient Gain effect volume (signal strength).
func set_radio_signal_strength(volume_db: float) -> void:
	if IDX_RADIO_AMBIENT < AudioServer.bus_count:
		var gain: AudioEffect = AudioServer.get_bus_effect(IDX_RADIO_AMBIENT, FX_RADIO_AMBIENT_GAIN)
		if gain != null and gain.get_class() == "AudioEffectGain":
			gain.set("volume_db", volume_db)


## Set the CallAudio Distortion drive (f(dread)).
func set_call_distortion(drive: float) -> void:
	if IDX_CALL_AUDIO < AudioServer.bus_count:
		var dist: AudioEffect = AudioServer.get_bus_effect(IDX_CALL_AUDIO, FX_CALL_AUDIO_DISTORTION)
		if dist is AudioEffectDistortion:
			(dist as AudioEffectDistortion).drive = clampf(drive, 0.0, 1.0)


## Set the DreadLayer LowPass cutoff frequency.
func set_dread_lowpass_cutoff(hz: float) -> void:
	if IDX_DREAD_LAYER < AudioServer.bus_count:
		var lp: AudioEffect = AudioServer.get_bus_effect(IDX_DREAD_LAYER, FX_DREAD_LAYER_LOWPASS)
		if lp is AudioEffectLowPassFilter:
			(lp as AudioEffectLowPassFilter).cutoff_hz = clampf(hz, 20.0, 20000.0)


## Set the DreadLayer bus volume (ramps from -12 dB to 0 dB at dread 75+).
func set_dread_level(dread_value: float) -> void:
	# dread_value: 0.0 (calm) → 100.0 (max dread)
	var t: float = clampf(dread_value / 75.0, 0.0, 1.0)
	var vol: float = lerpf(-12.0, 0.0, t)
	set_bus_volume(IDX_DREAD_LAYER, vol)
	# Also tighten the lowpass as dread rises (200 Hz → 600 Hz)
	set_dread_lowpass_cutoff(lerpf(200.0, 600.0, t))
