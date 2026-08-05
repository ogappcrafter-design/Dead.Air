// lib/analytics/AnalyticsEngine.ts
// Local-only, opt-in analytics. No network. No external SDK.
// Singleton engine tracking gameplay events with session scoping.

import { Band, CallType } from '../constants';

export type AnalyticsEventName =
  | 'session_start'
  | 'session_end'
  | 'call_received'
  | 'call_survived'
  | 'call_failed'
  | 'band_unlocked'
  | 'tape_collected'
  | 'achievement_unlocked'
  | 'store_viewed'
  | 'iap_completed';

export interface AnalyticsEvent {
  event: AnalyticsEventName;
  timestamp: number;
  session_id: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface CallReceivedData {
  callType: CallType;
  band: Band;
}

export interface CallSurvivedData {
  callType: CallType;
}

export interface BandUnlockedData {
  band: Band;
}

export interface AchievementUnlockedData {
  achievementId: string;
}

export interface IapCompletedData {
  productId: string;
}

/**
 * Generate a session-local unique id. Uses `crypto.randomUUID` when available
 * (Node 19+, modern browsers) and falls back to timestamp + counter. Collisions
 * within a single session are impossible because the counter is monotonic.
 */
function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

class AnalyticsEngineClass {
  private events: AnalyticsEvent[] = [];
  private sessionId: string | null = null;
  private sessionStartedAt: number | null = null;

  /**
   * Begin a new session. Tracks `session_start`. If a session is already
   * active it is ended first (records `session_end` with duration).
   * Idempotent: calling init twice without endSession in between is a no-op
   * for the second call (so mount/unmount cycles in React strict mode don't
   * produce phantom sessions).
   */
  init(): void {
    if (this.sessionId !== null) {
      return;
    }
    this.sessionId = makeSessionId();
    this.sessionStartedAt = Date.now();
    this.track('session_start');
  }

  /**
   * End the active session. Records `session_end` with duration_ms in data.
   * No-op when no session is active. Clears session state so init() can
   * start a fresh one.
   */
  endSession(): void {
    if (this.sessionId === null || this.sessionStartedAt === null) {
      return;
    }
    const durationMs = Date.now() - this.sessionStartedAt;
    this.track('session_end', { duration_ms: durationMs });
    this.sessionId = null;
    this.sessionStartedAt = null;
  }

  /**
   * Append an event. Silently dropped when no session is active, EXCEPT
   * for the `session_start` event which is allowed to bootstrap a session
   * via init(). This prevents event leaks from modules that fire before
   * the app calls init().
   */
  track(eventName: AnalyticsEventName, data?: AnalyticsEvent['data']): void {
    if (this.sessionId === null) {
      return;
    }
    const ev: AnalyticsEvent = {
      event: eventName,
      timestamp: Date.now(),
      session_id: this.sessionId,
    };
    if (data !== undefined) {
      ev.data = data;
    }
    this.events.push(ev);
  }

  /** Snapshot of all events. Returns a shallow copy to prevent external mutation. */
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }

  /**
   * Network flush hook. Intentionally a no-op: this engine is local-only.
   * The method exists to satisfy a future remote-sink contract without
   * changing call sites when one is added behind an explicit opt-in.
   */
  flush(): void {
    // no-op: local-only by design.
  }

  /** Clear all stored events. Does not affect the active session. */
  reset(): void {
    this.events = [];
  }

  /** Test/diagnostic accessor for the active session id. */
  getSessionId(): string | null {
    return this.sessionId;
  }
}

// Singleton export. One engine per app lifetime.
export const AnalyticsEngine = new AnalyticsEngineClass();
