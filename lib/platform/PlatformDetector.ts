// lib/platform/PlatformDetector.ts
// Platform detection + capability checks for dead.air.
//
// Dead.air targets two surfaces: web (Expo web export, browser AudioContext)
// and native (iOS / Android via Expo SDK 56). The PlatformBridge contract
// in `engine/audio/PlatformBridge.ts` labels those `'web' | 'native'`; this
// module narrows `Platform.OS` (from react-native) into the same two-value
// space so the bridge factory can pick the right implementation.
//
// Capability checks are PREDICTORS based on `Platform.OS` only. They do NOT
// probe for package presence — `expo-haptics`, `expo-av`, and friends are not
// installed in this repo, and task constraints forbid new npm dependencies.
// Each check answers:
//   "Would this feature be available IF the implementation wired it up?",
// not:
//   "Is this implementation wired up right now?"
//
// This makes the detector safe to use from any environment, including tests
// that lack the underlying native module or AudioContext polyfill.

import { Platform } from 'react-native';

/**
 * Bridge-facing platform label. Matches `PlatformBridge.platform` exactly
 * so the audio-engine bridge factory can match without translating.
 */
export type BridgePlatform = 'web' | 'native';

/**
 * Coarse native platform identifier. `'unknown'` covers the never-shipped
 * cases (e.g. visionOS, macos under catalyst) so callees can fall back to
 * safe defaults without runtime crashes.
 */
export type NativePlatform = 'ios' | 'android' | 'windows' | 'macos' | 'unknown';

/**
 * Feature tags supported by the detector. Keep this list narrow: every new
 * tag is an additional capability axis the bridge + UI will branch on, and
 * any tag added here must be documented in `docs/platform-matrix.md` before
 * it is consumed anywhere outside the detector.
 */
export type PlatformFeature =
  | 'audioContext'
  | 'haptics'
  | 'fileSystem'
  | 'keepAwake'
  | 'clipboard'
  | 'share'
  | 'vibration'
  | 'blurBackdrop';

/**
 * Resolved platform descriptor. Captures all the dimensions the rest of
 * the app needs to make a single platform decision, without forcing every
 * call site to import `Platform` from react-native directly.
 */
export interface PlatformDescriptor {
  /** Bridge label used by the audio bridge factory. */
  readonly platform: BridgePlatform;
  /** Native OS, only meaningful when `platform === 'native'`. */
  readonly native: NativePlatform;
  /** Operating-system version string if available; `''` if unknown. */
  readonly version: string;
  /** Whether the runtime is currently running inside a Jest test. */
  readonly isTest: boolean;
}

const NATIVE_OS_MAP: Readonly<Record<string, NativePlatform>> = {
  ios: 'ios',
  android: 'android',
  windows: 'windows',
  macos: 'macos',
  web: 'unknown', // web is not a native platform
};

const detectNativePlatform = (os: string | undefined): NativePlatform => {
  if (!os) return 'unknown';
  return NATIVE_OS_MAP[os] ?? 'unknown';
};

/**
 * Resolve a `PlatformDescriptor` from the live react-native `Platform`.
 * Lazy-cached — the host platform does not change at runtime.
 */
let cached: PlatformDescriptor | null = null;

export const detectPlatform = (): PlatformDescriptor => {
  if (cached) return cached;

  const os: string | undefined = Platform.OS;
  // `Platform.Version` may be undefined under jest-expo (the RN jest-preset
  // mocks Platform.OS but does not always populate Version). Read defensively.
  const rawVersion: string | number | undefined | null = (
    Platform as { Version?: string | number | null }
  ).Version;
  const version: string =
    typeof rawVersion === 'string' ? rawVersion : rawVersion != null ? String(rawVersion) : '';
  // Under the jest-expo preset, `__DEV__` exists (often set to `false`) and
  // `JEST_WORKER_ID` is set. On real devices, `__DEV__ === true` is the
  // default and `JEST_WORKER_ID` is absent. We check `JEST_WORKER_ID`
  // first since it is the most reliable signal, then fall back to
  // `__DEV__ === false` (a secondary hint — production builds also set it).
  const g = globalThis as { __DEV__?: unknown };
  const jestWorkerId = (process as { env?: { JEST_WORKER_ID?: string } }).env?.JEST_WORKER_ID;
  const isTest =
    typeof jestWorkerId === 'string' && jestWorkerId.length > 0
      ? true
      : typeof g.__DEV__ === 'boolean'
        ? g.__DEV__ === false
        : true; // unknown environment — assume test for safety

  const platform: BridgePlatform = os === 'web' ? 'web' : 'native';
  const native = platform === 'web' ? 'unknown' : detectNativePlatform(os);

  cached = Object.freeze({ platform, native, version, isTest });
  return cached;
};

/**
 * Reset the detector cache. Only for tests; never call from app code.
 */
export const __resetPlatformDetectorCache = (): void => {
  cached = null;
};

/**
 * Capability predictor table. Boolean = "would this be available on this
 * platform if the implementation were wired up". Defaults are conservative:
 * when uncertain, return `false` and document the gap in
 * `docs/platform-matrix.md`.
 */
const FEATURE_MATRIX: Readonly<Record<BridgePlatform, Partial<Record<PlatformFeature, boolean>>>> =
  Object.freeze({
    web: Object.freeze({
      audioContext: true, // Web Audio API on a modern browser
      haptics: false, // web has no haptics API wired
      fileSystem: false, // no FS abstraction on web export
      keepAwake: false, // expo-keep-awake not installed; web falls back
      clipboard: true, // browser Clipboard API
      share: true, // navigator.share on most browsers
      vibration: false, // navigator.vibrate deprecated/unreliable; treat off
      blurBackdrop: true, // CSS backdrop-filter
    }),
    native: Object.freeze({
      audioContext: true, // expo-av path (not installed yet)
      haptics: true, // expo-haptics path (not installed yet)
      fileSystem: true, // expo-file-system path (not installed yet)
      keepAwake: true, // expo-keep-awake path (not installed yet)
      clipboard: true, // expo-clipboard path (not installed yet)
      share: true, // expo-sharing path (not installed yet)
      vibration: true, // React Native Vibration API on supported native
      blurBackdrop: true, // @react-native-community/blur (not installed)
    }),
  });

/**
 * Predict whether a `PlatformFeature` would be available on the resolved
 * platform. Does NOT probe for package presence — see file header.
 *
 * @param feature Feature tag to probe.
 * @param descriptor Optional pre-resolved descriptor; defaults to `detectPlatform()`.
 */
export const supportsFeature = (
  feature: PlatformFeature,
  descriptor: PlatformDescriptor = detectPlatform(),
): boolean => {
  const row = FEATURE_MATRIX[descriptor.platform];
  return row[feature] === true;
};

/**
 * Predict all capabilities at once. Useful for engine bootstrap logs and
 * for the smoke-test harness to assert every tag is reachable.
 */
export const detectFeatures = (
  descriptor: PlatformDescriptor = detectPlatform(),
): Readonly<Record<PlatformFeature, boolean>> => {
  const row = FEATURE_MATRIX[descriptor.platform];
  const labels: readonly PlatformFeature[] = [
    'audioContext',
    'haptics',
    'fileSystem',
    'keepAwake',
    'clipboard',
    'share',
    'vibration',
    'blurBackdrop',
  ];
  const out = labels.reduce<Record<PlatformFeature, boolean>>(
    (acc, label) => {
      acc[label] = row[label] === true;
      return acc;
    },
    {} as Record<PlatformFeature, boolean>,
  );
  return Object.freeze(out);
};

/**
 * Convenience: `true` when running on the bridge's `web` platform.
 */
export const isWeb = (descriptor: PlatformDescriptor = detectPlatform()): boolean =>
  descriptor.platform === 'web';

/**
 * Convenience: `true` when running on the bridge's `native` platform.
 */
export const isNative = (descriptor: PlatformDescriptor = detectPlatform()): boolean =>
  descriptor.platform === 'native';

/**
 * Convenience: `true` when running in a Jest test environment.
 *
 * Heuristic: `__DEV__` is undefined under jest-expo, while it is defined
 * (typically `true`) under real React Native runtimes. We additionally
 * surface the cached flag from `detectPlatform` so tests that stub
 * `Platform.OS` via `jest.resetModules` still see a consistent answer.
 */
export const isTestRuntime = (descriptor: PlatformDescriptor = detectPlatform()): boolean =>
  descriptor.isTest;
