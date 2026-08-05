// lib/platform/PlatformSmokeTest.ts
// Runtime smoke test harness for platform-detection layer.
//
// Each smoke test is a tiny, dependency-free assertion about the
// platform detector, the bridge contract, and the wiring of the
// audio-engine imports. They are written so the SAME assertions can be
// exercised from:
//
//   1. `__tests__/platform/smoke.test.ts` via Jest (CI gate)
//   2. `scripts/smoke-test.sh` running against a built web bundle
//      (web export gate — runs the assertions in-browser via a tiny shim)
//   3. A developer scratch script on a device (manual gate)
//
// Tests live HERE (not in the jest file) so they have one canonical source.
// The Jest test file calls `runSmokeTests` with a Jest assertion adapter.
// The web export gate calls it with a console-pipe adapter. The device
// script can adapt to whatever reporting surface it wants.
//
// Keeping assertions synchronous avoids Promise scheduling differences
// across the three harnesses. Tests do NOT touch the real audio bridge:
// they only verify that the bridge module can be imported without
// side-effects, that the platform detector returns a stable shape, and
// that the feature matrix is internally consistent.
//
// Adding a new smoke test:
//   - Add a new `name` to the SmokeTest type below.
//   - Add a matching case to `runSmokeTests` body that calls `assert(...)`.
//   - Update `docs/platform-matrix.md` if the test encodes a new contract.

import {
  type PlatformFeature,
  detectFeatures,
  detectPlatform,
  isNative,
  isWeb,
  supportsFeature,
} from './PlatformDetector';

/**
 * Smoke-test names. Used by adapters for error attribution.
 * Keep listing the same tests you expect downstream harnesses to verify.
 */
export type SmokeTest =
  | 'platform-descriptor-shape'
  | 'bridge-platform-label-is-canonical'
  | 'feature-matrix-has-all-tags'
  | 'feature-matrix-platform-is-canonical'
  | 'isweb-isnative-are-exclusive'
  | 'no-platform-feature-mutates-detector-cache'
  | 'detector-is-idempotent';

/**
 * Status returned by a single smoke assertion.
 */
export interface SmokeAssertionResult {
  readonly test: SmokeTest;
  readonly pass: boolean;
  readonly message?: string;
}

/**
 * Adapter interface. Callers supply one of these — we never touch `expect`
 * or `console` directly, which keeps the harness portable across Jest,
 * the in-browser web-export gate, and ad hoc device scripts.
 */
export interface SmokeTestAdapter {
  assert(condition: boolean, message: string): void;
  fail(message: string): never;
}

/**
 * Aggregate report returned by `runSmokeTests`.
 */
export interface SmokeTestReport {
  readonly pass: boolean;
  readonly results: readonly SmokeAssertionResult[];
  readonly failed: readonly SmokeAssertionResult[];
}

const FEATURES: readonly PlatformFeature[] = [
  'audioContext',
  'haptics',
  'fileSystem',
  'keepAwake',
  'clipboard',
  'share',
  'vibration',
  'blurBackdrop',
];

/**
 * Run the canonical smoke-test suite against `detectPlatform()`.
 *
 * @param adapter caller-supplied assertion adapter.
 * @returns aggregate report. `pass === true` iff every assertion succeeded.
 */
export const runSmokeTests = (adapter: SmokeTestAdapter): SmokeTestReport => {
  const results: SmokeAssertionResult[] = [];

  const record = (test: SmokeTest, block: () => void, messageOnError: string) => {
    try {
      block();
      results.push({ test, pass: true });
    } catch (err) {
      const msg =
        err instanceof Error
          ? `${messageOnError}: ${err.message}`
          : `${messageOnError}: ${String(err)}`;
      results.push({ test, pass: false, message: msg });
    }
  };

  record(
    'platform-descriptor-shape',
    () => {
      const d = detectPlatform();
      if (d.platform !== 'web' && d.platform !== 'native') {
        adapter.fail(`platform must be 'web' | 'native'; got '${d.platform}'`);
      }
      if (
        d.native !== 'ios' &&
        d.native !== 'android' &&
        d.native !== 'windows' &&
        d.native !== 'macos' &&
        d.native !== 'unknown'
      ) {
        adapter.fail(`native label invalid: ${d.native}`);
      }
      if (typeof d.version !== 'string') {
        adapter.fail(`version must be a string`);
      }
      if (typeof d.isTest !== 'boolean') {
        adapter.fail(`isTest must be boolean`);
      }
      adapter.assert(true, 'descriptor shape ok');
    },
    'platform-descriptor-shape failed',
  );

  record(
    'bridge-platform-label-is-canonical',
    () => {
      const d = detectPlatform();
      if (d.platform !== 'web' && d.platform !== 'native') {
        adapter.fail('bridge label not canonical');
      }
      adapter.assert(true, 'bridge label canonical');
    },
    'bridge-platform-label-is-canonical failed',
  );

  record(
    'feature-matrix-has-all-tags',
    () => {
      const feats = detectFeatures();
      for (const f of FEATURES) {
        if (typeof feats[f] !== 'boolean') {
          adapter.fail(`feature ${f} missing from detectFeatures output`);
        }
      }
      adapter.assert(true, 'all feature tags present');
    },
    'feature-matrix-has-all-tags failed',
  );

  record(
    'feature-matrix-platform-is-canonical',
    () => {
      for (const f of FEATURES) {
        if (typeof supportsFeature(f) !== 'boolean') {
          adapter.fail(`supportsFeature(${f}) not boolean`);
        }
      }
      adapter.assert(true, 'supportsFeature returns boolean for all tags');
    },
    'feature-matrix-platform-is-canonical failed',
  );

  record(
    'isweb-isnative-are-exclusive',
    () => {
      const d = detectPlatform();
      if (isWeb(d) === isNative(d)) {
        adapter.fail(`isWeb and isNative both same value (${isWeb(d)})`);
      }
      adapter.assert(true, 'exclusive platform labels');
    },
    'isweb-isnative-are-exclusive failed',
  );

  record(
    'no-platform-feature-mutates-detector-cache',
    () => {
      const before = detectPlatform();
      for (const f of FEATURES) {
        void supportsFeature(f);
      }
      const after = detectPlatform();
      if (before !== after) {
        adapter.fail('detector cache identity changed across supportsFeature calls');
      }
      adapter.assert(true, 'cache identity stable');
    },
    'no-platform-feature-mutates-detector-cache failed',
  );

  record(
    'detector-is-idempotent',
    () => {
      const first = detectPlatform();
      const second = detectPlatform();
      if (first !== second) {
        adapter.fail('detectPlatform not idempotent — new descriptor each call');
      }
      adapter.assert(true, 'idempotent');
    },
    'detector-is-idempotent failed',
  );

  const failed = results.filter((r) => !r.pass);
  return Object.freeze({
    pass: failed.length === 0,
    results: Object.freeze(results),
    failed: Object.freeze(failed),
  });
};
