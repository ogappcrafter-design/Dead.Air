// tests/engine/NarrativeSeason.test.ts
// DEA-85: Season 1 content integrity + season state machine.

import { SEASON_1_CALLS, SEASON_1_CALL_IDS } from '@/data/seasons/season1/holdMusic';
import {
  SEASON_1_TAPES,
  SEASON_1_TAPE_IDS,
  SEASON_1_REQUIRED_TAPE_IDS,
} from '@/data/seasons/season1/tapes';
import { SEASON_1_ENDING } from '@/data/seasons/season1/ending';
import { SEASON_1_UNLOCK_GRAPH } from '@/data/seasons/season1/unlockGraph';
import { SEASONS, getSeasonById } from '@/data/seasons';
import {
  getSeasonAct,
  getSeasonBandLadder,
  isSeasonCallUnlocked,
  isSeasonFinaleAvailable,
  selectSeasonEnding,
  SEASON_1_BAND_LADDER,
} from '@/engine/progression/NarrativeSeason';
import { hasCycle } from '@/engine/progression/UnlockGraph';
import { CALL_TYPES } from '@/lib/constants';

const CALL_IDS = [...SEASON_1_CALL_IDS];

describe('Season 1 content', () => {
  it('has eight calls with unique ids in the seasonal block', () => {
    expect(SEASON_1_CALLS).toHaveLength(8);
    const ids = SEASON_1_CALLS.map((c) => c.id);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(16000);
      expect(id).toBeLessThan(16100);
    }
    expect(ids).toEqual(CALL_IDS);
  });

  it('uses only known call types and core bands', () => {
    for (const call of SEASON_1_CALLS) {
      expect(CALL_TYPES).toContain(call.type);
      expect(call.band).toBeGreaterThanOrEqual(0);
      expect(call.band).toBeLessThanOrEqual(4);
      expect(call.signal).toBeGreaterThanOrEqual(0);
      expect(call.signal).toBeLessThanOrEqual(5);
    }
  });

  it('every tape name in a call resolves to a season tape', () => {
    const names = new Set(SEASON_1_TAPES.map((t) => `Tape #S1-${tapeNumber(t.id)} — ${t.title}`));
    const referenced: string[] = [];
    for (const call of SEASON_1_CALLS) {
      if (call.tapeName) referenced.push(call.tapeName);
      for (const choice of call.choices ?? []) {
        if (choice.tapeName) referenced.push(choice.tapeName);
      }
    }
    expect(referenced.length).toBe(5);
    for (const name of referenced) {
      expect(names.has(name)).toBe(true);
    }
  });

  it('has five tapes with unique ids', () => {
    expect(SEASON_1_TAPES).toHaveLength(5);
    expect(new Set(SEASON_1_TAPES.map((t) => t.id)).size).toBe(5);
    expect(SEASON_1_TAPES.map((t) => t.id)).toEqual([...SEASON_1_TAPE_IDS]);
    expect(SEASON_1_REQUIRED_TAPE_IDS).toHaveLength(4);
  });

  it('has an acyclic season unlock graph', () => {
    expect(hasCycle(SEASON_1_UNLOCK_GRAPH)).toBe(false);
    for (const prereqs of Object.values(SEASON_1_UNLOCK_GRAPH.prerequisites)) {
      for (const id of prereqs) {
        expect(CALL_IDS).toContain(id);
      }
    }
  });

  it('registers exactly one season with a complete ending', () => {
    expect(SEASONS).toHaveLength(1);
    expect(getSeasonById('s1_hold')?.title).toBe('HOLD MUSIC');
    expect(SEASON_1_ENDING.sequence.length).toBeGreaterThan(20);
    expect(SEASON_1_ENDING.sequence.at(-1)).toBe('TITLE CARD: HOLD MUSIC');
    expect(Object.keys(SEASON_1_ENDING.openingByTag)).toEqual([
      's1_connect',
      's1_chair',
      's1_hangup',
    ]);
  });
});

describe('NarrativeSeason', () => {
  const withCalls = (ids: number[]): { receivedCalls: number[]; tapesCollected: string[] } => ({
    receivedCalls: ids,
    tapesCollected: [],
  });
  const allTapes = [...SEASON_1_REQUIRED_TAPE_IDS];

  it('starts at act 1 with only LIVING open', () => {
    expect(getSeasonAct(withCalls([]))).toBe(1);
    expect(getSeasonBandLadder(1)).toEqual(['LIVING']);
  });

  it('advances one act per gate', () => {
    expect(getSeasonAct(withCalls([16000, 16001]))).toBe(2);
    expect(getSeasonAct(withCalls([16000, 16001, 16002, 16003]))).toBe(3);
    expect(getSeasonAct(withCalls([16000, 16001, 16002, 16003, 16004]))).toBe(4);
    expect(
      getSeasonAct({
        receivedCalls: [16000, 16001, 16002, 16003, 16004, 16005, 16006],
        tapesCollected: allTapes,
      }),
    ).toBe(5);
  });

  it('holds act 5 back until the four pre-finale tapes are held', () => {
    const calls = [16000, 16001, 16002, 16003, 16004, 16005, 16006];
    expect(getSeasonAct({ receivedCalls: calls, tapesCollected: [] })).toBe(4);
    expect(getSeasonAct({ receivedCalls: calls, tapesCollected: allTapes })).toBe(5);
  });

  it('opens bands cumulatively', () => {
    expect(getSeasonBandLadder(5)).toEqual([...SEASON_1_BAND_LADDER]);
    expect(getSeasonBandLadder(3)).toEqual(['LIVING', 'LIMINAL', 'LOST']);
  });

  it('gates season calls by act', () => {
    expect(isSeasonCallUnlocked(16000, 1)).toBe(true);
    expect(isSeasonCallUnlocked(16001, 1)).toBe(true);
    expect(isSeasonCallUnlocked(16002, 1)).toBe(false);
    expect(isSeasonCallUnlocked(16007, 4)).toBe(false);
    expect(isSeasonCallUnlocked(16007, 5)).toBe(true);
    expect(isSeasonCallUnlocked(0, 5)).toBe(false);
  });

  it('selects THE HOLD from any finale tag and no_ending otherwise', () => {
    expect(selectSeasonEnding(['s1_connect'])).toBe('s1_hold');
    expect(selectSeasonEnding(['s1_chair'])).toBe('s1_hold');
    expect(selectSeasonEnding(['s1_hangup'])).toBe('s1_hold');
    expect(selectSeasonEnding([])).toBe('no_ending');
    expect(selectSeasonEnding(['cooperate', 'listen'])).toBe('no_ending');
  });

  it('offers the finale only at act 5 and only once', () => {
    const base = [16000, 16001, 16002, 16003, 16004, 16005, 16006];
    expect(isSeasonFinaleAvailable({ receivedCalls: base, tapesCollected: allTapes })).toBe(true);
    expect(
      isSeasonFinaleAvailable({ receivedCalls: [...base, 16007], tapesCollected: allTapes }),
    ).toBe(false);
  });
});

function tapeNumber(id: string): string {
  return String(Number(id.replace('tape-s1-', '')));
}
