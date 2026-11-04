// __tests__/engine/audio/capture/MicrophoneCapture.test.ts
// DEA-90 — session-level permission memoization: ask once, never nag.

import {
  __resetMicrophonePermissionCache,
  requestMicrophonePermission,
  type MicrophoneCapture,
  type MicrophonePermission,
} from '@/engine/audio/capture/MicrophoneCapture';

const makeCapture = (
  permission: MicrophonePermission | (() => Promise<MicrophonePermission>),
): MicrophoneCapture => ({
  platform: 'web',
  isAvailable: () => true,
  requestPermission: jest.fn(
    typeof permission === 'function' ? permission : async () => permission,
  ),
  start: async () => true,
  stop: () => {},
});

beforeEach(() => {
  __resetMicrophonePermissionCache();
});

describe('requestMicrophonePermission', () => {
  it('asks once and reuses a grant for the session', async () => {
    const capture = makeCapture('granted');

    await expect(requestMicrophonePermission(capture)).resolves.toBe('granted');
    await expect(requestMicrophonePermission(capture)).resolves.toBe('granted');

    expect(capture.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('remembers a refusal so later calls never prompt again', async () => {
    const capture = makeCapture('denied');

    await expect(requestMicrophonePermission(capture)).resolves.toBe('denied');
    await expect(requestMicrophonePermission(capture)).resolves.toBe('denied');

    expect(capture.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('does not cache "unavailable" — a device can appear later', async () => {
    const capture = makeCapture('unavailable');

    await expect(requestMicrophonePermission(capture)).resolves.toBe('unavailable');
    await expect(requestMicrophonePermission(capture)).resolves.toBe('unavailable');

    expect(capture.requestPermission).toHaveBeenCalledTimes(2);
  });

  it('treats a throwing platform as unavailable without caching it', async () => {
    const capture = makeCapture(async () => {
      throw new Error('platform exploded');
    });

    await expect(requestMicrophonePermission(capture)).resolves.toBe('unavailable');
    await expect(requestMicrophonePermission(capture)).resolves.toBe('unavailable');

    expect(capture.requestPermission).toHaveBeenCalledTimes(2);
  });

  it('shares the cached answer across capture instances', async () => {
    const first = makeCapture('granted');
    const second = makeCapture('denied');

    await expect(requestMicrophonePermission(first)).resolves.toBe('granted');
    await expect(requestMicrophonePermission(second)).resolves.toBe('granted');

    expect(second.requestPermission).not.toHaveBeenCalled();
  });
});
