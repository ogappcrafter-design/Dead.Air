## test_phase3_bunker.gd — Tests for DEA-124 Location 4 "The Bunker".
## Verifies: underground bunker start, CLASSIFIED strongest, HISTORICAL
## first unlock, numbers heard near tape machine, vault code puzzle
## (22102, alarm on 3 wrong), alarm resets after 60s, vault opens and
## powers elevator, office desk save, elevator requires vault + key,
## reset restores Phase 1.
extends RefCounted

var test_name: String = "Phase3Bunker"

func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_starts_classified_strongest"] = await test_starts_classified_strongest()
	results["test_historical_unlocked_on_entry"] = await test_historical_unlocked_on_entry()
	results["test_numbers_heard_near_machine"] = await test_numbers_heard_near_machine()
	results["test_correct_code_opens_vault"] = await test_correct_code_opens_vault()
	results["test_wrong_codes_trigger_alarm"] = await test_wrong_codes_trigger_alarm()
	results["test_alarm_resets_after_duration"] = await test_alarm_resets_after_duration()
	results["test_vault_powers_elevator"] = await test_vault_powers_elevator()
	results["test_elevator_requires_vault_and_key"] = await test_elevator_requires_vault_and_key()
	results["test_office_desk_save"] = await test_office_desk_save()
	results["test_reset_restores_phase1"] = await test_reset_restores_phase1()
	return results

# ─── Helpers ─────────────────────────────────────────────────────────────────

func _load_segment() -> Node:
	var scene: PackedScene = load("res://scenes/phase3/bunker.tscn")
	var segment: Node = scene.instantiate()
	var tree: SceneTree = Engine.get_main_loop() as SceneTree
	tree.root.add_child(segment)
	return segment

func _cleanup_segment(segment: Node) -> void:
	if segment:
		segment._reset_for_testing()
		segment.queue_free()

# ─── Tests ───────────────────────────────────────────────────────────────────

func test_starts_classified_strongest() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_started()
	if ok:
		ok = segment.get_phase_name() == "EXPLORE"
	if ok:
		ok = segment.get_radio_band_id() == segment.CLASSIFIED_BAND_ID
	if ok:
		ok = segment.get_radio_signal() >= 70.0
	_cleanup_segment(segment)
	return ok

func test_historical_unlocked_on_entry() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = segment.is_historical_unlocked()
	_cleanup_segment(segment)
	return ok

func test_numbers_heard_near_machine() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_numbers_heard()
	if ok:
		segment.place_player_at_machine_for_testing()
		segment._process(0.016)
		ok = segment.is_numbers_heard()
	_cleanup_segment(segment)
	return ok

func test_correct_code_opens_vault() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var result: String = segment.submit_vault_code("22102")
	var ok: bool = result == "ok"
	if ok:
		ok = segment.is_vault_open() and segment.is_elevator_powered()
	if ok:
		# Vault door visually opens.
		ok = not segment.get_node("Vault/Door").visible
	_cleanup_segment(segment)
	return ok

func test_wrong_codes_trigger_alarm() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var got_alarm := [false]
	segment.alarm_triggered.connect(func() -> void: got_alarm[0] = true)
	var ok: bool = segment.submit_vault_code("11111") == "wrong"
	if ok:
		ok = segment.get_wrong_attempts() == 1
	if ok:
		ok = segment.submit_vault_code("22222") == "wrong"
	if ok:
		# Third wrong code triggers the alarm.
		ok = segment.submit_vault_code("33333") == "alarm" and got_alarm[0]
	if ok:
		ok = segment.is_alarm_active() and segment.get_phase_name() == "ALARM"
	_cleanup_segment(segment)
	return ok

func test_alarm_resets_after_duration() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	segment.submit_vault_code("11111")
	segment.submit_vault_code("22222")
	segment.submit_vault_code("33333")
	var ok: bool = segment.is_alarm_active()
	if ok:
		# Wait out the alarm (60s).
		for i in range(62):
			segment._process(1.0)
		ok = not segment.is_alarm_active()
	if ok:
		# Code doesn't change: correct code still works after reset.
		var result: String = segment.submit_vault_code("22102")
		ok = result == "ok" and segment.is_vault_open()
	_cleanup_segment(segment)
	return ok

func test_vault_powers_elevator() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.is_elevator_powered()
	if ok:
		var got_power := [false]
		segment.elevator_powered.connect(func() -> void: got_power[0] = true)
		segment.submit_vault_code("22102")
		ok = got_power[0] and segment.is_elevator_powered()
	_cleanup_segment(segment)
	return ok

func test_elevator_requires_vault_and_key() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	# Without vault: fails regardless of key.
	var ok: bool = not segment.activate_elevator(true)
	if ok:
		# With vault but no key: fails.
		segment.submit_vault_code("22102")
		ok = not segment.activate_elevator(false)
	if ok:
		# With vault and key: completes.
		var got_complete := [false]
		segment.segment_completed.connect(func() -> void: got_complete[0] = true)
		ok = segment.activate_elevator(true)
		if ok:
			ok = got_complete[0] and segment.get_phase_name() == "COMPLETED"
	_cleanup_segment(segment)
	return ok

func test_office_desk_save() -> bool:
	var segment: Node = _load_segment()
	await _wait_frames(3)
	var ok: bool = not segment.has_saved()
	if ok:
		segment.place_player_at_desk_for_testing()
		segment._process(0.016)
		ok = segment.has_saved()
	if ok:
		var sm: Node = segment._autoload("SaveManager")
		ok = sm and sm.is_tape_used("bunker_office_1")
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
