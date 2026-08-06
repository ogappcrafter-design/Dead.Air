# Playtest Bug Catalog — P6-9

Static analysis + flow verification on branch `fm/deadair-p6-9`.

## Initial baseline (before any fixes)

- `npx tsc --noEmit`: **4 errors**, all in `lib/errorTracking.ts`
  - `TS2307: Cannot find module '@sentry/react-native'` (line 1)
  - `TS7006: Parameter 'event' implicitly has an 'any' type` (line 62)
  - `TS7006: Parameter 'scope' implicitly has an 'any' type` (line 76)
  - `TS7006: Parameter 'scope' implicitly has an 'any' type` (line 102)
- `npx jest --forceExit`: **1 of 35 suites failed** (570/580 tests passing)
  - `__tests__/lib/errorTracking.test.ts` — `Cannot find module '@sentry/react-native'` at `jest.mock('@sentry/react-native')`

**Root cause (single):** `@sentry/react-native@7.11.0` declared in `package.json` but missing from `node_modules/`. The 3 TS7006 errors were downstream of the missing module type declarations; the failing test suite was the jest mock of the same missing module.

**Resolution:** `pnpm install --frozen-lockfile` wrote the missing entry to `node_modules/.modules.yaml` and created the `@sentry/react-native` symlink. After install:

- `npx tsc --noEmit` → `No errors found`
- `npx jest --forceExit` → `Test Suites: 35 passed, 35 total. Tests: 580 passed, 580 total.`

No source edits were required for the baseline — the dependency installation was the entire fix.

(Note: the task hint mentioned ~8 TS errors across five files; only 4 actually existed, all in `errorTracking.ts`. The other four files were clean.)

## Runtime / flow bugs

### BUG-1 — Settings UI does not expose all store-backed toggles

- **Severity:** P1
- **Where:** `app/settings/index.tsx`
- **Symptom:** Store (`store/useSettingsStore.ts`) exposes `masterVolume`, `sfxVolume`, `musicVolume`, `voiceVolume`, `staticEnabled`, `autoSave`, `callFrequency`, `difficulty`, `cloudSyncEnabled`, `scanlineIntensity`, plus CRT and reduced-motion. The Settings UI only renders controls for CRT (enable + intensity stepper) and reduced motion. The other ~9 settings are unreachable from the UI.
- **Task baseline:** "Settings screen → all toggles work (CRT, volume, SFX, analytics)."
- **Fix:** Add Audio, Static, Gameplay, and Analytics sections to the Settings screen. Each control binds to the existing store action; no new state needed.

### BUG-2 — `ActiveCallDispatcher` violates the Rules of Hooks (P0, crash)

- **Severity:** P0
- **Where:** `components/calls/ActiveCallDispatcher.tsx:27-30`
- **Symptom:** A `useCallback` is declared on line 30, **after** the early return on line 27 (`if (!route || !activeCall) return null;`). The component has 3 hooks above the early return (`useSanityEffect`, `useState`, `useState`, `useEffect`) but only invokes the 4th `useCallback` when the `if` branch is not taken. The first time `route` flips from `null` to a real route (or vice versa), React detects a different hook count between renders and throws `"Rendered fewer hooks than expected. This may be caused by an accidental early return statement."` — crashing the entire radio screen with no recovery beyond app restart.
- **Repro:** Start the app, trigger any incoming call (route flips `null → JUST_LISTEN`), then end the call (route flips `JUST_LISTEN → null`). The second transition throws.
- **Fix:** Move `onComplete` (or its equivalent) above the early return, so the hook ordering is constant across every render.

### BUG-3 — Radio screen has no navigation entry to Tapes / Store / Settings

- **Severity:** P1
- **Where:** `app/radio/index.tsx`, `components/radio/RadioBody.tsx`
- **Symptom:** The Stack navigator (`app/_layout.tsx`) declares `index`, `radio`, `tapes`, `store`, `settings` screens, and `tapes`/`store`/`settings` each render a `‹ BACK` button that calls `router.back()`. But the radio screen itself renders only the radio hardware (frequency, dial, band selector, signal). There is no button or affordance on the radio screen to navigate forward to `/tapes`, `/store`, or `/settings`. A user launching the app lands on splash → /radio and has no in-app path to those three screens. They are reachable only via a deep-link or by dev-time URL manipulation.
- **Task baseline:** "Walk through game flows and verify each works: Splash → Radio, Settings → all toggles work, Tapes → collected tapes, Store → IAP, Call flow → tuning → incoming call → active call."
- **Fix:** Add a nav row (or footer buttons) on the radio screen with `router.push('/tapes')`, `router.push('/store')`, `router.push('/settings')`. Buttons must be accessible (testIDs + accessibility labels).

## Verification protocol

- Static analysis: `npx tsc --noEmit`
- Tests: `npx jest --forceExit` (use `npx jest` directly; the `rtk jest` wrapper auto-runs `pnpm install` first and fails on `ERR_PNPM_IGNORED_BUILDS` for `@sentry/cli@2.58.4`)
- Flow walkthrough: read every screen + every store + every component in the call dispatch path
- Hooks rule scan: grep + manual line-by-line of all .tsx in `components/` and `app/` for hooks called after early returns
