# Dead Air Radio — DAR Phase 1 Status

_Status reconciled against `master` on 2026-09-29._ The original Aug 6–20, 2026 plan is now a historical implementation record, not a list of untouched tasks. Check the source and `docs/store/release-checklist.md` before reopening work.

## P1: IAP Store Hardening — code integrated; production setup remains

`lib/iap.ts` connects `expo-in-app-purchases` to the app. The store UI calls the purchase and restore flows, purchase events update entitlements only when a transaction receipt and order ID are present, and startup revalidates against purchase history. Error and cancellation states are surfaced through the store UI.

**Still required outside code:** configure matching products and pricing in App Store Connect and Google Play, provision EAS/store credentials, and test purchase, restore, cancellation, and refund behavior on native sandbox builds. The app performs client-side receipt-presence/history checks; no server-side receipt validation service is present.

## P2: Tape Audio Playback — implemented in the app

`app/tapes/index.tsx` connects the tape screen to `TapeDroneSynth` and per-band/per-tape/per-rarity audio profiles. The player exposes play/pause/stop, progress, volume, and cleanup on close or navigation. The generated audio includes ambient drone, filtered texture, and vowel-like voice fragments; it is synthesized rather than a set of recorded dialogue clips.

**Still required:** verify and tune the sound on supported native devices as part of release QA. Do not describe tape playback as wholly unwired.

## P3: Procedural Call Engine — implemented and tested

- `engine/calls/ProceduralCallGenerator.ts` assembles structured calls from fragment libraries and variation rules.
- `data/fragments/` contains the base band libraries and expansion content.
- `engine/progression/InfiniteSignal.ts` applies the ownership gate: the generated pool is included for owners and excluded for non-owners.
- Tests cover generated call structure, uniqueness, gating, and pool composition.

The default configuration generates six calls per each of the eight base fragment libraries (48 generated calls per pool construction), then adds eligible seasonal and owned-pack content. This pool is finite at a given construction; fresh procedural content comes from regeneration rather than an infinite resident list.

## Separate outstanding integration

Radio-call audio is not connected to the audio engine yet: `engine/calls/callManagerInstance.ts` supplies `audio: null`. This is independent of tape audio synthesis and playback.
