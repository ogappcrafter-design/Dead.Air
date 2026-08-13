extends Node3D
## Test scene for the interaction system.
## Sets EXPLORE mode and wires InteractionRaycast signals to UI components.


func _ready() -> void:
	PhaseManager.set_mode(PhaseEnums.ModeContext.EXPLORE)

	var raycast: InteractionRaycast = $Player/InteractionRaycast
	var prompt: InteractPrompt = $UI/InteractPrompt
	var examine: ExamineDisplay = $UI/ExamineDisplay

	raycast.target_changed.connect(_on_target_changed.bind(prompt))
	raycast.examine_performed.connect(_on_examine_performed.bind(examine))


func _on_target_changed(target: Interactable, prompt: InteractPrompt) -> void:
	if target != null:
		prompt.show_prompt(target.get_prompt_text())
	else:
		prompt.hide_prompt()


func _on_examine_performed(_target: Interactable, text: String, examine: ExamineDisplay) -> void:
	examine.show_text(text)
