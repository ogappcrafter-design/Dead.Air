// tests/lib/community/customFrequencySchema.test.ts
// DEA-89 — shared schema validation for composed presets and friend codes.

import { createCustomFrequencyDraft } from '@/engine/calls/CustomFrequency';
import { customFrequencyToPresetInput } from '@/lib/community/frequencyPreset';
import {
  createPresetInputSchema,
  presetPayloadSchema,
  presetQuerySchema,
} from '@/lib/community/schema';

function inputFor(band = 0) {
  const frequency = createCustomFrequencyDraft(band, {
    id: 'local:schema',
    name: 'Schema Frequency',
    createdAt: 1,
  });
  if (frequency === null) throw new Error('No draft');
  return customFrequencyToPresetInput(frequency);
}

describe('composed preset payloads', () => {
  it('accepts a composition and difficulty pair', () => {
    const parsed = createPresetInputSchema.parse(inputFor());
    expect(parsed.payload.composition).toBeDefined();
    expect(parsed.payload.difficulty).toBeDefined();
  });

  it('still accepts a legacy tuning-only payload', () => {
    expect(
      presetPayloadSchema.safeParse({ frequency: 99.5, band: 'LOST', volume: 0.6 }).success,
    ).toBe(true);
  });

  it('rejects a composition without difficulty', () => {
    const input = inputFor();
    const payload = { ...input.payload, difficulty: undefined };
    expect(presetPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a difficulty without composition', () => {
    const input = inputFor();
    const payload = { ...input.payload, composition: undefined };
    expect(presetPayloadSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects a composition band that disagrees with the preset band', () => {
    const input = inputFor();
    const payload = { ...input.payload, band: 'LIMINAL' };
    const result = presetPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'composition.band')).toBe(
        true,
      );
    }
  });

  it('rejects fragment references outside the band library', () => {
    const input = inputFor();
    const composition = input.payload.composition!;
    const payload = {
      ...input.payload,
      composition: { ...composition, openingIndex: 999 },
    };
    const result = presetPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path.join('.') === 'composition.openingIndex'),
      ).toBe(true);
    }
  });

  it('rejects difficulty values outside the band range', () => {
    const input = inputFor();
    const payload = {
      ...input.payload,
      difficulty: { ...input.payload.difficulty!, sanityDelta: -99 },
    };
    const result = presetPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects unknown custom-call fields', () => {
    const input = inputFor();
    expect(
      presetPayloadSchema.safeParse({ ...input.payload, callScript: 'free text' }).success,
    ).toBe(false);
  });
});

describe('friend code sharing fields', () => {
  it('normalizes a friend code on create', () => {
    const parsed = createPresetInputSchema.parse({
      ...inputFor(),
      friendCode: ' da-abcde ',
    });
    expect(parsed.friendCode).toBe('DA-ABCDE');
  });

  it('rejects an invalid friend code', () => {
    expect(
      createPresetInputSchema.safeParse({ ...inputFor(), friendCode: 'DA-12345' }).success,
    ).toBe(false);
  });

  it('accepts a friend code filter in the list query', () => {
    expect(presetQuerySchema.parse({ friendCode: 'da-abcde' }).friendCode).toBe('DA-ABCDE');
  });

  it('rejects an invalid friend code filter', () => {
    expect(presetQuerySchema.safeParse({ friendCode: 'nope' }).success).toBe(false);
  });
});
