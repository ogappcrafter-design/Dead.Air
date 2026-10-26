// tests/lib/community/featureFlag.test.ts
// DEA-95 Phase 1 — community feature flag (client + server).

import {
  COMMUNITY_CLIENT_FLAG_ENV,
  isCommunityEnabled,
  parseCommunityFlag,
} from '@/lib/community/featureFlag';
import { isCommunityEnabled as isServerCommunityEnabled } from '@/worker/community/feature_flag';

describe('parseCommunityFlag', () => {
  it.each(['on', 'ON', ' on '])('treats %p as enabled', (value) => {
    expect(parseCommunityFlag(value)).toBe(true);
  });

  it.each([
    'off',
    'false',
    '0',
    'no',
    'disabled',
    '',
    'maybe',
    '   ',
    'true',
    '1',
    'yes',
    'enabled',
  ])('treats %p as disabled', (value) => {
    expect(parseCommunityFlag(value)).toBe(false);
  });

  it('fails closed for missing values', () => {
    expect(parseCommunityFlag(undefined)).toBe(false);
    expect(parseCommunityFlag(null)).toBe(false);
  });
});

describe('client flag', () => {
  const original = process.env[COMMUNITY_CLIENT_FLAG_ENV];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[COMMUNITY_CLIENT_FLAG_ENV];
    } else {
      process.env[COMMUNITY_CLIENT_FLAG_ENV] = original;
    }
  });

  it('is off when the build flag is absent', () => {
    delete process.env[COMMUNITY_CLIENT_FLAG_ENV];
    expect(isCommunityEnabled()).toBe(false);
  });

  it('is off when the build flag is "off"', () => {
    process.env[COMMUNITY_CLIENT_FLAG_ENV] = 'off';
    expect(isCommunityEnabled()).toBe(false);
  });

  it('is on only for an explicit enabling value', () => {
    process.env[COMMUNITY_CLIENT_FLAG_ENV] = 'on';
    expect(isCommunityEnabled()).toBe(true);
  });
});

describe('server flag', () => {
  it('defaults to off when the Worker var is absent', () => {
    expect(isServerCommunityEnabled({})).toBe(false);
  });

  it('stays off for the committed "off" value', () => {
    expect(isServerCommunityEnabled({ COMMUNITY_ENABLED: 'off' })).toBe(false);
  });

  it.each(['true', '1', 'yes', 'enabled'])('keeps the server off for %p', (value) => {
    expect(isServerCommunityEnabled({ COMMUNITY_ENABLED: value })).toBe(false);
  });

  it('turns on only for an explicit enabling value', () => {
    expect(isServerCommunityEnabled({ COMMUNITY_ENABLED: 'on' })).toBe(true);
  });
});
