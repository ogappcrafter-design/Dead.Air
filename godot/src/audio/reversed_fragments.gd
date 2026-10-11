class_name ReversedFragments
extends Node

## Segment 2B "The Static Sky" — reversed/distorted voice fragments (DEA).
## The portable radio picks up fragments: voices from Shift 1-5 calls,
## reversed, distorted, warning.
##
## Each fragment is a source line from calls.json (Shift 1-5 calls), played
## REVERSED (character order flipped) over the radio with burst gating —
## syllable-ish envelopes so it reads as backwards speech through static.
## Between fragments: silence or warning tags from the ORIGIN call.
##
## Pure logic (get_fragment_text, reverse_text, build_fragment_schedule)
## is testable without audio.

signal fragment_started(text: String, call_id: int)
signal fragment_finished()

const SAMPLE_RATE := 44100.0
const BURST_RATE_HZ := 7.5       # syllable-ish gating
const VOICE_BASE_HZ := 190.0     # formant-ish carrier, slightly too low
const VOICE_WOBBLE_HZ := 5.0

## Source fragments: [call_id, line_index] into calls.json (Shift 1-5 calls).
## Lines verified against src/data/calls.json.
const FRAGMENT_SOURCES := [
	[0, 2],   # "That number. belongs you."
	[1, 5],   # "Oh. Wrong number."
	[2, 4],   # "Would you like it back?"
	[3, 4],   # "...Ruth passed fourteen years ago November."
	[10, 2],  # "Baby. Don't fuss. I don't long on this line."
	[15, 2],  # "Hello? anyone out there? This first test —"
	[15, 4],  # "— frequency. If you can hear this, worked."
]

## Warning fragments (not from calls — these are the radio itself warning).
const WARNING_LINES := [
	"go back",
	"not this way",
	"still ahead",
]

@export var bus_name := "RADIO_AMBIENT"

var _voice_player: AudioStreamPlayer
var _stream: AudioStreamGeneratorPlayback
var _started := false

var _queue: Array = []          # schedule of {text, call_id}
var _current_text := ""
var _current_call_id := -1
var _char_index := 0
var _char_timer := 0.0
var _char_duration := 0.14
var _burst_phase := 0.0
var _between_timer := 0.0
var _between_duration := 6.0
var _warn_next := false

var _phase := 0.0
var _wobble_phase := 0.0


func start() -> void:
	if _started:
		return
	_started = true
	_setup_audio()
	_load_fragments()
	_between_duration = 4.0  # first fragment arrives soon


func stop() -> void:
	if not _started:
		return
	_started = false
	if _voice_player:
		_voice_player.stop()


func is_started() -> bool:
	return _started


func _setup_audio() -> void:
	var bus_idx := AudioServer.get_bus_index(bus_name)
	var bus := bus_name if bus_idx >= 0 else "Master"
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = SAMPLE_RATE
	gen.buffer_length = 1.0
	_voice_player = AudioStreamPlayer.new()
	_voice_player.stream = gen
	_voice_player.bus = bus
	add_child(_voice_player)
	_voice_player.play()
	_stream = _voice_player.get_stream_playback()


## Load source lines from calls.json and build the reversed schedule.
func _load_fragments() -> void:
	var f := FileAccess.open("res://src/data/calls.json", FileAccess.READ)
	if f == null:
		push_warning("ReversedFragments: cannot open calls.json")
		return
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	var calls: Array = []
	if parsed is Dictionary and parsed.has("calls"):
		calls = parsed["calls"]
	elif parsed is Array:
		calls = parsed
	var schedule := build_fragment_schedule(calls, FRAGMENT_SOURCES, WARNING_LINES)
	_queue = schedule


## Pure: build the fragment schedule from calls data.
## Each entry: {text: String (reversed), call_id: int, warning: bool}
static func build_fragment_schedule(calls: Array, sources: Array, warnings: Array) -> Array:
	var schedule: Array = []
	for src in sources:
		var call_id: int = src[0]
		var line_idx: int = src[1]
		var text := ""
		for c in calls:
			if int(c.get("id", -1)) == call_id:
				var lines: Array = c.get("lines", [])
				if line_idx < lines.size():
					text = str(lines[line_idx])
				break
		if text != "":
			schedule.append({
				"text": reverse_text(text),
				"call_id": call_id,
				"warning": false,
			})
	# Weave warnings between source fragments (every other slot, reversed too)
	var out: Array = []
	var warn_i := 0
	for i in range(schedule.size()):
		out.append(schedule[i])
		if i % 2 == 1 and warn_i < warnings.size():
			out.append({
				"text": reverse_text(str(warnings[warn_i])),
				"call_id": -1,
				"warning": true,
			})
			warn_i += 1
	return out


## Pure: reverse a line's character order (the "backwards speech" text form).
static func reverse_text(text: String) -> String:
	var chars := []
	for i in range(text.length()):
		chars.append(text[text.length() - 1 - i])
	return "".join(chars)


## Pure: gate envelope for a burst — syllable-ish rhythm.
static func burst_envelope(time_in_char: float, char_duration: float) -> float:
	var t := clampf(time_in_char / maxf(char_duration, 0.001), 0.0, 1.0)
	# Quick attack, hold, quick release
	if t < 0.15:
		return t / 0.15
	if t > 0.8:
		return (1.0 - t) / 0.2
	return 1.0


func _process(delta: float) -> void:
	if not _started or not _stream:
		return

	# Advance the schedule
	if _current_text == "":
		_between_timer += delta
		if _between_timer >= _between_duration and not _queue.is_empty():
			var next: Dictionary = _queue.pop_front()
			_current_text = next["text"]
			_current_call_id = next["call_id"]
			_char_index = 0
			_char_timer = 0.0
			_between_duration = randf_range(5.0, 9.0)
			fragment_started.emit(_current_text, _current_call_id)
	else:
		_char_timer += delta
		if _char_timer >= _char_duration:
			_char_timer = 0.0
			_char_index += 1
			if _char_index >= _current_text.length():
				_current_text = ""
				_between_timer = 0.0
				fragment_finished.emit()

	_fill_voice_buffer(delta)


## Voice: formant-ish carrier gated per character (backwards speech feel).
func _fill_voice_buffer(delta: float) -> void:
	var frames := _stream.get_frames_available()
	if frames <= 0:
		return
	var buf: PackedVector2Array = PackedVector2Array()
	buf.resize(frames)
	var speaking := _current_text != ""
	for i in range(frames):
		var s := 0.0
		if speaking:
			_burst_phase += delta
			_wobble_phase += VOICE_WOBBLE_HZ * TAU / SAMPLE_RATE
			var env := burst_envelope(_char_timer, _char_duration)
			# Wobbled carrier, gated — reads as garbled backwards voice.
			var wobble := 1.0 + 0.25 * sin(_wobble_phase)
			s = sin(_phase) * env * wobble * 0.12
			_phase += VOICE_BASE_HZ * wobble * TAU / SAMPLE_RATE
		buf[i] = Vector2(s, s)


	_stream.push_buffer(buf)
## Testing helpers.

func get_current_fragment() -> Dictionary:
	return {
		"text": _current_text,
		"call_id": _current_call_id,
		"queue_size": _queue.size(),
	}


func get_schedule_size() -> int:
	return _queue.size() + _current_text.length()


## Advance the fragment state machine without audio (for tests).
## Returns the fragment text if one started this step, else "".
func step_for_testing(delta: float) -> String:
	var before := _current_text
	if _current_text == "":
		_between_timer += delta
		if _between_timer >= _between_duration and not _queue.is_empty():
			var next: Dictionary = _queue.pop_front()
			_current_text = next["text"]
			_current_call_id = next["call_id"]
			_char_index = 0
			_char_timer = 0.0
			fragment_started.emit(_current_text, _current_call_id)
			return _current_text
		return ""
	_char_timer += delta
	if _char_timer >= _char_duration:
		_char_timer = 0.0
		_char_index += 1
		if _char_index >= _current_text.length():
			_current_text = ""
			_between_timer = 0.0
			fragment_finished.emit()
	return before if before != "" else ""
