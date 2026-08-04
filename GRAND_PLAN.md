# GRAND PLAN — Dead Air Radio Rebuild

> *The signal is forming. Follow the plan.*

**Created:** 2026-07-18  
**Status:** Phases 1-2 complete, Phase 3 in progress (worker has uncommitted work)
**Repo:** github.com/daggerstuff/deadair

---

## The Vision

Transform a ~970-line React Native prototype into a polished, addictive, multi-platform paranormal radio horror game.

**What it is:** You are a late-night DJ. The calls are real. The dead, the classified, the time-looped, and things with no name all come through on the radio. Ambient psychological horror — quiet dread, not jump scares.

**What it isn't:** No multiplayer. No combat. No jump scares. No predatory monetization.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Expo SDK 56 + React Native 0.85.3 | Single codebase → web + iOS + Android + desktop |
| Navigation | Expo Router | File-based, web-compatible |
| State | Zustand 5.x + persist middleware | Lightweight, persistence built-in, game-friendly |
| Language | TypeScript (strict) | Type safety, better DX |
| Storage | AsyncStorage (local) + optional cloud | Offline-first |
| Audio | Web Audio API (web) + expo-av (native) | Real-time synthesis |
| Testing | Jest 29 + babel-jest | Store/lib tests working |
| Package Mgr | pnpm | npm v12 on node v24.18 is broken |

---

## Architecture

```
deadair/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root Stack navigator + CRTView wrapper
│   ├── index.tsx           # Splash → auto-navigate to /radio
│   ├── +not-found.tsx      # 404 "NO SIGNAL"
│   ├── radio/              # Main game screen
│   ├── tapes/              # Tape collection
│   ├── store/              # IAP store
│   └── settings/           # Preferences
├── components/
│   ├── radio/              # Physical radio UI (dial, display, bands, volume, signal)
│   ├── calls/              # Call type renderers (5 types)
│   ├── tapes/              # Tape collection UI
│   └── shared/             # CRT effects, glow text, common UI
├── engine/
│   ├── audio/              # Web Audio API engine + effects chain
│   ├── radio/              # Band/tuning/signal logic
│   └── save/               # Persistence layer
├── store/                  # Zustand stores (game, radio, settings)
├── data/                   # Calls (sacred), bands, tapes
├── lib/                    # Theme, constants, storage wrapper
└── assets/                 # Audio, images, icons
```

**Data Flow:**
```
User Input → Radio Store → Audio Engine → Visual Feedback
                ↓
          Game Store → Sanity/Static Changes → UI Updates
                ↓
          Persistence → AsyncStorage (auto-save)
```

---

## The Six Phases

### Phase 1: Foundation ✅ COMPLETE

**Goal:** Working Expo project with navigation, theme, save/load, and state stores.

**Completed:**
- Expo project with TypeScript strict mode
- Expo Router with 5 screens (splash, radio, tapes, store, settings)
- CRT theme system (#030303 bg, #FF8C00 amber, #39FF14 green)
- AsyncStorage typed wrapper (get/set/remove)
- 3 Zustand stores with persistence:
  - `useGameStore` — sanity, static, tapes, unlockedBands
  - `useRadioStore` — frequency, volume, band, signalStrength
  - `useSettingsStore` — audio/display/gameplay preferences
- Data files: 5 bands, 15 tapes, 18 sacred calls
- Jest config: 29 tests passing
- ESLint + Prettier

**Key files:** `lib/theme.ts`, `lib/storage.ts`, `lib/constants.ts`, `store/*.ts`, `data/*`

---

### Phase 2: Radio UI ✅ COMPLETE

**Goal:** Physical radio interface with tactile controls.

**Completed:**
- `FrequencyDisplay` — 48px amber digital readout with tick marks
- `BandSelector` — 5-band horizontal selector, locked bands show 🔒
- `TuningDial` — 140px circular dial (PanGesture + Reanimated rotation)
- `VolumeControl` — bar with +/- buttons and mute toggle
- `SignalStrength` — 5-bar green indicator
- `RadioBody` — 3-column layout composing all components
- `CRTView` — scanline overlay (intensity prop)

**Key files:** `components/radio/*.tsx`, `components/shared/CRTView.tsx`

**Note:** Component tests skipped (React 19 + RN + pnpm + Jest = incompatible). 29 store/lib tests cover state logic.

---

### Phase 3: Audio Engine — NEXT

**Goal:** Real-time radio static synthesis and ambient soundscapes.

**Duration:** Week 5-6

**Deliverables:**
- Web Audio API context initialization
- Static synthesis engine (white/pink/brown noise)
- Effects chain: static synth → distortion → reverb → spatial
- Ambient background layer (wind, hum, distant signals)
- Voice processing for calls (EQ, compression, lo-fi)
- Platform abstraction (Web Audio API → expo-av fallback)
- Volume integration with useSettingsStore

**Architecture:**
```
AudioEngine (singleton)
├── StaticSynth       — white/pink/brown noise generator
├── EffectsChain      — distortion → reverb → spatial
├── AmbientLayer      — background soundscape
├── VoiceProcessor    — call audio treatment
└── PlatformBridge    — Web Audio API | expo-av
```

**Key decisions to make:**
- Web Audio API node graph structure
- Reverb impulse response strategy (convolver vs algorithmic)
- How to handle mobile vs web audio differences
- Static intensity → frequency mapping

**Files to create:**
- `engine/audio/AudioEngine.ts`
- `engine/audio/StaticSynth.ts`
- `engine/audio/EffectsChain.ts`
- `engine/audio/AmbientLayer.ts`
- `engine/audio/VoiceProcessor.ts`
- `engine/audio/PlatformBridge.ts`
- `__tests__/engine/audio/*.test.ts`

---

### Phase 4: Call System

**Goal:** Deliver the 18 sacred calls with 5 distinct mechanics.

**Duration:** Week 7-8

**Ship size:** Per feature (one task = one shippable feature, not one file)

**Task Breakdown — 9 tasks, 3 dependency layers:**

#### Layer 1: Foundation (blocking)

| Task | Name | Scope | Key Files |
|------|------|-------|----------|
| P4-1 | Call Infrastructure | `CallManager` (singleton, call lifecycle, routing) + `CallScheduler` (timing, band-appropriate selection) | `engine/calls/CallManager.ts`, `engine/calls/CallScheduler.ts` |

#### Layer 2: Call Renderers (parallel, all depend on P4-1)

| Task | Name | Mechanic | Key Files |
|------|------|----------|----------|
| P4-2 | Just Listen | Player listens, no interaction, tension builds | `components/calls/JustListenRenderer.tsx` |
| P4-3 | Dead Air | Silence timer, player must hold through dead air, static reward | `components/calls/DeadAirRenderer.tsx` |
| P4-4 | Right Answer | Multiple choice, correct answer advances call | `components/calls/RightAnswerRenderer.tsx` |
| P4-5 | Signal Decode | Pattern matching / number input from audio | `components/calls/SignalDecodeRenderer.tsx` |
| P4-6 | Stay Calm | Stress test, timer with sanity drain, don't hang up | `components/calls/StayCalmRenderer.tsx` |

#### Layer 3: Systems (parallel, depend on all renderers)

| Task | Name | Scope | Key Files |
|------|------|-------|----------|
| P4-7 | Procedural Variation | Randomized caller names, details, timing, branching | `engine/calls/ProceduralVariation.ts` |
| P4-8 | Sanity Effects | Per-call-type sanity consequences, drain/recovery curves | `engine/calls/SanityEffects.ts` |
| P4-9 | Static Rewards | Completion rewards, static currency economy | `engine/calls/StaticRewards.ts` |

**Dispatch map: 3 waves**
```
Wave 1: P4-1 (Call Infrastructure)
  ↓
Wave 2: P4-2 | P4-3 | P4-4 | P4-5 | P4-6  (5 renderers in parallel)
  ↓
Wave 3: P4-7 | P4-8 | P4-9  (3 systems in parallel)
```

**Architecture:**
```
CallManager (singleton)
├── CallScheduler        — when calls happen, which band
├── CallRenderer         — routes to correct type component
├── ProceduralVariation  — randomized details per call
├── SanityEffects        — per-type sanity consequences
└── StaticRewards        — completion rewards
```

**Testing:**
- Per-task unit tests (Jest, mock RN where needed)
- Integration tests begin here — call flow end-to-end
- Component tests deferred (React 19 + RN + Jest incompatible)

---

### Phase 5: Progression

**Goal:** Addiction hooks — real-time events, unlock progression, tape collection.

**Duration:** Week 9-10

**Ship size:** Per feature

**Task Breakdown — 6 tasks, 2 dependency layers:**

#### Layer 1: Foundation (blocking)

| Task | Name | Scope | Key Files |
|------|------|-------|----------|
| P5-1 | Night Shift | Session structure (4-hour blocks w/ breaks), real-time schedule, call timing | `engine/progression/NightShift.ts` |
| P5-2 | Band Unlock | Metroidvania gates, unlock criteria (calls survived, tapes found, sanity thresholds) | `engine/progression/BandUnlock.ts` |

#### Layer 2: Features (parallel, depend on P5-1 + P5-2)

| Task | Name | Scope | Key Files |
|------|------|-------|----------|
| P5-3 | Tape Collection | 15 tapes, rarity tiers, playback UI, collection screen | `components/tapes/TapeCollection.tsx`, `components/tapes/TapePlayer.tsx` |
| P5-4 | IAP Store | Base game purchase + Infinite Signal expansion, store UI | `components/store/IAPStore.tsx` |
| P5-5 | Achievements | Milestone tracking, unlock notifications, badge display | `engine/progression/Achievements.ts` |
| P5-6 | Cloud Sync | Optional, opt-in, cross-device progress | `engine/progression/CloudSync.ts` |

**Dispatch map: 2 waves**
```
Wave 1: P5-1 + P5-2  (Night Shift + Band Unlock)
  ↓
Wave 2: P5-3 | P5-4 | P5-5 | P5-6  (4 features in parallel)
```

**Open decisions (resolve before dispatch):**
1. Real-time vs compressed time — do calls happen at actual clock times, or compressed night-shift duration?
2. Band unlock criteria — exact thresholds (calls survived? tapes found? sanity maintained?)
3. Tape playback UX — full audio playback vs transcript + ambient sound
4. IAP Infinite Signal scope — what exactly does the expansion unlock?
5. Cloud provider — which sync backend (if cloud sync ships)?

---

### Phase 6: Polish & Release

**Goal:** Ship it.

**Duration:** Week 11-12

**Ship size:** Per feature

**Task list — 10 tasks:**

| Task | Name | Scope |
|------|------|-------|
| P6-1 | Audio Latency | Optimize audio engine for <50ms response, reduce buffer sizes |
| P6-2 | Render Performance | Frame rate pass, memoization, virtual lists, reduce re-renders |
| P6-3 | EAS Build Config | `eas.json`, build profiles, environment secrets |
| P6-4 | Cross-Platform Smoke | Test web, iOS, Android, desktop — catch platform-specific issues |
| P6-5 | Accessibility Audit | Screen reader, reduced motion, contrast, font scaling |
| P6-6 | Error Tracking | Sentry integration, error boundaries, crash reporting |
| P6-7 | Analytics | Minimal, privacy-respecting — session length, calls survived, bands unlocked |
| P6-8 | CRT Visual Polish | Final scanline tuning, glow effects, phosphor decay |
| P6-9 | Playtest Bug Fixes | Internal playtest → bug triage → fix pass |
| P6-10 | Store Submission | App Store + Play Store assets, screenshots, descriptions, submission |

**Key files to modify:**
- `app.json` / `eas.json` — build config
- All components — performance pass
- `app/_layout.tsx` — error boundary

---

## Decision Log

| # | Decision | Alternatives | Why |
|---|----------|--------------|-----|
| 1 | Expo (not raw RN) | React Native CLI, Flutter | Web + native, single codebase, easier deploy |
| 2 | Ground-up rebuild | Refactor existing | Existing 970-line prototype too minimal |
| 3 | Triple-hook addiction | Single hook | Real-time + procedural + progression = max retention |
| 4 | Ambient psychological horror | Jump scares, action | Matches late-night radio vibe |
| 5 | Full audio engine | Pre-recorded only | Real-time synthesis = infinite variation |
| 6 | Hybrid sessions | Structured only | Balances progression with ambient dread |
| 7 | 18 calls sacred | Rewrite, expand | Writing is strong, add systems around them |
| 8 | Real radio UI | Minimalist | Physicality increases immersion |
| 9 | Local + cloud save | Cloud only | Offline-first, optional sync |
| 10 | Zustand over Redux | Redux, MobX, Context | Lightweight, persistence built-in |
| 11 | Expo Router | React Navigation | File-based, web-compatible, modern |
| 12 | pnpm over npm | npm | npm v12 on node v24.18 has install bug |
| 13 | Hybrid plan detail (Approach C) | Full detail all phases, bullet-only all phases | Full detail Phase 4, task breakdown Phase 5, bullet list Phase 6 — right depth per phase |
| 14 | Ship size = per feature | Per file, per phase | One task = one shippable feature, crewmate owns it end-to-end |
| 15 | Parallel dispatch where deps allow | Strict sequential | Waves of independent tasks dispatched in parallel, serialized only by dependency layers |

---

## The Sacred Content

**18 calls** in `data/calls.js`. These are hand-crafted, emotionally resonant, and final.

| Band | Calls | Vibe |
|------|-------|------|
| LIVING | Calls 0-3 | Normal. Safe. Familiar. |
| LIMINAL | Calls 4-7 | Between stations. Whispers. Time distortion. |
| LOST | Calls 8-11 | Frequencies that shouldn't exist. Children singing. |
| CLASSIFIED | Calls 12-15 | Government. Numbers stations. Emergency alerts. |
| ████████ | Calls 16-17 | [REDACTED] |

**Rule:** Never rewrite the calls. Add procedural variation around them (randomized names, timing, details) but the core writing is locked.

---

## Addiction Model

Three interlocking hooks:

1. **Real-Time Events** — calls happen at specific times, creating appointment gameplay. "I need to check the radio at 2AM."
2. **Procedural Variation** — even familiar calls feel different. Randomized details, timing, and branching. No two playthroughs identical.
3. **Unlock Progression** — metroidvania-style band unlocking. Deeper frequencies = darker content. "I need to survive 8 calls to reach CLASSIFIED."

**Player loop:**
```
Tune radio → Find signal → Answer call → Survive consequences →
  → Earn static → Unlock band → Find tape → Repeat deeper
```

---

## Horror Design Principles

1. **Quiet dread over jump scares.** The horror is in what you hear between words. The static that almost forms a name. The silence that lasts one beat too long.

2. **Ambient atmosphere.** Background soundscape never stops. Wind, hum, distant signals. The radio is always alive.

3. **Player agency creates fear.** Choosing to tune deeper is scarier than being forced. The player does this to themselves.

4. **Restraint.** Less is more. A whisper is scarier than a scream. A shadow is scarier than a monster.

5. **Emotional truth.** The calls are about real things — grief, loss, loneliness, fear of the unknown. The supernatural amplifies human emotion, not the other way around.

---

## Testing Strategy

| Layer | Tool | Coverage | Status |
|-------|------|----------|--------|
| Unit (stores, libs) | Jest | 29 tests | ✅ Passing |
| Unit (per-task) | Jest + mock RN | Each Phase 4/5 task ships own tests | Phase 4+ |
| Integration | Jest + mock RN | Call flow end-to-end, progression logic | Phase 4+ |
| Component | — | Deferred (React 19 + RN + Jest incompatible) | Future |
| E2E | Detox | User flows, call mechanics | Phase 6 |
| Visual | Manual + screenshots | UI fidelity, CRT effects | Phase 6 |
| Audio | Manual listening | Audio engine, call audio | Phase 3+ |
| Platform | Expo build + test | Web, iOS, Android, desktop | Phase 6 |

**Current:** 29 tests cover all stores (game, radio, settings) and libs (theme, storage). Component tests deferred — React 19 + RN + pnpm + Jest is incompatible without deprecated `react-test-renderer`. Per-task unit tests begin Phase 4, integration tests begin Phase 4.

---

## File Map (Current State)

```
✅ = Complete    🔲 = Planned    ❌ = Not started

✅ app/_layout.tsx              Root Stack navigator
✅ app/index.tsx                Splash screen
✅ app/+not-found.tsx           404 screen
✅ app/radio/index.tsx          Radio screen (RadioBody)
🔲 app/tapes/index.tsx          Tape collection (placeholder)
🔲 app/store/index.tsx          IAP store (placeholder)
🔲 app/settings/index.tsx       Settings (placeholder)

✅ components/radio/*           6 radio components
🔲 components/calls/*           5 call type renderers
🔲 components/tapes/*           Tape collection UI
✅ components/shared/CRTView    CRT overlay

🔲 engine/audio/*               Audio engine (Phase 3)
🔲 engine/calls/*               Call system (Phase 4)
🔲 engine/progression/*         Progression (Phase 5)

✅ store/useGameStore           Sanity, static, tapes, bands
✅ store/useRadioStore          Frequency, volume, band
✅ store/useSettingsStore       Audio, display, gameplay prefs

✅ data/bands.ts                5 frequency bands
✅ data/calls.js                18 sacred calls
✅ data/tapes.ts                15 collectible tapes

✅ lib/theme.ts                 CRT colors, fonts, spacing
✅ lib/storage.ts               AsyncStorage wrapper
✅ lib/constants.ts             App constants

✅ 29 tests passing
```

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Web Audio API differs from expo-av | High | Platform abstraction layer in Phase 3 |
| React 19 + RN testing gaps | Medium | Detox E2E in Phase 6, manual testing |
| 18 calls may feel repetitive | Medium | Procedural variation system in Phase 4 |
| Audio performance on low-end devices | Medium | Fallback to pre-recorded samples |
| App Store rejection (horror content) | Low | Content warnings, no graphic violence |
| Scope creep | High | Strict phase boundaries, YAGNI |

---

## Timeline

| Phase | Weeks | Status |
|-------|-------|--------|
| Phase 1: Foundation | 1-2 | ✅ Complete |
| Phase 2: Radio UI | 3-4 | ✅ Complete |
| Phase 3: Audio Engine | 5-6 | 🔲 In progress |
| Phase 4: Call System | 7-8 | 🔲 Planned (9 tasks, 3 waves) |
| Phase 5: Progression | 9-10 | 🔲 Planned (6 tasks, 2 waves) |
| Phase 6: Polish & Release | 11-12 | 🔲 Planned (10 tasks) |

**Total estimated time:** 12 weeks (3 months)

---

## How to Continue

1. Read `DESIGN.md` for architecture details
2. Read `HANDOFF.md` for current state and gotchas
3. Read `docs/plans/2026-07-18-phase-1-foundation.md` for task-level detail
4. Phase 3 audio engine work is in progress (uncommitted in worker worktree)
5. Phase 4 is ready for dispatch — 9 tasks across 3 waves
6. Phase 5 has 5 open decisions to resolve before dispatch

**Dispatch strategy:**
- Ship size = one task = one crewmate feature
- Parallel dispatch in waves where dependencies allow
- Wave 1 (P4-1) blocks Wave 2 (P4-2 through P4-6), which blocks Wave 3 (P4-7 through P4-9)
- Resolve Phase 5 open decisions before dispatching Phase 5 tasks

---

*The frequency is open. Something is already waiting. Build the engine. Let them speak.*
