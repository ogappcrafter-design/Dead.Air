## test_phase2_static_sky.gd — Tests for DEA-118 Segment 2B "The Static Sky".
## Verifies: segment starts (Phase 2 active), static sky present, high wide
## camera, radio LIVING weak signal (misaligned), signal rises when facing
## nav heading (navigation-by-radio), road bend/houses triggers, reversed
## fragments pull from real Shift 1-5 calls, outdoor ambience starts,
## exit area fires exit_reached, and reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase2StaticSky"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_segment_start_sets_phase2"] = await test_segment_start_sets_phase2()
	results["test_static_sky_present"] = await test_static_sky_present()
	results["test_camera_high_wide"] = await test_camera_high_wide()
	results["test_signal_misaligned_facing_away"] = await test_signal_misaligned_facing_away()
	results["test_signal_aligned_facing_nav"] = await test_signal_aligned_facing_nav()
	results["test_bend_and_houses_triggers"] = await test_bend_and_houses_triggers()
	results["test_fragments_from_shift_calls"] = await test_fragments_from_shift_calls()
	results["test_fragments_reversed"] = await test_fragments_reversed()
	results["test_ambience_starts"] = await test_ambience_starts()
	results["test_exit_reached_signal"] = await test_exit_reached_signal()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase2/static_sky.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_segment_start_sets_phase2() -> bool:
	var segment: Node = _load_segment()
	var ok := true
	await _wait_frames(3)
	if not segment.is_started():
		ok = false
	if ok and PhaseManager.get_phase() != PhaseEnums.Phase.PHASE_2_BREAK:
		ok = false
	_cleanup_segment(segment)
	return ok

func test_static_sky_present() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var sky: Node3D = segment.get_static_sky()
	var ok: bool = sky != null and sky is StaticSky
	if ok:
		ok = sky.get_static_brightness() > 0.0 and sky.get_static_brightness() < 0.5
	_cleanup_segment(segment)
	return ok

func test_camera_high_wide() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var cam: Camera3D = segment.get_node_or_null("CameraRig") as Camera3D
	var ok: bool = cam != null
	if ok:
		# High angle: camera well above ground, wide FOV
		ok = cam.global_position.y > 8.0
	if ok:
		ok = cam.fov >= 50.0
	_cleanup_segment(segment)
	return ok

func test_signal_misaligned_facing_away() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player: CharacterBody3D = segment.get_player()
	var ok: bool = player != null
	if ok:
		# Face backwards (-X), away from nav heading (+X)
		segment._face_player(Vector3(-1.0, 0.0, 0.0))
		segment._process(0.016)
		var sig: float = segment.get_radio_signal()
		ok = sig < 30.0
	_cleanup_segment(segment)
	return ok

func test_signal_aligned_facing_nav() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player: CharacterBody3D = segment.get_player()
	var ok: bool = player != null
	if ok:
		# Face down the road (+X, the nav heading)
		segment._face_player(Vector3(1.0, 0.0, 0.0))
		segment._process(0.016)
		var sig: float = segment.get_radio_signal()
		# Aligned: base 72 ± pulse depth 6 → 66..78
		ok = sig >= 60.0 and sig <= 80.0
	if ok:
		# And aligned must exceed misaligned
		segment._face_player(Vector3(0.0, 0.0, 1.0))  # perpendicular
		segment._process(0.016)
		var mid: float = segment.get_radio_signal()
		segment._face_player(Vector3(1.0, 0.0, 0.0))
		segment._process(0.016)
		var aligned: float = segment.get_radio_signal()
		ok = aligned > mid
	_cleanup_segment(segment)
	return ok

func test_bend_and_houses_triggers() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_cleanup_segment(segment)
		return false
	var got_bend := [false]
	var got_houses := [false]
	segment.bend_reached.connect(func() -> void: got_bend[0] = true)
	segment.houses_visible.connect(func() -> void: got_houses[0] = true)
	player.global_position.x = 31.0  # BEND_X - 4.0 = 30.0 threshold
	segment._process(0.016)
	player.global_position.x = 36.0  # BEND_X + 1.0 = 35.0 threshold
	segment._process(0.016)
	var ok: bool = got_bend[0] and got_houses[0]
	if ok:
		ok = segment.has_bend_fired() and segment.has_houses_fired()
	_cleanup_segment(segment)
	return ok

func test_fragments_from_shift_calls() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var fragments: Node = segment.get_fragments()
	var ok: bool = fragments != null and fragments.is_started()
	if ok:
		# Schedule should contain entries sourced from Shift 1-5 calls
		ok = fragments.get_schedule_size() > 0
	if ok:
		# Step until a fragment starts (bounded)
		var text := ""
		for i in range(300):
			text = fragments.step_for_testing(0.1)
			if text != "":
				break
		ok = text != ""
	if ok:
		var frag: Dictionary = fragments.get_current_fragment()
		# call_id must be a real Shift 1-5 call (0..17 range, >= 0)
		var call_id: int = frag.get("call_id", -1)
		ok = call_id >= 0 and call_id <= 17
	_cleanup_segment(segment)
	return ok

func test_fragments_reversed() -> bool:
	# Pure logic: reverse_text of a known line must read backwards.
	var reversed: String = ReversedFragments.reverse_text("Wrong number.")
	var ok: bool = reversed == ".rebmun gnorW"
	if ok:
		# Schedule built from calls data must contain reversed text
		var calls: Array = CallData.calls
		if calls.is_empty():
			# Load directly if CallData autoload not populated in this context
			var f := FileAccess.open("res://src/data/calls.json", FileAccess.READ)
			var parsed: Variant = JSON.parse_string(f.get_as_text()) if f else []
			calls = parsed if parsed is Array else []
		var schedule: Array = ReversedFragments.build_fragment_schedule(
			calls, ReversedFragments.FRAGMENT_SOURCES, ReversedFragments.WARNING_LINES)
		ok = schedule.size() >= ReversedFragments.FRAGMENT_SOURCES.size()
		if ok:
			# At least one fragment's reversed text, when re-reversed, contains
			# a distinctive word from its source line.
			var found := false
			for frag in schedule:
				var unreversed: String = ReversedFragments.reverse_text(str(frag["text"]))
				if unreversed.containsn("wrong number") or unreversed.containsn("ruth"):
					found = true
					break
			ok = found
	return ok

func test_ambience_starts() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var amb: Node = segment.get_ambience()
	var ok: bool = amb != null and amb.is_started()
	if ok:
		var states: Dictionary = amb.get_layer_states()
		ok = states.get("started", false) and states.get("wind_on", false)
	_cleanup_segment(segment)
	return ok

func test_exit_reached_signal() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got := [false]
	segment.exit_reached.connect(func() -> void: got[0] = true)
	var player: CharacterBody3D = segment.get_player()
	if player == null:
		_cleanup_segment(segment)
		return false
	segment._on_exit_area_entered(player)
	var ok: bool = got[0]
	_cleanup_segment(segment)
	return ok

func test_reset_restores_phase1() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment._reset_for_testing()
	var ok: bool = PhaseManager.get_phase() == PhaseEnums.Phase.PHASE_1_STATION
	segment.queue_free()
	return ok

func _wait_frames(count: int) -> void:
	for i in range(count):
		await (Engine.get_main_loop() as SceneTree).process_frame
