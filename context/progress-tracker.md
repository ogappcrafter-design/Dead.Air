# Dead Air Radio — Progress Tracker

## Completed Work (Pre-DAR Phase 1)

- [x] Foundation: Radio UI, store UI, game state, call system
- [x] P4-P7: Merged to master
- [x] Audio engine files created (8 files in engine/audio/)
- [x] Mock IAP store implemented (useStoreStore.ts)
- [x] 18 hand-crafted sacred calls in data/calls.js
- [x] 5 bands configured: LIVING, LIMINAL, LOST, CLASSIFIED, ████████

## DAR Phase 1 Phases

- [ ] P1: IAP Store Hardening (PIX-4255) — COMPLETE
- [ ] P2: Tape Audio Playback (PIX-4254) — COMPLETE
- [ ] P3: Procedural Call Engine (PIX-4253) — COMPLETE

## Phase P1: IAP Store Hardening — PENDING

| Task                               | Issue    | Status      |
| ---------------------------------- | -------- | ----------- |
| Integrate expo-in-app-purchases    | PIX-4263 | [ ] PENDING |
| Handle purchase receipts + restore | PIX-4264 | [ ] PENDING |
| IAP error handling + edge cases    | PIX-4265 | [ ] PENDING |

## Phase P2: Tape Audio Playback — PENDING

| Task                              | Issue    | Status      |
| --------------------------------- | -------- | ----------- |
| Synthesize ambient drone per tape | PIX-4260 | [ ] PENDING |
| Voice fragments + static textures | PIX-4261 | [ ] PENDING |
| Tape player UI                    | PIX-4262 | [ ] PENDING |

## Phase P3: Procedural Call Engine — PENDING

| Task                            | Issue    | Status      |
| ------------------------------- | -------- | ----------- |
| ProceduralCallGenerator class   | PIX-4256 | [ ] PENDING |
| Fragment libraries per band     | PIX-4257 | [ ] PENDING |
| Wire IAP ownership gate         | PIX-4258 | [ ] PENDING |
| Tests for procedural generation | PIX-4259 | [ ] PENDING |

## Known Issues

1. IAP is mock-only — useStoreStore.ts uses setTimeout, no real billing
2. Audio not wired — AudioEngine exists but not connected to UI
3. InfiniteSignal TODO — Line 54 of InfiniteSignal.ts, procedural generation not implemented
4. $3.99 IAP delivers nothing — Players who buy Infinite Signal get no additional content
