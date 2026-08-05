import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type EasProfile = {
  channel?: string;
  distribution?: string;
  developmentClient?: boolean;
  env?: Record<string, string>;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
};

type EasConfig = {
  cli?: Record<string, unknown>;
  build?: Record<string, EasProfile>;
  submit?: Record<string, unknown>;
};

const easPath = resolve(__dirname, '../../eas.json');

function loadEasConfig(): EasConfig {
  const raw = readFileSync(easPath, 'utf8');
  return JSON.parse(raw) as EasConfig;
}

describe('eas.json', () => {
  it('is valid JSON', () => {
    const raw = readFileSync(easPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('has cli, build, and submit top-level keys', () => {
    const cfg = loadEasConfig();
    expect(cfg.cli).toBeDefined();
    expect(cfg.build).toBeDefined();
    expect(cfg.submit).toBeDefined();
  });

  it('has development, preview, and production profiles', () => {
    const cfg = loadEasConfig();
    const profiles = Object.keys(cfg.build ?? {});
    expect(profiles).toContain('development');
    expect(profiles).toContain('preview');
    expect(profiles).toContain('production');
  });

  it('each profile has a channel and distribution', () => {
    const cfg = loadEasConfig();
    const build = cfg.build ?? {};
    for (const name of ['development', 'preview', 'production'] as const) {
      const profile = build[name];
      expect(profile).toBeDefined();
      expect(profile?.channel).toBe(name);
      expect(profile?.distribution).toBeDefined();
    }
  });

  it('each profile exposes required EXPO_PUBLIC_* env vars', () => {
    const cfg = loadEasConfig();
    const build = cfg.build ?? {};
    const required = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SENTRY_DSN', 'EXPO_PUBLIC_ANALYTICS_KEY'];
    for (const name of ['development', 'preview', 'production'] as const) {
      const env = build[name]?.env ?? {};
      for (const key of required) {
        expect(env).toHaveProperty(key);
        expect(typeof env[key]).toBe('string');
        expect((env[key] as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('production profile targets the store', () => {
    const cfg = loadEasConfig();
    expect(cfg.build?.production?.distribution).toBe('store');
    expect(cfg.build?.production?.android?.buildType).toBe('app-bundle');
  });

  it('preview profile uses internal distribution', () => {
    const cfg = loadEasConfig();
    expect(cfg.build?.preview?.distribution).toBe('internal');
    expect(cfg.build?.preview?.android?.buildType).toBe('apk');
  });

  it('development profile enables the dev client', () => {
    const cfg = loadEasConfig();
    expect(cfg.build?.development?.developmentClient).toBe(true);
  });

  it('submit section has production and preview profiles', () => {
    const cfg = loadEasConfig();
    const submit = cfg.submit ?? {};
    expect(Object.keys(submit)).toContain('production');
    expect(Object.keys(submit)).toContain('preview');
  });

  it('submit profiles reference ios and android keys', () => {
    const cfg = loadEasConfig();
    const submit = cfg.submit ?? {};
    for (const name of ['production', 'preview'] as const) {
      const entry = (submit as Record<string, Record<string, unknown>>)[name];
      expect(entry).toBeDefined();
      expect(entry.ios).toBeDefined();
      expect(entry.android).toBeDefined();
    }
  });
});
