# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Game-dev scaffold

The game-development workflow scaffold lives at `~/everything-game-dev-code` (installed here via the `godot-production` profile; state in `.game/` is local-only). Use it for planning and review work; do not copy or modify the scaffold from this repo.

- **Rules resolution order:** read the scaffold's `rules/common/` first, then exactly one engine layer — `rules/godot/` for this repo (never mix in Unity/Unreal/web rules).
- **Workflow entry points:** the scaffold's slash commands (e.g. `/gdd`, `/plan`, `/godot-review`, `/godot-build-fix`, `/godot-scene-audit`) resolve to files under the scaffold's `commands/` — read the named file and follow its declared agents/skills/output.
- **Engine isolation:** Godot work stays in `godot/` against the GDD (`docs/plans/redesign-gdd.md`); the Expo/React Native app in `app/`, `components/`, `engine/`, `store/` follows this repo's own conventions above, not the scaffold's web rules.

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

## Shift 1 Tutorial (DEA-111)

`BandController` enforces band locks (`unlock_band` / `lock_all_bands` / `is_band_unlocked`; locked bands are rejected in `set_active_band` / `on_band_changed` / `on_frequency_changed`). `ShiftController.start_shift()` resets locks via `lock_all_bands()`, then `_unlock_bands_for_shift()` unlocks the shift's bands. `TutorialManager` (a child of `GameDirector`, not an autoload) shows 3 dismissible `TutorialOverlay` steps on shifts with `tutorial=true` in `SHIFT_DATA`: TUNING at shift start, SIGNAL_METER on first call, COMPOSURE on first composure change; each step must be dismissed before the next shows. `ShiftSummary.set_save_available()` hides the save UI when `save_unlocked=false` (Shift 1: dread meter hidden, save disabled).

## CRT Degradation System (DEA-145)

`CRTDegradation` autoload (`godot/src/visual/crt_degradation.gd`) tracks per-shift permanent CRT degradation: shift levels `[0.0, 0.15, 0.35, 0.60, 0.85]` (pristine → barely holding), capped at 0.85, persisted via the `SaveData.crt_degradation` field (SaveManager syncs it on save/load).

`CRTPostProcess` (`godot/src/visual/crt_postprocess.gd`) owns the controller role (the old `CRTController` autoload was removed in the companion-project sync). `compute_params(dread, composure, signal, in_safe_room, degradation)` applies DEA-145 thresholds (composure <50 flicker / <30 scanline drift / <20 severe glitch / <10 inversion+RGB swap; signal <50 noise / <30 heavy static / <10 near-total; dread >40 vignette / >60 CA / >80 image breaks) with degradation as a baseline amplifier. Hide mode: `set_crt_visible(false)` hides the CRT layer (meters on other canvas layers stay); full room-darkening lands with the hide mechanic (DEA-119). Integration: `ShiftController.start_shift()` → `_apply_crt_degradation()`; `CRTPostProcess` reads `/root/CRTDegradation` each frame.

The shader's `ca_radial_amount` / `signal_scanline_drift` uniforms (DEA-142) were restored by DEA-145 — they were removed in the companion sync only because their driver was gone; DEA-145's `compute_params` drives them again.

## Ambient Motion System

`AmbientLife` (`godot/src/visual/ambient_life.gd`, class_name) is the ambient motion layer: GPUParticles3D dust/fog/ash/static modes, fluorescent flicker with random dropouts (`flicker_lights`/`flicker_depth`), emissive pulses (`pulse_targets`), and an optional player-following emission volume (`follow_target` — lazy-acquired from group "player"; switches particles to world-space with an 80m visibility AABB). Presets: `for_interior(lights)`, `for_liminal()`, `for_ash()`, `for_static()`, `for_neon(pulse)`. station.gd wires per-room ambient (`_setup_ambient`); each phase segment script adds a mood preset before `start_segment()`. Tests: `tests/test_ambient_life.gd` (suite total 715); `tests/visual_driver_ambient.gd` proves live motion under Xvfb via frame diffs.

## Endless Night (DEA-86, mobile app)

`useEndlessNight` hook (`hooks/useEndlessNight.ts`, mounted on the radio screen) drives the endless run loop: auto-starts after the first completed shift, schedules calls at `getEndlessCallInterval` (escalation-scaled, 25s floor), idle sanity drain, and submits the run to the leaderboard on game-over. Rare events use id base **6000** in `callManagerInstance` (keep that range reserved); core bands are 0–4 (the five fragment libraries all support the advanced call-type set). Game-over fires inside `gameStateSlice.decreaseSanity` **before** the no_rest wipe — keep that ordering.

## Graphics Asset Pack

`godot/assets/textures/` holds the generated art pack: 8 seamless environment textures, 2 backdrop textures, 4 props, and 6 key-art/concept images. `manifest.json` records prompts, sizes, intended material use, and provenance; `README.md` documents the mapping. `assets/icon.png`, `adaptive-icon.png`, `splash.png`, and `favicon.png` are real assets referenced by `app.json` (they were 1x1 placeholders before 2026-11-17).

Godot 4.7 is installed at `/usr/local/bin/godot`, and `godot --headless --import` has generated `.import` sidecars for all 20 textures. Station scenes (`station/booth|hallway|bathroom|back_office|rooftop`), `phase3/bunker.tscn`, and `entities/suit.tscn` assign them; architecture materials use world triplanar mapping to keep texture orientation consistent across CSG box faces. Other phase scenes still use flat colors. Generated via the local 9router gateway with FLUX.2 Dev (`cf/@cf/black-forest-labs/flux-2-dev`) and post-processed with Pillow (1920x1080 key-art crops, roll-plus-feather seamless wrap, icon mat flood-fill). FLUX.2 [dev] is non-commercial: regenerate with FLUX.2 [klein] or FLUX.1 [schnell] (Apache-2.0) using `godot/assets/textures/regenerate.py` before shipping commercially.

## Godot test suite and API gotchas

Run the suite only through the runner (single `tests/test_*.gd` files fail at compile time because autoloads are unavailable to a bare `--script`):

```bash
cd godot && /usr/local/bin/godot --headless --path . --script res://tests/test_runner.gd > /tmp/godot_test.log 2>&1
```

Exit 1 is expected whenever any test fails; judge by `Total: / Passed: / Failed:`. Baseline after the 2026-11-22 graphics-pack work (klein repaint + PBR maps), plus the DEA-191 ControlsRemap suite: **856 total, 0 failed**.

Sharp edges that caused the old 26-failure baseline:

- **GDScript lambdas capture locals by value.** A test that does `var fired := false; sig.connect(func(): fired = true)` can never observe the signal. Use an `Array`/`Dictionary` holder (`var fired := [false]`) or a bound method.
- **`ProgressBar.vertical` does not exist in Godot 4.7.** Setting it raises and aborts the rest of the builder function, leaving later nodes null. Use `fill_mode = ProgressBar.FILL_BOTTOM_TO_TOP` for vertical meters.
- **`.tres` Colors need `Color(r, g, b, a)`.** The bare `color = 1.0, 0.55, 0.0, 1` form loads silently as black; `band_config.tres` had this bug.
- **`save_game()` syncs live trackers over `SaveData`** (`CRTDegradation`, `MoralChoiceTracker`), so tests asserting those fields must set the tracker, not just the SaveData field.
- **`GDScript.new()` + `source_code` needs `reload()`** before `set_script()`, otherwise the node has no methods.
- **Budget the full suite at 1500 s, not 900 s.** Runtime varies enough that a 900 s cap can land it mid-suite (seen in `Phase4Endings`) and a killed run reports no `Total:` line at all, which looks like a hang. A completed run of the same tree finishes well inside 1500 s.
- **The suite can stall for real, in whichever scene suite it is on** (2026-11-22, DEA-177): output stops mid-suite and the process keeps burning a full core (26 min observed) with no `Total:` line. Seen on the feature branch inside `FMVPlayer` and on pristine `master` inside `Phase3LiminalSpace`, so it is pre-existing and not attributable to one ticket; about half of all runs complete. It is not a buffered log (reproduces under `stdbuf -o0`) and not leftover processes. Retry until a run prints `Total:`; judge a single attempt hung only after the full budget, never by a frozen line count.
- **A typed parameter cannot receive a freed object.** `func f(z: CameraZone)` raises `SCRIPT ERROR: Invalid type in function ... (previously freed) is not a subclass of the expected argument class` at argument binding, so an `is_instance_valid(z)` guard inside the body never runs. Signal handlers carrying node refs across a scene unload need the parameter untyped (`z`), with the validity check in the body; `camera_manager.gd` is the worked example, pinned by `tests/test_camera_coverage.gd::test_freed_zone_cannot_activate`.
- **A brand-new `class_name` is not in the global class cache during headless runs.** Until the project is imported (`godot --headless --import`), another script that names it fails with `Parse Error: Could not find type "X"`, and every scene using that script fails to load. Reference new scripts by path (`const XScript = preload("res://.../x.gd")`, usable as a type annotation and for `.new()`) instead of the bare identifier; classes already in the cache are unaffected.

## PS1 render dressings (DEA-174/175)

`PS1Geometry` (`godot/src/visual/ps1_geometry.gd`) decides per surface from that surface's own material: triplanar brushes stay perspective-correct, ordinary-UV surfaces (props) get `affine_uv`. `dressing_enabled` turns the whole pass off for A/B.

- **Always read materials through `material_texture()` / `surface_settings()`**, never `.albedo_texture` directly: once dressed, the texture lives in the `ShaderMaterial` parameter and a `BaseMaterial3D`-only read returns null, silently skipping every dressed surface.
- **Rig:** `tests/visual_driver_ps1_station` (dressed vs undressed, prop affine) needs `xvfb-run` + `--rendering-method gl_compatibility`, and captures happen after the station's deferred `_setup_station`, so wait frames before touching materials. It gates on a measured noise floor (identical settings twice, currently 0.0000) instead of magic thresholds.
- **Measured:** dressed vs undressed 54.1% of pixels, luma 38.4 -> 35.7; affine on a prop 24% (coarsely-mapped prop) to 0.2% (finely tessellated), 0% in wide framing.
- **Snapping ships off because it is invisible at 160x120, not broken:** `tests/visual_driver_snap_probe` (one quad) gives 2.9% at 8x6, 0.24% at 320x240, 0.0000 at 160x120; station brushes read 0.0000 at every grid. Coarsen `STATION_SNAP` or snap only props if the wobble is wanted.

## OpenDesign (`od`) — machine install and repo project

OpenDesign ([nexu-io/open-design](https://github.com/nexu-io/open-design)) is installed from source on this machine; deadair is registered there as an imported-folder project. Nothing in this repo's build depends on it — OD is a design/tooling daemon used alongside the game work.

- **Checkout:** `/home/vivi/open-design` (v0.27.2, pnpm 10.33.2 via corepack). `pnpm install` builds every package, including the daemon at `apps/daemon/dist/cli.js`.
- **CLI:** `~/.local/bin/od` is a shim (`exec node .../apps/daemon/dist/cli.js "$@"`), also linked as `open-design`. It **shadows uutils coreutils `od`**; the system binary is still `/usr/bin/od`, so use the absolute path in scripts that need the octal dump.
- **Daemon:** runs as the systemd user unit `od-daemon.service` (`~/.config/systemd/user/od-daemon.service`, `Restart=on-failure`, `OD_DATA_DIR` set; `Linger=yes` so it survives logout): `systemctl --user restart od-daemon`, logs via `journalctl --user -u od-daemon`. Do not park it in an agent shell session. Health: `curl -s http://127.0.0.1:7456/api/health`. Data root is repo-local: `/home/vivi/open-design/.od` (`OD_DATA_DIR`).
- **This repo's project:** id `6b92a357-a3e1-449a-ac4e-37c7df836149`, `metadata.baseDir = /home/vivi/deadair`, kind `prototype`. Inspect with `od project list --json`; refresh by re-running `od project import /home/vivi/deadair --name "Dead Air"` against a running daemon.
- **MCP:** `od mcp install <agent>` writes the stdio server entry from the daemon's `/api/mcp/install-info`. Installed for `codex` (`~/.codex/config.toml`), `opencode` (`~/.config/opencode/opencode.json`), and `claude` (`~/.claude.json`); remove with `--uninstall`, preview with `--print`.
- **Build-script allowlist:** `node-pty`, `@ffmpeg-installer/linux-x64`, `@ffprobe-installer/linux-x64` must sit in the checkout root `package.json` `pnpm.onlyBuiltDependencies`; the same names in `pnpm-workspace.yaml` alone are ignored on this host, so pnpm reports "Ignored build scripts: node-pty" and no `pty.node` appears. After `pnpm install --force` the module lands at `node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty/build/Release/pty.node`, and `require('node-pty').spawn('/bin/sh',['-c','echo PTY_OK'])` prints `PTY_OK` (exit 0).
- **`od doctor` speed:** the per-plugin `POST /api/plugins/:id/doctor` route reloads the whole plugin registry per call, so a 478-plugin sweep took ~66 s and looked like a hang. The checkout carries local (uncommitted) changes: a bulk `POST /api/plugins/doctor` route (`{ ids?: string[] }`, one registry load + one connector probe for the whole sweep) in `apps/daemon/src/routes/plugins/index.ts`, and `runDoctor` in `apps/daemon/src/cli.ts` calling it with a fallback to the old fan-out. Full sweep is ~0.7 s; it still exits 1 because 86 bundled templates fail with `manifest.warning`/`atom.unknown`.

## Repo remotes and push rules

Two remotes: `origin` (`git@github.com:daggerstuff/deadair.git`) and `macabre` (`git@github.com:ogappcrafter-design/Dead.Air.git`, branch `macabre`). As of 2026-11-21 `origin/master` rejects direct pushes (`GH013: Changes must be made through a pull request`), so a batch goes out as a feature branch plus a PR (`gh api --method POST repos/daggerstuff/deadair/pulls -f title=... -f head=... -f base=... -f body=...`; plain `gh pr create` still works but this host's `gh` prints unrelated extension output, and `merge` needs every review thread resolved first - `resolveReviewThread` by GraphQL). The `required_status_checks` rule was removed on 2026-11-21 because it named five checks that a paths-filtered or docs-only commit can never produce, which made every PR permanently unmergeable., while `macabre` fast-forwards directly.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
