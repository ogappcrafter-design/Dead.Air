# Dead Air Radio — Project Briefing

## What Is Dead Air Radio?

A React Native/Expo game about tuning a radio to mysterious frequencies. Players explore 5 bands (LIVING, LIMINAL, LOST, CLASSIFIED, ████████), receive eerie "calls" from beyond, collect tapes, and manage their sanity. The game has a CRT/analog horror aesthetic.

## Revenue Model

- **Free base game** — 18 hand-crafted calls across 5 bands
- **Infinite Signal IAP ($3.99)** — Unlocks procedural call generation for infinite replayability
- Product ID: configured in `lib/constants.ts`

## Current Crisis

The $3.99 Infinite Signal IAP is sold but does nothing. `getCallPool()` in `InfiniteSignal.ts` returns the same 18 calls regardless of purchase. This is the #1 revenue priority.

## DAR Phase 1 Goals (Aug 6-20, 2026)

1. **Fix IAP** — Replace mock billing with real `expo-in-app-purchases`, handle receipts, restore purchases, error states
2. **Complete audio loop** — Wire AudioEngine to UI, synthesize tape drones, add voice fragments, build tape player UI
3. **Procedural Call Engine** — Build ProceduralCallGenerator so Infinite Signal IAP actually delivers infinite procedural calls

## Constraints

- **DO NOT modify `data/calls.js`** — 18 sacred hand-crafted calls are immutable
- **TypeScript strict** — `npx tsc --noEmit` must pass clean, no `as any` or `@ts-ignore`
- **Expo SDK 56** — Use compatible packages only
- **Cross-platform** — Must work on iOS (StoreKit) and Android (Play Billing)
- **No new dependencies** without clear justification — prefer using existing audio engine
- **Test coverage** — New engine code needs unit tests (PIX-4259)
- **pnpm** — All package management via pnpm

## Team

- **Linear Team:** Pixelated (PIX)
- **Project:** DAR Phase 1: Revenue-Critical Fixes
- **Initiative:** Dead Air Radio Expansion
- **Issue creator:** Chad
