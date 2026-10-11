// hooks/useEndlessNight.ts
// DEA-86: Drives an Endless Night run — the survival loop the pure
// EndlessNight engine was built for but never had.
//
// The hook owns the run lifecycle:
//   - START: when eligibility flips (shiftsCompleted >= 1, no NG+ active,
//     call manager idle), begins the run via the store action.
//   - CALLS: while active, schedules a call on an escalation-scaled
//     interval. With RARE_EVENT_CHANCE the call is a unique procedural
//     rare event (advanced type from the current escalation level,
//     generated on a core band and registered in the live registry);
//     otherwise a sacred call from the player's band (falling back to the
//     largest sacred band when the player's band has none).
//   - SCORING: each call the player completes (CallManager transitions to
//     'completed') counts as one survived shift → incrementEndlessScore,
//     which escalates level + weather in the pure engine.
//   - DRAIN: while idle between calls, sanity drains continuously
//     (ENDLESS_IDLE_DRAIN_PER_SECOND); the difficulty × escalation
//     multiplier is composed inside decreaseSanity (DEA-86).
//   - GAME OVER: the store flips endlessGameOver at sanity 0; the hook
//     then submits the score to the leaderboard and clears the run's
//     rare-event calls from the registry.
//   - QUIT / unmount: endEndlessNightMode + registry cleanup; an active
//     call is aborted so it never leaks into normal play.

import { useEffect, useRef } from 'react';
import {
  ENDLESS_IDLE_DRAIN_PER_SECOND,
  ENDLESS_IDLE_DRAIN_TICK_MS,
  getEndlessCallInterval,
  getEscalationCallTypes,
  selectRareEvent,
  type RareEventSelection,
} from '../engine/progression/EndlessNight';
import { getCallManager } from '../engine/calls/CallManager';
import {
  clearEndlessRareEventCalls,
  registerEndlessRareEventCall,
} from '../engine/calls/callManagerInstance';
import { CALLS } from '../data/calls';
import { BANDS } from '../lib/constants';
import type { Band } from '../lib/constants';
import { DIFFICULTY_CONFIGS } from '../lib/difficulty';
import { useGameStore } from '../store/useGameStore';
import { useRadioStore } from '../store/useRadioStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { submitEndlessScore } from '../store/useLeaderboardStore';

/** Grace delay (ms) between a call completing and the next call starting. */
const CALL_GAP_MS = 1_200;

/** Grace delay (ms) after a run starts before the first call. */
const FIRST_CALL_DELAY_MS = 1_500;

export interface EndlessCallPlan {
  callId: number;
  band: number;
  isRareEvent: boolean;
}

/**
 * DEA-86: Pure decision for the next call in an Endless Night run.
 *
 * Rolls for a rare event (only possible once the escalation level has
 * unlocked advanced types). Rare events target a core band (0-4) so the
 * forced type is always renderable; the caller generates + registers the
 * unique call. Otherwise the plan points at a sacred call from the
 * player's current band (falling back to the largest sacred pool).
 *
 * Deterministic given the rolls — fully testable without the manager.
 */
export function planNextCall(
  escalationLevel: number,
  sacredByBand: ReadonlyArray<ReadonlyArray<number>>,
  currentBand: number,
  roll: number,
  bandRoll: number,
  pickRoll: number,
): EndlessCallPlan {
  const rare: RareEventSelection = selectRareEvent(escalationLevel, roll, bandRoll);
  if (rare.isRareEvent && rare.callType !== null && rare.band !== null) {
    return { callId: -1, band: rare.band, isRareEvent: true };
  }
  const band = normalCallBand(sacredByBand, currentBand);
  const pool = sacredByBand[band] ?? [];
  const idx = pool.length > 0 ? Math.floor(pickRoll * pool.length) % pool.length : 0;
  const id = pool[idx];
  if (id === undefined) {
    return { callId: -1, band, isRareEvent: false };
  }
  return { callId: id, band, isRareEvent: false };
}

/**
 * Band index a normal call comes from: the player's band when it has
 * sacred calls, else the largest pool (lowest index wins ties). The caller
 * tunes the radio to this band so the call's band matches what's played.
 */
function normalCallBand(
  sacredByBand: ReadonlyArray<ReadonlyArray<number>>,
  currentBand: number,
): number {
  const preferred = sacredByBand[currentBand];
  if (preferred !== undefined && preferred.length > 0) {
    return currentBand;
  }
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < sacredByBand.length; i++) {
    const len = (sacredByBand[i] ?? []).length;
    if (len > bestLen) {
      best = i;
      bestLen = len;
    }
  }
  return best;
}

/**
 * DEA-86: useEndlessNight — mount on the radio screen.
 *
 * No-op unless a run is (or becomes) active. All timers clean up on
 * unmount or when the run ends (game over or quit).
 */
export function useEndlessNight(): void {
  const active = useGameStore((s) => s.endlessModeActive);
  const gameOver = useGameStore((s) => s.endlessGameOver);

  // Whether this hook began/adopted the current run (so it owns cleanup).
  const startedByRef = useRef(false);
  // Whether we already submitted the current run's game-over score.
  const submittedRef = useRef(false);

  // --- First night-shift completion → eligibility (DEA-86) ---
  // The tutorial IS the player's first night shift. Counting its
  // completion as shiftsCompleted = 1 makes Endless Night reachable
  // without a full manual playthrough. Runs once (guarded by
  // shiftsCompleted === 0); a skipped tutorial also counts.
  const tutorialStep = useTutorialStore((s) => s.step);
  const tutorialSkipped = useTutorialStore((s) => s.skipped);
  useEffect(() => {
    const completed = tutorialStep === 'completed' || tutorialSkipped === true;
    if (!completed) return;
    const g = useGameStore.getState();
    if (g.shiftsCompleted >= 1) return;
    if (g.endlessModeActive) return;
    g.incrementShiftsCompleted();
  }, [tutorialStep, tutorialSkipped]);

  // --- Start the run when eligibility is met (mount-time) ---
  useEffect(() => {
    const g = useGameStore.getState();
    if (g.endlessModeActive) return; // already running; adoption effect below
    const eligible =
      g.shiftsCompleted >= 1 &&
      !g.ngPlusActive &&
      (getCallManager()?.getCallState() ?? 'idle') === 'idle';
    if (!eligible) return;
    g.startEndlessNightMode();
  }, []);

  // --- Adopt ownership whenever a run becomes active ---
  // Covers: a persisted mid-run, a run started from the settings screen,
  // and a restart from the game-over banner (resets the submitted flag so
  // the next death re-submits).
  useEffect(() => {
    if (!active) return;
    startedByRef.current = true;
    submittedRef.current = false;
  }, [active]);

  // --- Main loop: call scheduling + idle drain (only while active) ---
  useEffect(() => {
    if (!active || gameOver) return;

    // Sacred call ids grouped by band index (sacred data: id 0-17, bands 0-7).
    const sacredByBand: number[][] = [];
    for (const c of CALLS) {
      (sacredByBand[c.band] ??= []).push(c.id);
    }

    let nextCallTimer: ReturnType<typeof setTimeout> | null = null;
    const clearNextCall = () => {
      if (nextCallTimer !== null) {
        clearTimeout(nextCallTimer);
        nextCallTimer = null;
      }
    };

    // Escalation-scaled interval between shift calls, composed with the
    // player's difficulty call-frequency multiplier.
    const currentInterval = () => {
      const g = useGameStore.getState();
      const cfg = DIFFICULTY_CONFIGS[useSettingsStore.getState().difficulty];
      return getEndlessCallInterval(g.escalationLevel, cfg.callFrequencyMultiplier);
    };

    const startPlannedCall = () => {
      const g = useGameStore.getState();
      if (!g.endlessModeActive) return;
      const mgr = getCallManager();
      if (mgr === null || mgr.getCallState() !== 'idle') return;
      const bandIdx = bandToIndex(useRadioStore.getState().currentBand);
      const plan = planNextCall(
        g.escalationLevel,
        sacredByBand,
        bandIdx,
        Math.random(),
        Math.random(),
        Math.random(),
      );
      if (plan.isRareEvent) {
        // Generate + register a unique rare event call for this run on the
        // selected core band with an advanced type from the escalation level.
        const types = getEscalationCallTypes(g.escalationLevel);
        const forcedType =
          types.length > 0 ? (types[Math.floor(Math.random() * types.length)] ?? null) : null;
        if (forcedType !== null) {
          const call = registerEndlessRareEventCall(forcedType, plan.band);
          if (call !== null) {
            mgr.startCall(call.id);
            return;
          }
        }
        // Rare-event registration failed — fall through to a sacred call.
      }
      // Normal call: tune to the band the call actually lives on so the
      // call's band matches the voice preset applied at start.
      useRadioStore.getState().setBand(BANDS[plan.band] ?? 'LIVING');
      if (plan.callId >= 0) {
        mgr.startCall(plan.callId);
      }
    };

    const scheduleNextCall = (delayMs: number) => {
      clearNextCall();
      nextCallTimer = setTimeout(() => {
        nextCallTimer = null;
        startPlannedCall();
      }, delayMs);
    };

    // Idle drain: continuous sanity pressure between calls. Pass the raw
    // per-second amount; decreaseSanity composes difficulty × escalation
    // internally (DEA-86).
    const drainTimer = setInterval(() => {
      const g = useGameStore.getState();
      if (!g.endlessModeActive || g.endlessGameOver) return;
      g.decreaseSanity(ENDLESS_IDLE_DRAIN_PER_SECOND);
    }, ENDLESS_IDLE_DRAIN_TICK_MS);

    // Score: a completed call = a survived shift. Track the id at start so
    // each distinct call counts once, and only calls this run started are
    // scored (tutorial/daily calls that complete are ignored).
    const callAtStartRef = { id: -1 };
    const unsub = getCallManager()?.subscribe((state, call) => {
      if (state === 'active' && call !== null) {
        callAtStartRef.id = call.call.id;
        return;
      }
      if (state === 'completed') {
        const g = useGameStore.getState();
        if (!g.endlessModeActive || g.endlessGameOver) {
          callAtStartRef.id = -1;
          return;
        }
        const completedId = call?.call.id ?? -1;
        if (completedId !== callAtStartRef.id) {
          callAtStartRef.id = -1;
          return;
        }
        callAtStartRef.id = -1;
        g.incrementEndlessScore();
        scheduleNextCall(CALL_GAP_MS);
      }
    });

    // First call after a short grace period.
    scheduleNextCall(Math.min(FIRST_CALL_DELAY_MS, currentInterval()));

    return () => {
      clearNextCall();
      clearInterval(drainTimer);
      unsub?.();
    };
  }, [active, gameOver]);

  // --- Game over: submit leaderboard + clean registry (once per run) ---
  useEffect(() => {
    if (!gameOver) return;
    if (submittedRef.current) return;
    const g = useGameStore.getState();
    if (!g.endlessModeActive) return; // run already quit manually
    submittedRef.current = true;
    submitEndlessScore(g.endlessHighScore, usePlayerStore.getState().djCallSign);
    clearEndlessRareEventCalls();
  }, [gameOver]);

  // --- Quit / unmount: clean up the run ---
  useEffect(() => {
    return () => {
      const g = useGameStore.getState();
      if (!g.endlessModeActive) return;
      const mgr = getCallManager();
      if (startedByRef.current) {
        // Abort any in-flight call so it can't leak into normal play.
        if (mgr !== null && mgr.getCallState() !== 'idle') {
          mgr.reset();
        }
        g.endEndlessNightMode();
      }
      clearEndlessRareEventCalls();
      startedByRef.current = false;
    };
  }, []);
}

// --- Internal helpers (local to the hook, not part of the public API) ---

function bandToIndex(band: Band): number {
  const idx = BANDS.indexOf(band);
  return idx >= 0 ? idx : 0;
}
