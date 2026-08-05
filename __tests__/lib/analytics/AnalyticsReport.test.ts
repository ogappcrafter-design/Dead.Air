// __tests__/lib/analytics/AnalyticsReport.test.ts
import { generateReport } from '../../../lib/analytics/AnalyticsReport';
import type { AnalyticsEvent } from '../../../lib/analytics/AnalyticsEngine';

function makeEvent(
  event: AnalyticsEvent['event'],
  session_id: string,
  data?: AnalyticsEvent['data'],
): AnalyticsEvent {
  const ev: AnalyticsEvent = { event, timestamp: 0, session_id };
  if (data !== undefined) {
    ev.data = data;
  }
  return ev;
}

describe('AnalyticsReport.generateReport', () => {
  it('returns zeroed summary for empty input', () => {
    const summary = generateReport([]);
    expect(summary).toEqual({
      totalSessions: 0,
      averageSessionLengthMs: 0,
      totalCallsSurvived: 0,
      callsByType: {},
      bandsUnlocked: [],
      achievementsEarned: [],
    });
  });

  it('counts totalSessions from session_start events', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_start', 's1'),
      makeEvent('session_end', 's1', { duration_ms: 1000 }),
      makeEvent('session_start', 's2'),
      makeEvent('session_end', 's2', { duration_ms: 3000 }),
      makeEvent('session_start', 's3'),
    ];
    expect(generateReport(events).totalSessions).toBe(3);
  });

  it('computes averageSessionLengthMs as the rounded mean of session_end durations', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_start', 's1'),
      makeEvent('session_end', 's1', { duration_ms: 1000 }),
      makeEvent('session_start', 's2'),
      makeEvent('session_end', 's2', { duration_ms: 3000 }),
    ];
    // (1000 + 3000) / 2 = 2000
    expect(generateReport(events).averageSessionLengthMs).toBe(2000);
  });

  it('rounds averageSessionLengthMs to the nearest integer', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_end', 's1', { duration_ms: 1000 }),
      makeEvent('session_end', 's2', { duration_ms: 1001 }),
    ];
    // (1000 + 1001) / 2 = 1000.5 -> rounds to 1001 (Math.round half-up)
    expect(generateReport(events).averageSessionLengthMs).toBe(1001);
  });

  it('ignores session_end events without a numeric duration_ms', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_end', 's1', { duration_ms: 'oops' as unknown as number }),
      makeEvent('session_end', 's2', { duration_ms: 500 }),
    ];
    // Only one valid session_end of 500 -> average 500
    expect(generateReport(events).averageSessionLengthMs).toBe(500);
  });

  it('returns averageSessionLengthMs 0 when no session_end events exist', () => {
    const events: AnalyticsEvent[] = [makeEvent('session_start', 's1')];
    expect(generateReport(events).averageSessionLengthMs).toBe(0);
  });

  it('counts totalCallsSurvived from call_survived events', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('call_survived', 's1', { callType: 'voices' }),
      makeEvent('call_survived', 's1', { callType: 'numbers' }),
      makeEvent('call_failed', 's1', { callType: 'noise' }),
    ];
    expect(generateReport(events).totalCallsSurvived).toBe(2);
  });

  it('groups callsByType by data.callType', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('call_survived', 's1', { callType: 'voices' }),
      makeEvent('call_survived', 's1', { callType: 'voices' }),
      makeEvent('call_survived', 's1', { callType: 'numbers' }),
      makeEvent('call_survived', 's1', { callType: 'noise' }),
    ];
    expect(generateReport(events).callsByType).toEqual({
      voices: 2,
      numbers: 1,
      noise: 1,
    });
  });

  it('skips call_survived events without a string callType when grouping', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('call_survived', 's1', { callType: 42 as unknown as string }),
      makeEvent('call_survived', 's1', { callType: 'voices' }),
      makeEvent('call_survived', 's1'),
    ];
    expect(generateReport(events).callsByType).toEqual({ voices: 1 });
  });

  it('collects distinct bandsUnlocked in order of first appearance', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('band_unlocked', 's1', { band: 'AM' }),
      makeEvent('band_unlocked', 's1', { band: 'FM' }),
      makeEvent('band_unlocked', 's1', { band: 'AM' }),
      makeEvent('band_unlocked', 's1', { band: 'SW' }),
    ];
    expect(generateReport(events).bandsUnlocked).toEqual(['AM', 'FM', 'SW']);
  });

  it('skips band_unlocked events without a string band', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('band_unlocked', 's1', { band: 99 as unknown as string }),
      makeEvent('band_unlocked', 's1', { band: 'FM' }),
    ];
    expect(generateReport(events).bandsUnlocked).toEqual(['FM']);
  });

  it('collects distinct achievementsEarned in order of first appearance', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('achievement_unlocked', 's1', { achievementId: 'first_call' }),
      makeEvent('achievement_unlocked', 's1', { achievementId: 'survivor' }),
      makeEvent('achievement_unlocked', 's1', { achievementId: 'first_call' }),
    ];
    expect(generateReport(events).achievementsEarned).toEqual(['first_call', 'survivor']);
  });

  it('skips achievement_unlocked events without a string achievementId', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('achievement_unlocked', 's1'),
      makeEvent('achievement_unlocked', 's1', { achievementId: 'survivor' }),
    ];
    expect(generateReport(events).achievementsEarned).toEqual(['survivor']);
  });

  it('aggregates a full mixed event stream correctly', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_start', 's1'),
      makeEvent('call_received', 's1', { callType: 'voices', band: 'AM' }),
      makeEvent('call_survived', 's1', { callType: 'voices' }),
      makeEvent('band_unlocked', 's1', { band: 'FM' }),
      makeEvent('achievement_unlocked', 's1', { achievementId: 'first_call' }),
      makeEvent('tape_collected', 's1', { tapeId: 'tape_001' }),
      makeEvent('store_viewed', 's1'),
      makeEvent('iap_completed', 's1', { productId: 'infinite_signal' }),
      makeEvent('call_failed', 's1', { callType: 'noise' }),
      makeEvent('session_end', 's1', { duration_ms: 5000 }),
    ];
    const summary = generateReport(events);
    expect(summary.totalSessions).toBe(1);
    expect(summary.averageSessionLengthMs).toBe(5000);
    expect(summary.totalCallsSurvived).toBe(1);
    expect(summary.callsByType).toEqual({ voices: 1 });
    expect(summary.bandsUnlocked).toEqual(['FM']);
    expect(summary.achievementsEarned).toEqual(['first_call']);
  });

  it('is pure — input array is not mutated', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_start', 's1'),
      makeEvent('call_survived', 's1', { callType: 'voices' }),
    ];
    const snapshot = [...events];
    generateReport(events);
    expect(events).toEqual(snapshot);
  });

  it('is pure — repeated calls with the same input return equal summaries', () => {
    const events: AnalyticsEvent[] = [
      makeEvent('session_start', 's1'),
      makeEvent('call_survived', 's1', { callType: 'voices' }),
    ];
    const first = generateReport(events);
    const second = generateReport(events);
    expect(second).toEqual(first);
  });
});
