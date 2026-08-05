// hooks/useNightShift.ts
// React hook that drives a NightShift session.
//
// Uses requestAnimationFrame to tick the NightShift engine with real-time
// deltas. When shouldTriggerCall() is true, consumes the call and forwards
// it to CallManager.startCall().
//
// The hook relies on the NightShift singleton (initNightShift) and the
// CallManager singleton (initCallManager), both initialized at app boot.
// If either is not initialized, the hook is a no-op (defensive).

import { useEffect, useRef, useState, useCallback } from 'react';
import { getNightShift, type ShiftState } from '../engine/progression/NightShift';
import { getCallManager } from '../engine/calls/CallManager';

export interface UseNightShiftResult {
  state: ShiftState;
  startShift: () => void;
  endShift: () => void;
}

/** Idle state returned before a shift has started. */
const IDLE_STATE: ShiftState = {
  phase: 'off-air',
  inGameMinutes: 0,
  realTimeMs: 0,
  scheduledCalls: [],
  nextCallIndex: 0,
  isComplete: false,
};

/**
 * Drive a NightShift session.
 *
 * - `startShift()`: starts the shift on the singleton NightShift engine.
 *   Begins the rAF tick loop. The hook re-renders with the new state.
 * - `endShift()`: ends the shift early (e.g. player quits). Stops the loop.
 * - `state`: current ShiftState, updated on every tick.
 *
 * The tick loop calls `NightShift.tick(deltaMs)` each frame, then checks
 * `shouldTriggerCall()`. If true, it consumes the call and calls
 * `CallManager.startCall(callId)`. The loop auto-stops when the shift
 * is complete.
 */
export function useNightShift(): UseNightShiftResult {
  const [state, setState] = useState<ShiftState>(IDLE_STATE);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const tick = useCallback(() => {
    if (!runningRef.current) {
      return;
    }
    const shift = getNightShift();
    if (shift === null) {
      return;
    }

    const now = performance.now();
    const last = lastTimeRef.current;
    const deltaMs = last === null ? 0 : now - last;
    lastTimeRef.current = now;

    const newState = shift.tick(deltaMs);
    setState(newState);

    // Trigger any due call.
    if (shift.shouldTriggerCall()) {
      const scheduled = shift.consumeCall();
      if (scheduled !== null) {
        const callManager = getCallManager();
        if (callManager !== null) {
          callManager.startCall(scheduled.callId);
        }
      }
      // Update state after consuming (advances nextCallIndex).
      setState(shift.getState());
    }

    if (newState.isComplete) {
      // Shift ended — stop the loop.
      runningRef.current = false;
      rafRef.current = null;
      lastTimeRef.current = null;
      return;
    }

    // Schedule next frame.
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startShift = useCallback(() => {
    const shift = getNightShift();
    if (shift === null) {
      return;
    }
    const initialState = shift.startShift();
    setState(initialState);
    runningRef.current = true;
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const endShift = useCallback(() => {
    const shift = getNightShift();
    if (shift === null) {
      return;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    runningRef.current = false;
    lastTimeRef.current = null;
    const finalState = shift.endShift();
    setState(finalState);
  }, []);

  // Cleanup on unmount: stop the loop.
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      runningRef.current = false;
      lastTimeRef.current = null;
    };
  }, []);

  return { state, startShift, endShift };
}
