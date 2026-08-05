# Platform Matrix

This document records the **known platform differences** for dead.air, the
contracts the platform-detection layer (`lib/platform/`) enforces, and the
capability surface each platform exposes. Source-of-truth for the matrix
lives in code (`lib/platform/PlatformDetector.ts`); this doc is the
human-readable companion.

## Bridge platform labels

The audio engine bridge (`engine/audio/PlatformBridge.ts`) labels
platforms as a strict two-value space: `'web' | 'native'`.
`PlatformDetector.detectPlatform()` resolves `Platform.OS` (from
`react-native`) into that same space so the bridge factory can match
without translating.

| `Platform.OS` | `BridgePlatform` | `NativePlatform` |
| ------------- | ---------------- | ---------------- |
| `'web'`       | `'web'`          | `'unknown'`      |
| `'ios'`       | `'native'`       | `'ios'`          |
| `'android'`   | `'native'`       | `'android'`      |
| `'windows'`   | `'native'`       | `'windows'`      |
| `'macos'`     | `'native'`       | `'macos'`        |
| anything else | `'native'`       | `'unknown'`      |

The detector caches its result; `__resetPlatformDetectorCache()` is
exported for tests only.

## Capability matrix

`supportsFeature(feature)` returns a boolean predictor — "would this
feature be available on the resolved platform IF the implementation were
wired up". It does NOT probe for package presence. By task constraint,
no new npm dependencies may be introduced by this layer; the predictor
only knows roughly what each platform supports.

| Feature        | web | native | Notes                                                                        |
| -------------- | --- | ------ | ---------------------------------------------------------------------------- |
| `audioContext` | ✓   | ✓      | Web: Web Audio API. Native: would-be `expo-av` (not installed).              |
| `haptics`      | ✗   | ✓      | Web: no haptics API wired. Native: would-be `expo-haptics`.                  |
| `fileSystem`   | ✗   | ✓      | Native: would-be `expo-file-system`.                                         |
| `keepAwake`    | ✗   | ✓      | Native: would-be `expo-keep-awake`.                                          |
| `clipboard`    | ✓   | ✓      | Web: Clipboard API. Native: would-be `expo-clipboard`.                       |
| `share`        | ✓   | ✓      | Web: `navigator.share`. Native: would-be `expo-sharing`.                     |
| `vibration`    | ✗   | ✓      | Native: `Vibration` API on supported devices.                                |
| `blurBackdrop` | ✓   | ✓      | Web: CSS `backdrop-filter`. Native: would-be `@react-native-community/blur`. |

### Caveats

1. **Predictor only.** Every `true` here is "available IF wired up".
   Until the relevant module is installed, calling code MUST treat these
   results as advisory — combine with `PlatformBridge.platform` and any
   import-guard before touching the underlying API.

2. **No probes.** We deliberately do not import `expo-haptics` etc to
   test presence at runtime. Probe-by-import couples the detector to
   every implementation's import side-effects; the predictor pattern keeps
   the detector side-effect free and safe to call from any environment,
   including tests.

3. **Conservative unknowns.** When the OS is unknown, native features
   stay enabled only because the detector still labels the platform
   `'native'`. Replace with a narrower rule if real-world behavior
   differs; document the change here.

## Smoke tests

`lib/platform/PlatformSmokeTest.ts` exports a canonical set of assertions
exercised from three surfaces:

1. `__tests__/platform/smoke.test.ts` — Jest gate (CI)
2. `scripts/smoke-test.sh` — Web export gate (in-browser)
3. Ad hoc device scripts

Currently active smoke tests:

- `platform-descriptor-shape` — descriptor fields are correct primitive types
- `bridge-platform-label-is-canonical` — bridge label is `'web' | 'native'`
- `feature-matrix-has-all-tags` — `detectFeatures()` returns all 8 tags
- `feature-matrix-platform-is-canonical` — `supportsFeature` returns boolean for every tag
- `isweb-isnative-are-exclusive` — `isWeb(d) !== isNative(d)`
- `no-platform-feature-mutates-detector-cache` — feature queries do not invalidate the cached descriptor
- `detector-is-idempotent` — `detectPlatform() === detectPlatform()`

Tests that require Jest machinery (`jest.isolateModules`, etc.) live
exclusively in the jest file, never in `lib/platform/`.

## Test-runtime detection

`detectPlatform()` sets `isTest` to `true` when:

- `process.env.JEST_WORKER_ID` is a non-empty string (most reliable), OR
- `__DEV__` is `false` (jest-expo sets `__DEV__ = false`), OR
- `__DEV__` is undefined (no React Native runtime mounted)

Real devices have `__DEV__ === true` and no `JEST_WORKER_ID`, so
`isTest === false` there. Production builds also drop `__DEV__` to
`false`; they are distinguished from tests by the
`JEST_WORKER_ID` check first.

## Known platform-specific quirks

### `Platform.Version` under Jest

`@react-native/jest-preset` mocks `Platform.OS` but does NOT always
populate `Platform.Version`. The detector reads `Version` defensively;
under Jest, `descriptor.version === ''`.

### `react-native` import under jest-expo

`jest.mock('react-native', ...)` is required in tests that touch
platform code, because the jest-expo preset stubs the module so
aggressively that `Platform` itself comes back `undefined`. See
`__tests__/platform/smoke.test.ts` for the canonical mock.

### `@sentry/react-native` not installed

`lib/errorTracking.ts` imports `@sentry/react-native`, which is not
in `package.json`. `tsc --noEmit` reports this; `tsconfig.json`
excludes `__tests__/` from type-checking, so the test file that
`jest.mock`s the package fails at jestRESOLVE time, not at compile
time. Pre-existing failure unrelated to platform detection; tracked
separately.

## Adding a new capability tag

1. Extend `PlatformFeature` in `lib/platform/PlatformDetector.ts`.
2. Add the tag to the `FEATURE_MATRIX` rows for `web` and `native`.
3. Add the tag to the `FEATURES` array in
   `lib/platform/PlatformSmokeTest.ts`.
4. Add a row to the capability matrix table above.
5. If the tag is consumed outside `lib/platform/`, add a smoke test
   that exercises `supportsFeature(newTag)` end-to-end.

## Adding a new smoke test

1. Add the name to `SmokeTest` in `lib/platform/PlatformSmokeTest.ts`.
2. Add a matching `record(...)` block to `runSmokeTests`.
3. Update the smoke-test list above.
4. If the test needs `jest.isolateModules` or similar Jest machinery,
   add it to `__tests__/platform/smoke.test.ts` instead — keep
   `lib/platform/` Jest-free.
