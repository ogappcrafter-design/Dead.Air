## test_hud_layout.gd — Unit tests for HUDLayout and CRTText.
## Tests: HUD component creation, data binding, hide mode, text corruption, meter updates.
extends RefCounted

var test_name: String = "HUDLayout"


func run_tests() -> Dictionary:
	var results: Dictionary = {}
	results["test_crt_text_no_corruption_at_high_composure"] = test_crt_text_no_corruption_at_high_composure()
	results["test_crt_text_corruption_at_low_composure"] = test_crt_text_corruption_at_low_composure()
	results["test_crt_text_empty_string"] = test_crt_text_empty_string()
	results["test_hud_creates_all_components"] = test_hud_creates_all_components()
	results["test_hud_signal_meter_updates"] = test_hud_signal_meter_updates()
	results["test_hud_composure_meter_updates"] = test_hud_composure_meter_updates()
	results["test_hud_dread_meter_visibility"] = test_hud_dread_meter_visibility()
	results["test_hud_dread_meter_hidden_when_zero"] = test_hud_dread_meter_hidden_when_zero()
	results["test_hud_band_display_updates"] = test_hud_band_display_updates()
	results["test_hud_tape_counter_updates"] = test_hud_tape_counter_updates()
	results["test_hud_tape_counter_max_value"] = test_hud_tape_counter_max_value()
	results["test_hud_hide_mode_hides_ui"] = test_hud_hide_mode_hides_ui()
	results["test_hud_hide_mode_shows_breathing"] = test_hud_hide_mode_shows_breathing()
	results["test_hud_hide_mode_vignette_overlay"] = test_hud_hide_mode_vignette_overlay()
	results["test_hud_call_text_set"] = test_hud_call_text_set()
	results["test_hud_subtitle_set"] = test_hud_subtitle_set()
	results["test_hud_recording_flashes"] = test_hud_recording_flashes()
	results["test_hud_clock_visible_in_phase_1"] = test_hud_clock_visible_in_phase_1()
	results["test_hud_clock_hidden_in_other_phases"] = test_hud_clock_hidden_in_other_phases()
	results["test_hud_control_hints_present"] = test_hud_control_hints_present()
	return results


# --- CRTText tests ---

func test_crt_text_no_corruption_at_high_composure() -> bool:
	# At composure >= 30, text should be unchanged.
	var result: String = CRTText.corrupt_text("LIVING 88.7 MHz", 50.0)
	return result == "LIVING 88.7 MHz"


func test_crt_text_corruption_at_low_composure() -> bool:
	# At composure < 30, text should be corrupted (different from original).
	# Use composure = 0 for maximum corruption.
	# Run multiple times because corruption is probabilistic.
	var corrupted: bool = false
	for _i in range(20):
		var result: String = CRTText.corrupt_text("LIVING BROADCAST", 0.0)
		if result != "LIVING BROADCAST":
			corrupted = true
			break
	return corrupted


func test_crt_text_empty_string() -> bool:
	var result: String = CRTText.corrupt_text("", 0.0)
	return result == ""


# --- HUDLayout tests ---

## Build a minimal HUDLayout with mock systems for testing.
func _make_hud() -> HUDLayout:
	var hud := HUDLayout.new()
	# Build without connecting to real systems — _ready builds UI.
	# We need to add to tree for _ready to fire.
	return hud


## Build a HUD with mock core systems attached.
func _make_hud_with_systems() -> Dictionary:
	var hud := HUDLayout.new()
	hud.radio_tuner = _make_mock_radio_tuner()
	hud.signal_strength = _make_mock_signal_strength()
	hud.dread_composure = _make_mock_dread_composure()
	hud.tape_inventory = _make_mock_tape_inventory()
	return {
		"hud": hud,
		"radio_tuner": hud.radio_tuner,
		"signal_strength": hud.signal_strength,
		"dread_composure": hud.dread_composure,
		"tape_inventory": hud.tape_inventory,
	}


## Mock RadioTuner for testing (just the needed interface).
func _make_mock_radio_tuner() -> RadioTuner:
	var tuner := RadioTuner.new()
	# Set up a basic band config for band display tests.
	var config := BandConfig.new()
	var band := BandData.new()
	band.id = 0
	band.name = "LIVING"
	band.center_frequency = 88.7
	band.sensitivity = 8.0
	band.freq_range_min = 87.5
	band.freq_range_max = 92.0
	config.bands = [band]
	tuner.band_config = config
	tuner.current_frequency = 88.7
	tuner.current_band_id = 0
	return tuner


## Mock SignalStrength for testing.
func _make_mock_signal_strength() -> SignalStrength:
	var ss := SignalStrength.new()
	ss.signal_value = 75.0
	return ss


## Mock DreadComposure for testing.
func _make_mock_dread_composure() -> DreadComposure:
	var dc := DreadComposure.new()
	dc.dread = 0.0
	dc.composure = 100.0
	return dc


## Mock TapeInventory for testing.
func _make_mock_tape_inventory() -> Node:
	var inv := Node.new()
	# Add methods via script.
	var script := GDScript.new()
	script.source_code = """
extends Node

var collected: int = 3
var consumed: int = 1

func get_collected_count() -> int:
	return collected

func get_consumed_count() -> int:
	return consumed

func get_total_encountered() -> int:
	return collected

signal tape_collected(tape_id)
signal tape_consumed(tape_id)
"""
	inv.set_script(script)
	return inv


func test_hud_creates_all_components() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	# Add to tree to trigger _ready.
	Engine.get_main_loop().root.add_child(hud)

	var has_signal: bool = hud._signal_bar != null
	var has_composure: bool = hud._composure_bar != null
	var has_dread: bool = hud._dread_bar != null
	var has_band_name: bool = hud._band_name_label != null
	var has_freq: bool = hud._freq_label != null
	var has_call: bool = hud._call_text_label != null
	var has_subtitle: bool = hud._subtitle_label != null
	var has_tape: bool = hud._tape_counter_label != null
	var has_clock: bool = hud._clock_label != null
	var has_hints: bool = hud._control_hints_label != null
	var has_breathing: bool = hud._breathing_overlay != null
	var has_vignette: bool = hud._vignette_overlay != null

	hud.queue_free()
	return has_signal and has_composure and has_dread and has_band_name and has_freq \
		and has_call and has_subtitle and has_tape and has_clock and has_hints \
		and has_breathing and has_vignette


func test_hud_signal_meter_updates() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Signal strength should be reflected in the signal bar.
	var ss: SignalStrength = ctx["signal_strength"]
	ss.signal_value = 42.0
	ss.signal_changed.emit(42.0)

	var result: bool = hud._signal_bar.value == 42.0
	hud.queue_free()
	return result


func test_hud_composure_meter_updates() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	var dc: DreadComposure = ctx["dread_composure"]
	dc.composure = 60.0
	dc.composure_changed.emit(60.0)

	var result: bool = hud._composure_bar.value == 60.0
	hud.queue_free()
	return result


func test_hud_dread_meter_visibility() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	var dc: DreadComposure = ctx["dread_composure"]
	dc.dread = 50.0
	dc.dread_changed.emit(50.0)

	var result: bool = hud._dread_bar.visible and hud._dread_bar.value == 50.0
	hud.queue_free()
	return result


func test_hud_dread_meter_hidden_when_zero() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	var dc: DreadComposure = ctx["dread_composure"]
	# Start with dread > 0, then drop to 0.
	dc.dread = 10.0
	dc.dread_changed.emit(10.0)
	dc.dread = 0.0
	dc.dread_changed.emit(0.0)

	var result: bool = not hud._dread_bar.visible
	hud.queue_free()
	return result


func test_hud_band_display_updates() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Band name should show "LIVING" (from mock).
	var result: bool = hud._band_name_label.text == "LIVING"
	hud.queue_free()
	return result


func test_hud_tape_counter_updates() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Mock tape_inventory has collected = 3, so counter should show "3/10".
	var result: bool = hud._tape_counter_label.text == "3/10"
	hud.queue_free()
	return result


func test_hud_tape_counter_max_value() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# MAX_TAPES = 10, so the counter format should be "X/10".
	var result: bool = hud._tape_counter_label.text.ends_with("/10")
	hud.queue_free()
	return result


func test_hud_hide_mode_hides_ui() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Manually trigger hide mode.
	hud._is_hide_mode = true
	hud._apply_hide_mode()

	var result: bool = not hud._band_name_label.visible \
		and not hud._freq_label.visible \
		and not hud._call_text_label.visible \
		and not hud._subtitle_label.visible \
		and not hud._tape_counter_label.visible \
		and not hud._clock_label.visible \
		and not hud._control_hints_label.visible \
		and not hud._dread_bar.visible

	hud.queue_free()
	return result


func test_hud_hide_mode_shows_breathing() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	hud._is_hide_mode = true
	hud._apply_hide_mode()

	var result: bool = hud._breathing_overlay.visible
	hud.queue_free()
	return result


func test_hud_hide_mode_vignette_overlay() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	hud._is_hide_mode = true
	hud._apply_hide_mode()

	# Vignette should be visible and darker (0.2 alpha).
	var result: bool = hud._vignette_overlay.visible and hud._vignette_overlay.color.a >= 0.2
	hud.queue_free()
	return result


func test_hud_call_text_set() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	hud.set_call_text("CALLER_01", "INCOMING")

	# At high composure, text should be uncorrupted.
	var result: bool = hud._call_text_label.text.contains("CALLER_01") \
		and hud._call_text_label.text.contains("INCOMING")
	hud.queue_free()
	return result


func test_hud_subtitle_set() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	hud.set_subtitle("Test subtitle text")

	var result: bool = hud._subtitle_label.text == "Test subtitle text"
	hud.queue_free()
	return result


func test_hud_recording_flashes() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	var initial_visible: bool = hud._tape_counter_label.visible

	# Start recording.
	hud.set_recording(true)

	# Step _process: accumulate 0.5s to trigger first flash toggle.
	hud._process(0.3)
	hud._process(0.3)

	# After 0.6s, the tape counter should have toggled to invisible.
	var toggled_off: bool = hud._tape_counter_label.visible != initial_visible

	# Step further to trigger second toggle back to visible.
	hud._process(0.3)
	hud._process(0.3)

	# After another 0.6s, should have toggled back.
	var toggled_back: bool = hud._tape_counter_label.visible == initial_visible

	# Stop recording: label should be restored to visible.
	hud.set_recording(false)
	var restored: bool = hud._tape_counter_label.visible

	hud.queue_free()
	return toggled_off and toggled_back and restored


func test_hud_clock_visible_in_phase_1() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Phase 1 = PHASE_1_STATION = 0.
	hud._update_clock_visibility(PhaseEnums.Phase.PHASE_1_STATION)

	var result: bool = hud._clock_label.visible
	hud.queue_free()
	return result


func test_hud_clock_hidden_in_other_phases() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Phase 2 = PHASE_2_BREAK = 1.
	hud._update_clock_visibility(PhaseEnums.Phase.PHASE_2_BREAK)

	var result: bool = not hud._clock_label.visible
	hud.queue_free()
	return result


func test_hud_control_hints_present() -> bool:
	var ctx: Dictionary = _make_hud_with_systems()
	var hud: HUDLayout = ctx["hud"]
	Engine.get_main_loop().root.add_child(hud)

	# Control hints should contain the expected button labels.
	var text: String = hud._control_hints_label.text
	var result: bool = text.contains("L-Stick") \
		and text.contains("Tune") \
		and text.contains("Record") \
		and text.contains("Play") \
		and text.contains("Interact")
	hud.queue_free()
	return result
