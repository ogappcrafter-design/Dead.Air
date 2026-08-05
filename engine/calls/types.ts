// engine/calls/types.ts
// Shared types for the call system. CallData mirrors data/calls.js shape.
// data/calls.js is sacred — never modified.

import type { Band, CallType } from '../../lib/constants';

/** A single choice within a RIGHT_ANSWER call. */
export interface CallChoice {
  text: string;
  outcome: string;
  sanityDelta: number;
  staticMult: number;
  tape?: boolean;
  tapeName?: string;
}

/** Shape of an entry in data/calls.js CALLS array. All 18 calls match this. */
export interface CallData {
  id: number;
  /** Band index 0-4 (LIVING=0 … ████████=4). */
  band: number;
  callerId: string;
  callerName: string;
  /** Signal strength 0-5. */
  signal: number;
  type: CallType;
  /** Base static reward, before multipliers. */
  staticReward: number;
  // Type-specific optional fields:
  lines?: string[];
  choices?: CallChoice[];
  /** DEAD_AIR wait duration in seconds. */
  waitSeconds?: number;
  /** STAY_CALM duration window in seconds. */
  duration?: number;
  /** STAY_CALM penalty if caller panics. */
  sanityPenalty?: number;
  /** JUST_LISTEN sanity delta applied at end. */
  sanityDelta?: number;
  /** Top-level tape unlock flag (JUST_LISTEN, DEAD_AIR, SIGNAL_DECODE). */
  tape?: boolean;
  tapeName?: string;
  /** SIGNAL_DECODE intro text. */
  intro?: string;
  /** SIGNAL_DECODE sequence to match. */
  sequence?: number[];
  /** SIGNAL_DECODE decoded message shown on success. */
  decodedMessage?: string;
}

/** Active call lifecycle state machine. */
export type CallLifecycleState = 'idle' | 'incoming' | 'active' | 'resolving' | 'completed';

/** Outcome reported by a call renderer when the call ends. */
export interface CallOutcome {
  /** Total sanity change for this call (can be negative). */
  sanityDelta: number;
  /** Base static reward before multipliers. */
  staticReward: number;
  /** Multiplier applied to static reward. */
  staticMultiplier: number;
  /** Tape name if this call unlocked a tape. */
  tapeUnlocked?: string;
  /** Band if this call unlocked a new band. */
  bandUnlocked?: Band;
}

/** A call in progress, bundled with its lifecycle state. */
export interface ActiveCall {
  call: CallData;
  state: CallLifecycleState;
  /** Timestamp (ms) when call became active. */
  startTime: number;
}

/** Listener for call state observer pattern. */
export type CallStateListener = (state: CallLifecycleState, call: ActiveCall | null) => void;
