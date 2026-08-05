// lib/analytics/AnalyticsReport.ts
// Pure aggregation over AnalyticsEvent[]. No side effects, no network.

import type { AnalyticsEvent } from './AnalyticsEngine';

export interface AnalyticsSummary {
  totalSessions: number;
  averageSessionLengthMs: number;
  totalCallsSurvived: number;
  callsByType: Record<string, number>;
  bandsUnlocked: string[];
  achievementsEarned: string[];
}

/**
 * Aggregate event stream into a summary. Pure function — given the same
 * events array, the same summary is produced. Handles empty input safely.
 *
 * - `totalSessions`: count of session_start events (each represents one
 *   session bootstrapped by AnalyticsEngine.init()).
 * - `averageSessionLengthMs`: mean of duration_ms across session_end
 *   events that carry data.duration_ms. Zero when no sessions ended.
 * - `totalCallsSurvived`: count of call_survived events.
 * - `callsByType`: count of call_survived events grouped by data.callType.
 * - `bandsUnlocked`: distinct ids from band_unlocked events, in order.
 * - `achievementsEarned`: distinct ids from achievement_unlocked events,
 *   in order.
 */
export function generateReport(events: AnalyticsEvent[]): AnalyticsSummary {
  const totalSessions = events.filter((e) => e.event === 'session_start').length;

  const endedSessions = events.filter(
    (e) =>
      e.event === 'session_end' &&
      e.data !== undefined &&
      typeof e.data['duration_ms'] === 'number',
  );
  const totalTimeMs = endedSessions.reduce(
    (sum, e) => sum + (typeof e.data?.['duration_ms'] === 'number' ? e.data['duration_ms'] : 0),
    0,
  );
  const averageSessionLengthMs =
    endedSessions.length > 0 ? Math.round(totalTimeMs / endedSessions.length) : 0;

  const survivedEvents = events.filter((e) => e.event === 'call_survived');
  const totalCallsSurvived = survivedEvents.length;
  const callsByType: Record<string, number> = {};
  for (const ev of survivedEvents) {
    if (ev.data === undefined) {
      continue;
    }
    const t = ev.data['callType'];
    if (typeof t === 'string') {
      const current = callsByType[t] ?? 0;
      callsByType[t] = current + 1;
    }
  }

  const bandsUnlocked: string[] = [];
  for (const ev of events.filter((e) => e.event === 'band_unlocked')) {
    if (ev.data === undefined) {
      continue;
    }
    const band = ev.data['band'];
    if (typeof band === 'string' && !bandsUnlocked.includes(band)) {
      bandsUnlocked.push(band);
    }
  }

  const achievementsEarned: string[] = [];
  for (const ev of events.filter((e) => e.event === 'achievement_unlocked')) {
    if (ev.data === undefined) {
      continue;
    }
    const id = ev.data['achievementId'];
    if (typeof id === 'string' && !achievementsEarned.includes(id)) {
      achievementsEarned.push(id);
    }
  }

  return {
    totalSessions,
    averageSessionLengthMs,
    totalCallsSurvived,
    callsByType,
    bandsUnlocked,
    achievementsEarned,
  };
}
