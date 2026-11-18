# Graphics completion — asset pack rollout, PBR, licensing, and test baseline

**Status:** planned
**Created:** 2026-11-18
**Goal owner:** Omo (agent)
**Depends on:** `godot/assets/textures/README.md`, `godot/assets/textures/manifest.json`,
`docs/plans/redesign-gdd.md` (Visual Design — Exact Specifications)

## Why

The first graphics pass is done but uncommitted: 20 generated textures and key art,
real Expo icons/splash, and albedo material wiring on the station rooms, the bunker,
and the Suit. The rest of the game still uses flat colors, the pack is albedo-only,
and it was generated with a non-commercial model. This plan finishes the rollout,
adds PBR maps, replaces the model for commercial use, and clears the pre-existing
Godot test failures so the baseline is honest.

## Current state (verified 2026-11-18)

- Godot 4.7 at `/usr/local/bin/godot`; `godot --headless --import` generated
  `.import` sidecars for all 20 textures.
- Textures assigned in: `scenes/station/{booth,hallway,bathroom,back_office,rooftop}.tscn`,
  `scenes/phase3/bunker.tscn`, `scenes/entities/suit.tscn`. Architecture uses
  world triplanar mapping (`uv1_triplanar` + `uv1_world_triplanar`).
- Flat-color scenes remaining: `scenes/phase2/{first_house,follower,static_sky,threshold}.tscn`,
  `scenes/phase3/{neighborhood,highway,liminal_space}.tscn`,
  `scenes/phase4/{chamber,clearing,staircase}.tscn`, plus `main_menu.tscn` and UI scenes.
- Unused pack assets: `keyart/keyart_title.jpg`, `props/on_air_sign.jpg`,
  `props/poster_missing.jpg`, `props/crt_bezel_frame.jpg`; `props/tape_label.jpg`
  is only referenced in docs.
- Godot suite: 702 total, 676 passed, 26 failed (CI baseline is 28). Failures are
  concentrated in HUDLayout, BandSystem, PhaseManager, and related suites.
- Nothing is committed since `08039e6`.

## Constraints

- Do not delete, skip, or weaken tests to reach green; fix the code or the test
  setup at the cause.
- Do not regress the CI gate: Godot failures must not exceed 28 until the final
  phase, and must reach 0 by the end.
- Keep the repo clean: no API keys in commits; no generated temp render scenes
  left behind; `.import` sidecars are tracked alongside textures.
- Use the installed Godot 4.7 and the local 9router gateway
  (`NINEROUTER_URL=http://localhost:20128`, `NINEROUTER_KEY` from the environment
  or local config). Never hardcode the key.
- Xvfb is installed for render checks (`xvfb-run` + `--display-driver x11`,
  `--rendering-method gl_compatibility`).
- Visual verification is required: a passing material check is not enough for a
  visible change. Capture and inspect renders.

## Tasks

### 1. Commit the current work

Split into logical commits (suggested):

1. `feat(graphics): add generated asset pack and real app icons`
   - `godot/assets/textures/**` (including `.import` files)
   - `assets/{icon,adaptive-icon,splash,favicon}.png`
2. `feat(godot): assign asset-pack textures to station, bunker, and Suit`
   - the seven wired scenes
3. `docs(graphics): document asset pack mapping, provenance, and regeneration`
   - `AGENTS.md`, `godot/assets/textures/README.md`, `manifest.json`

**Acceptance:** `git status` clean; commits are atomic; no secrets; `.import`
sidecars are tracked.

### 2. Use the unused assets

- `main_menu.tscn`: add the title key art (`keyart/keyart_title.jpg`) as a
  full-rect background behind the existing `ColorRect`/VBox, with a dark overlay
  so the amber text stays readable. Keep the existing menu controls and signals.
- `station/booth.tscn`: place `props/on_air_sign.jpg` on a wall plane, emissive.
- `station/back_office.tscn`: place `props/poster_missing.jpg` on a wall plane.
- Tape UI (`scenes/ui/tape_player.tscn` and/or `src/ui/cassette_tape_visual.gd`):
  use `props/tape_label.jpg` for the cassette label instead of the placeholder
  fallback; use `props/crt_bezel_frame.jpg` as a frame/overlay if it fits the
  layout without obscuring controls.

**Acceptance:** every asset above is referenced by a scene/script; renders of the
main menu, booth, and back office show it; no menu signal regressions; suite
failures do not increase.

### 3. Texture the remaining phase scenes

Apply the existing mapping pattern (world triplanar on architecture, albedo_color
white or a deliberate tint):

- `phase2/first_house.tscn` — siding/wallpaper, carpet, ceiling, wood.
- `phase2/follower.tscn` — asphalt/ground, concrete, night backdrop.
- `phase2/static_sky.tscn` — ground, concrete, static/backdrop.
- `phase2/threshold.tscn` — concrete, wood, carpet.
- `phase3/neighborhood.tscn` — asphalt/road, house siding, grass/ground.
- `phase3/highway.tscn` — asphalt, concrete, guardrail/metal.
- `phase3/liminal_space.tscn` — liminal wallpaper/concrete, carpet, fluorescent ceiling.
- `phase4/chamber.tscn` — concrete, metal, carpet.
- `phase4/clearing.tscn` — ground/grass, wood, night backdrop.
- `phase4/staircase.tscn` — concrete, metal railing.

Generate missing textures (asphalt, house siding, grass/ground, guardrail/metal,
fluorescent ceiling) with `regenerate.py` and add them to `manifest.json` with
prompts and intended use. Import with Godot after generation.

**Acceptance:** all ten scenes reference at least their primary surfaces; no
scene uses a texture at an obviously wrong scale (verify with renders); manifest
and README list every new texture; suite failures do not increase.

### 4. Real gameplay render pass

Render the actual gameplay scenes, not the verification cameras:

- `station/station.tscn` with its `CRTPostProcess` and fixed camera zones.
- `bunker.tscn` with its `WorldEnvironment` and lights.
- At least one phase 2/3/4 scene after task 3.

Capture desktop (1920x1080 or 1280x720) renders under Xvfb. Inspect for:
texture orientation, scale, tiling seams, triplanar sharpness, exposure, and
whether the CRT post-process washes out or crushes the art. Tune `uv1_scale`,
`uv1_triplanar_sharpness`, ambient light, and material roughness where needed.
Keep gameplay behavior unchanged.

**Acceptance:** reviewed renders exist for station, bunker, and one phase scene;
documented before/after adjustments; no visual regressions to UI readability.

### 5. Add normal/roughness maps

The pack is albedo-only, which is why surfaces read flat.

- Derive or generate normal and roughness maps for the eight seamless environment
  textures and the Suit wool (normal maps from height/luminance, roughness from
  luminance inversion, or generate them explicitly).
- Store alongside albedo as `<name>_normal.jpg` / `<name>_roughness.jpg` (or PNG
  if quality demands it), add to `manifest.json`, and import.
- Assign `normal_enabled = true`, `normal_texture`, and `roughness_texture` in the
  wired materials. Triplanar applies to normal maps as well; keep the same scale.
- Verify under a directional light render; roughness must vary, not be uniform.

**Acceptance:** every architecture material has normal + roughness maps; renders
show surface relief and varied specular response; no pink/black missing-texture
materials; suite failures do not increase.

### 6. Replace the non-commercial model

The pack was generated with FLUX.2 [dev] (non-commercial license).

- Regenerate the pack with `cf/@cf/black-forest-labs/flux-2-klein-9b` or
  `cf/@cf/black-forest-labs/flux-1-schnell` (Apache-2.0) via `regenerate.py`,
  or document a per-asset replacement if a specific image cannot be reproduced.
- Re-run the seamless pass, PBR derivation, and material verification on the
  replacement images.
- Update `manifest.json` generation metadata and the README/AGENTS licensing note
  to state the commercial-safe model and date.

**Acceptance:** no shipped asset is FLUX.2 [dev]-only; manifest records the
licensed model; README/AGENTS no longer carry the non-commercial caveat as an
open risk.

### 7. Clear the Godot test baseline

26 pre-existing failures (CI baseline 28), concentrated in HUDLayout, BandSystem,
PhaseManager, and related suites.

- Fix failures at the cause: node lifecycle/order, missing nodes, signal
  expectations, or stale test setup. Do not delete or skip tests.
- If a failure is a genuine engine/upstream bug, document it with a linked
  reproduction and keep the assertion.
- Target 0 failures; interim gate is 26 or fewer (no regression).

**Acceptance:** `godot --headless --path godot --script res://tests/test_runner.gd`
reports 0 failures (or a fully documented, justified exception list); CI's
28-failure allowance can be tightened to match.

## Verification commands

```bash
# Import after asset changes
cd godot && godot --headless --import

# Material wiring check (temporary script, delete after)
godot --headless --path godot --script res://tests/_material_check.gd

# Full suite
godot --headless --path godot --script res://tests/test_runner.gd

# Render check
xvfb-run -a -s "-screen 0 1280x720x24" godot --display-driver x11 \
  --path godot --rendering-method gl_compatibility --rendering-driver opengl3 \
  --audio-driver Dummy --resolution 1280x720 res://tests/_render_scene.tscn
```

## Completion condition

All seven tasks meet their acceptance criteria, each verified with command output
or an inspected render, and the final report states per-task evidence and any
remaining exception. Work is committed; the working tree is clean.
