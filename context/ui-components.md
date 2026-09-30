# Dead Air Radio — UI Components & Design System

_Status reconciled against the app on 2026-09-29._

## Design Language

CRT / analog-horror aesthetic with dark backgrounds, phosphor green and amber text, scanlines, and glitch styling. Shared colors, typography, and spacing tokens are in `lib/theme.ts`.

## Component Architecture

- **Screens:** Expo Router routes in `app/`.
- **Components:** reusable UI in `components/`; state is supplied through props and Zustand selectors.
- **Styling:** React Native `StyleSheet` with project theme tokens; no external component library is used.

## Key Screens

### Radio (`app/radio/index.tsx`, `components/radio/RadioBody.tsx`)

The screen contains the tuner, band selection, volume control, signal display, and active-call UI. **Radio-call audio is not wired:** the shared `callManagerInstance` currently has `audio: null`. This gap is specific to call playback; it does not describe the tape player.

### Store (`app/store/index.tsx`)

The store screen uses the real `lib/iap.ts` purchase and restore functions. `useStoreStore` holds receipt-gated entitlements and purchase status. The restore button is on the store screen, and status/error messages are shown in the screen banner. Product-console setup and native sandbox testing remain release work.

### Tape Collection (`app/tapes/index.tsx`)

Collected tapes open `components/tapes/TapePlayer.tsx`. The screen drives synthesized audio through `TapeDroneSynth`, with band/tape/rarity profiles, play/pause/stop controls, a progress display, and cleanup when playback closes or navigation leaves the screen.

### Settings (`app/settings/`)

Settings include accessibility, audio, data, and progression options, along with the project’s achievement and social components where enabled. Restore purchases is not described as a settings-only feature; it is exposed from the store screen.

## State Management

- `useRadioStore` — frequency, band, and radio controls.
- `useGameStore` — sanity, static, tapes, and progression.
- `useStoreStore` — IAP connection, purchase records, entitlements, and status.
- Domain-specific stores own accessibility, settings, audio ambience, and other features.
