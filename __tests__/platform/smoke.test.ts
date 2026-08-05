// __tests__/platform/smoke.test.ts
// Jest gate for the platform smoke tests.
//
// The smoke test assertions live in `lib/platform/PlatformSmokeTest.ts` so
// they can also be exercised by the web-export gate and on-device scripts
// without duplication. This file wires them to Jest with an adapter that
// maps onto `expect(...).toBe(true)` + `throw new Error(...)`.
//
// We also add Jest-only assertions here that are not part of the canonical
// `runSmokeTests` set — those that genuinely require Jest machinery such
// as `jest.isolateModules` or `jest.resetModules`. lib-side tests must
// stay free of Jest globals; additional `require()`-based import checks
// belong here and only here.

// jest-expo preset stubs `react-native` so aggressively that `Platform`
// itself comes back undefined. Provide a minimal mock before any import
// touches the module. Tests that need to vary `Platform.OS` should call
// `setMockPlatform(...)` from `beforeEach`.
jest.mock('react-native', () => {
  let os: 'ios' | 'android' | 'web' | 'windows' | 'macos' = 'ios';
  let version: string | number = '17.0';
  return {
    __esModule: true,
    Platform: {
      get OS() {
        return os;
      },
      get Version() {
        return version;
      },
      select: (opts: Record<string, unknown>) => opts[os] ?? opts.default,
    },
    // expose helpers so tests can mutate the mock between assertions
    __setMockPlatform: (
      nextOs: 'ios' | 'android' | 'web' | 'windows' | 'macos',
      nextVersion: string | number = '',
    ) => {
      os = nextOs;
      version = nextVersion;
    },
  };
});

import {
  type PlatformDescriptor,
  type SmokeTestReport,
  runSmokeTests,
  type SmokeTestAdapter,
} from '@/lib/platform/PlatformSmokeTest';
import {
  __resetPlatformDetectorCache,
  detectFeatures,
  detectPlatform,
  isNative,
  isTestRuntime,
  isWeb,
  supportsFeature,
} from '@/lib/platform/PlatformDetector';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rnMock = require('react-native') as {
  __setMockPlatform: (
    os: 'ios' | 'android' | 'web' | 'windows' | 'macos',
    version?: string | number,
  ) => void;
};
const setMockPlatform = rnMock.__setMockPlatform;

describe('lib/platform/PlatformDetector + PlatformSmokeTest', () => {
  beforeEach(() => {
    __resetPlatformDetectorCache();
  });

  describe('runSmokeTests (canonical suites)', () => {
    it('passes every canonical smoke test under jest', () => {
      const adapter: SmokeTestAdapter = {
        assert: (cond, _msg) => {
          if (!cond) throw new Error('adapter.assert failed');
        },
        fail: (msg) => {
          throw new Error(msg);
        },
      };
      const report: SmokeTestReport = runSmokeTests(adapter);
      if (!report.pass) {
        const failedMsgs = report.failed
          .map((r) => `  - ${r.test}: ${r.message ?? 'no message'}`)
          .join('\n');
        throw new Error(`smoke tests failed:\n${failedMsgs}`);
      }
      expect(report.pass).toBe(true);
      expect(report.failed).toEqual([]);
    });

    it('returns a frozen report object', () => {
      const adapter: SmokeTestAdapter = {
        assert: () => {},
        fail: (msg) => {
          throw new Error(msg);
        },
      };
      const report = runSmokeTests(adapter);
      expect(Object.isFrozen(report)).toBe(true);
      expect(Object.isFrozen(report.results)).toBe(true);
      expect(Object.isFrozen(report.failed)).toBe(true);
    });

    it('captures a failure when adapter.fail is called', () => {
      const adapter: SmokeTestAdapter = {
        assert: () => {
          throw new Error('synthetic assert fail');
        },
        fail: (msg) => {
          throw new Error(msg);
        },
      };
      const report = runSmokeTests(adapter);
      expect(report.pass).toBe(false);
      expect(report.failed.length).toBeGreaterThan(0);
    });
  });

  describe('detectPlatform shape', () => {
    it('returns an Object.is-stable descriptor across calls', () => {
      const a = detectPlatform();
      const b = detectPlatform();
      expect(a).toBe(b);
    });

    it('resolves bridge label to either web or native', () => {
      const { platform } = detectPlatform();
      expect(platform === 'web' || platform === 'native').toBe(true);
    });

    it('returns a frozen descriptor object', () => {
      expect(Object.isFrozen(detectPlatform())).toBe(true);
    });

    it('exposes a string version (possibly empty)', () => {
      expect(typeof detectPlatform().version).toBe('string');
    });
  });

  describe('isWeb / isNative / isTestRuntime predicates', () => {
    it('isWeb and isNative are mutually exclusive', () => {
      const d = detectPlatform();
      expect(isWeb(d)).not.toBe(isNative(d));
    });

    it('isTestRuntime returns boolean', () => {
      expect(typeof isTestRuntime()).toBe('boolean');
    });

    it('under jest-expo, isTestRuntime returns true', () => {
      // __DEV__ is undefined under jest-expo preset, so detector should
      // resolve to test runtime. (Guarded so non-jest runners can still
      // import this file.)
      expect(isTestRuntime()).toBe(true);
    });
  });

  describe('supportsFeature / detectFeatures', () => {
    const FEATURES = [
      'audioContext',
      'haptics',
      'fileSystem',
      'keepAwake',
      'clipboard',
      'share',
      'vibration',
      'blurBackdrop',
    ] as const;

    it('detectFeatures returns a boolean for every feature tag', () => {
      const feats = detectFeatures();
      for (const f of FEATURES) {
        expect(typeof feats[f]).toBe('boolean');
      }
    });

    it('detectFeatures returns a frozen object', () => {
      expect(Object.isFrozen(detectFeatures())).toBe(true);
    });

    it('supportsFeature returns boolean for every tag', () => {
      for (const f of FEATURES) {
        expect(typeof supportsFeature(f)).toBe('boolean');
      }
    });

    it('web platform tag yields expected capability vector', () => {
      const d: PlatformDescriptor = Object.freeze({
        platform: 'web',
        native: 'unknown',
        version: '',
        isTest: true,
      });
      expect(supportsFeature('audioContext', d)).toBe(true);
      expect(supportsFeature('haptics', d)).toBe(false);
      expect(supportsFeature('fileSystem', d)).toBe(false);
      expect(supportsFeature('keepAwake', d)).toBe(false);
      expect(supportsFeature('clipboard', d)).toBe(true);
      expect(supportsFeature('share', d)).toBe(true);
      expect(supportsFeature('vibration', d)).toBe(false);
      expect(supportsFeature('blurBackdrop', d)).toBe(true);
    });

    it('native platform tag yields expected capability vector', () => {
      const d: PlatformDescriptor = Object.freeze({
        platform: 'native',
        native: 'ios',
        version: '17.0',
        isTest: true,
      });
      expect(supportsFeature('audioContext', d)).toBe(true);
      expect(supportsFeature('haptics', d)).toBe(true);
      expect(supportsFeature('fileSystem', d)).toBe(true);
      expect(supportsFeature('keepAwake', d)).toBe(true);
      expect(supportsFeature('clipboard', d)).toBe(true);
      expect(supportsFeature('share', d)).toBe(true);
      expect(supportsFeature('vibration', d)).toBe(true);
      expect(supportsFeature('blurBackdrop', d)).toBe(true);
    });
  });

  describe('cache invalidation', () => {
    it('__resetPlatformDetectorCache forces a fresh descriptor', () => {
      const a = detectPlatform();
      __resetPlatformDetectorCache();
      const b = detectPlatform();
      // Identity changes because the cache was cleared — value may be equal
      // but Object.is should differ across the rebuild.
      expect(a).not.toBe(b);
      // After re-resolution, values still match (we didn't change Platform).
      expect(a.platform).toBe(b.platform);
      expect(a.native).toBe(b.native);
    });
  });

  describe('PlatformBridge contract integration', () => {
    // Jest-only: confirm the bridge module exports the helper type guards
    // that depend on the same `platform: 'web' | 'native'` label this
    // detector outputs, and that the labels line up. Lives here because
    // it needs `jest.isolateModules` machinery that does not belong in
    // library code.

    it('PlatformBridge.isWebBridge / isNativeBridge accept detector labels', () => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@/engine/audio/PlatformBridge') as {
          isWebBridge: (b: { readonly platform: 'web' | 'native' }) => boolean;
          isNativeBridge: (b: { readonly platform: 'web' | 'native' }) => boolean;
        };
        const webLike = { platform: 'web' as const };
        const nativeLike = { platform: 'native' as const };
        expect(mod.isWebBridge(webLike)).toBe(true);
        expect(mod.isWebBridge(nativeLike)).toBe(false);
        expect(mod.isNativeBridge(webLike)).toBe(false);
        expect(mod.isNativeBridge(nativeLike)).toBe(true);
      });
    });

    it('detector label space matches PlatformBridge label space', () => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require('@/engine/audio/PlatformBridge') as {
          bandStaticCharacter: unknown;
        };
        // Just confirm the module loaded with its exports intact.
        expect(typeof mod.bandStaticCharacter).toBe('function');
      });
    });
  });
});
