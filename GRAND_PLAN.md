# GRAND PLAN — Dead Air Radio

> _The signal is forming. Follow the plan._

**Created:** 2026-07-18
**Updated:** 2026-08-09
**Status:** All phases complete. Game shipped. Linear initiative "Dead Air Radio Expansion" closed.
**Repo:** github.com/daggerstuff/deadair

---

## The Vision

Transform a ~970-line React Native prototype into a polished, addictive, multi-platform paranormal radio horror game.

**What it is:** You are a late-night DJ. The calls are real. The dead, the classified, the time-looped, and things with no name all come through on the radio. Ambient psychological horror — quiet dread, not jump scares.

**What it isn't:** No multiplayer. No combat. No jump scares. No predatory monetization.

---

## Tech Stack

| Layer       | Choice                                 | Why                                              |
| ----------- | -------------------------------------- | ------------------------------------------------ |
| Framework   | Expo SDK 56 + React Native 0.85.3      | Single codebase → web + iOS + Android + desktop  |
| Navigation  | Expo Router                            | File-based, web-compatible                       |
| State       | Zustand 5.x + persist middleware       | Lightweight, persistence built-in, game-friendly |
| Language    | TypeScript 6.0 (strict)                | Type safety, better DX                           |
| Storage     | AsyncStorage (local) + optional cloud  | Offline-first                                    |
| Audio       | Web Audio API (web) + expo-av (native)  | Real-time synthesis                              |
| Testing     | Jest 29.7 + babel-jest                 | Store/lib tests working                          |
| Package Mgr | pnpm                                   | npm v12 on node v24.18 is broken                 |
| Monitoring  | Sentry 7.11                            | Crash reporting, error tracking                  |
| Build       | EAS (Expo Application Services)        | Cloud builds, store submission                   |

---

## Architecture

```
deadair/
├── app/                        # Expo Router screens (file-based routing)
│   ├── _layout.tsx             # Root Stack + CRTView wrapper + ErrorBoundary
│   ├── index.tsx               # Splash → auto-navigate to /radio
│   ├── +not-found.tsx           # 404 "NO SIGNAL"
│   ├── radio/                   # Main game screen
│   ├── tapes/                   # Tape collection
│   ├── store/                   # IAP store
│   ├── settings/               # Preferences
│   ├── leaderboard/             # Leaderboard screen
│   ├── call-of-the-day/         # Daily mystery call
│   ├── friends/                 # Friend codes & sharing
│   └── share/                   # Share & community
├── components/
│   ├── radio/                   # Physical radio UI (dial, display, bands, volume, signal)
│   ├── calls/                   # Call type renderers (5 base + 5 advanced)
│   ├── tapes/                   # Tape collection UI
│   ├── progression/             # NG+, Endless Night, Tape Mastery
│   ├── store/                   # IAP store UI
│   ├── leaderboard/             # Leaderboard UI
│   ├── callOfTheDay/            # Daily mystery call UI
│   ├── friends/                 # Friend code UI
│   ├── share/                   # Share & community UI
│   └── shared/                  # CRT effects, glow text, ErrorBoundary, common UI
├── engine/
│   ├── audio/                   # Web Audio API engine, effects chain, latency optimization
│   ├── calls/                   # CallManager, CallScheduler, ProceduralVariation, SanityEffects
│   ├── progression/             # Bands, tapes, achievements, Night Shift, NG+, Endless Night
│   └── save/                    # Persistence layer
├── store/                       # 10 Zustand stores
│   ├── useGameStore             # Sanity, static, tapes, bands
│   ├── useRadioStore            # Frequency, volume, band, signalStrength
│   ├── useSettingsStore         # Audio, display, gameplay prefs
│   ├── useStoreStore            # IAP store state
│   ├── usePlayerStore           # Player identity & DJ persona
│   ├── useAchievementStore      # Milestones, badges
│   ├── useAnalyticsStore        # Local-only opt-in analytics
│   ├── useLeaderboardStore      # Leaderboard rankings
│   ├── useCallOfTheDayStore     # Daily mystery call state
│   └── useFriendCodeStore       # Friend codes & sharing
├── data/                        # Calls (sacred), bands, tapes, DLC content
│   ├── bands.ts                 # 5 frequency bands
│   ├── calls.js                 # 18 sacred calls
│   ├── tapes.ts                 # 15 collectible tapes
│   ├── ngPlusContent.ts         # New Game+ content
│   ├── tapeMasteryLayers.ts     # Tape Mastery progression
│   └── dlc/                     # DLC fragment libraries
├── lib/                         # Theme, constants, storage, errorTracking, analytics
├── docs/                        # Full documentation tree
│   ├── store/                   # App Store + Play Store listings
│   ├── monitoring/              # Sentry setup, crash triage
│   ├── platform-matrix.md       # Cross-platform test matrix
│   ├── playtest-bugs.md         # Playtest bug log
│   └── build.md                 # Build & release guide
├── scripts/
│   └── smoke-test.sh            # Cross-platform smoke test
└── assets/                      # Audio, images, icons
```

**Data Flow:**

```
User Input → Radio Store → Audio Engine → Visual Feedback
                ↓
          Game Store → Sanity/Static Changes → UI Updates
                ↓
          Persistence → AsyncStorage (auto-save)
```

**Audio Chain:**

```
StaticSynth → Distortion → Reverb → Spatial → Master Gain → Output
```

**Night Shift:**

4-hour in-game block compressed to ~20 min real-time.
Phases: off-air → on-air → break → sign-off

**Sanity/Static Economy:**

Sanity: 100 → 0 (drains from calls, recovers between)
Static: 0 → 100 (earned by surviving calls, currency for unlocks)

---

## Build History

### Phase 1: Foundation ✅ COMPLETE
**Goal:** Working Expo project with navigation, theme, save/load, and state stores.
**PRs:** Initial commits (b5713ae, 4ed70f8, 09f3759)

- Expo project with TypeScript strict mode
- Expo Router with 5 screens (splash, radio, tapes, store, settings)
- CRT theme system (#030303 bg, #FF8C00 amber, #39FF14 green)
- AsyncStorage typed wrapper (get/set/remove)
- 3 Zustand stores with persistence
- Data files: 5 bands, 15 tapes, 18 sacred calls
- Jest config: 29 tests passing
- ESLint + Prettier

### Phase 2: Radio UI ✅ COMPLETE
**Goal:** Physical radio interface with tactile controls.
**PRs:** Initial commits

- FrequencyDisplay — 48px amber digital readout with tick marks
- BandSelector — 5-band horizontal selector, locked bands show 🔒
- TuningDial — 140px circular dial (PanGesture + Reanimated rotation)
- VolumeControl — bar with +/- buttons and mute toggle
- SignalStrength — 5-bar green indicator
- RadioBody — 3-column layout composing all components
- CRTView — scanline overlay (intensity prop)

### Phase 3: Audio Engine ✅ COMPLETE
**Goal:** Real-time radio static synthesis and ambient soundscapes.

- Web Audio API context init (lazily created, SSR-safe)
- Static synthesis engine (white/pink/brown noise, intensity → band-pass/drive)
- Effects chain: distortion → reverb (convolver IR) → stereo panner
- Ambient background layer (looping, band-swappable, crossfade)
- Voice processing for calls (EQ band-pass, compressor, bitcrush presets)
- Platform abstraction via PlatformBridge interface (web + native)
- 105 new tests covering singleton lifecycle, pure-logic mappings, node graph

### Phase 4: Call System ✅ COMPLETE
**Goal:** Deliver the 18 sacred calls with 5 distinct mechanics.
**PRs:** #3–#10 (P4-1 through P4-9)

- CallManager singleton (lifecycle, routing)
- CallScheduler (timing, band-appropriate selection)
- 5 call type renderers: Just Listen, Dead Air, Right Answer, Signal Decode, Stay Calm
- ProceduralVariation (randomized caller names, details, timing, branching)
- SanityEffects (per-call-type drain/recovery curves)
- StaticRewards (completion rewards, static currency economy)
- Integration tests for call flow end-to-end

### Phase 5: Progression ✅ COMPLETE
**Goal:** Addiction hooks — real-time events, unlock progression, tape collection.
**PRs:** #11–#15 (P5-1 through P5-5)

- Night Shift session structure (4-hour blocks, real-time schedule)
- Band Unlock (metroidvania gates, unlock criteria)
- Tape Collection (15 tapes, rarity tiers, playback UI)
- IAP Store (base game + Infinite Signal expansion)
- Achievements (milestone tracking, unlock notifications, badge display)
- Cloud Sync (deferred — local-only opt-in analytics shipped instead)

### Phase 6: Polish & Release ✅ COMPLETE
**Goal:** Ship it.
**PRs:** #16–#25 (P6-1 through P6-10)

| PR  | Task                  | Delivered                                                       |
| --- | --------------------- | --------------------------------------------------------------- |
| #16 | P6-3 EAS Build Config  | eas.json, build profiles, environment secrets                  |
| #17 | P6-1 Audio Latency    | <50ms response, reduced buffer sizes                           |
| #18 | P6-6 Error Tracking   | Sentry 7.11, ErrorBoundary, Report-a-Bug                       |
| #19 | P6-2 Render Perf      | Memoization, virtual lists, reduced re-renders                 |
| #20 | P6-8 CRT Visual Polish | CRTView, CRTEffects, CRTRetention — scanlines, glow, phosphor   |
| #21 | P6-7 Analytics        | Local-only opt-in analytics (session length, calls, bands)     |
| #22 | P6-4 Cross-Platform   | Smoke test infrastructure, platform-matrix.md                  |
| #23 | P6-5 Accessibility    | Screen reader, reduced motion, contrast, font scaling           |
| #24 | P6-10 Store Assets    | App Store + Play Store listings, screenshots, descriptions      |
| #25 | P6-9 Playtest Bugs    | P0 hook crash fix, P1 nav gap fixes                            |

### Phase 7: Post-Launch ✅ COMPLETE
**Goal:** Marketing assets and crash monitoring.
**PRs:** #26–#27

- P7-1: Marketing assets (PR #27)
- P7-2: Post-launch monitoring — Sentry crash workflow, bug triage process (PR #26)

---

## DAR Phase 1–5: Revenue Expansion ✅ COMPLETE

After the core game shipped, five revenue-expansion phases were tracked in Linear as projects under the "Dead Air Radio Expansion" initiative. All issues closed, all projects marked Completed.

| Phase | Name                       | PRs            | Key Deliverables                                                        |
| ----- | -------------------------- | -------------- | ---------------------------------------------------------------------- |
| DAR-1 | Revenue-Critical Fixes      | #28, #29, #30  | IAP + audio, procedural call engine (DEA-84), IAP hardening (DEA-82) |
| DAR-2 | Content Depth               | #31–#36        | Ambient drone (DEA-83), 5 new call types (DEA-71), new bands (DEA-68), choice persistence (DEA-69), meta-narrative arc (DEA-70) |
| DAR-3 | Engagement & Retention      | #37–#40        | Player identity (DEA-48), difficulty system (DEA-46), onboarding (DEA-47), daily mystery call (DEA-49) |
| DAR-4 | Social & Monetization       | #41–#45        | Share/community (DEA-33), atmospheric DLC (DEA-30), cosmetic skins (DEA-31), premium tape packs (DEA-32), DLC runtime wiring |
| DAR-5 | Polish & Scale              | #46–#48        | Environmental audio (DEA-13), progression modes (NG+/Endless/Tape Mastery), performance & latency (DEA-11) |

**Total: 48 PRs, 50 Linear issues (all Done/Canceled), 80 commits.**

---

## Decision Log

| #   | Decision                           | Alternatives                                   | Why                                                                                      |
| --- | ---------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Expo (not raw RN)                  | React Native CLI, Flutter                      | Web + native, single codebase, easier deploy                                             |
| 2   | Ground-up rebuild                  | Refactor existing                              | Existing 970-line prototype too minimal                                                  |
| 3   | Triple-hook addiction              | Single hook                                    | Real-time + procedural + progression = max retention                                     |
| 4   | Ambient psychological horror       | Jump scares, action                            | Matches late-night radio vibe                                                            |
| 5   | Full audio engine                  | Pre-recorded only                              | Real-time synthesis = infinite variation                                                 |
| 6   | Hybrid sessions                    | Structured only                                | Balances progression with ambient dread                                                  |
| 7   | 18 calls sacred                    | Rewrite, expand                                | Writing is strong, add systems around them                                               |
| 8   | Real radio UI                      | Minimalist                                     | Physicality increases immersion                                                          |
| 9   | Local + cloud save                 | Cloud only                                     | Offline-first, optional sync                                                             |
| 10  | Zustand over Redux                 | Redux, MobX, Context                           | Lightweight, persistence built-in                                                        |
| 11  | Expo Router                        | React Navigation                               | File-based, web-compatible, modern                                                       |
| 12  | pnpm over npm                      | npm                                            | npm v12 on node v24.18 has install bug                                                   |
| 13  | Hybrid plan detail (Approach C)    | Full detail all phases, bullet-only all phases | Full detail Phase 4, task breakdown Phase 5, bullet list Phase 6 — right depth per phase |
| 14  | Ship size = per feature            | Per file, per phase                            | One task = one shippable feature, crewmate owns it end-to-end                            |
| 15  | Parallel dispatch where deps allow | Strict sequential                              | Waves of independent tasks dispatched in parallel, serialized only by dependency layers  |
| 16  | Local-only analytics               | Firebase, Mixpanel, Amplitude                  | Privacy-respecting, no external dependency, opt-in only                                  |
| 17  | Sentry for error tracking           | Custom logging, Bugsnag                        | Best RN/Expo integration, crash reporting, free tier sufficient                          |
| 18  | Procedural call engine (DEA-84)    | Hand-write every call                          | Infinite Signal IAP needs infinite content variety                                       |
| 19  | DLC as fragment libraries          | Monolithic expansions                          | Modular, individually purchasable, runtime composition                                   |
| 20  | 5 progression modes                | Single playthrough only                        | NG+, Endless Night, Tape Mastery = replayability and depth                                |

---

## The Sacred Content

**18 calls** in `data/calls.js`. These are hand-crafted, emotionally resonant, and final.

| Band       | Calls       | Vibe                                                |
| ---------- | ----------- | --------------------------------------------------- |
| LIVING     | Calls 0-3   | Normal. Safe. Familiar.                             |
| LIMINAL    | Calls 4-7   | Between stations. Whispers. Time distortion.        |
| LOST       | Calls 8-11  | Frequencies that shouldn't exist. Children singing. |
| CLASSIFIED | Calls 12-15 | Government. Numbers stations. Emergency alerts.     |
| ████████   | Calls 16-17 | [REDACTED]                                          |

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

| Layer               | Tool                 | Coverage                                     | Status          |
| ------------------- | -------------------- | -------------------------------------------- | --------------- |
| Unit (stores, libs) | Jest                 | Store logic, pure functions                  | ✅ Passing      |
| Unit (per-task)     | Jest + mock RN       | Each Phase 4/5 task shipped own tests       | ✅ Complete     |
| Integration         | Jest + mock RN       | Call flow end-to-end, progression logic      | ✅ Complete     |
| Component           | Deferred             | React 19 + RN + Jest incompatible            | ⚠️ Not feasible |
| E2E                 | Manual + smoke-test  | Cross-platform smoke test script             | ✅ Complete     |
| Visual              | Manual + screenshots | UI fidelity, CRT effects                     | ✅ Complete     |
| Audio               | Manual listening     | Audio engine, call audio                     | ✅ Complete     |
| Platform            | EAS builds + manual  | Web, iOS, Android, desktop                   | ✅ Complete     |
| Accessibility       | Manual audit         | Screen reader, contrast, reduced motion      | ✅ Complete     |

---

## Risk Register (Post-Completion)

| Risk                                 | Severity | Outcome                                                               |
| ------------------------------------ | -------- | -------------------------------------------------------------------- |
| Web Audio API differs from expo-av   | High     | ✅ Resolved — PlatformBridge abstraction shipped in Phase 3           |
| React 19 + RN testing gaps           | Medium   | ⚠️ Accepted — Component tests deferred, integration + E2E cover gaps  |
| 18 calls may feel repetitive         | Medium   | ✅ Resolved — ProceduralVariation + procedural call engine (DEA-84)   |
| Audio performance on low-end devices | Medium   | ✅ Resolved — Latency optimization in PR #17 and PR #48               |
| App Store rejection (horror content) | Low      | ✅ Resolved — Content warnings, no graphic violence, assets ready     |
| Scope creep                          | High     | ✅ Managed — 48 PRs across 7 phases + 5 DAR phases, all landed clean  |

---

## Timeline (Actual)

| Phase                          | PRs       | Status     |
| ------------------------------ | --------- | ---------- |
| Phase 1: Foundation            | Initial   | ✅ Complete |
| Phase 2: Radio UI              | Initial   | ✅ Complete |
| Phase 3: Audio Engine          | Initial   | ✅ Complete |
| Phase 4: Call System           | #3–#10    | ✅ Complete |
| Phase 5: Progression           | #11–#15   | ✅ Complete |
| Phase 6: Polish & Release      | #16–#25   | ✅ Complete |
| Phase 7: Post-Launch           | #26–#27   | ✅ Complete |
| DAR-1: Revenue-Critical        | #28–#30   | ✅ Complete |
| DAR-2: Content Depth           | #31–#36   | ✅ Complete |
| DAR-3: Engagement & Retention  | #37–#40   | ✅ Complete |
| DAR-4: Social & Monetization   | #41–#45   | ✅ Complete |
| DAR-5: Polish & Scale           | #46–#48   | ✅ Complete |

**Total: 48 PRs, 50 Linear issues, 80 commits, 10 Zustand stores, 5 shared components, full doc tree.**

---

## What Comes Next

The core game is complete, the revenue expansion is landed, and the Linear initiative is closed. What follows are growth directions the game could grow into — not commitments, just possibilities ranked by impact-to-effort ratio.

### Tier 1: High-Value, Proven Patterns

**Real Multiplayer Events (Seasonal)**
The addiction model already has real-time events. Seasonal limited-time calls (Halloween broadcast, Winter Solstice signal, April Fool's numbers station) would drive re-engagement spikes without new core systems. The procedural call engine can generate seasonal variants from fragment libraries. Low effort — the infrastructure already exists.

**Community-Driven Content**
The share/community features (DEA-33) and friend codes are local-only. A lightweight server for sharing custom call fragments, tape recordings, or frequency presets would turn the single-player game into a community hub. Medium effort — needs a backend, but the client-side sharing UI already exists.

**Audio Expansion Packs**
The DLC fragment library system (DEA-30/31/32) is designed for growth. New atmospheric packs (rain, train station, abandoned hospital), new cosmetic radio skins (military field radio, pirate radio, hospital intercom), and new tape packs with unique narrative arcs can be shipped incrementally. Low effort — the DLC pipeline is proven.

### Tier 2: Depth & Replayability

**Mod System**
Expose the procedural call engine's fragment composition as a player-facing tool. Let players assemble their own call fragments, tune difficulty parameters, and share custom "frequencies" via friend codes. This turns the procedural engine from a backend system into a creative platform. High effort — but the engine already exists; this is a UI and sharing layer.

**Narrative Seasons**
The meta-narrative arc (DEA-70) established a relay point and 15-tape ending. A seasonal model with new narrative arcs — each season a new "transmission" with its own tapes, band unlocks, and ending — would give returning players a reason to come back. High effort — requires new sacred-level writing, which is the hardest content to produce.

**Endless Night Procedural Depth**
Endless Night mode exists but could be deepened with procedural difficulty scaling, rare event calls, and a scoring system that feeds into the leaderboard. The leaderboard store already exists. Medium effort — mostly tuning and content, not new systems.

### Tier 3: Platform & Reach

**Web Release**
The Expo codebase targets web, but the web experience hasn't been a launch priority. A dedicated web build with keyboard controls (arrow keys for tuning, spacebar for answer) and browser audio optimization would open a new distribution channel. Low-medium effort — the codebase is web-compatible; this is polish and testing.

**Steam / Desktop Release**
Electron or Tauri wrapper around the web build for Steam distribution. The CRT aesthetic and atmospheric audio translate well to desktop. The IAP system would need Steam overlay integration. Medium effort — platform integration, not game changes.

**Accessibility Deepening**
The Phase 6 accessibility pass covered the basics. Full accessibility — audio descriptions for calls, haptic feedback patterns for call types, colorblind-safe signal indicators, and a "radio text mode" for deaf/hard-of-hearing players — would make the game genuinely inclusive. Medium-high effort — but it aligns with the horror design principle of emotional truth.

### Tier 4: Moonshots

**Voice-Driven Gameplay**
Use device microphone to let players actually "answer" calls — voice activity detection could drive the Stay Calm mechanic (must not speak) or the Right Answer mechanic (speak the answer). This would make the radio feel real in a way no other game does. Very high effort — but it would be a genuinely novel mechanic.

**ARG Integration**
The ████████ band and CLASSIFIED calls already have ARG energy. A real-world ARG layer — phone numbers that play audio when called, QR codes hidden in CRT scanlines, a fake radio station website — would blur the game's edge with reality. The horror design principle of player agency makes this potent. High effort — content creation and web infrastructure.

**AI-Generated Call Voices**
The voice processing pipeline (EQ, compression, bitcrush) is built for real audio. A TTS pipeline that generates caller voices from the sacred call text, with real-time pitch/prosody variation, would make every procedural variant sound unique without recording every line. The Web Audio API chain already processes the output. High effort — but it would solve the "18 calls may feel repetitive" risk at its root.

---

## How to Pick Up

1. Read `README.md` for the current architecture overview
2. Read `docs/build.md` for build and release instructions
3. Read `docs/monitoring/sentry-setup.md` for crash monitoring
4. Read `docs/store/` for store listing assets
5. Check Linear team DEA for any new issues
6. The codebase is the source of truth — this plan is the history

---

_The frequency is open. Something is already waiting. The signal has been built. Now let it grow._
