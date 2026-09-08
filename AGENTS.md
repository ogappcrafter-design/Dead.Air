# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Autoloads

Autoloads are registered in `godot/project.godot` under `[autoload]`. Order matters — later autoloads can reference earlier ones at runtime (not at LSP/edit time). LSP errors on autoload identifiers (CallManager, CallData, MoralChoiceTracker, etc.) are expected and valid at runtime.

## Moral Choice System (DEA-98)

`MoralChoiceTracker` autoload (`godot/src/core/moral_choice_tracker.gd`) tracks empathy/self-preservation/curiosity scores. GDD mapping hardcoded in `_CHOICE_MAP` const; data-driven fallback via `calls.json` `moral_choices` field. Integrated with:

- `CallManager._apply_choice_effects()` → `record_choice(call_id, choice_text)`
- `TapeInventory.collect_tape()/refuse_tape()` → `add_tape_taken()/add_tape_refused()`
- `SaveManager.save_game()/load_game()` → `save_to()/load_from()`

## Call Audio Pipeline (DEA-137)

`CallAudioPipeline` autoload (`godot/src/audio/call_audio_pipeline.gd`) handles voice call audio playback with real-time processing. Routes all audio through the `CALL_AUDIO` bus (from DEA-134). Processing chain: Base → Band EQ → Compression → Radio Simulation → Bitcrush → Spatial → Output. Band EQ profiles per band (LIVING warm, LOST telephone bandpass, CLASSIFIED military crackle, ████████ sub-bass+proximity). Signal quality 0-100 controls degradation. Dread >60 applies pitch shift (-2 semitones), reverse reverb tail, random gate. Phase 4 corruption reverses segments and warps pitch. AudioBusManager.duck_for_call() ducks RadioAmbient -6dB; stinger ducking handled via duck_for_stinger().

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
