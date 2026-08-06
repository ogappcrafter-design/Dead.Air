# Dead Air Radio — DAR Phase 1: Revenue-Critical Fixes

## Overview

Fix the IAP that doesn't work, complete the core audio loop, and harden the store.
10 Linear issues across 3 workstreams. Target: Aug 6-20, 2026.

### P1: IAP Store Hardening (PIX-4255)

Integrate real IAP billing, handle receipts, restore purchases, and error states. Replace mock purchase flow in `store/useStoreStore.ts` with `expo-in-app-purchases` SDK.

- Integrate expo-in-app-purchases (PIX-4263): Install package, configure Infinite Signal product ($3.99) for iOS StoreKit + Android Play Billing, set up purchase event listeners, replace mock `purchaseInfiniteSignal()` with real billing
- Handle purchase receipts + restore purchases (PIX-4264): Validate receipt, store in AsyncStorage, update `hasInfiniteSignal` from real purchase result, add "Restore Purchases" button in Settings screen
- IAP error handling + edge cases (PIX-4265): Handle network failure, purchase declined, already owned, interrupted purchases, cross-device restore conflicts. No silent failures.
- Acceptance checks:
  - [ ] `expo-in-app-purchases` in package.json
  - [ ] Product IDs configured for iOS + Android
  - [ ] Purchase event listeners registered
  - [ ] `purchaseInfiniteSignal()` calls real billing SDK
  - [ ] Receipt validated and stored in AsyncStorage
  - [ ] `hasInfiniteSignal` set from real purchase result
  - [ ] Restore purchases button in Settings
  - [ ] Network failure shows retry option
  - [ ] Purchase declined handled gracefully
  - [ ] Already owned detected and messaged
  - [ ] Interrupted purchases recoverable
  - [ ] No silent failures
  - [ ] tsc clean, all tests pass

### P2: Tape Audio Playback (PIX-4254)

Wire audio engine to UI, synthesize ambient drones per tape, add voice fragments and static textures, build tape player UI with CRT aesthetic.

- Synthesize ambient drone audio per tape (PIX-4260): Use VoiceProcessor to synthesize drones for 15 tapes, base frequency by band, seamless loop
- Add voice fragments + static textures per tape (PIX-4261): Band-appropriate voice fragments (whispers for LOST, numbers for NUMBERS, prayers for SACRED), static textures vary by rarity
- Tape player UI (PIX-4262): Play/pause/stop controls, progress bar, visual feedback, audio stops on navigation, CRT aesthetic
- Acceptance checks:
  - [ ] 15 tape drones synthesized via VoiceProcessor
  - [ ] Base frequency varies by band
  - [ ] Seamless loop (no clicks/gaps)
  - [ ] Voice fragments generated per band
  - [ ] Band-appropriate content (whispers/numbers/prayers)
  - [ ] Static textures vary by rarity
  - [ ] Play/pause/stop buttons functional
  - [ ] Progress bar shows playback position
  - [ ] Audio stops on navigation away
  - [ ] CRT aesthetic maintained
  - [ ] tsc clean

### P3: Procedural Call Engine (PIX-4253)

Build ProceduralCallGenerator so Infinite Signal IAP delivers infinite procedural calls. Wire IAP ownership gate. Add tests.

- Create ProceduralCallGenerator class (PIX-4256): New class in `engine/calls/ProceduralCallGenerator.ts`, generate calls from templates + variation rules per band, unique callerId, procedural lines, randomized sanityDelta/staticReward, correct call type per band
- Build fragment libraries per band (PIX-4257): Create `data/fragments/<band>.ts` for 5 bands (LIVING, NUMBERS, LOST, SACRED, RIGHT_ANSWER), each with opening/middle/closing/response fragments
- Wire IAP ownership gate (PIX-4258): Update `getCallPool()` in `InfiniteSignal.ts` to check `hasInfiniteSignal`, return hand-crafted + procedural if owned, only 18 hand-crafted if not, remove TODO at line 54
- Tests for procedural call generation (PIX-4259): Unit tests for generation, uniqueness, IAP gating, fragment assembly, call structure
- Acceptance checks:
  - [ ] `ProceduralCallGenerator.ts` exists in `engine/calls/`
  - [ ] Generates unique calls per band
  - [ ] Valid structure (callerId, lines, type, rewards)
  - [ ] 5 fragment library files in `data/fragments/`
  - [ ] Each has opening/middle/closing/response fragments
  - [ ] `getCallPool()` checks `hasInfiniteSignal`
  - [ ] Owners get infinite procedural calls
  - [ ] Non-owners get only 18 hand-crafted calls
  - [ ] TODO at line 54 removed
  - [ ] No modifications to `data/calls.js`
  - [ ] Tests for generation, uniqueness, IAP gating
  - [ ] All tests pass
  - [ ] tsc clean
