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

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
