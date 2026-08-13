# Dead Air Radio — Godot 4 Rebuild

This is the **Godot 4** rebuild of Dead Air Radio, a paranormal late-night radio game.

## Source Truth

The Game Design Document (GDD) is the authoritative source for all architecture, systems, and content decisions:

- **GDD:** [`docs/plans/redesign-gdd.md`](../docs/plans/redesign-gdd.md)
- **Linear issue:** [DEA-148](https://linear.app/pixelated/issue/DEA-148/godot-4-project-setup-and-architecture)

Where the GDD and a Linear issue disagree, the GDD wins.

## Predecessor

The React Native / Expo app in the repository root (`../`) is the shipped predecessor. This Godot project is the engine rebuild and lives entirely under `godot/`. Do not modify files outside this directory as part of the Godot migration.

## Project Structure

```
godot/
├── project.godot              # Godot 4 project config (Forward+, 1920x1080, vsync)
├── default_bus_layout.tres    # 9-bus audio layout (GDD §Audio Architecture + TAPE)
├── src/
│   ├── core/                  # Core systems (radio, stress, save, state machine)
│   ├── audio/                 # Audio engine, bus layout, call pipeline
│   ├── visual/                # CRT shader, camera system, UI
│   ├── entities/              # Player, The Suits, environmental
│   ├── levels/                # Station, Phase 2-4 level scenes
│   ├── data/                  # Sacred calls data, band configs, tape data
│   └── ui/                    # Menus, HUD, settings
├── assets/
│   ├── audio/                 # Room tones, static, calls, stingers
│   ├── shaders/               # CRT shader, visual effects
│   ├── models/                # 3D models (station, characters, props)
│   └── textures/              # CRT textures, UI elements
└── tests/
```

## Rendering

- **Renderer:** Forward+ (required for CRT post-processing)
- **Resolution:** 1920×1080, vsync enabled
- **MSAA:** Auto (up to 8x)
- **TAA:** Enabled

## Audio Buses

Per GDD §Audio Architecture, the project defines 9 buses:

| Bus             | Purpose                                       |
| --------------- | --------------------------------------------- |
| `MASTER`        | Final output                                  |
| `ROOM_TONE`     | Station/environment ambient bed               |
| `RADIO_AMBIENT` | Radio static, hum, carrier noise              |
| `CALL_AUDIO`    | Caller voice and call-specific audio          |
| `DREAD_LAYER`   | Dynamic dread/horror audio layer              |
| `STINGER`       | Horror stings and accent hits                 |
| `SILENCE`       | Deliberate silence channel (dead air moments) |
| `UI`            | UI sounds (button clicks, menu navigation)    |
| `TAPE`          | Tape playback (collectible tape player)       |

All buses route to `MASTER` and support real-time parameter control via GDScript.

## Input Map

Custom actions defined in `project.godot` (remappable; remapping UI is DEA-152):

| Action            | Gamepad         | Keyboard  |
| ----------------- | --------------- | --------- |
| `radio_tune`      | Left Stick X    | A / D     |
| `radio_band_up`   | D-pad Right     | E         |
| `radio_band_down` | D-pad Left      | Q         |
| `radio_record`    | Face Button (A) | R         |
| `interact`        | Face Button (X) | E / Space |
| `move`            | Left Stick      | W/A/S/D   |

Godot default UI actions (`ui_accept`, `ui_cancel`, `ui_left/right/up/down`) are included by the engine.

## Tooling

### Linting & Formatting

GDScript linting and formatting tools:

- **[gdlint](https://github.com/Scony/godot-gdscript-toolkit)** — static analysis / linter
- **[gdformat](https://github.com/Scony/godot-gdscript-toolkit)** — code formatter

These tools are **not wired to CI yet**. Install locally if desired:

```bash
pip install gdtoolkit
```

### Opening the Project

1. Install [Godot 4.3+](https://godotengine.org/download/)
2. Open the project: `godot --path godot/`
3. Or use the Godot Project Manager and add the `godot/` folder
