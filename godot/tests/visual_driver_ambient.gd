extends Node
## Visual verification driver for AmbientLife.
## Loads the station, captures frames over time, measures pixel change
## (particles + flicker), samples emissive pulse (ON AIR sign + antenna
## beacon), then repeats the motion check on the liminal phase scene.
## Usage: xvfb-run godot --path godot res://tests/visual_driver_ambient.tscn

const OUT_DIR := "screenshot"
const STATION_PATH := "res://scenes/station/station.tscn"
const LIMINAL_PATH := "res://scenes/phase3/liminal_space.tscn"

var _station_ok := false
var _pulse_sign_ok := false
var _pulse_beacon_ok := false
var _liminal_ok := false


func _ready() -> void:
	DirAccess.open("user://").make_dir(OUT_DIR)
	await _run_station()
	await _run_liminal()
	_finish()


func _run_station() -> void:
	var inst: Node = (load(STATION_PATH) as PackedScene).instantiate()
	inst.name = "Station"
	get_tree().root.add_child.call_deferred(inst)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(2.0).timeout
	# Aim the active camera into the booth interior so particles are in view.
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		cam.global_position = Vector3(0, 1.7, 2.6)
		cam.look_at(Vector3(0, 1.1, -1.5), Vector3.UP)
	await get_tree().create_timer(0.5).timeout
	var frames: Array[Image] = []
	for i in range(3):
		frames.append(await _snap("station", i))
		if i < 2:
			await get_tree().create_timer(0.8).timeout
	var d01 := _diff(frames[0], frames[1])
	var d12 := _diff(frames[1], frames[2])
	_station_ok = d01 > 0.001 and d12 > 0.001
	print("[AmbientDriver] station diff 0->1: %.4f 1->2: %.4f" % [d01, d12])
	_pulse_sign_ok = await _check_pulse("/root/Station/Booth/OnAirSign", false)
	_pulse_beacon_ok = await _check_pulse("/root/Station/Rooftop/AntennaCrossbar", true)
	print("[AmbientDriver] pulse sign=%s beacon=%s" % [
		"YES" if _pulse_sign_ok else "NO",
		"YES" if _pulse_beacon_ok else "NO"])
	inst.queue_free()
	await get_tree().process_frame


func _check_pulse(node_path: String, is_override: bool) -> bool:
	var n := get_node_or_null(node_path) as GeometryInstance3D
	if n == null:
		return false
	var mat: StandardMaterial3D = null
	if is_override and n.material_override is StandardMaterial3D:
		mat = n.material_override as StandardMaterial3D
	elif n.mesh != null:
		var m: Material = n.get_active_material(0)
		if m is StandardMaterial3D:
			mat = m as StandardMaterial3D
	if mat == null or not mat.emission_enabled:
		return false
	var lo := mat.emission_energy_multiplier
	var hi := lo
	for i in range(50):
		await get_tree().process_frame
		lo = minf(lo, mat.emission_energy_multiplier)
		hi = maxf(hi, mat.emission_energy_multiplier)
	return hi - lo > 0.05


func _run_liminal() -> void:
	var inst: Node = (load(LIMINAL_PATH) as PackedScene).instantiate()
	inst.name = "Liminal"
	get_tree().root.add_child.call_deferred(inst)
	await get_tree().process_frame
	await get_tree().process_frame
	await get_tree().create_timer(2.0).timeout
	var frames: Array[Image] = []
	for i in range(3):
		frames.append(await _snap("liminal", i))
		if i < 2:
			await get_tree().create_timer(0.8).timeout
	var d01 := _diff(frames[0], frames[1])
	var d12 := _diff(frames[1], frames[2])
	_liminal_ok = d01 > 0.001 and d12 > 0.001
	print("[AmbientDriver] liminal diff 0->1: %.4f 1->2: %.4f" % [d01, d12])
	inst.queue_free()
	await get_tree().process_frame


func _snap(tag: String, idx: int) -> Image:
	await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_png("user://%s/ambient_%s_%d.png" % [OUT_DIR, tag, idx])
	return img


func _diff(a: Image, b: Image) -> float:
	if a == null or b == null or a.get_size() != b.get_size():
		return -1.0
	var total := 0.0
	var count := 0
	for y in range(0, a.get_height(), 4):
		for x in range(0, a.get_width(), 4):
			var ca := a.get_pixel(x, y)
			var cb := b.get_pixel(x, y)
			total += absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b)
			count += 1
	return total / maxf(count, 1.0)


func _finish() -> void:
	var ok := _station_ok and _pulse_sign_ok and _pulse_beacon_ok and _liminal_ok
	print("[AmbientDriver] STATION_MOTION=%s PULSE_SIGN=%s PULSE_BEACON=%s LIMINAL_MOTION=%s" % [
		"YES" if _station_ok else "NO",
		"YES" if _pulse_sign_ok else "NO",
		"YES" if _pulse_beacon_ok else "NO",
		"YES" if _liminal_ok else "NO"])
	get_tree().quit(0 if ok else 1)
