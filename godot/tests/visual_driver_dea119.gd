extends Node
## Visual verification driver for DEA-119 Segment 2C "The Follower".
## Usage:
##   xvfb-run godot --path godot res://tests/visual_driver_dea119.tscn
## Flow: dead air → presence (suit approaches from behind) → hunt
## (tune to LIMINAL, run to house) → hiding (breath hold, shadow sweep,
## static peaks/fades) → passed → complete. Screenshots to user://screenshot/.
## Exit code 0 when all checks pass.

const OUT_DIR := "screenshot"

var _step := 0
var _checks: Array[String] = []
var _failures: int = 0

var _segment: Node = null
var _player: CharacterBody3D = null
var _suit = null


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	var scene: PackedScene = load("res://scenes/phase2/follower.tscn")
	var seg := scene.instantiate()
	seg.name = "Follower"
	get_tree().root.add_child.call_deferred(seg)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(1.0).timeout
	_run()


func _run() -> void:
	_resolve_references()
	await _step0_environment()
	await _step1_dead_air()
	await _step2_presence()
	await _step3_hunt_and_house()
	await _step4_hiding_shadow()
	await _step5_passed()
	_finish()


func _resolve_references() -> void:
	_segment = get_node_or_null("/root/Follower")
	_player = _segment.get_player() if _segment else null
	_suit = _segment.get_suit() if _segment else null


func _snap(name: String) -> void:
	_step += 1
	var path := OUT_DIR + "/dea119_%02d_%s.png" % [_step, name]
	var img := get_viewport().get_texture().get_image()
	var err := img.save_png("user://" + path)
	print("[Driver] snapshot user://%s (err=%d)" % [path, err])


func _check(cond: bool, label: String) -> void:
	if cond:
		_checks.append("PASS: " + label)
	else:
		_failures += 1
		_checks.append("FAIL: " + label)
		print("[Driver] *** FAIL: %s" % label)


func _step0_environment() -> void:
	print("[Driver] Step 0: verifying environment")
	_check(_segment != null, "Follower segment loaded")
	_check(_player != null, "player present")
	_check(_suit != null, "suit entity present")
	await get_tree().process_frame
	_snap("boot_state")


func _step1_dead_air() -> void:
	print("[Driver] Step 1: dead air")
	_check(_segment.is_started(), "segment started")
	_check(_segment.get_phase_name() == "DEAD_AIR", "phase == DEAD_AIR")
	_segment._process(0.016)
	_check(_segment.get_radio_signal() <= 0.001, "radio signal == 0 (dead air)")
	await get_tree().create_timer(0.5).timeout
	_snap("dead_air")


func _step2_presence() -> void:
	print("[Driver] Step 2: presence")
	_segment._enter_phase(_segment.Phase.PRESENCE)
	_check(_segment.get_phase_name() == "PRESENCE", "phase == PRESENCE")
	# Suit approaches visibly
	_segment._process(0.1)
	_suit._physics_process(0.1)
	_check(_suit.visible, "suit visible during presence")
	_check(_segment.get_presence_volume() > 0.0, "presence audio audible")
	await get_tree().create_timer(0.5).timeout
	_snap("presence_behind")


func _step3_hunt_and_house() -> void:
	print("[Driver] Step 3: hunt and house")
	_segment.force_hunt_phase_for_testing()
	_check(_segment.get_phase_name() == "HUNT", "phase == HUNT")
	# Before tuning: dead
	_check(_segment.get_radio_signal() <= 0.001, "signal dead before tuning")
	# Tune to LIMINAL
	_segment.get_radio_tuner().set_band(1)
	_segment._process(0.016)
	_check(_segment.is_radio_restored(), "signal restored after tuning to LIMINAL")
	await get_tree().create_timer(0.3).timeout
	_snap("hunt_signal_back")
	# Walk to the house
	_player.global_position.x = 35.0
	await get_tree().create_timer(0.3).timeout
	_segment.force_house_entry_for_testing()
	_check(_segment.get_phase_name() == "HIDING", "house entry -> HIDING")


func _step4_hiding_shadow() -> void:
	print("[Driver] Step 4: hiding, shadow sweep")
	_check(_segment.is_hiding(), "hiding active")
	_check(_segment.is_silenced_for_hiding(), "total silence (all buses muted incl. radio)")
	_check(PhaseManager.get_mode() == PhaseEnums.ModeContext.HIDE, "hide mode active")
	# Breath hold
	_segment._breath_override_for_testing = true
	_segment._process(0.016)
	_check(_segment.is_breath_held(), "breath hold registered")
	_segment._breath_override_for_testing = false
	# Mid-pass shadow peak
	_segment._pass_timer = 6.0
	_segment._process(0.016)
	_check(_segment.get_window_shadow_intensity() > 0.9, "shadow sweep at window peak")
	await get_tree().create_timer(0.5).timeout
	_snap("shadow_at_windows")


func _step5_passed() -> void:
	print("[Driver] Step 5: passed and complete")
	var got_passed := [false]
	var got_complete := [false]
	_segment.follower_passed.connect(func() -> void: got_passed[0] = true)
	_segment.segment_completed.connect(func() -> void: got_complete[0] = true)
	_segment._pass_timer = 12.5
	_segment._process(0.016)
	_check(got_passed[0], "follower passed")
	_segment._pass_timer = 18.5
	_segment._process(0.016)
	_check(got_complete[0], "segment completed")
	await get_tree().create_timer(0.3).timeout
	_snap("passed")


func _finish() -> void:
	print("[Driver] ================= RESULTS =================")
	for c in _checks:
		print("[Driver] " + c)
	print("[Driver] ================= %d checks, %d failures =================" % [_checks.size(), _failures])
	var code := 0 if _failures == 0 else 1
	get_tree().quit(code)
