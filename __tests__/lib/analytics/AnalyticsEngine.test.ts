// __tests__/lib/analytics/AnalyticsEngine.test.ts
import { AnalyticsEngine } from '../../../lib/analytics/AnalyticsEngine';

describe('AnalyticsEngine', () => {
  beforeEach(() => {
    // End any active session then clear events. Safe to call repeatedly.
    AnalyticsEngine.endSession();
    AnalyticsEngine.reset();
  });

  afterEach(() => {
    AnalyticsEngine.endSession();
    AnalyticsEngine.reset();
  });

  describe('init', () => {
    it('starts a session and records session_start', () => {
      AnalyticsEngine.init();
      const events = AnalyticsEngine.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]?.event).toBe('session_start');
      expect(events[0]?.session_id).toEqual(expect.any(String));
    });

    it('produces a non-empty session id', () => {
      AnalyticsEngine.init();
      expect(AnalyticsEngine.getSessionId()).toEqual(expect.any(String));
      expect(AnalyticsEngine.getSessionId()).not.toBe('');
    });

    it('is idempotent — second init does not create a second session', () => {
      AnalyticsEngine.init();
      const firstId = AnalyticsEngine.getSessionId();
      AnalyticsEngine.init();
      expect(AnalyticsEngine.getSessionId()).toBe(firstId);
      expect(AnalyticsEngine.getEvents()).toHaveLength(1);
    });
  });

  describe('endSession', () => {
    it('records session_end with duration_ms', () => {
      AnalyticsEngine.init();
      const before = Date.now();
      // Force a measurable duration.
      const start = (AnalyticsEngine.getEvents()[0] as { timestamp: number }).timestamp;
      AnalyticsEngine.endSession();
      const events = AnalyticsEngine.getEvents();
      expect(events).toHaveLength(2);
      expect(events[1]?.event).toBe('session_end');
      const duration = events[1]?.data?.['duration_ms'];
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(before).toBeGreaterThanOrEqual(start);
    });

    it('clears session state so a fresh session can be started', () => {
      AnalyticsEngine.init();
      const firstId = AnalyticsEngine.getSessionId();
      AnalyticsEngine.endSession();
      AnalyticsEngine.init();
      const secondId = AnalyticsEngine.getSessionId();
      expect(secondId).not.toBe(firstId);
    });

    it('is a no-op when no session is active', () => {
      AnalyticsEngine.endSession();
      expect(AnalyticsEngine.getEvents()).toHaveLength(0);
      expect(AnalyticsEngine.getSessionId()).toBeNull();
    });

    it('preserves events on the buffer after ending', () => {
      AnalyticsEngine.init();
      AnalyticsEngine.track('call_received', { callType: 'voices', band: 'AM' });
      AnalyticsEngine.endSession();
      expect(AnalyticsEngine.getEvents()).toHaveLength(3);
    });
  });

  describe('track', () => {
    it('appends an event with timestamp and session id', () => {
      AnalyticsEngine.init();
      const before = Date.now();
      AnalyticsEngine.track('call_received', { callType: 'voices', band: 'AM' });
      const events = AnalyticsEngine.getEvents();
      expect(events).toHaveLength(2);
      expect(events[1]?.event).toBe('call_received');
      expect(events[1]?.timestamp).toBeGreaterThanOrEqual(before);
      expect(events[1]?.session_id).toBe(AnalyticsEngine.getSessionId());
    });

    it('attaches data payload when provided', () => {
      AnalyticsEngine.init();
      AnalyticsEngine.track('band_unlocked', { band: 'FM' });
      const ev = AnalyticsEngine.getEvents()[1];
      expect(ev?.data).toEqual({ band: 'FM' });
    });

    it('omits data when not provided', () => {
      AnalyticsEngine.init();
      AnalyticsEngine.track('store_viewed');
      const ev = AnalyticsEngine.getEvents()[1];
      expect(ev?.data).toBeUndefined();
    });

    it('is a no-op when no session is active', () => {
      AnalyticsEngine.track('call_received', { callType: 'voices', band: 'AM' });
      expect(AnalyticsEngine.getEvents()).toHaveLength(0);
    });
  });

  describe('getEvents', () => {
    it('returns a shallow copy — mutations do not affect engine state', () => {
      AnalyticsEngine.init();
      AnalyticsEngine.track('store_viewed');
      const snapshot = AnalyticsEngine.getEvents();
      snapshot.push({
        event: 'store_viewed',
        timestamp: 0,
        session_id: 'fake',
      });
      expect(AnalyticsEngine.getEvents()).toHaveLength(2);
    });
  });

  describe('flush', () => {
    it('is a no-op and does not throw', () => {
      expect(() => AnalyticsEngine.flush()).not.toThrow();
    });
  });

  describe('reset', () => {
    it('clears the event buffer without touching the active session', () => {
      AnalyticsEngine.init();
      AnalyticsEngine.track('store_viewed');
      const id = AnalyticsEngine.getSessionId();
      AnalyticsEngine.reset();
      expect(AnalyticsEngine.getEvents()).toHaveLength(0);
      expect(AnalyticsEngine.getSessionId()).toBe(id);
    });
  });
});
