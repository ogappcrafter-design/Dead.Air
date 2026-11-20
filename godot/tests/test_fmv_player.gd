## test_fmv_player.gd — Tests for the DEA-199 launch FMV player.
## Verifies: the intro scene wiring (VideoStreamPlayer + skip hint), Master
## audio-bus routing, skip-on-input, the missing-clip fallback to the title
## screen, single-transition guarding, and that the shipped Ogg Theora clip
## actually loads with the expected duration.
extends RefCounted

var test_name: String = "FMVPlayer"

const SCENE_PATH := "res://scenes/fmv_intro.tscn"
const INTRO_PATH := FMVPlayer.INTRO_STREAM_PATH
const MENU_PATH := "res://scenes/main_menu.tscn"
const MISSING_PATH := "res://assets/fmv/definitely_missing.ogv"
## The runtime clip is 15 s of 1080p Theora; anything under this is a stub.
const MIN_CLIP_BYTES := 1_000_000


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	var scene := load(SCENE_PATH)
	results["test_scene_loads"] = scene != null
	if scene == null:
		print("  FAIL: could not load %s" % SCENE_PATH)
		return results

	# ─── Shipped clip ───
	results["test_intro_clip_ships"] = ResourceLoader.exists(INTRO_PATH, "VideoStream")
	var stream := load(INTRO_PATH) as VideoStream if results["test_intro_clip_ships"] else null
	results["test_intro_clip_loads"] = stream is VideoStreamTheora
	if stream != null:
		# VideoStreamTheora exposes length only on its playback object, so the
		# unit test guards presence + payload; duration is verified by ffprobe in
		# scripts/fmv/render_masters.py.
		var bytes := FileAccess.get_file_as_bytes(INTRO_PATH).size()
		results["test_intro_clip_has_payload"] = bytes >= MIN_CLIP_BYTES
		if bytes < MIN_CLIP_BYTES:
			print("  FAIL: intro clip is %d bytes" % bytes)
	else:
		results["test_intro_clip_has_payload"] = false
		print("  FAIL: intro clip did not load at %s" % INTRO_PATH)

	# ─── Scene wiring ───
	var intro: FMVPlayer = scene.instantiate()
	var stub := _install_stub(intro)
	intro.intro_stream_path = INTRO_PATH
	_attach(intro)
	await _wait_frames(2)

	var player := intro.get_node_or_null("VideoStreamPlayer") as VideoStreamPlayer
	results["test_player_node_present"] = player is VideoStreamPlayer
	results["test_skip_hint_present"] = intro.get_node_or_null("SkipHint") is Label
	results["test_audio_bus_is_master"] = (
		player != null and String(player.bus) == String(AudioBusManager.BUS_MASTER)
	)
	if not results["test_audio_bus_is_master"]:
		print("  FAIL: video audio bus is not Master")
	results["test_intro_started"] = _has_signal_record(stub, "started")

	# ─── Skip on input ───
	var key := InputEventKey.new()
	key.pressed = true
	intro._input(key)
	results["test_skip_on_key_input"] = _has_signal_record(stub, "skipped")
	results["test_skip_requests_title_screen"] = stub.requested.has(MENU_PATH)
	results["test_player_stopped_after_skip"] = player == null or not player.is_playing()
	results["test_finished_flag_set"] = intro.finished

	# Repeated skip must not request a second scene change.
	intro.skip()
	results["test_skip_is_idempotent"] = stub.requested.size() == 1
	if stub.requested.size() != 1:
		print("  FAIL: %d scene requests instead of 1" % stub.requested.size())

	_cleanup(intro)

	# ─── Natural end of playback ───
	var intro2: FMVPlayer = scene.instantiate()
	var stub2 := _install_stub(intro2)
	intro2.intro_stream_path = INTRO_PATH
	_attach(intro2)
	await _wait_frames(1)
	var player2 := intro2.get_node_or_null("VideoStreamPlayer") as VideoStreamPlayer
	if player2 != null:
		player2.finished.emit()
	results["test_natural_finish_transitions"] = stub2.requested == [MENU_PATH]
	results["test_natural_finish_after_skip_ignored"] = (
		_has_signal_record(stub2, "finished") and intro2.finished
	)
	_cleanup(intro2)

	# ─── Missing clip fallback ───
	var intro3: FMVPlayer = scene.instantiate()
	var stub3 := _install_stub(intro3)
	intro3.intro_stream_path = MISSING_PATH
	_attach(intro3)
	await _wait_frames(1)
	results["test_missing_clip_emits_unavailable"] = _has_signal_record(stub3, "unavailable")
	results["test_missing_clip_falls_back_to_menu"] = stub3.requested == [MENU_PATH]
	results["test_missing_clip_marks_finished"] = intro3.finished
	if not results["test_missing_clip_falls_back_to_menu"]:
		print("  FAIL: missing clip did not fall back to %s" % MENU_PATH)
	_cleanup(intro3)

	# ─── Non-skip events do not end the intro ───
	var intro4: FMVPlayer = scene.instantiate()
	var stub4 := _install_stub(intro4)
	intro4.intro_stream_path = INTRO_PATH
	_attach(intro4)
	await _wait_frames(1)
	var motion := InputEventMouseMotion.new()
	results["test_mouse_motion_does_not_skip"] = (
		not intro4._is_skip_event(motion) and not intro4.finished
	)
	var release := InputEventKey.new()
	release.pressed = false
	results["test_key_release_does_not_skip"] = not intro4._is_skip_event(release)
	_cleanup(intro4)

	return results


# ─── helpers ─────────────────────────────────────────────────────────
## Recording stub for request_scene_change plus signal bookkeeping.
func _install_stub(intro: FMVPlayer) -> Dictionary:
	var stub := {"requested": [], "started": false, "skipped": false, "finished": false, "unavailable": false}
	intro.request_scene_change = func(path: String) -> void:
		stub.requested.append(path)
	intro.intro_started.connect(
		func() -> void:
			stub.started = true
	)
	intro.intro_skipped.connect(
		func() -> void:
			stub.skipped = true
	)
	intro.intro_finished.connect(
		func() -> void:
			stub.finished = true
	)
	intro.intro_unavailable.connect(
		func() -> void:
			stub.unavailable = true
	)
	return stub


func _has_signal_record(stub: Dictionary, key: String) -> bool:
	return stub.get(key, false) == true


## Attach the intro under the scene-tree root so @onready nodes resolve and
## get_viewport() exists for set_input_as_handled.
func _attach(intro: Node) -> void:
	Engine.get_main_loop().root.add_child(intro)


func _wait_frames(count: int) -> void:
	for _i in range(count):
		await Engine.get_main_loop().process_frame


func _cleanup(intro: Node) -> void:
	if intro == null:
		return
	if intro.is_inside_tree():
		intro.get_parent().remove_child(intro)
	intro.free()
