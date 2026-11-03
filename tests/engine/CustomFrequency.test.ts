// tests/engine/CustomFrequency.test.ts
// DEA-89 — pure custom frequency composition, validation, and call building.

import {
  CUSTOM_CALL_TYPES,
  CUSTOM_FREQUENCY_MAX_MIDDLE_LINES,
  buildCustomFrequencyCall,
  createCustomFrequencyDraft,
  getCustomCallTypesForBand,
  getCustomFrequencyLibrary,
  previewCustomFrequencyLines,
  validateCustomFrequency,
  type CustomFrequency,
} from '@/engine/calls/CustomFrequency';

function draft(band = 0): CustomFrequency {
  const value = createCustomFrequencyDraft(band, {
    id: `local:test-${band}`,
    name: 'Test Frequency',
    createdAt: 1_000,
  });
  if (value === null) throw new Error(`No draft for band ${band}`);
  return value;
}

function clone(frequency: CustomFrequency): CustomFrequency {
  return JSON.parse(JSON.stringify(frequency)) as CustomFrequency;
}

describe('custom frequency defaults', () => {
  it('produces a valid draft for every core band', () => {
    for (const band of [0, 1, 2, 3, 4]) {
      const frequency = draft(band);
      expect(validateCustomFrequency(frequency)).toEqual({ ok: true, issues: [] });
      expect(frequency.composition.band).toBe(band);
      expect(frequency.origin).toBe('local');
    }
  });

  it('only offers the three line-based call types', () => {
    expect(CUSTOM_CALL_TYPES).toEqual(['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER']);
    expect(getCustomCallTypesForBand(0)).toEqual(['JUST_LISTEN', 'DEAD_AIR', 'RIGHT_ANSWER']);
    expect(getCustomCallTypesForBand(99)).toEqual([]);
  });

  it('returns null for a band without a core fragment library', () => {
    expect(createCustomFrequencyDraft(5)).toBeNull();
    expect(getCustomFrequencyLibrary(5)).toBeNull();
  });
});

describe('custom frequency validation', () => {
  it('rejects an unknown band', () => {
    const frequency = draft();
    frequency.composition.band = 9;
    const result = validateCustomFrequency(frequency);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'composition.band')).toBe(true);
  });

  it('rejects an unsupported call type for the band', () => {
    const frequency = draft(0);
    // LIVING does not author STAY_CALM fragments.
    frequency.composition.callType = 'STAY_CALM' as never;
    const result = validateCustomFrequency(frequency);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'composition.callType')).toBe(true);
  });

  it.each([
    ['openingIndex', 999],
    ['closingIndex', 999],
  ] as const)('rejects an out-of-range %s', (field, value) => {
    const frequency = draft();
    frequency.composition[field] = value;
    expect(validateCustomFrequency(frequency).ok).toBe(false);
  });

  it('rejects duplicate or out-of-range middles', () => {
    const frequency = draft();
    frequency.composition.middleIndices = [0, 0];
    expect(validateCustomFrequency(frequency).ok).toBe(false);

    const outOfRange = draft();
    outOfRange.composition.middleIndices = [999];
    expect(validateCustomFrequency(outOfRange).ok).toBe(false);
  });

  it('rejects empty and oversized middle lists', () => {
    const empty = draft();
    empty.composition.middleIndices = [];
    expect(validateCustomFrequency(empty).ok).toBe(false);

    const tooMany = draft();
    tooMany.composition.middleIndices = Array.from(
      { length: CUSTOM_FREQUENCY_MAX_MIDDLE_LINES + 1 },
      (_, index) => index,
    );
    expect(validateCustomFrequency(tooMany).ok).toBe(false);
  });

  it('requires 2-4 distinct responses for RIGHT_ANSWER', () => {
    const frequency = draft();
    frequency.composition.callType = 'RIGHT_ANSWER';

    frequency.composition.choiceIndices = [0];
    expect(validateCustomFrequency(frequency).ok).toBe(false);

    frequency.composition.choiceIndices = [0, 0];
    expect(validateCustomFrequency(frequency).ok).toBe(false);

    frequency.composition.choiceIndices = [0, 1, 2, 3, 4];
    expect(validateCustomFrequency(frequency).ok).toBe(false);

    frequency.composition.choiceIndices = [0, 1];
    expect(validateCustomFrequency(frequency).ok).toBe(true);
  });

  it('rejects responses on a non-choice call type', () => {
    const frequency = draft();
    frequency.composition.callType = 'JUST_LISTEN';
    frequency.composition.choiceIndices = [0, 1];
    expect(validateCustomFrequency(frequency).ok).toBe(false);
  });

  it('clamps validation to the band difficulty ranges', () => {
    const frequency = draft(0);
    frequency.difficulty.sanityDelta = -99;
    frequency.difficulty.staticReward = 999;
    frequency.difficulty.signal = 9;
    const result = validateCustomFrequency(frequency);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        'difficulty.sanityDelta',
        'difficulty.staticReward',
        'difficulty.signal',
      ]),
    );
  });

  it('rejects a frequency outside the band dial range', () => {
    const frequency = draft(0);
    frequency.frequency = 160;
    expect(validateCustomFrequency(frequency).ok).toBe(false);
  });

  it('validates the name, volume, and friend code', () => {
    const shortName = draft();
    shortName.name = 'ab';
    expect(validateCustomFrequency(shortName).ok).toBe(false);

    const volume = draft();
    volume.volume = 2;
    expect(validateCustomFrequency(volume).ok).toBe(false);

    const friendCode = draft();
    friendCode.friendCode = 'NOPE';
    expect(validateCustomFrequency(friendCode).ok).toBe(false);

    const validFriendCode = draft();
    validFriendCode.friendCode = 'DA-ABCDE';
    expect(validateCustomFrequency(validFriendCode).ok).toBe(true);
  });
});

describe('custom frequency call building', () => {
  it('assembles exactly the selected fragments', () => {
    const frequency = draft(0);
    const library = getCustomFrequencyLibrary(0)!;
    frequency.composition.openingIndex = 2;
    frequency.composition.middleIndices = [1, 3];
    frequency.composition.closingIndex = 4;

    const call = buildCustomFrequencyCall(frequency, 20_001);

    expect(call.id).toBe(20_001);
    expect(call.band).toBe(0);
    expect(call.type).toBe('JUST_LISTEN');
    expect(call.sourceCustomFrequencyId).toBe(frequency.id);
    expect(call.lines).toEqual([
      library.openings[2],
      library.middles[1],
      library.middles[3],
      library.closings[4],
    ]);
    expect(call.sanityDelta).toBe(frequency.difficulty.sanityDelta);
    expect(call.staticReward).toBe(frequency.difficulty.staticReward);
    expect(call.signal).toBe(frequency.difficulty.signal);
  });

  it('is deterministic for the same frequency and id', () => {
    const frequency = draft(2);
    const first = buildCustomFrequencyCall(frequency, 20_002);
    const second = buildCustomFrequencyCall(frequency, 20_002);

    expect(second).toEqual(first);
  });

  it('builds RIGHT_ANSWER choices from the selected responses', () => {
    const frequency = draft(0);
    const library = getCustomFrequencyLibrary(0)!;
    frequency.composition.callType = 'RIGHT_ANSWER';
    frequency.composition.choiceIndices = [0, 2];

    const call = buildCustomFrequencyCall(frequency, 20_004);

    expect(call.choices).toHaveLength(2);
    expect(call.choices?.[0]?.text).toBe(library.responses[0]?.text);
    expect(call.choices?.[1]?.text).toBe(library.responses[2]?.text);
    expect(call.choices?.every((choice) => choice.staticMult >= 1 && choice.staticMult <= 3)).toBe(
      true,
    );
  });

  it('builds DEAD_AIR with a deterministic wait window', () => {
    const frequency = draft(1);
    frequency.composition.callType = 'DEAD_AIR';
    const call = buildCustomFrequencyCall(frequency, 20_005);
    expect(call.type).toBe('DEAD_AIR');
    expect(call.waitSeconds).toBeGreaterThanOrEqual(6);
    expect(call.waitSeconds).toBeLessThanOrEqual(15);
  });

  it('refuses to build an invalid frequency', () => {
    const frequency = clone(draft());
    frequency.composition.openingIndex = 999;
    expect(() => buildCustomFrequencyCall(frequency, 20_006)).toThrow(/Invalid custom frequency/);
  });

  it('previews the same lines the call will use', () => {
    const frequency = draft(3);
    const call = buildCustomFrequencyCall(frequency, 20_007);
    expect(previewCustomFrequencyLines(frequency)).toEqual(call.lines);
  });
});
