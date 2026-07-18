---
name: 2d-games
description: 2D game development principles. Sprites, tilemaps, physics, camera.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# 2D Game Development

> Principles for 2D game systems.

## 1. Sprite Systems

- **Texture atlases** — pack sprites into atlases; fewer draw calls = better perf
- **Frame measurement** — always measure `frameWidth`/`frameHeight` before loading spritesheets; wrong dimensions = top Phaser bug
- **Animation state machines** — idle → walk → jump → attack; clear transitions prevent animation glitches
- **Nine-slice** — use for UI elements that stretch (panels, buttons)
- **Sprite layering** — z-order by `depth` property; sort by Y for isometric/top-down

## 2. Tilemap Design

- **Layer separation** — ground, objects, triggers, UI on separate layers
- **Auto-tiling** — let engine handle edge/corner tiles; manual placement is error-prone
- **Collision layers** — define per-layer collision; don't collide everything with everything
- **Object layers** — use for spawn points, triggers, collectibles (not tile layers)
- **Infinite scrolling** — tilemap wrapping needs buffer tiles beyond viewport

## 3. 2D Physics

| Physics | Use When | Avoid When |
|---------|----------|------------|
| Arcade (AABB) | Platformers, shooters, simple collisions | Rotating bodies, non-rectangular shapes |
| Matter.js | Physics puzzles, destructible terrain | 100+ active bodies, performance-critical |
| None | Puzzles, card games, UI-only | Any meaningful collision |

- **Collision shapes** — circles for round objects, polygons for complex; AABB is fastest
- **Velocity-based movement** — `body.velocity.set()` not manual position changes
- **Gravity tuning** — negative Y = up; tune per-object for floaty feel

## 4. Camera Systems

- **Dead zone** — camera doesn't move for small player movements; feels less twitchy
- **Look-ahead** — offset camera in movement direction; player sees where they're going
- **Bounds** — clamp camera to world bounds; no seeing beyond the map
- **Screen shake** — brief random offset; use sparingly for impacts
- **Room transitions** — fade/cut between rooms; buffer adjacent room assets

## 5. Genre Patterns

- **Platformer** — coyote time (forgiving edge jumps), jump buffering, variable jump height
- **Top-down** — 8-directional movement, line of sight, room-based streaming
- **Shooter** — projectile pooling, spread patterns, screen-wrap
- **RPG** — tilemap collision, NPC interaction zones, inventory systems
- **Puzzle** — grid-based movement, state machines, undo systems

## 6. Anti-Patterns

- ❌ Loading assets in `create()` — always `preload()`
- ❌ Manual position updates instead of physics velocity
- ❌ Global variables for game state — use scene data or state machines
- ❌ No object pooling — spawning/destroying per frame = GC spikes
- ❌ Ignoring mobile — test touch controls early, not at the end
- ❌ Skipping playtesting — "it works" ≠ "it feels good"
