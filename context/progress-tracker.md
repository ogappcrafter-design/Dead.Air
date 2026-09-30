# Dead Air Radio — Progress Tracker

_Status reconciled against `master` on 2026-09-29._ This replaces the older pending-work snapshot; the implementation and current release checklist are authoritative.

## Implemented in the repository

- **IAP purchase flow:** `lib/iap.ts` integrates `expo-in-app-purchases`, entitlement updates are receipt/order-ID gated, restore is available from the store screen, and purchase-history revalidation runs at launch.
- **Procedural calls:** `engine/calls/ProceduralCallGenerator.ts`, band fragment libraries, the Infinite Signal owner gate, and unit tests are present. Owners receive eligible hand-authored calls plus a generated finite pool; non-owners do not receive the generated pool.
- **Tape playback:** the tape screen connects its player controls to synthesized per-tape audio profiles, progress updates, and cleanup on navigation.
- **Quality checks:** CI runs formatting, lint, typecheck, circular-dependency analysis, Jest tests, and secret scanning.

## Confirmed remaining gaps / release gates

1. **Radio-call audio is not wired:** `engine/calls/callManagerInstance.ts` still passes `audio: null`; `CallManager.setAudioAccess()` is not connected to the radio screen. This does not mean tape playback is missing.
2. **Store release setup is external:** confirm App Store Connect / Google Play products, EAS credentials, and native purchase/restore behavior using the sandbox checklist in `docs/store/release-checklist.md`.
3. **Receipt verification limitation:** the app checks for a transaction receipt and order ID and rechecks store purchase history, but this repository has no server-side receipt validation.

## Validation baseline

The last verified local baseline reported 78 Jest suites and 1,386 tests passing, with formatting, lint, typecheck, and circular-dependency checks passing. Re-run checks after source changes.
