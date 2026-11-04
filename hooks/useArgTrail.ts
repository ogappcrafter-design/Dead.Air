// hooks/useArgTrail.ts
// DEA-91: wires the in-fiction ARG trail into the radio screen.
//
// Reads only state the shipped app already carries (radio band/frequency,
// completed shifts, static, received calls) and the persisted discovery log,
// then exposes the one trace and one bleed that are visible right now, plus
// the two player actions: DECODE a trace, FILE a bleed.
//
// When the resolved trail is tuned to the carrier, this hook registers the
// hidden call (lazily, via callManagerInstance.registerArgHiddenCall) and hands
// it to the call manager. It never fires while a call is already in progress;
// it retries until the console is idle.

import { useCallback, useEffect, useMemo } from 'react';
import { getCallManager } from '../engine/calls/CallManager';
import { registerArgHiddenCall } from '../engine/calls/callManagerInstance';
import {
  buildTraceGrid,
  getActiveFragment,
  getActiveTrace,
  getTrailLog,
  isHiddenCallArmed,
  isTrailResolved,
  resolveTraceArtifact,
  type DecodedArtifact,
  type TrailContext,
  type TrailLog,
  type TrailProgress,
} from '../engine/arg/ArgTrail';
import type { GlyphGrid } from '../engine/arg/GlyphCodec';
import { ARG_HIDDEN_CALL_ID } from '../data/arg';
import type { ArgFragmentSpec, ArgTraceSpec } from '../data/arg';
import { useGameStore } from '../store/useGameStore';
import { useRadioStore } from '../store/useRadioStore';
import { useArgTrailStore } from '../store/argTrailStore';

/** How often to retry the hidden call while a call is already in progress. */
const HIDDEN_CALL_RETRY_MS = 4000;

export interface UseArgTrailResult {
  /** The trace currently hidden in the scanline layer, if any. */
  activeTrace: ArgTraceSpec | null;
  /** Its rendered glyph matrix for this shift (null when no trace is active). */
  traceGrid: GlyphGrid | null;
  /** The CLASSIFIED bleed currently readable, if any. */
  activeFragment: ArgFragmentSpec | null;
  /** Everything the player has collected, for the log. */
  log: TrailLog;
  /** True when all three rows are read and all three bleeds filed. */
  resolved: boolean;
  /** Decode the visible trace. Returns the artifact so the panel can print it. */
  decodeTrace: () => DecodedArtifact | null;
  /** File the visible bleed (marks it heard). */
  fileFragment: () => void;
}

export function useArgTrail(): UseArgTrailResult {
  const band = useRadioStore((s) => s.currentBand);
  const frequency = useRadioStore((s) => s.frequency);
  const shiftNumber = useGameStore((s) => s.shiftsCompleted);
  const staticLevel = useGameStore((s) => s.static);
  const receivedCalls = useGameStore((s) => s.receivedCalls);

  const decodedTraceIds = useArgTrailStore((s) => s.decodedTraceIds);
  const heardFragmentIds = useArgTrailStore((s) => s.heardFragmentIds);
  const hiddenCallPlayed = useArgTrailStore((s) => s.hiddenCallPlayed);
  const markTraceDecoded = useArgTrailStore((s) => s.markTraceDecoded);
  const markFragmentHeard = useArgTrailStore((s) => s.markFragmentHeard);
  const markHiddenCallPlayed = useArgTrailStore((s) => s.markHiddenCallPlayed);

  const context = useMemo<TrailContext>(
    () => ({ band, frequency, shiftNumber, staticLevel, receivedCalls }),
    [band, frequency, shiftNumber, staticLevel, receivedCalls],
  );

  const progress = useMemo<TrailProgress>(
    () => ({ decodedTraceIds, heardFragmentIds, hiddenCallPlayed }),
    [decodedTraceIds, heardFragmentIds, hiddenCallPlayed],
  );

  const activeTrace = useMemo(() => getActiveTrace(context, progress), [context, progress]);
  const activeFragment = useMemo(() => getActiveFragment(context, progress), [context, progress]);
  const traceGrid = useMemo(
    () => (activeTrace === null ? null : buildTraceGrid(activeTrace, shiftNumber)),
    [activeTrace, shiftNumber],
  );
  const log = useMemo(() => getTrailLog(progress), [progress]);
  const resolved = useMemo(() => isTrailResolved(progress), [progress]);
  const armed = useMemo(() => isHiddenCallArmed(context, progress), [context, progress]);

  const decodeTrace = useCallback((): DecodedArtifact | null => {
    if (activeTrace === null) return null;
    const artifact = resolveTraceArtifact(activeTrace, shiftNumber);
    markTraceDecoded(activeTrace.id);
    return artifact;
  }, [activeTrace, shiftNumber, markTraceDecoded]);

  const fileFragment = useCallback((): void => {
    if (activeFragment === null) return;
    markFragmentHeard(activeFragment.id);
  }, [activeFragment, markFragmentHeard]);

  useEffect(() => {
    if (!armed) return;
    let stopped = false;

    const attempt = (): void => {
      if (stopped) return;
      const manager = getCallManager();
      if (manager === null) return;
      if (manager.getCallState() !== 'idle') return;
      registerArgHiddenCall();
      if (manager.startCall(ARG_HIDDEN_CALL_ID)) {
        stopped = true;
        markHiddenCallPlayed();
      }
    };

    attempt();
    const timer = setInterval(attempt, HIDDEN_CALL_RETRY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [armed, markHiddenCallPlayed]);

  return {
    activeTrace,
    traceGrid,
    activeFragment,
    log,
    resolved,
    decodeTrace,
    fileFragment,
  };
}
