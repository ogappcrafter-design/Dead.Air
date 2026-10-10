class_name OutdoorAmbience
extends Node

## Segment 2B "The Static Sky" — outdoor night ambience, all procedural.
## Three layers (DEA-118):
##  - Wind: filtered noise, "wrong pitch — slightly flat" (the noise is band-passed
##    below the frequency a natural wind would sit at, with a slow LFO on the cutoff).
##  - Wind chimes: distant, dissonant — clustered metallic pings from an out-of-tune
##    set (deliberately non-harmonic intervals).
##  - Lawnmower: a distant engine drone at 3 AM — low periodic putter with random
##    stall/restart gaps.
##
## Routed to ROOM_TONE by default (outdoor room tone). The segment keeps this bus
## unmuted — GDD says "no room tone" for the *indoor* hallway; outdoors the wind IS
## the room tone.

const SAMPLE_RATE := 44100.0

## Bus to route the ambience through.
@export var bus_name := "ROOM_TONE"

## Master level multiplier (0 = silence).
@export var master_level := 1.0

## ---- Internal players ----
var _wind_player: AudioStreamPlayer
var _chimes_player: AudioStreamPlayer
var _mower_player: AudioStreamPlayer

var _wind_stream: AudioStreamGeneratorPlayback
var _chimes_stream: AudioStreamGeneratorPlayback
var _mower_stream: AudioStreamGeneratorPlayback

## ---- Wind state ----
var _wind_phase := 0.0
var _wind_lfo_phase := 0.0
## Slightly flat: natural wind noise centers higher; we sit just below.
const WIND_BASE_HZ := 420.0
const WIND_LFO_HZ := 0.07
const WIND_DEPTH := 180.0

## ---- Chimes state ----
## Dissonant metallic cluster: deliberately non-harmonic partials (no 2:1 octave).
const CHIME_PARTIALS := [311.0, 471.0, 613.0, 829.0]
var _chime_timer := 0.0
var _chime_interval := 4.5
var _chime_active := false
var _chime_partial := 0
var _chime_env := 0.0
var _chime_phase := 0.0

## ---- Mower state ----
var _mower_phase := 0.0
var _mower_timer := 0.0
var _mower_on := false
var _mower_on_time := 0.0
var _mower_off_time := 0.0
const MOWER_HZ := 43.0
const MOWER_PUTTER_HZ := 7.0

var _started := false


func start() -> void:
	if _started:
		return
	_started = true
	_setup_audio()


func stop() -> void:
	if not _started:
		return
	_started = false
	if _wind_player: _wind_player.stop()
	if _chimes_player: _chimes_player.stop()
	if _mower_player: _mower_player.stop()


func is_started() -> bool:
	return _started


func _setup_audio() -> void:
	var bus_idx := AudioServer.get_bus_index(bus_name)
	var bus := bus_name if bus_idx >= 0 else "Master"

	_wind_player = _make_player(bus, 2.0)
	_chimes_player = _make_player(bus, 1.0)
	_mower_player = _make_player(bus, 1.0)

	_wind_stream = _wind_player.get_stream_playback()
	_chimes_stream = _chimes_player.get_stream_playback()
	_mower_stream = _mower_player.get_stream_playback()

	_mower_off_time = randf_range(2.0, 6.0)


func _make_player(bus: String, buffer_len: float) -> AudioStreamPlayer:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = SAMPLE_RATE
	gen.buffer_length = buffer_len
	var p := AudioStreamPlayer.new()
	p.stream = gen
	p.bus = bus
	add_child(p)
	p.play()
	return p


func _process(delta: float) -> void:
	if not _started:
		return
	_fill_wind()
	_fill_chimes(delta)
	_fill_mower(delta)


## Wind: band-passed noise around a slightly-flat center, cutoff slow-LFO'd.
func _fill_wind() -> void:
	if not _wind_stream:
		return
	var frames := _wind_stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	var center_hz := WIND_BASE_HZ + sin(_wind_lfo_phase) * WIND_DEPTH
	_wind_lfo_phase += TAU * WIND_LFO_HZ / SAMPLE_RATE
	for i in range(frames):
		# Noise carrier, resonant-ish emphasis via a phase-locked blend.
		_wind_phase += center_hz * TAU / SAMPLE_RATE
		var noise := randf_range(-1.0, 1.0)
		# Band-pass feel: average raw noise with the phase-locked sine carrier.
		var s := (noise * 0.7 + sin(_wind_phase) * 0.3) * 0.06 * master_level
		buf[i] = Vector2(s, s)


	_wind_stream.push_buffer(buf)
## Chimes: sporadic metallic pings from a dissonant cluster, quiet and distant.
func _fill_chimes(delta: float) -> void:
	if not _chimes_stream:
		return
	_chime_timer += delta
	if not _chime_active and _chime_timer >= _chime_interval:
		_chime_active = true
		_chime_timer = 0.0
		_chime_interval = randf_range(2.5, 8.0)
		_chime_partial = randi() % CHIME_PARTIALS.size()
		_chime_env = 1.0

	var frames := _chimes_stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	var hz: float = CHIME_PARTIALS[_chime_partial]
	for i in range(frames):
		var s := 0.0
		if _chime_active:
			_chime_phase += hz * TAU / SAMPLE_RATE
			_chime_env -= delta / SAMPLE_RATE * 2.2
			s = sin(_chime_phase) * _chime_env * 0.045 * master_level
			if _chime_env <= 0.0:
				_chime_active = false
		buf[i] = Vector2(s, s)


	_chimes_stream.push_buffer(buf)
## Mower: low putter drone with long random off-gaps ("at 3 AM" — wrong, distant).
func _fill_mower(delta: float) -> void:
	if not _mower_stream:
		return
	_mower_timer += delta
	if _mower_on and _mower_timer >= _mower_on_time:
		_mower_on = false
		_mower_timer = 0.0
		_mower_off_time = randf_range(6.0, 14.0)
	elif not _mower_on and _mower_timer >= _mower_off_time:
		_mower_on = true
		_mower_timer = 0.0
		_mower_on_time = randf_range(4.0, 9.0)

	var frames := _mower_stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		var s := 0.0
		if _mower_on:
			_mower_phase += MOWER_HZ * TAU / SAMPLE_RATE
			# Square-ish putter envelope: modulation phase advances at
			# PUTTER_HZ by scaling the MOWER_HZ phase.
			var putter := 1.0 if sin(_mower_phase * MOWER_PUTTER_HZ / MOWER_HZ) > 0.0 else 0.35
			s = sin(_mower_phase) * putter * 0.05 * master_level
		buf[i] = Vector2(s, s)


	_mower_stream.push_buffer(buf)
## Testing helper: layer activity snapshot.
func get_layer_states() -> Dictionary:
	return {
		"started": _started,
		"wind_on": _wind_stream != null,
		"chime_active": _chime_active,
		"mower_on": _mower_on,
	}
