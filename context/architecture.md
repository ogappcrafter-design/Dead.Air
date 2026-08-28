# Dead Air Radio — Architecture

## Tech Stack

- **Framework:** React Native / Expo SDK 56
- **Language:** TypeScript 6.0
- **React:** 19.2
- **State:** Zustand 5.0 (stores in `store/`)
- **Audio:** Web Audio API (custom engine in `engine/audio/`)
- **Testing:** Jest 29
- **Package Manager:** pnpm
- **Repo:** `git@github.com:daggerstuff/deadair`, branch `master`

## Directory Structure

```
deadair/
├── app/                    # Screen routes (Expo Router)
│   ├── radio/index.tsx     # Main radio screen
│   ├── store/index.tsx     # IAP store screen
│   ├── tapes/              # Tape detail views
│   └── settings/           # Settings screen
├── components/             # UI components
│   ├── radio/RadioBody.tsx # Radio UI (NO audio wiring currently)
│   ├── store/StoreCard.tsx # Store card (presentational)
│   └── ...
├── engine/                 # Core game engine
│   ├── audio/              # 8 audio engine files
│   │   ├── AudioEngine.ts       # Main audio controller
│   │   ├── StaticSynth.ts       # Static noise synthesizer
│   │   ├── EffectsChain.ts      # Audio effects
│   │   ├── VoiceProcessor.ts    # Voice processing
│   │   ├── AmbientLayer.ts      # Ambient drone layer
│   │   ├── PlatformBridge.ts    # Platform abstraction
│   │   ├── LatencyProfiler.ts  # Audio latency measurement
│   │   └── AudioPerformanceConfig.ts
│   ├── calls/              # Call system
│   │   ├── CallManager.ts  # Manages incoming calls (has setAudioAccess method)
│   │   └── CallOfTheDayGenerator.ts  # Seeded daily featured call picker
│   └── progression/        # Progression system
│       └── InfiniteSignal.ts  # IAP-gated call pool (TODO at line 54)
├── store/                  # Zustand stores
│   ├── useStoreStore.ts    # IAP entitlement state (persisted via AsyncStorage)
│   ├── useRadioStore.ts    # Radio state (frequency, band, volume)
│   ├── useGameStore.ts     # Game state (sanity, static, tapes)
│   ├── useLeaderboardStore.ts  # Anonymous leaderboard (local-only, AsyncStorage)
│   ├── useCallOfTheDayStore.ts # Call of the day + voting (local-only, AsyncStorage)
│   └── useFriendCodeStore.ts   # Friend code management (local-only, AsyncStorage)
├── hooks/                  # React hooks
│   ├── useNightShift.ts
│   └── useSanityEffect.ts
├── data/                   # Game data
│   ├── calls.js            # 18 hand-crafted sacred calls (DO NOT MODIFY)
│   └── ...
├── lib/                    # Utilities
│   ├── iap.ts             # IAP orchestration — wires expo-in-app-purchases, manages purchase lifecycle
│   └── constants.ts        # App constants (includes IAP product IDs)
├── docs/                   # Documentation
│   └── store/              # Store listing docs
├── scripts/                # Build scripts
└── context/                # autobots context files (this directory)
```

## Key Patterns

- **Zustand stores** manage all app state. Each store file exports a hook.
- **Engine layer** is separate from UI. Audio engine exists but is NOT wired to UI.
- **CallManager** has `setAudioAccess()` method for late audio binding — intended to be called once AudioEngine is ready.
- **InfiniteSignal** gates call pool by IAP ownership. Currently returns same 18 calls regardless. TODO at line 54 for procedural generation.
- **Data files** in `data/calls.js` are sacred — 18 hand-crafted calls must never be modified.
- **IAP** is wired via `lib/iap.ts` using `expo-in-app-purchases`. `useStoreStore.ts` holds entitlement state (persisted). Purchase lifecycle: `initIAP()` → `setPurchaseListener` → `purchaseProduct()` / `restorePurchases()`. Receipts are validated before granting entitlement.

## Remaining Gaps (DAR Phase 1 Targets)

1. **Audio not wired** — AudioEngine exists but no hook/component connects it to RadioBody
2. **InfiniteSignal procedural generation** — `getCallPool()` returns same 18 calls; TODO at line 54 for procedural expansion
3. **No tape audio** — Tape playback UI exists but no audio synthesis or playback
4. **~~Entitlement setter exposure~~ (RESOLVED)** — `setInfiniteSignal`/`setBase` in `useStoreStore` now validate purchase records before granting entitlement (`purchases.some(p => p.productId === ... && p.transactionReceipt)`). `lib/iap.ts` `revalidateEntitlements()` re-validates receipts on launch. See `context/security-auth.md`.

## Build & Test

```bash
pnpm install          # Install dependencies
pnpm test             # Run Jest tests
npx tsc --noEmit      # Type check (must be clean)
npx expo start        # Start dev server
```
