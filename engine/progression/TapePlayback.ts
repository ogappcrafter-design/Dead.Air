// engine/progression/TapePlayback.ts
// Pure state holder for tape playback lifecycle.
//
// TapePlayback owns the in-memory playback state machine for the tape
// collection screen: which tape is currently spinning and whether the
// transport is engaged. It deliberately performs no I/O — no audio engine
// wiring, no store access, no async. The screen that mounts it is responsible
// for side-effects (driving audio, updating stores); this class is the single
// source of truth for "what is playing right now" so tests can assert against
// it deterministically.
//
// State transitions:
//   play(tapeName, band)  -> isPlaying=true,  currentTape=tapeName
//   stop()                -> isPlaying=false, currentTape=null
//
// Each mutating method returns a fresh snapshot of the new state so callers
// can pass it to React state setters without aliasing the internal store.

import type { Band } from '../../lib/constants';

/** Immutable snapshot of the playback transport. */
export interface TapePlaybackState {
  /** Name of the tape currently cued, or null when stopped. */
  currentTape: string | null;
  /** Whether the transport is engaged (PLAY). False when stopped. */
  isPlaying: boolean;
}

/**
 * TapePlayback owns the playback transport state machine.
 *
 * The class is intentionally minimal — it stores `currentTape` and
 * `isPlaying` plus the last-played band (for ambient-layer selection,
 * surfaced via `getLastBand()`). It does NOT store the full call data or
 * transcript; the screen resolves those via TapeLookup.
 */
export class TapePlayback {
  private state: TapePlaybackState = {
    currentTape: null,
    isPlaying: false,
  };
  private lastBand: Band | null = null;

  /**
   * Begin playback of `tapeName` with `bandAmbient` as the ambient layer.
   * Returns a fresh snapshot of the new state.
   */
  play(tapeName: string, bandAmbient: Band): TapePlaybackState {
    this.state = { currentTape: tapeName, isPlaying: true };
    this.lastBand = bandAmbient;
    return this.getState();
  }

  /**
   * Stop playback and clear the cued tape. Returns a fresh snapshot of the
   * new state. Idempotent: stopping while already stopped returns the same
   * rest-state snapshot (still a new object reference).
   */
  stop(): TapePlaybackState {
    this.state = { currentTape: null, isPlaying: false };
    return this.getState();
  }

  /**
   * Return a fresh snapshot of the current state. Callers may freely mutate
   * the returned object — it is a shallow clone, not the internal store.
   */
  getState(): TapePlaybackState {
    return { ...this.state };
  }

  /**
   * Return the band most recently passed to `play`, or null if `play` has
   * never been called (or since the last construction). Useful for the audio
   * engine to know which ambient bed to keep warm between track changes.
   */
  getLastBand(): Band | null {
    return this.lastBand;
  }
}
