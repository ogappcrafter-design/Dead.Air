import {
  initErrorTracking,
  isSentryEnabled,
  reportBug,
  captureException,
  _resetErrorTrackingForTests,
} from '../../lib/errorTracking';
import { useGameStore } from '../../store/useGameStore';

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  withScope: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
}));

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

declare const __DEV__: boolean;

describe('errorTracking', () => {
  const originalDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetErrorTrackingForTests();
    useGameStore.setState({
      sanity: 100,
      static: 0,
      tapes: [],
      unlockedBands: ['LIVING'],
      isPlaying: false,
      currentCall: null,
      receivedCalls: [],
      sanityLowest: 100,
      shiftsCompleted: 0,
      longestCallSurvivedMs: 0,
    });
  });

  afterAll(() => {
    if (originalDsn === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = originalDsn;
    }
  });

  it('no-ops when DSN env is missing', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    expect(initErrorTracking()).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('no-ops when DSN env is empty', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '   ';
    expect(initErrorTracking()).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry when DSN is present', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    expect(initErrorTracking()).toBe(true);
    expect(isSentryEnabled()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://abc@sentry.example/1',
        release: '1.0.0',
      }),
    );
  });

  it('uses "unknown" release when expoConfig.version missing', () => {
    const original = Constants.expoConfig;
    (Constants as { expoConfig: unknown }).expoConfig = undefined;
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    try {
      initErrorTracking();
      expect(Sentry.init).toHaveBeenCalledWith(expect.objectContaining({ release: 'unknown' }));
    } finally {
      (Constants as { expoConfig: unknown }).expoConfig = original;
    }
  });

  it('returns true without re-initializing when already enabled', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    initErrorTracking();
    (Sentry.init as jest.Mock).mockClear();
    expect(initErrorTracking()).toBe(true);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('reportBug no-ops when Sentry disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    reportBug('help');
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('reportBug captures message with game context when enabled', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    initErrorTracking();
    (Sentry.withScope as jest.Mock).mockImplementation((cb: (s: unknown) => void) => {
      cb({
        setContext: jest.fn(),
        setTags: jest.fn(),
        setExtras: jest.fn(),
      });
    });
    reportBug('radio froze', { source: 'manual' });
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('radio froze', 'error');
  });

  it('captureException no-ops when Sentry disabled', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    captureException(new Error('x'));
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captureException reports error with extras when enabled', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    initErrorTracking();
    const err = new Error('boom');
    (Sentry.withScope as jest.Mock).mockImplementation((cb: (s: unknown) => void) => {
      cb({ setExtras: jest.fn(), setContext: jest.fn() });
    });
    captureException(err, { componentStack: 'at X' });
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
  });

  it('beforeSend attaches game state tags to event', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc@sentry.example/1';
    useGameStore.setState({
      sanity: 42,
      static: 7,
      tapes: [],
      unlockedBands: ['LIVING'],
      isPlaying: true,
      currentCall: null,
      receivedCalls: [],
      sanityLowest: 38,
      shiftsCompleted: 3,
      longestCallSurvivedMs: 12000,
    });
    initErrorTracking();
    const initCall = (Sentry.init as jest.Mock).mock.calls[0]?.[0] as
      | {
          beforeSend?: (e: { tags?: Record<string, unknown> }) => unknown;
        }
      | undefined;
    expect(initCall?.beforeSend).toBeDefined();
    const event = { tags: undefined };
    const result = initCall!.beforeSend!(event as never) as { tags: Record<string, unknown> };
    expect(result.tags).toMatchObject({
      sanity: 42,
      sanityLowest: 38,
      static: 7,
      isPlaying: true,
      shiftsCompleted: 3,
      longestCallSurvivedMs: 12000,
    });
  });
});
