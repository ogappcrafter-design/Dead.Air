class_name CollectorsTapePuzzle
extends Node3D
## The Collector's Tape puzzle — Location 1 side puzzle (DEA-126).
##
## GDD (source of truth) + Linear specifics merged:
##   - House B (The Collector's) holds an archive: a tape recorder with no
##     tape, and a wall of tapes (the archive).
##   - Tuning to LOST band while inside the house reveals the hidden signal:
##     a voice counting items, directing the player to the garden ("under
##     the tomatoes, third row"). The forced low-signal tuning per the GDD.
##   - The garden holds a dig spot. Interacting (dig) uncovers the tape.
##   - The tape is tape-010 ("Whispers" / "They're talking about you").
##   - The Collector's shadow manifests in the archive room when the signal
##     is revealed. Not hostile — observing. It nods. Leaves.
##
## If LOST is not unlocked, the house is just a house: no signal, no puzzle.

signal puzzle_revealed          # LOST band tuned in the house
signal signal_revealed          # the hidden signal is audible
signal shadow_manifested        # the Collector's shadow appears
signal tape_dug_up(tape_id: String)
signal puzzle_completed

## Band id of LOST (Shift 3 unlock).
const LOST_BAND_ID := 2
## Forced signal while the hidden signal is being revealed (GDD: 20-30).
const REVEAL_SIGNAL := 25.0
## Player proximity needed for the dig to be offered.
const DIG_RANGE := 2.5
## The tape this puzzle awards (Linear: Tape #10 from the recorder).
const TAPE_ID := "tape-010"

## Node refs.
var _player: CharacterBody3D
var _recorder: Node3D
var _archive_wall: Node3D
var _dig_spot: Node3D
var _shadow: Node3D
var _radio_tuner: Node

## State.
var _house_entered := false
var _revealed := false
var _signal_playing := false
var _shadow_visible := false
var _tape_taken := false
var _completed := false

## Hidden-signal voice synthesis (LOST band: a voice counting items).
var _signal_player: AudioStreamPlayer3D
var _signal_phase := 0.0
var _signal_stream: AudioStreamGeneratorPlayback
const AUDIO_SR := 44100.0
const COUNT_VOICE_HZ := 95.0


func _ready() -> void:
	call_deferred("_setup")


func _setup() -> void:
	_player = _find_player()
	_recorder = get_node_or_null("TapeRecorder")
	_archive_wall = get_node_or_null("ArchiveWall")
	_dig_spot = get_node_or_null("GardenDigSpot")
	_shadow = get_node_or_null("CollectorShadow")
	_radio_tuner = _find_tuner()
	if _signal_player == null:
		_signal_player = AudioStreamPlayer3D.new()
		_signal_player.name = "HiddenSignal"
		_signal_player.stream = _make_generator()
		_signal_player.bus = "Master"
		_signal_player.unit_size = 6.0
		_signal_player.max_distance = 25.0
		add_child(_signal_player)
	if _dig_spot is Area3D:
		if not (_dig_spot as Area3D).body_entered.is_connected(_on_dig_spot_entered):
			(_dig_spot as Area3D).body_entered.connect(_on_dig_spot_entered)


## The house door zone notifies the puzzle of entry (wired by the segment).
func set_house_entered(entered: bool) -> void:
	_house_entered = entered
	if not entered:
		return
	# Entering the house with LOST already tuned: reveal immediately.
	_check_reveal()


func _process(delta: float) -> void:
	if _house_entered and not _revealed:
		_check_reveal()
	if _revealed and not _tape_taken:
		_check_dig_proximity()
	if _signal_playing:
		_fill_signal_buffer(delta)


## Reveal condition: player inside House B, LOST band tuned.
func _check_reveal() -> void:
	if _revealed:
		return
	if not _house_entered:
		return
	var band_id := _get_tuned_band()
	if band_id != LOST_BAND_ID:
		return
	_revealed = true
	puzzle_revealed.emit()
	_start_hidden_signal()


func _start_hidden_signal() -> void:
	_signal_playing = true
	_signal_player.play()
	signal_revealed.emit()
	_manifest_shadow()


func _manifest_shadow() -> void:
	if _shadow and not _shadow_visible:
		_shadow_visible = true
		(_shadow as Node3D).visible = true
		shadow_manifested.emit()


## The dig is available when the player is near the dig spot after reveal.
func _check_dig_proximity() -> void:
	if _player == null or _dig_spot == null:
		return
	var dist := _player.global_position.distance_to((_dig_spot as Node3D).global_position)
	if dist <= DIG_RANGE:
		_offer_dig()


func _offer_dig() -> void:
	# One-shot: interact once revealed and near.
	if _tape_taken:
		return
	_dig_up_tape()


func _on_dig_spot_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if _revealed and not _tape_taken:
		_dig_up_tape()


func _dig_up_tape() -> void:
	if _tape_taken:
		return
	_tape_taken = true
	var inv := _autoload("TapeInventory")
	if inv and inv.has_method("collect_tape"):
		inv.collect_tape(TAPE_ID)
	tape_dug_up.emit(TAPE_ID)
	_finish()


func _finish() -> void:
	if _completed:
		return
	_completed = true
	puzzle_completed.emit()


## --- Signal synthesis: a voice counting items (LOST flavor) ---

func _make_generator() -> AudioStreamGenerator:
	var g := AudioStreamGenerator.new()
	g.mix_rate = AUDIO_SR
	g.buffer_length = 1.0
	return g


func _fill_signal_buffer(delta: float) -> void:
	if _signal_player == null:
		return
	var stream: AudioStreamGeneratorPlayback = _signal_player.get_stream_playback()
	if stream == null:
		return
	var frames := stream.get_frames_available()
	if frames <= 0:
		return
	var buf := PackedVector2Array()
	buf.resize(frames)
	for i in range(frames):
		# Low counting voice: slow, numbered cadence with gaps.
		_signal_phase += COUNT_VOICE_HZ * TAU / AUDIO_SR
		var word_gate := 0.0
		var cycle := fmod(_signal_phase * 0.25, TAU)
		if cycle < 3.14:
			word_gate = 0.6 + 0.4 * sin(_signal_phase * 0.5)
		var s := sin(_signal_phase) * 0.18 * word_gate + sin(_signal_phase * 1.4) * 0.06 * word_gate
		buf[i] = Vector2(s, s)
	stream.push_buffer(buf)


func get_forced_signal() -> float:
	return REVEAL_SIGNAL


## --- Helpers ---

func _get_tuned_band() -> int:
	var bc := _autoload("BandController")
	if bc:
		if bc.get("active_band_id") != null:
			return int(bc.get("active_band_id"))
	return -1


func _find_tuner() -> Node:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	for tuner in tree.get_nodes_in_group("radio_tuner"):
		return tuner
	return null


func _find_player() -> CharacterBody3D:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.root == null:
		return null
	for c in tree.get_nodes_in_group("player"):
		if c is CharacterBody3D:
			return c
	return null


func _autoload(name: String) -> Node:
	return get_node_or_null("/root/" + name)


## --- Testing helpers ---

func is_revealed() -> bool:
	return _revealed


func is_signal_playing() -> bool:
	return _signal_playing


func is_shadow_visible() -> bool:
	return _shadow_visible


func is_tape_taken() -> bool:
	return _tape_taken


func is_completed() -> bool:
	return _completed


func force_reveal_for_testing() -> void:
	_house_entered = true
	_check_reveal()


func force_dig_for_testing() -> void:
	_dig_up_tape()


func get_tuned_band_for_testing() -> int:
	return _get_tuned_band()


func _reset_for_testing() -> void:
	_house_entered = false
	_revealed = false
	_signal_playing = false
	_shadow_visible = false
	_tape_taken = false
	_completed = false
	if _signal_player:
		_signal_player.stop()
	if _shadow:
		(_shadow as Node3D).visible = false
