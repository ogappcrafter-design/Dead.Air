## test_audio_bus_manager.gd — Tests for AudioBusManager dread offset logic (DEA-141)
## Verifies that set_dread_level stores a dynamic offset instead of overwriting
## the accessibility baseline, so volume settings and reduce-horror offsets persist.
extends RefCounted

const EPS := 0.01

var test_name: String = "AudioBusManager"


func run_tests() -> Dictionary:
	var results: Dictionary = {}

	results["dread_offset_minus_12_at_dread_0"] = _test_dread_offset_at_0()
	results["dread_offset_0_at_dread_75"] = _test_dread_offset_at_75()
	results["dread_offset_0_above_75"] = _test_dread_offset_above_75()
	results["baseline_preserved_after_dread_changes"] = _test_baseline_preserved()
	results["bus_volume_equals_baseline_plus_offset"] = _test_bus_volume_equals_baseline_plus_offset()
	results["set_bus_volume_applies_dread_offset"] = _test_set_bus_volume_applies_offset()
	results["dread_offset_midpoint"] = _test_dread_offset_midpoint()

	return results


# ─── Helper ─────────────────────────────────────────────────────────


func _make_abm():
	var script = load("res://src/audio/audio_bus_manager.gd")
	if script == null:
		return null
	return script.new()


func _approx_eq(a: float, b: float, eps: float = EPS) -> bool:
	return abs(a - b) <= eps


func _has_dread_bus() -> bool:
	return AudioServer.bus_count > AudioBusManager.IDX_DREAD_LAYER


# ─── Dread Offset Tests ──────────────────────────────────────────────


func _test_dread_offset_at_0() -> bool:
	var abm = _make_abm()
	if abm == null:
		return false
	abm.set_dread_level(0.0)
	return _approx_eq(abm._dread_offset, -12.0)


func _test_dread_offset_at_75() -> bool:
	var abm = _make_abm()
	if abm == null:
		return false
	abm.set_dread_level(75.0)
	return _approx_eq(abm._dread_offset, 0.0)


func _test_dread_offset_above_75() -> bool:
	var abm = _make_abm()
	if abm == null:
		return false
	abm.set_dread_level(100.0)
	return _approx_eq(abm._dread_offset, 0.0)


func _test_dread_offset_midpoint() -> bool:
	var abm = _make_abm()
	if abm == null:
		return false
	# dread 37.5 → t = 37.5/75 = 0.5 → lerpf(-12, 0, 0.5) = -6
	abm.set_dread_level(37.5)
	return _approx_eq(abm._dread_offset, -6.0)


func _test_baseline_preserved() -> bool:
	var abm = _make_abm()
	if abm == null:
		return false
	var test_baseline := -40.0
	abm._baseline_volumes[AudioBusManager.IDX_DREAD_LAYER] = test_baseline
	# Call set_dread_level multiple times with different values
	abm.set_dread_level(10.0)
	abm.set_dread_level(50.0)
	abm.set_dread_level(80.0)
	abm.set_dread_level(0.0)
	# Baseline should be unchanged — set_dread_level no longer overwrites it
	return _approx_eq(
		abm._baseline_volumes.get(AudioBusManager.IDX_DREAD_LAYER, 999.0), test_baseline
	)


func _test_bus_volume_equals_baseline_plus_offset() -> bool:
	if not _has_dread_bus():
		return true  # Skip if AudioServer lacks the DREAD bus
	var abm = _make_abm()
	if abm == null:
		return false
	var test_baseline := -30.0
	abm._baseline_volumes[AudioBusManager.IDX_DREAD_LAYER] = test_baseline
	abm.set_dread_level(37.5)  # _dread_offset = -6.0
	var expected: float = test_baseline + abm._dread_offset
	var actual: float = AudioServer.get_bus_volume_db(AudioBusManager.IDX_DREAD_LAYER)
	return _approx_eq(actual, expected)


func _test_set_bus_volume_applies_offset() -> bool:
	if not _has_dread_bus():
		return true  # Skip if AudioServer lacks the DREAD bus
	var abm = _make_abm()
	if abm == null:
		return false
	abm.set_dread_level(37.5)  # _dread_offset = -6.0
	abm.set_bus_volume(AudioBusManager.IDX_DREAD_LAYER, -40.0)
	# Baseline should be -40, actual should be -40 + (-6) = -46
	if not _approx_eq(abm.get_bus_volume(AudioBusManager.IDX_DREAD_LAYER), -40.0):
		return false
	var actual: float = AudioServer.get_bus_volume_db(AudioBusManager.IDX_DREAD_LAYER)
	return _approx_eq(actual, -46.0)
