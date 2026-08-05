import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useGameStore } from '../store/useGameStore';

let sentryEnabled = false;

const SENTRY_DSN_ENV = 'EXPO_PUBLIC_SENTRY_DSN';

function readDsn(): string | undefined {
  const raw = process.env[SENTRY_DSN_ENV];
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function readRelease(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

function attachGameContext(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const state = useGameStore.getState();
  const tags: Record<string, string | number | boolean> = {
    sanity: state.sanity,
    sanityLowest: state.sanityLowest,
    static: state.static,
    isPlaying: state.isPlaying,
    shiftsCompleted: state.shiftsCompleted,
    longestCallSurvivedMs: state.longestCallSurvivedMs,
    unlockedBands: state.unlockedBands.length,
    receivedCalls: state.receivedCalls.length,
    tapes: state.tapes.length,
  };
  if (!event.tags) event.tags = {};
  for (const [key, value] of Object.entries(tags)) {
    event.tags[key] = value;
  }
  if (!event.contexts) event.contexts = {};
  event.contexts.game = {
    sanity: state.sanity,
    sanityLowest: state.sanityLowest,
    static: state.static,
    isPlaying: state.isPlaying,
    shiftsCompleted: state.shiftsCompleted,
    longestCallSurvivedMs: state.longestCallSurvivedMs,
    unlockedBands: state.unlockedBands,
    receivedCalls: state.receivedCalls,
    tapes: state.tapes,
    currentCall: state.currentCall,
  };
  return event;
}

export function initErrorTracking(): boolean {
  if (sentryEnabled) return true;
  const dsn = readDsn();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    release: readRelease(),
    environment: __DEV__ ? 'development' : 'production',
    beforeSend(event) {
      return attachGameContext(event);
    },
  });
  sentryEnabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

export function reportBug(message: string, extra?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    const state = useGameStore.getState();
    scope.setContext('game', {
      sanity: state.sanity,
      sanityLowest: state.sanityLowest,
      static: state.static,
      isPlaying: state.isPlaying,
      shiftsCompleted: state.shiftsCompleted,
      longestCallSurvivedMs: state.longestCallSurvivedMs,
      unlockedBands: state.unlockedBands,
      receivedCalls: state.receivedCalls,
      tapes: state.tapes,
      currentCall: state.currentCall,
    });
    scope.setTags({
      sanity: String(state.sanity),
      sanityLowest: String(state.sanityLowest),
      shiftsCompleted: String(state.shiftsCompleted),
    });
    if (extra) scope.setExtras(extra);
    Sentry.captureMessage(message, 'error');
  });
}

export function captureException(error: unknown, extra?: Record<string, unknown>): void {
  if (!sentryEnabled) return;
  Sentry.withScope((scope) => {
    if (extra) scope.setExtras(extra);
    const state = useGameStore.getState();
    scope.setContext('game', {
      sanity: state.sanity,
      sanityLowest: state.sanityLowest,
      static: state.static,
      isPlaying: state.isPlaying,
      shiftsCompleted: state.shiftsCompleted,
      longestCallSurvivedMs: state.longestCallSurvivedMs,
    });
    Sentry.captureException(error);
  });
}

export function _resetErrorTrackingForTests(): void {
  sentryEnabled = false;
}
