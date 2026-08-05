// __tests__/engine/progression/TapePlayback.test.ts
// Tests for TapePlayback transport state machine + TapeLookup helpers.

import { TapePlayback } from '@/engine/progression/TapePlayback';
import { findCallByTape, getAllTapeNames } from '@/engine/progression/TapeLookup';
import { ALL_TAPES, CALLS } from '@/data/calls';
import type { CallData } from '@/engine/calls/types';
import type { Band } from '@/lib/constants';

// Cast sacred JS data into typed shape — matches callManagerInstance.ts pattern.
const CALLS_TYPED = CALLS as unknown as CallData[];

describe('TapePlayback', () => {
  it('initializes with currentTape=null, isPlaying=false', () => {
    const pb = new TapePlayback();
    expect(pb.getState()).toEqual({ currentTape: null, isPlaying: false });
  });

  it('play() sets currentTape and isPlaying=true', () => {
    const pb = new TapePlayback();
    const state = pb.play('Tape #6 — Signal From Guardian', 'LIMINAL');
    expect(state.currentTape).toBe('Tape #6 — Signal From Guardian');
    expect(state.isPlaying).toBe(true);
  });

  it('getState() after play() returns isPlaying=true', () => {
    const pb = new TapePlayback();
    pb.play('Tape #1 — The Wrong Number', 'LIVING');
    expect(pb.getState().isPlaying).toBe(true);
    expect(pb.getState().currentTape).toBe('Tape #1 — The Wrong Number');
  });

  it('stop() resets to currentTape=null, isPlaying=false', () => {
    const pb = new TapePlayback();
    pb.play("Tape #2 — The Collector's Archive", 'LIMINAL');
    const state = pb.stop();
    expect(state.currentTape).toBeNull();
    expect(state.isPlaying).toBe(false);
  });

  it('getState() returns a fresh object (not the internal reference)', () => {
    const pb = new TapePlayback();
    pb.play('Tape #3 — The 3:47 Sessions', 'LOST');
    const snapshot = pb.getState();
    snapshot.isPlaying = false;
    snapshot.currentTape = 'mutated';
    // Internal state must be untouched by caller mutations to the snapshot.
    expect(pb.getState().isPlaying).toBe(true);
    expect(pb.getState().currentTape).toBe('Tape #3 — The 3:47 Sessions');
  });

  it('play() returns a fresh snapshot distinct from a subsequent getState() reference', () => {
    const pb = new TapePlayback();
    const returned = pb.play("Tape #4 — Yesterday's Frequency", 'LOST');
    const subsequent = pb.getState();
    expect(returned).not.toBe(subsequent);
    expect(returned).toEqual(subsequent);
  });

  it('stop() is idempotent — repeats from rest to rest with new references', () => {
    const pb = new TapePlayback();
    const first = pb.stop();
    const second = pb.stop();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });

  it('getLastBand() returns the band passed to play() and null before any play()', () => {
    const pb = new TapePlayback();
    expect(pb.getLastBand()).toBeNull();
    pb.play('Tape #5 — Echo Chamber', 'CLASSIFIED');
    expect(pb.getLastBand()).toBe('CLASSIFIED');
  });
});

describe('findCallByTape', () => {
  it('resolves Tape #6 — Signal From Guardian to call id 8', () => {
    const call = findCallByTape('Tape #6 — Signal From Guardian', CALLS_TYPED);
    expect(call?.id).toBe(8);
  });

  it('returns null for an unknown tape name', () => {
    const call = findCallByTape('Tape #99 — Nonexistent', CALLS_TYPED);
    expect(call).toBeNull();
  });

  it('returns the first match when multiple calls reference the same tape name (defensive)', () => {
    // No current duplicates in sacred data — synthesize a fixture.
    const fixture: CallData[] = [
      {
        id: 101,
        band: 0,
        callerId: 'x',
        callerName: 'x',
        signal: 0,
        type: 'JUST_LISTEN',
        staticReward: 0,
        tape: true,
        tapeName: 'Duplicate Tape',
      },
      {
        id: 102,
        band: 0,
        callerId: 'y',
        callerName: 'y',
        signal: 0,
        type: 'JUST_LISTEN',
        staticReward: 0,
        tape: true,
        tapeName: 'Duplicate Tape',
      },
    ];
    const call = findCallByTape('Duplicate Tape', fixture);
    expect(call?.id).toBe(101);
  });

  it('finds tapes unlocked via choice (RIGHT_ANSWER shape)', () => {
    // Tape #10 — Courtesy Call unlocks via RIGHT_ANSWER choice (call id 12).
    const call = findCallByTape('Tape #10 — Courtesy Call', CALLS_TYPED);
    expect(call?.id).toBe(12);
  });

  it('returns the same call reference regardless of how many times it is called', () => {
    const first = findCallByTape('Tape #6 — Signal From Guardian', CALLS_TYPED);
    const second = findCallByTape('Tape #6 — Signal From Guardian', CALLS_TYPED);
    expect(first).toBe(second); // pure function — same input, same reference
  });
});

describe('getAllTapeNames', () => {
  it('returns exactly 15 unique tape names for the CALLS fixture', () => {
    const names = getAllTapeNames(CALLS_TYPED);
    expect(names.length).toBe(15);
    expect(new Set(names).size).toBe(15);
  });

  it('returns names that match ALL_TAPES (set equality)', () => {
    const names = getAllTapeNames(CALLS_TYPED);
    expect(new Set(names)).toEqual(new Set(ALL_TAPES));
  });

  it('deduplicates tape names referenced by multiple choices', () => {
    // Defensive fixture — same tapeName on two choices should yield one entry.
    const fixture: CallData[] = [
      {
        id: 1,
        band: 0,
        callerId: 'a',
        callerName: 'a',
        signal: 0,
        type: 'RIGHT_ANSWER',
        staticReward: 0,
        choices: [
          {
            text: 'x',
            outcome: 'y',
            sanityDelta: 0,
            staticMult: 1,
            tape: true,
            tapeName: 'Shared',
          },
          {
            text: 'z',
            outcome: 'w',
            sanityDelta: 0,
            staticMult: 1,
            tape: true,
            tapeName: 'Shared',
          },
        ],
      },
    ];
    expect(getAllTapeNames(fixture)).toEqual(['Shared']);
  });

  it('returns [] for an empty calls fixture', () => {
    expect(getAllTapeNames([])).toEqual([]);
  });

  it('does not mutate the input fixture', () => {
    const fixtureCopy: CallData[] = [
      {
        id: 1,
        band: 0,
        callerId: 'a',
        callerName: 'a',
        signal: 0,
        type: 'JUST_LISTEN',
        staticReward: 0,
        tape: true,
        tapeName: 'X',
      },
    ];
    const snapshot = JSON.stringify(fixtureCopy);
    getAllTapeNames(fixtureCopy);
    expect(JSON.stringify(fixtureCopy)).toBe(snapshot);
  });
});

describe('coverage: every ALL_TAPES entry resolves to a real call', () => {
  it('every tape name in ALL_TAPES finds a matching call', () => {
    for (const name of ALL_TAPES) {
      const call = findCallByTape(name, CALLS_TYPED);
      expect(call).not.toBeNull();
      if (call !== null) {
        // Sanity-check band index is in range 0..4.
        const band: Band = (['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'] as Band[])[
          call.band
        ]!;
        expect(band).toBeDefined();
      }
    }
  });

  it('every ALL_TAPES entry is present in getAllTapeNames output', () => {
    const names = new Set(getAllTapeNames(CALLS_TYPED));
    for (const name of ALL_TAPES) {
      expect(names.has(name)).toBe(true);
    }
  });
});
