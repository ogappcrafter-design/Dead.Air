extends Node

## DEA-142: CRT Post-Process Autoload Controller
##
## Registered as an autoload (`CRTController`). Creates and manages the
## CRTPostProcess CanvasLayer at runtime, discovers SignalStrength and
## DreadComposure nodes in the scene tree, and exposes an accessibility API
## for adjusting or disabling CRT effects.
##
## Accessibility (DEA-146):
## - set_crt_enabled(bool): completely enable/disable post-processing
## - set_intensity_multiplier(float 0.0–1.0): scale all effect intensities
## - set_reduce_motion(bool): disable scanline roll, glitch, tear, flicker
## - set_scanlines_enabled(bool): toggle scanlines on/off
## - set_curvature_enabled(bool): toggle barrel distortion on/off
##
## Process order: CRTPostProcess is a child, so its _process() runs BEFORE
## this controller's _process(). This lets us apply accessibility overrides
## after CRT computes its params each frame.

# --- Signals ---
signal crt_enabled_changed(enabled: bool)
signal intensity_multiplier_changed(multiplier: float)

# Params that get scaled by intensity multiplier
const _SCALABLE_PARAMS: Array[String] = [
	"scanline_opacity",
	"scanline_roll_speed",
	"bloom_intensity",
	"flicker_intensity",
	"glitch_intensity",
	"glitch_shift_max",
	"color_split_offset",
	"tear_intensity",
	"vignette_intensity",
	"noise_density",
	"desaturation_amount",
	"alert_blend",
	"inversion_amount",
	"ca_radial_amount",
	"signal_scanline_drift",
]

# Scan interval for discovering SignalStrength / DreadComposure (seconds)
const DISCOVERY_INTERVAL: float = 0.5

# --- Internal ---
var _crt: CRTPostProcess = null
var _signal_strength: SignalStrength = null
var _dread_composure: DreadComposure = null
var _scan_timer: float = 0.0

# --- Accessibility state ---
var _crt_enabled: bool = true
var _intensity_multiplier: float = 1.0
var _reduce_motion: bool = false
var _scanlines_enabled: bool = true
var _curvature_enabled: bool = true


func _ready() -> void:
	_crt = CRTPostProcess.new()
	_crt.name = "CRTPostProcess"
	add_child(_crt)


func _process(delta: float) -> void:
	if not _crt_enabled:
		return

	# Discover SignalStrength / DreadComposure if missing
	if _signal_strength == null or _dread_composure == null:
		_scan_timer += delta
		if _scan_timer >= DISCOVERY_INTERVAL:
			_scan_timer = 0.0
			_discover_nodes()
	else:
		# Re-discover if nodes were freed (scene change)
		if not is_instance_valid(_signal_strength):
			_signal_strength = null
			_crt.signal_strength = null
		if not is_instance_valid(_dread_composure):
			_dread_composure = null
			_crt.dread_composure = null

	# Apply accessibility overrides after CRT's _process has set shader params.
	# CRT is a child → its _process runs first → we can override here.
	_apply_accessibility_overrides()


# --- Node discovery ---


func _discover_nodes() -> void:
	if _signal_strength == null:
		var found_s := _find_node_of_class(get_tree().root, "SignalStrength")
		if found_s != null:
			_signal_strength = found_s
			_crt.signal_strength = _signal_strength

	if _dread_composure == null:
		var found_d := _find_node_of_class(get_tree().root, "DreadComposure")
		if found_d != null:
			_dread_composure = found_d
			_crt.dread_composure = _dread_composure


func _find_node_of_class(root: Node, class_name_str: String) -> Node:
	if root == null:
		return null
	if root.get_script() != null and root.get_script().get_global_name() == class_name_str:
		return root
	for child in root.get_children():
		var found := _find_node_of_class(child, class_name_str)
		if found != null:
			return found
	return null


# --- Accessibility API (DEA-146) ---


func set_crt_enabled(enabled: bool) -> void:
	_crt_enabled = enabled
	if _crt != null:
		_crt.visible = enabled
	crt_enabled_changed.emit(enabled)


func is_crt_enabled() -> bool:
	return _crt_enabled


func set_intensity_multiplier(multiplier: float) -> void:
	_intensity_multiplier = clampf(multiplier, 0.0, 1.0)
	intensity_multiplier_changed.emit(_intensity_multiplier)


func get_intensity_multiplier() -> float:
	return _intensity_multiplier


func set_reduce_motion(reduce: bool) -> void:
	_reduce_motion = reduce


func is_reduce_motion() -> bool:
	return _reduce_motion


func set_scanlines_enabled(enabled: bool) -> void:
	_scanlines_enabled = enabled


func set_curvature_enabled(enabled: bool) -> void:
	_curvature_enabled = enabled


## Apply accessibility overrides directly to shader material.
## Called every frame after CRT's _process sets shader params.
func _apply_accessibility_overrides() -> void:
	if _crt == null:
		return
	var mat := _crt.get_shader_material()
	if mat == null:
		return

	# Intensity multiplier: scale degradation params
	if _intensity_multiplier < 1.0:
		for param in _SCALABLE_PARAMS:
			var current = mat.get_shader_parameter(param)
			if current != null and current is float:
				mat.set_shader_parameter(param, current * _intensity_multiplier)

	# Reduce motion: zero out motion-based effects
	if _reduce_motion:
		mat.set_shader_parameter("scanline_roll_speed", 0.0)
		mat.set_shader_parameter("glitch_intensity", 0.0)
		mat.set_shader_parameter("glitch_shift_max", 0.0)
		mat.set_shader_parameter("tear_intensity", 0.0)
		mat.set_shader_parameter("flicker_intensity", 0.0)
		mat.set_shader_parameter("signal_scanline_drift", 0.0)

	# Scanlines toggle
	if not _scanlines_enabled:
		mat.set_shader_parameter("scanline_opacity", 0.0)

	# Curvature toggle
	if not _curvature_enabled:
		mat.set_shader_parameter("curvature_amount", 0.0)


# --- Passthrough API ---


func get_crt() -> CRTPostProcess:
	return _crt


func get_shader_material() -> ShaderMaterial:
	if _crt != null:
		return _crt.get_shader_material()
	return null


func trigger_roll(duration: float = 1.0, speed: float = 8.0) -> void:
	if _crt != null and _crt_enabled:
		_crt.trigger_roll(duration, speed)


func trigger_glitch_burst(intensity: float = 1.0, duration: float = 0.3) -> void:
	if _crt != null and _crt_enabled:
		_crt.trigger_glitch_burst(intensity, duration)


func set_param(name: String, value: Variant) -> void:
	if _crt != null:
		_crt.set_param(name, value)


func get_param(name: String) -> Variant:
	if _crt != null:
		return _crt.get_param(name)
	return null
