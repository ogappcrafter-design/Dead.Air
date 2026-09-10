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

## Accessibility Audio Options (DEA-141)

`AccessibilityManager` autoload (`godot/src/core/accessibility_manager.gd`) manages audio accessibility: volume sliders (6 buses), subtitles, visual audio cues, colorblind audio patterns, reduce-horror mode, hold-breath toggle, pause-anywhere override. Persists via `user://accessibility.cfg`. Modifies `AudioBusManager` bus volumes at runtime. Creates `SubtitleDisplay` and `VisualAudioCues` child Controls.

## The Suits Enemy Entity (DEA-125)

`Suit` class (`godot/src/entities/suit.gd`) — faceless suited enemies in dark charcoal suits. State machine: IDLE → PATROL → INVESTIGATE → APPROACH → SEARCH → RELOCATE. Detection ranges: 5m PATROL, 10m INVESTIGATE, +1m per 10 dread. Contact sets composure to 0 and teleports player to a random safe area (no kill). Audio is radio-only: no footsteps/breathing; proximity telegraphed via radio static intensity + signal needle.

`SuitSpawner` class (`godot/src/entities/suit_spawner.gd`) — phase-based spawn manager. Phase 2: 1 suit; Phase 3 Liminal: 2; Phase 3 Bunker (location 3): 3; Phase 4: 0. Despawns all on Phase 4 entry. Scene: `godot/scenes/entities/suit.tscn`.

Integration hooks: `DreadComposure.entity_nearby` / `hiding_detected` flags, `SignalStrength` entity count, `StingerSystem.trigger_suits_detected()`, `PhaseManager.enter_hide_mode()` / `exit_hide_mode()`. Hide = Input action `hide` (Circle/B), breath = `hold_breath` (L2/LT, 5s max).

## Visual Accessibility Options (DEA-146)

`AccessibilityManager` also manages visual accessibility (same autoload, same `user://accessibility.cfg`, new `visual` ConfigFile section). Settings: camera shake reduction (0/50/100%), high contrast mode, text size (S/M/L/XL with 1.0/1.25/1.5/2.0 scale), screen flash reduction, static reduction (~50% noise density cut), vignette reduction, CRT toggle (master on/off), difficulty presets (Easy/Normal/Hard/Dead Air with composure/dread/save multipliers).

CRT shader parameter application: `VisualAccessibilityController` (`godot/src/visual/visual_accessibility_controller.gd`, child of AccessibilityManager) pushes modifier dicts to `CRTPostProcess.set_accessibility_mods()`. `CRTPostProcess._apply_accessibility_mods()` runs after normal param computation each frame. Mods: `shake_mult` (roll speed), `flash_reduction` (roll=0, flicker×0.25), `static_mult` (noise density), `vignette_off`, `crt_off` (hides overlay).

High contrast + text size: `HighContrastManager` (`godot/src/ui/high_contrast_manager.gd`, child of AccessibilityManager) walks the scene tree applying borders to Panels/ProgressBars and outline+bg to Labels, and scales font sizes by the text size multiplier.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
