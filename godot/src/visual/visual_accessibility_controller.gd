## VisualAccessibilityController
## DEA-146: Applies visual accessibility settings to the CRT post-process shader.
## Reads settings from AccessibilityManager and pushes modifiers to CRTPostProcess.
## Created as a child of AccessibilityManager (like SubtitleDisplay / VisualAudioCues).
## Reference: DEA-146, GDD §Accessibility — "Camera shake", "Composure effects", "CRT"
class_name VisualAccessibilityController
extends Node

# ─── Static reduction multiplier (cut noise density ~50%) ────────────
const STATIC_REDUCTION_MULT: float = 0.5

# ─── Internal ────────────────────────────────────────────────────────
var _crt: CRTPostProcess = null
var _searched_for_crt: bool = false


func _ready() -> void:
	_connect_signals()
	_find_and_apply()


func _process(_delta: float) -> void:
	# Re-find CRT if not yet found (it may be instantiated after scene load)
	if _crt == null and not _searched_for_crt:
		_find_and_apply()
		return
	# Re-apply every frame in case CRT re-computed params (it runs in its own _process)
	if _crt != null:
		_push_mods()


# ─── Signal wiring ────────────────────────────────────────────────────


func _connect_signals() -> void:
	if not AccessibilityManager:
		return
	AccessibilityManager.camera_shake_reduction_changed.connect(_on_visual_setting_changed)
	AccessibilityManager.screen_flash_reduction_toggled.connect(_on_visual_setting_changed)
	AccessibilityManager.static_reduction_toggled.connect(_on_visual_setting_changed)
	AccessibilityManager.vignette_reduction_toggled.connect(_on_visual_setting_changed)
	AccessibilityManager.crt_toggled.connect(_on_crt_toggled)


# ─── CRT discovery ───────────────────────────────────────────────────


func _find_and_apply() -> void:
	_crt = _find_crt_postprocess()
	if _crt != null:
		_searched_for_crt = true
		_push_mods()
	else:
		# Try again next frame — CRT may not exist yet
		_searched_for_crt = false


## Search the scene tree for a CRTPostProcess instance.
func _find_crt_postprocess() -> CRTPostProcess:
	var tree := get_tree()
	if tree == null:
		return null
	var nodes := tree.get_nodes_in_group("crt_postprocess")
	if nodes.size() > 0:
		return nodes[0] as CRTPostProcess
	# Fallback: search by class name through all nodes
	var root := tree.root
	if root == null:
		return null
	return _search_for_crt(root)


func _search_for_crt(node: Node) -> CRTPostProcess:
	if node is CRTPostProcess:
		return node as CRTPostProcess
	for child in node.get_children():
		var found := _search_for_crt(child)
		if found != null:
			return found
	return null


# ─── Modifier computation ────────────────────────────────────────────


## Compute the accessibility modifier dict from current AccessibilityManager state.
static func compute_mods(
	shake_reduction: int,
	flash_reduction: bool,
	static_reduction: bool,
	vignette_reduction: bool,
	crt_enabled: bool
) -> Dictionary:
	var mods: Dictionary = {}

	# CRT master toggle
	if not crt_enabled:
		mods["crt_off"] = true
		return mods

	# Camera shake reduction: 0/50/100% → multiplier 1.0/0.5/0.0
	var shake_mult := 1.0 - (float(shake_reduction) / 100.0)
	if shake_mult < 1.0:
		mods["shake_mult"] = shake_mult

	# Screen flash reduction: eliminate roll, cut flicker 75%
	if flash_reduction:
		mods["flash_reduction"] = true

	# Static reduction: cut noise density 50%
	if static_reduction:
		mods["static_mult"] = STATIC_REDUCTION_MULT

	# Vignette reduction: eliminate vignette
	if vignette_reduction:
		mods["vignette_off"] = true

	return mods


## Get the current mods from AccessibilityManager state.
func _get_current_mods() -> Dictionary:
	if not AccessibilityManager:
		return {}
	return compute_mods(
		AccessibilityManager.camera_shake_reduction,
		AccessibilityManager.screen_flash_reduction,
		AccessibilityManager.static_reduction,
		AccessibilityManager.vignette_reduction,
		AccessibilityManager.crt_enabled
	)


## Push accessibility modifiers to the CRT post-process shader.
func _push_mods() -> void:
	if _crt == null:
		return
	_crt.set_accessibility_mods(_get_current_mods())


# ─── Signal handlers ─────────────────────────────────────────────────


func _on_visual_setting_changed(_value) -> void:
	_push_mods()


func _on_crt_toggled(_enabled: bool) -> void:
	# When CRT is re-enabled, push mods (which will show the overlay).
	# When disabled, the mods dict carries crt_off=true.
	_push_mods()
