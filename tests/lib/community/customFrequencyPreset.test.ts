// tests/lib/community/customFrequencyPreset.test.ts
// DEA-89 — custom frequency <-> community preset round trip and import guards.

import {
  CUSTOM_CALL_TYPES,
  buildCustomFrequencyCall,
  createCustomFrequencyDraft,
  type CustomFrequency,
} from '@/engine/calls/CustomFrequency';
import {
  customFrequencyShareText,
  customFrequencyToPresetInput,
  presetHasCustomCall,
  presetToCustomFrequency,
} from '@/lib/community/frequencyPreset';
import { createPresetInputSchema, type Preset } from '@/lib/community/schema';
import { CommunityClient } from '@/lib/community/client';
import { createMemoryCache } from '@/lib/community/cache';

function frequency(): CustomFrequency {
  const value = createCustomFrequencyDraft(2, {
    id: 'local:round-trip',
    name: 'The Long Wave',
    description: 'A slow sweep across the lost band.',
    createdAt: 1_000,
  });
  if (value === null) throw new Error('No draft');
  return value;
}

function presetFrom(freq: CustomFrequency): Preset {
  const input = customFrequencyToPresetInput(freq, 'DA-ABCDE');
  const parsed = createPresetInputSchema.parse(input);
  return {
    id: 'preset-42',
    name: parsed.name,
    description: parsed.description ?? '',
    payload: parsed.payload,
    tags: parsed.tags ?? [],
    authorName: 'STATIC-1A2B',
    friendCode: parsed.friendCode ?? null,
    schemaVersion: 2,
    status: 'published',
    reportCount: 0,
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
  };
}

describe('custom frequency preset mapping', () => {
  it.each(CUSTOM_CALL_TYPES)(
    'preserves %s playback through sharing and different registry slots',
    (callType) => {
      const original = frequency();
      original.composition = {
        callType,
        middleIndices: original.composition.middleIndices,
        closingIndex: original.composition.closingIndex,
        openingIndex: original.composition.openingIndex,
        band: original.composition.band,
        ...(callType === 'RIGHT_ANSWER' ? { choiceIndices: [0, 1] } : {}),
      };
      const result = presetToCustomFrequency(presetFrom(original));
      if (!result.frequency) throw new Error('Missing installed frequency');

      const authoredCall = buildCustomFrequencyCall(original, 20_000);
      const installedCall = buildCustomFrequencyCall(result.frequency, 20_001);

      expect(installedCall).toEqual({
        ...authoredCall,
        id: 20_001,
        sourceCustomFrequencyId: result.frequency.id,
      });
    },
  );

  it('transmits store proof on both client publishing paths', async () => {
    const fetchImpl = jest.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(presetFrom(frequency())),
    );
    const client = new CommunityClient({
      baseUrl: 'https://api.test/community',
      enabled: true,
      cache: createMemoryCache(),
      fetchImpl,
    });
    const input = {
      ...customFrequencyToPresetInput(frequency()),
      entitlementProof: { platform: 'google' as const, purchaseToken: 'store-token' },
    };
    await client.createPreset(input);
    await client.updatePreset('preset-42', input);
    for (const call of fetchImpl.mock.calls) {
      expect(JSON.parse(String(call[1]?.body))).toMatchObject({
        entitlementProof: input.entitlementProof,
      });
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it('produces a community payload the shared schema accepts', () => {
    const input = customFrequencyToPresetInput(frequency(), 'DA-ABCDE');
    const parsed = createPresetInputSchema.parse(input);

    expect(parsed.payload.band).toBe('LOST');
    expect(parsed.payload.composition).toEqual(frequency().composition);
    expect(parsed.payload.difficulty).toEqual(frequency().difficulty);
    expect(parsed.friendCode).toBe('DA-ABCDE');
    expect(parsed.tags).toEqual(expect.arrayContaining(['custom-frequency', 'lost']));
  });

  it('round-trips an installed preset into a read-only frequency', () => {
    const original = frequency();
    const result = presetToCustomFrequency(presetFrom(original));

    expect(result.ok).toBe(true);
    expect(result.frequency?.origin).toBe('community');
    expect(result.frequency?.remoteId).toBe('preset-42');
    expect(result.frequency?.authorName).toBe('STATIC-1A2B');
    expect(result.frequency?.friendCode).toBe('DA-ABCDE');
    expect(result.frequency?.composition).toEqual(original.composition);
    expect(result.frequency?.difficulty).toEqual(original.difficulty);
  });

  it('refuses a legacy tuning-only preset', () => {
    const legacy = presetFrom(frequency());
    const tuningOnly: Preset = {
      ...legacy,
      payload: {
        frequency: legacy.payload.frequency,
        band: legacy.payload.band,
        volume: legacy.payload.volume,
      },
    };
    expect(presetHasCustomCall(tuningOnly)).toBe(false);
    const result = presetToCustomFrequency(tuningOnly);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe('payload.composition');
  });

  it('refuses an invalid imported composition', () => {
    const preset = presetFrom(frequency());
    const invalid: Preset = {
      ...preset,
      payload: {
        ...preset.payload,
        composition: { ...preset.payload.composition!, openingIndex: 999 },
      },
    };
    const result = presetToCustomFrequency(invalid);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === 'composition.openingIndex')).toBe(true);
  });

  it('refuses a band label that disagrees with the composition', () => {
    const preset = presetFrom(frequency());
    const mismatched: Preset = {
      ...preset,
      payload: {
        ...preset.payload,
        band: 'LIVING',
      },
    };
    const result = presetToCustomFrequency(mismatched);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.path).toBe('composition.band');
  });

  it('builds share text with the community id and friend code', () => {
    const installed = presetToCustomFrequency(presetFrom(frequency())).frequency!;
    const text = customFrequencyShareText(installed);
    expect(text).toContain('The Long Wave');
    expect(text).toContain('COMMUNITY ID: preset-42');
    expect(text).toContain('FRIEND CODE: DA-ABCDE');
  });
});
