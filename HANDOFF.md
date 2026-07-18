# HANDOFF.md — Dead Air Radio

> *Something is trying to reach you. The signal is forming.*

**Last updated:** 2026-07-18  
**Current phase:** Phase 1 (Foundation) ✅ + Phase 2 (Radio UI) ✅ — Phase 3 (Audio Engine) next

---

## What Is This?

Paranormal late-night radio horror game. You are the DJ. The calls are real.

Ambient psychological horror — quiet dread, not jump scares. Late-night coast radio vibe. Think 3AM, alone, static between stations, and something on the other end.

**Platforms:** Web PWA + iOS/Android + Desktop (via Expo)  
**Stack:** React Native 0.85.3, Expo SDK 56, TypeScript, Zustand, Expo Router

---

## Quick Start

```bash
# Use pnpm (npm v12 on node v24.18 has a bug that fails to install all deps)
pnpm install --legacy-peer-deps

# Start dev
pnpm start
# or
npx expo start --web    # browser
npx expo start          # native

# Run tests (29 passing)
pnpm test
```

**Node:** v24.18.0 (project targets 24.16.0 via engines — works fine)  
**Package manager:** pnpm (mandatory — npm is broken on this node version)

---

## Project Structure

```
deadair/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root Stack navigator, CRTView wrapper
│   ├── index.tsx                 # Splash → auto-navigate to /radio after 2s
│   ├── +not-found.tsx            # 404 "NO SIGNAL" screen
│   ├── radio/index.tsx           # Main radio screen (RadioBody + CRTView)
│   ├── tapes/index.tsx           # Tape collection (placeholder)
│   ├── store/index.tsx           # IAP store (placeholder)
│   └── settings/index.tsx        # Settings (placeholder)
├── components/
│   ├── radio/                    # Physical radio UI
│   │   ├── RadioBody.tsx         # Main layout composing all radio components
│   │   ├── FrequencyDisplay.tsx  # Digital frequency readout (48px amber)
│   │   ├── BandSelector.tsx      # 5-band horizontal selector, locked shows 🔒
│   │   ├── TuningDial.tsx        # 140px circular dial (PanGesture + Reanimated)
│   │   ├── VolumeControl.tsx     # Volume bar, +/- buttons, mute toggle
│   │   └── SignalStrength.tsx    # 5-bar green signal indicator
│   └── shared/
│       └── CRTView.tsx           # CRT scanline overlay (intensity prop)
├── lib/
│   ├── constants.ts              # BANDS tuple, CALL_TYPES, MAX_SANITY/STATIC, save keys
│   ├── storage.ts                # Typed AsyncStorage wrapper (get/set/remove)
│   └── theme.ts                  # colors, fonts, spacing
├── store/
│   ├── useGameStore.ts           # Zustand persist: sanity, static, tapes, unlockedBands
│   ├── useRadioStore.ts          # Zustand persist: frequency, volume, band, signal
│   └── useSettingsStore.ts       # Zustand persist: audio/display/gameplay prefs
├── data/
│   ├── bands.ts                  # BandInfo interface, BANDS Record (5 bands), helpers
│   ├── calls.js                  # SACRED — 18 hand-crafted calls (never rewrite)
│   └── tapes.ts                  # TapeInfo interface, TAPES array (15 tapes)
├── __tests__/
│   ├── lib/theme.test.ts         # 4 tests
│   ├── lib/storage.test.ts       # 4 tests
│   └── store/
│       ├── useGameStore.test.ts  # 9 tests
│       ├── useRadioStore.test.ts # 7 tests
│       └── useSettingsStore.test.ts # 5 tests
├── __mocks__/
│   └── @react-native-async-storage/
│       └── async-storage.ts      # In-memory AsyncStorage mock for Jest
├── assets/                       # icons, splash, favicon
├── docs/plans/                   # Implementation plans
├── DESIGN.md                     # Architecture decisions + decision log
└── HANDOFF.md                    # This file
```

---

## What's Built (Phases 1-2)

### Phase 1: Foundation ✅
- Expo project with TypeScript, strict mode
- Expo Router with Stack navigator (5 screens)
- Theme system (CRT aesthetic: #030303 bg, #FF8C00 amber, #39FF14 green)
- AsyncStorage wrapper with typed get/set/remove
- 3 Zustand stores with persistence (game, radio, settings)
- Data files: 5 bands, 15 tapes, sacred 18 calls
- Jest config: 29 tests passing
- ESLint + Prettier configured

### Phase 2: Radio UI ✅
- FrequencyDisplay: 48px amber digital readout with tick marks
- BandSelector: 5-band horizontal, locked bands grayed with 🔒
- TuningDial: 140px circular drag-to-tune (react-native-gesture-handler + reanimated)
- VolumeControl: bar with +/- and mute toggle
- SignalStrength: 5-bar green indicator
- RadioBody: 3-column layout composing all components
- CRT scanline overlay

---

## What's Next (Phase 3+)

### Phase 3: Audio Engine (Week 5-6) — NEXT
- Web Audio API setup
- Radio static synthesis (white/pink noise)
- Effects chain: distortion → reverb → spatial
- Ambient background layer
- Voice processing for calls

### Phase 4: Call System (Week 7-8)
- 5 call type renderer components (JUST_LISTEN, DEAD_AIR, RIGHT_ANSWER, SIGNAL_DECODE, STAY_CALM)
- Procedural variation (randomized details, timing)
- Sanity effects per call type
- Static currency rewards

### Phase 5: Progression (Week 9-10)
- Night shift structure (4-hour sessions)
- Band unlocking (metroidvania-style)
- Tape collection UI
- Store/IAP wiring

### Phase 6: Polish (Week 11-12)
- Performance optimization
- Platform testing
- EAS build + submission

See `DESIGN.md` for full architecture and decision log.

---

## Key Design Decisions

| # | Decision | Why |
|---|----------|-----|
| 1 | Expo (not raw RN) | Web + native from single codebase |
| 2 | Zustand over Redux | Lightweight, persistence built-in, game-friendly |
| 3 | Expo Router over React Nav | File-based, web-compatible |
| 4 | Ambient horror (not jump scares) | Matches late-night radio vibe |
| 5 | Full audio engine (not pre-recorded) | Real-time synthesis = infinite variation |
| 6 | 18 calls are sacred | Writing is strong, add systems around them |

Full log in `DESIGN.md`.

---

## Critical Things to Know

### Sacred Content
`data/calls.js` contains 18 hand-crafted calls. **Never rewrite these.** Add procedural variation around them, but the core writing is locked.

### Package Manager
**Use pnpm.** npm v12.0.1 on node v24.18.0 has a bug where it reports "584 packages audited" but only installs ~341 dirs. pnpm works correctly. All installs need `--legacy-peer-deps`.

### Jest Config
`jest.config.js` uses manual babel-jest transform with `babel-preset-expo`. Does NOT use `jest-expo` preset (broken with `@react-native/jest-preset`'s ESM setup files in Jest's CJS context). Component tests (React Native rendering) are skipped — 29 store/lib tests pass fine.

### Save Keys
- `dead_air_save_v1` — game state (sanity, static, tapes, bands)
- `dead_air_save_v1_radio` — radio state (frequency, volume, band)
- `dead_air_save_v1_settings` — settings (audio, display, gameplay prefs)

### Store Pattern
All stores use zustand `persist` middleware with AsyncStorage. Pattern:
```typescript
const useXStore = create(
  persist(
    (set, get) => ({ /* state + actions */ }),
    { name: 'dead_air_save_v1_x', storage: createJSONStorage(() => AsyncStorage) }
  )
)
```

### Audio API Choice (Phase 3)
- Web: Web Audio API (native browser API)
- Mobile: expo-av + custom native modules
- Fallback: Pre-recorded samples if real-time unavailable

---

## Git Log

```
7c0b06f chore: align dependency versions and add expo-router/status-bar plugins
abe0d8e Commit all the changes
07bd9a6 Create UPDATE FILE RED UPDATE
586f02d Merge pull request #1 from daggerstuff/chad
55a3a19 Add expo-insights dependency updates
1d5e2c7 security: override uuid dependency to ^11.1.1 to fix vulnerability
9a320ca chore: update package-lock.json engine field
4fe3cbf Pin Node.js to v24.16.0 via engines and .nvmrc
9dd9de7 upgrade: Expo SDK 50 -> 56, remove unused deps, fix splash schema
ffb8fb6 fix: remove unused imports (useCallback, AsyncStorage) from game.js
```

Remote: `git@github.com:daggerstuff/deadair.git`

---

## Known Issues / Tech Debt

1. **Component tests skipped** — React Native component rendering tests are not feasible with current Jest + React 19 + pnpm setup. 29 store/lib tests cover state logic. Consider Detox for E2E later.
2. **Placeholder screens** — tapes, store, settings screens show "Coming in Phase X" text. Need full UI in Phases 4-5.
3. **No audio engine yet** — Phase 3 is next. Radio UI is visual-only right now.
4. **No cloud sync** — Settings store has `cloudSyncEnabled` flag but no implementation. Phase 5+ territory.
5. **IAP not wired** — Store screen is placeholder. Google Play Billing integration needed for release.

---

*The frequency is open. Something is already waiting.*
