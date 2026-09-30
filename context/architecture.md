# Dead Air Radio — Architecture

_Status reconciled against `master` on 2026-09-29._ Source code is authoritative when this note and implementation differ.

## Tech Stack

- **Framework:** React Native / Expo SDK 56
- **Language:** TypeScript 6
- **State:** Zustand 5 (`store/`)
- **Audio:** PlatformBridge-based synthesis in `engine/audio/`
- **Testing:** Jest 29
- **Package manager:** pnpm

## Directory Structure

```text
deadair/
├── app/                    # Expo Router screens
├── components/             # UI components
├── data/                   # Calls, tapes, fragments, and DLC content
├── engine/
│   ├── audio/              # Audio engine, tape synthesis, effects, bridges
│   ├── calls/              # Call types, generation, scheduling, rendering
│   └── progression/        # Unlocks, tape playback, Infinite Signal pool
├── hooks/                  # UI lifecycle and playback hooks
├── lib/                    # IAP service, theme, analytics, utilities
├── store/                  # Zustand state and persistence
├── tests/                  # Jest tests
└── context/                # Project notes; keep aligned with source
```

## Current Implementation

- **Procedural calls:** `engine/calls/ProceduralCallGenerator.ts` assembles valid calls from fragment libraries. `engine/progression/InfiniteSignal.ts` includes procedural calls for owners and restricts non-owners to the eligible hand-authored pool. The default generator currently produces six calls per configured band library (48 across the eight base libraries), with seasonal and owned-pack content added separately. This is a finite pool generated for a session, not an unbounded in-memory stream. `data/calls.js` remains the protected hand-authored source.
- **Purchases:** `lib/iap.ts` connects to `expo-in-app-purchases`; the store screen exposes purchase and restore flows. Entitlements require a transaction receipt and order ID, and launch-time purchase-history revalidation can revoke entitlements. This is client-side store-history/receipt-presence checking; this repository does not implement server-side receipt verification. Store-console product setup and native sandbox testing remain release tasks.
- **Tape audio:** `app/tapes/index.tsx` wires the tape player UI to `TapeDroneSynth`, using per-band, per-tape, and per-rarity profiles with drone, texture, and vowel-like voice fragments. Playback stops when the player closes or the screen unmounts.
- **Radio-call audio:** This is a separate unfinished path. `engine/calls/callManagerInstance.ts` currently constructs the manager with `audio: null`; `CallManager.setAudioAccess()` exists but is not wired from the radio screen. The call UI is functional, but calls do not yet use the audio engine for playback.

## Key Patterns

- Engine logic is kept separate from React UI and receives store/audio access through explicit interfaces.
- Zustand stores own app state; persistent state uses the configured storage adapters.
- Radio-call audio and tape-audio playback have different integration paths; do not infer one is wired because the other is.
- `data/calls.js` contains the protected hand-authored calls. Add generated content through fragment libraries instead.

## Build & Test

```bash
pnpm install
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run deps:circular
pnpm test --runInBand --forceExit
```

The force-exit flag avoids Jest lingering after tests because of an open async handle; it does not suppress test failures.
