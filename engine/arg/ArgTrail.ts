// engine/arg/ArgTrail.ts
// DEA-91: pure gating and resolution for the in-fiction ARG trail.
//
// Mirrors engine/progression/NarrativeSeason.ts: no store imports, no React,
// no I/O. The hook (hooks/useArgTrail.ts) reads the stores and turns these
// results into a scanline trace and a signal-bleed panel; the store
// (store/argTrailStore.ts) persists what the player has read.
//
// The trail's shape is intentionally linear and short — one decode artifact,
// one CLASSIFIED fragment set, one hidden call. A trail that sprawls is worse
// than a trail that resolves.

import type { Band } from '../../lib/constants';
import {
  ARG_FRAGMENTS,
  ARG_HIDDEN_CALL_ID,
  ARG_TRACES,
  getRegistryRow,
  type ArgFragmentId,
  type ArgFragmentSpec,
  type ArgTraceId,
  type ArgTraceSpec,
  type RegistryRow,
} from '../../data/arg';
import { decodeGlyphMatrix, encodeGlyphMatrix, type GlyphGrid } from './GlyphCodec';

/** The band the whole trail lives on. */
export const ARG_TRAIL_BAND: Band = 'CLASSIFIED';

/** Carrier the three registry rows point at. */
export const ARG_TARGET_FREQUENCY = 104.7;

/**
 * Half-width of the carrier window. The console prints frequency with one
 * decimal (components/radio/FrequencyDisplay.tsx), so a displayed "104.7"
 * always lands inside this window and the gate matches what the player sees.
 */
export const ARG_FREQUENCY_TOLERANCE = 0.05;

/** State the trail reads. Every field comes from an existing store. */
export interface TrailContext {
  band: Band;
  frequency: number;
  /** Completed shifts — the trail's temporal axis. */
  shiftNumber: number;
  /** Accumulated static 0..100 — the trail's depth gauge. */
  staticLevel: number;
  receivedCalls: readonly number[];
}

/** What the player has already read. Persisted by store/argTrailStore.ts. */
export interface TrailProgress {
  decodedTraceIds: readonly ArgTraceId[];
  heardFragmentIds: readonly ArgFragmentId[];
  hiddenCallPlayed: boolean;
}

/** A trace resolved into its registry row. */
export interface DecodedArtifact {
  traceId: ArgTraceId;
  payload: string;
  row: RegistryRow;
}

/** Collected pieces, in trail order, for the on-screen log. */
export interface TrailLog {
  decodedRows: readonly RegistryRow[];
  filedFragments: readonly ArgFragmentSpec[];
  totalTraces: number;
  totalFragments: number;
}

const hasAll = <T>(required: readonly T[] | undefined, owned: ReadonlySet<T>): boolean =>
  (required ?? []).every((id) => owned.has(id));

/** True when one trail piece's conditions are satisfied right now. */
export function isArgConditionMet(
  condition: ArgTraceSpec['condition'],
  context: TrailContext,
  progress: TrailProgress,
): boolean {
  if (context.band !== condition.band) return false;
  if (context.shiftNumber < condition.minShift) return false;
  if (context.staticLevel < condition.minStatic) return false;
  if (
    condition.requiresAnyCalls.length > 0 &&
    !condition.requiresAnyCalls.some((callId) => context.receivedCalls.includes(callId))
  ) {
    return false;
  }
  if (!hasAll(condition.requiresTraceIds, new Set(progress.decodedTraceIds))) return false;
  if (!hasAll(condition.requiresFragmentIds, new Set(progress.heardFragmentIds))) return false;
  return true;
}

/** The next trace to show: conditions met, not yet decoded. */
export function getActiveTrace(
  context: TrailContext,
  progress: TrailProgress,
): ArgTraceSpec | null {
  const decoded = new Set(progress.decodedTraceIds);
  for (const trace of ARG_TRACES) {
    if (decoded.has(trace.id)) continue;
    if (isArgConditionMet(trace.condition, context, progress)) return trace;
  }
  return null;
}

/** The next bleed to show: conditions met, not yet filed. */
export function getActiveFragment(
  context: TrailContext,
  progress: TrailProgress,
): ArgFragmentSpec | null {
  const heard = new Set(progress.heardFragmentIds);
  for (const fragment of ARG_FRAGMENTS) {
    if (heard.has(fragment.id)) continue;
    if (isArgConditionMet(fragment.condition, context, progress)) return fragment;
  }
  return null;
}

/** Deterministic dither seed for a trace on a given shift. */
export function traceSeed(traceId: ArgTraceId, shiftNumber: number): string {
  return `arg:${traceId}:shift:${shiftNumber}`;
}

/** The glyph matrix a trace renders on a given shift. */
export function buildTraceGrid(trace: ArgTraceSpec, shiftNumber: number): GlyphGrid {
  return encodeGlyphMatrix(trace.payload, traceSeed(trace.id, shiftNumber));
}

/**
 * Resolve a trace the way the in-game DECODE action does: render the matrix,
 * then read it back from the cells alone. The round-trip is the proof that the
 * artifact is genuinely decodable from a screenshot, not a lookup keyed on the
 * trace id.
 */
export function resolveTraceArtifact(trace: ArgTraceSpec, shiftNumber: number): DecodedArtifact {
  const grid = buildTraceGrid(trace, shiftNumber);
  const payload = decodeGlyphMatrix(grid);
  if (payload === null) {
    throw new Error(`ArgTrail: trace ${trace.id} did not decode on shift ${shiftNumber}`);
  }
  const row = getRegistryRow(trace.registryRow);
  if (row === undefined) {
    throw new Error(
      `ArgTrail: trace ${trace.id} points at missing registry row ${trace.registryRow}`,
    );
  }
  return { traceId: trace.id, payload, row };
}

/** True when every trace is decoded and every bleed is filed. */
export function isTrailResolved(progress: TrailProgress): boolean {
  return (
    ARG_TRACES.every((trace) => progress.decodedTraceIds.includes(trace.id)) &&
    ARG_FRAGMENTS.every((fragment) => progress.heardFragmentIds.includes(fragment.id))
  );
}

/** Collected pieces for the on-screen log. */
export function getTrailLog(progress: TrailProgress): TrailLog {
  const decodedRows: RegistryRow[] = [];
  for (const trace of ARG_TRACES) {
    if (!progress.decodedTraceIds.includes(trace.id)) continue;
    const row = getRegistryRow(trace.registryRow);
    if (row !== undefined) decodedRows.push(row);
  }
  const filedFragments = ARG_FRAGMENTS.filter((fragment) =>
    progress.heardFragmentIds.includes(fragment.id),
  );
  return {
    decodedRows,
    filedFragments,
    totalTraces: ARG_TRACES.length,
    totalFragments: ARG_FRAGMENTS.length,
  };
}

/**
 * True when the resolved trail is pointing at the hidden call and the player
 * has tuned the carrier. Tuning is the deliberate act: nothing fires while the
 * player is anywhere else on the dial.
 */
export function isHiddenCallArmed(context: TrailContext, progress: TrailProgress): boolean {
  if (progress.hiddenCallPlayed) return false;
  if (context.receivedCalls.includes(ARG_HIDDEN_CALL_ID)) return false;
  if (!isTrailResolved(progress)) return false;
  if (context.band !== ARG_TRAIL_BAND) return false;
  return Math.abs(context.frequency - ARG_TARGET_FREQUENCY) < ARG_FREQUENCY_TOLERANCE;
}
