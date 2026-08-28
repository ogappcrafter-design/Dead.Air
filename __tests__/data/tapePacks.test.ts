// __tests__/data/tapePacks.test.ts
// Tests for tape pack registry, DLC call definitions, and ownership helpers.

import {
  TAPE_PACKS,
  ALL_DLC_CALLS,
  ALL_DLC_FRAGMENTS,
  getTapePackByProductId,
  getTapePackByPackId,
  getDlcCallsForOwnedPacks,
  getDlcFragmentsForOwnedPacks,
} from '../../data/tapePacks';
import { HOLIDAY_DLC_CALLS } from '../../data/tapePacks/holidayCalls';
import { NUMBERS_STATION_DLC_CALLS } from '../../data/tapePacks/numbersStationCalls';
import { VOICES_BEYOND_DLC_CALLS } from '../../data/tapePacks/voicesBeyondCalls';
import { DLC_TAPES } from '../../data/tapes';
import type { CallData } from '../../engine/calls/types';

const HOLIDAY_ID = 'com.deadair.tape_pack_holiday';
const NUMBERS_ID = 'com.deadair.tape_pack_numbers_station';
const VOICES_ID = 'com.deadair.tape_pack_voices_beyond';

describe('TAPE_PACKS registry', () => {
  it('contains exactly 3 tape packs', () => {
    expect(TAPE_PACKS).toHaveLength(3);
  });

  it('has unique product IDs', () => {
    const ids = TAPE_PACKS.map((p) => p.productId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique pack IDs', () => {
    const ids = TAPE_PACKS.map((p) => p.packId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each pack has 5 tapes', () => {
    for (const pack of TAPE_PACKS) {
      expect(pack.tapes).toHaveLength(5);
    }
  });

  it('each pack has 3 calls', () => {
    for (const pack of TAPE_PACKS) {
      expect(pack.calls).toHaveLength(3);
    }
  });

  it('each pack has at least 1 fragment library', () => {
    for (const pack of TAPE_PACKS) {
      expect(pack.fragmentLibraries.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all pack calls have sourcePackId matching their product ID', () => {
    for (const pack of TAPE_PACKS) {
      for (const call of pack.calls) {
        expect(call.sourcePackId).toBe(pack.productId);
      }
    }
  });

  it('all pack calls have unique IDs', () => {
    const allIds = TAPE_PACKS.flatMap((p) => p.calls.map((c) => c.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('Holiday pack uses band 0 (LIVING)', () => {
    const pack = getTapePackByProductId(HOLIDAY_ID);
    expect(pack).toBeDefined();
    expect(pack!.calls.every((c) => c.band === 0)).toBe(true);
  });

  it('Numbers Station pack uses band 3 (CLASSIFIED)', () => {
    const pack = getTapePackByProductId(NUMBERS_ID);
    expect(pack).toBeDefined();
    expect(pack!.calls.every((c) => c.band === 3)).toBe(true);
  });

  it('Voices Beyond pack uses band 2 (LOST)', () => {
    const pack = getTapePackByProductId(VOICES_ID);
    expect(pack).toBeDefined();
    expect(pack!.calls.every((c) => c.band === 2)).toBe(true);
  });
});

describe('getTapePackByProductId', () => {
  it('returns the correct pack for holiday product ID', () => {
    const pack = getTapePackByProductId(HOLIDAY_ID);
    expect(pack?.packId).toBe('tape_pack_holiday');
  });

  it('returns undefined for unknown product ID', () => {
    expect(getTapePackByProductId('com.deadair.unknown')).toBeUndefined();
  });
});

describe('getTapePackByPackId', () => {
  it('returns the correct pack for "holiday"', () => {
    const pack = getTapePackByPackId('tape_pack_holiday');
    expect(pack?.productId).toBe(HOLIDAY_ID);
  });

  it('returns undefined for unknown pack ID', () => {
    expect(getTapePackByPackId('unknown')).toBeUndefined();
  });
});

describe('ALL_DLC_CALLS', () => {
  it('contains all 9 DLC calls (3 per pack)', () => {
    expect(ALL_DLC_CALLS).toHaveLength(9);
  });

  it('includes holiday calls with IDs 200-202', () => {
    const ids = ALL_DLC_CALLS.filter((c) => c.sourcePackId === HOLIDAY_ID).map((c) => c.id);
    expect(ids).toEqual([200, 201, 202]);
  });

  it('includes numbers station calls with IDs 300-302', () => {
    const ids = ALL_DLC_CALLS.filter((c) => c.sourcePackId === NUMBERS_ID).map((c) => c.id);
    expect(ids).toEqual([300, 301, 302]);
  });

  it('includes voices beyond calls with IDs 400-402', () => {
    const ids = ALL_DLC_CALLS.filter((c) => c.sourcePackId === VOICES_ID).map((c) => c.id);
    expect(ids).toEqual([400, 401, 402]);
  });

  it('every call has a sourcePackId', () => {
    for (const call of ALL_DLC_CALLS) {
      expect(call.sourcePackId).toBeDefined();
    }
  });
});

describe('ALL_DLC_FRAGMENTS', () => {
  it('contains at least 3 fragment libraries (1 per pack)', () => {
    expect(ALL_DLC_FRAGMENTS.length).toBeGreaterThanOrEqual(3);
  });

  it('includes fragments for band 0 (Holiday/LIVING)', () => {
    expect(ALL_DLC_FRAGMENTS.some((f) => f.band === 0)).toBe(true);
  });

  it('includes fragments for band 3 (Numbers Station/CLASSIFIED)', () => {
    expect(ALL_DLC_FRAGMENTS.some((f) => f.band === 3)).toBe(true);
  });

  it('includes fragments for band 2 (Voices Beyond/LOST)', () => {
    expect(ALL_DLC_FRAGMENTS.some((f) => f.band === 2)).toBe(true);
  });
});

describe('getDlcCallsForOwnedPacks', () => {
  it('returns empty array when no packs owned', () => {
    expect(getDlcCallsForOwnedPacks([])).toEqual([]);
  });

  it('returns 3 calls when only holiday pack owned', () => {
    const calls = getDlcCallsForOwnedPacks([HOLIDAY_ID]);
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.sourcePackId === HOLIDAY_ID)).toBe(true);
  });

  it('returns 9 calls when all 3 packs owned', () => {
    const calls = getDlcCallsForOwnedPacks([HOLIDAY_ID, NUMBERS_ID, VOICES_ID]);
    expect(calls).toHaveLength(9);
  });

  it('ignores unknown product IDs', () => {
    const calls = getDlcCallsForOwnedPacks([HOLIDAY_ID, 'com.deadair.unknown']);
    expect(calls).toHaveLength(3);
  });
});

describe('getDlcFragmentsForOwnedPacks', () => {
  it('returns empty array when no packs owned', () => {
    expect(getDlcFragmentsForOwnedPacks([])).toEqual([]);
  });

  it('returns fragment library when holiday pack owned', () => {
    const frags = getDlcFragmentsForOwnedPacks([HOLIDAY_ID]);
    expect(frags.length).toBeGreaterThanOrEqual(1);
    expect(frags.every((f) => f.band === 0)).toBe(true);
  });

  it('returns fragments for all 3 packs when all owned', () => {
    const frags = getDlcFragmentsForOwnedPacks([HOLIDAY_ID, NUMBERS_ID, VOICES_ID]);
    expect(frags.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DLC call data integrity', () => {
  const allDlc = [
    ...HOLIDAY_DLC_CALLS,
    ...NUMBERS_STATION_DLC_CALLS,
    ...VOICES_BEYOND_DLC_CALLS,
  ] as CallData[];

  it('every DLC call has required fields', () => {
    for (const call of allDlc) {
      expect(call.id).toBeGreaterThan(0);
      expect(call.callerId).toBeTruthy();
      expect(call.callerName).toBeTruthy();
      expect(call.signal).toBeGreaterThanOrEqual(0);
      expect(call.staticReward).toBeGreaterThan(0);
      expect(call.type).toBeTruthy();
    }
  });

  it('RIGHT_ANSWER calls have at least 2 choices', () => {
    for (const call of allDlc) {
      if (call.type === 'RIGHT_ANSWER') {
        expect(call.choices).toBeDefined();
        expect(call.choices!.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('SIGNAL_DECODE calls have decodedMessage', () => {
    for (const call of allDlc) {
      if (call.type === 'SIGNAL_DECODE') {
        expect(call.decodedMessage).toBeTruthy();
      }
    }
  });

  it('DLC tape IDs reference tapes in DLC_TAPES', () => {
    const dlcTapeIds = new Set(DLC_TAPES.map((t) => t.id));
    for (const call of allDlc) {
      if (call.tape !== undefined) {
        expect(dlcTapeIds.has(call.tape)).toBe(true);
      }
    }
  });
});
