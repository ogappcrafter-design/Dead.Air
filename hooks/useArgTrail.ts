// hooks/useArgTrail.ts
// DEA-91: wires the in-fiction ARG trail into the radio screen.
//
// Reads only state the shipped app already carries (radio band/frequency,
// static, received calls) plus a session dwell counter for time held on the
// band, and the persisted discovery log. Exposes the one trace and one bleed
// that are visible right now, plus the two player actions: DECODE a trace,
// FILE a bleed.
//
// Why dwell rather than `shiftsCompleted`: the NightShift loop is not mounted
// on the radio screen, so the completed-shift counter only ever reaches 1.
// Gating the trail on it would have made every piece unreachable. Time on the
// carrier is measurable, advances every session, and is what the fiction asks
// the player to do anyway — hold still and listen.
//
// When the resolved trail is tuned to the carrier, the hook reports the call as
// armed and offers `answerHiddenCall`. The player answers it — the call is
// never auto-started, so a one-shot payoff can't be spent by tuning past the
// carrier while looking at something else.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCallManager } from '../engine/calls/CallManager';
import { registerArgHiddenCall } from '../engine/calls/callManagerInstance';
import {
  ARG_TRAIL_BAND,
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

/**
 * Dwell resolution. Five seconds is fine-grained enough for the trail's
 * thresholds (10s..35s) without re-rendering the radio every second.
 */
const DWELL_TICK_MS = 5000;

export interface UseArgTrailResult {
  /** The trace currently hidden in the scanline layer, if any. */
  activeTrace: ArgTraceSpec | null;
  /** Its rendered glyph matrix for this phase (null when no trace is active). */
  traceGrid: GlyphGrid | null;
  /** The CLASSIFIED bleed currently readable, if any. */
  activeFragment: ArgFragmentSpec | null;
  /** Everything the player has collected, for the log. */
  log: TrailLog;
  /** True when all three rows are read and all three bleeds filed. */
  resolved: boolean;
  /** True when the resolved trail is tuned to the carrier and unplayed. */
  hiddenCallArmed: boolean;
  /** Decode the visible trace. Returns the artifact so the panel can print it. */
  decodeTrace: () => DecodedArtifact | null;
  /** File the visible bleed (marks it heard). */
  fileFragment: () => void;
  /** Answer the armed carrier. Returns true when the call actually started. */
  answerHiddenCall: () => boolean;
}

export function useArgTrail(): UseArgTrailResult {
  const band = useRadioStore((s) => s.currentBand);
  const frequency = useRadioStore((s) => s.frequency);
  const staticLevel = useGameStore((s) => s.static);
  const receivedCalls = useGameStore((s) => s.receivedCalls);

  const decodedTraceIds = useArgTrailStore((s) => s.decodedTraceIds);
  const heardFragmentIds = useArgTrailStore((s) => s.heardFragmentIds);
  const hiddenCallPlayed = useArgTrailStore((s) => s.hiddenCallPlayed);
  const markTraceDecoded = useArgTrailStore((s) => s.markTraceDecoded);
  const markFragmentHeard = useArgTrailStore((s) => s.markFragmentHeard);
  const markHiddenCallPlayed = useArgTrailStore((s) => s.markHiddenCallPlayed);

  const progress = useMemo<TrailProgress>(
    () => ({ decodedTraceIds, heardFragmentIds, hiddenCallPlayed }),
    [decodedTraceIds, heardFragmentIds, hiddenCallPlayed],
  );
  const resolved = useMemo(() => isTrailResolved(progress), [progress]);

  // Time held on the band this session. Tuning away resets it: the carrier has
  // to be held, not visited. The clock stops once the trail is fully collected.
  const [dwellSeconds, setDwellSeconds] = useState(0);
  useEffect(() => {
    if (band !== ARG_TRAIL_BAND) {
      setDwellSeconds(0);
      return;
    }
    if (resolved) return;
    const timer = setInterval(() => {
      setDwellSeconds((seconds) => seconds + DWELL_TICK_MS / 1000);
    }, DWELL_TICK_MS);
    return () => clearInterval(timer);
  }, [band, resolved]);

  const context = useMemo<TrailContext>(
    () => ({ band, frequency, dwellSeconds, staticLevel, receivedCalls }),
    [band, frequency, dwellSeconds, staticLevel, receivedCalls],
  );

  const activeTrace = useMemo(() => getActiveTrace(context, progress), [context, progress]);
  const activeFragment = useMemo(() => getActiveFragment(context, progress), [context, progress]);
  // Dither phase: the night's call count. Stable while the player reads, moves
  // as they go deeper, so the noise field settles and shifts without the
  // payload ever changing.
  const ditherPhase = receivedCalls.length;
  const traceGrid = useMemo(
    () => (activeTrace === null ? null : buildTraceGrid(activeTrace, ditherPhase)),
    [activeTrace, ditherPhase],
  );
  const log = useMemo(() => getTrailLog(progress), [progress]);
  const armed = useMemo(() => isHiddenCallArmed(context, progress), [context, progress]);

  const decodeTrace = useCallback((): DecodedArtifact | null => {
    if (activeTrace === null) return null;
    const artifact = resolveTraceArtifact(activeTrace, ditherPhase);
    markTraceDecoded(activeTrace.id);
    return artifact;
  }, [activeTrace, ditherPhase, markTraceDecoded]);

  const fileFragment = useCallback((): void => {
    if (activeFragment === null) return;
    markFragmentHeard(activeFragment.id);
  }, [activeFragment, markFragmentHeard]);

  const answerHiddenCall = useCallback((): boolean => {
    if (!armed) return false;
    const manager = getCallManager();
    if (manager === null || manager.getCallState() !== 'idle') return false;
    registerArgHiddenCall();
    if (!manager.startCall(ARG_HIDDEN_CALL_ID)) return false;
    markHiddenCallPlayed();
    return true;
  }, [armed, markHiddenCallPlayed]);

  return {
    activeTrace,
    traceGrid,
    activeFragment,
    log,
    resolved,
    hiddenCallArmed: armed,
    decodeTrace,
    fileFragment,
    answerHiddenCall,
  };
}
