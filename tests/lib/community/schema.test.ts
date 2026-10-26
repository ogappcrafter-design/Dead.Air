// tests/lib/community/schema.test.ts
// DEA-95 Phase 1 — shared community schema contract.

import {
  PRESET_MAX_LIMIT,
  PRESET_TAG_MAX_COUNT,
  createPresetInputSchema,
  presetTagsSchema,
  presetQuerySchema,
  presetSchema,
  reportInputSchema,
  updatePresetInputSchema,
} from '@/lib/community/schema';

const validPreset = {
  name: 'The Long Wave',
  description: 'A slow sweep across the lost band.',
  payload: { frequency: 99.5, band: 'LOST', volume: 0.6, tone: 'warm' },
  tags: ['Night', 'calm', 'night'],
};

describe('createPresetInputSchema', () => {
  it('accepts a valid preset and normalizes tags', () => {
    const parsed = createPresetInputSchema.parse(validPreset);
    expect(parsed.tags).toEqual(['night', 'calm']);
    expect(parsed.payload.volume).toBe(0.6);
  });

  it('defaults volume when omitted', () => {
    const parsed = createPresetInputSchema.parse({
      name: 'Quiet Dial',
      payload: { frequency: 90, band: 'LIVING' },
    });
    expect(parsed.payload.volume).toBe(0.8);
  });

  it.each([
    ['🎵🎶', false],
    ['🎵🎶🎵', true],
    ['🎵'.repeat(60), true],
    ['🎵'.repeat(61), false],
    ['ab\0valid', false],
  ])('validates Unicode name %p consistently on create and update', (name, accepted) => {
    expect(createPresetInputSchema.safeParse({ ...validPreset, name }).success).toBe(accepted);
    expect(updatePresetInputSchema.safeParse({ name }).success).toBe(accepted);
  });

  it('rejects a too-short name', () => {
    expect(createPresetInputSchema.safeParse({ ...validPreset, name: 'ab' }).success).toBe(false);
  });

  it('rejects a frequency outside the dial range', () => {
    expect(
      createPresetInputSchema.safeParse({
        ...validPreset,
        payload: { frequency: 12, band: 'LIVING' },
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown band', () => {
    expect(
      createPresetInputSchema.safeParse({
        ...validPreset,
        payload: { frequency: 99.5, band: 'NOT_A_BAND' },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown fields so custom-call content cannot ride along', () => {
    expect(createPresetInputSchema.safeParse({ ...validPreset, callScript: '...' }).success).toBe(
      false,
    );
  });

  it('rejects too many tags', () => {
    const tags = Array.from({ length: PRESET_TAG_MAX_COUNT + 1 }, (_, index) => `tag-${index}`);
    expect(createPresetInputSchema.safeParse({ ...validPreset, tags }).success).toBe(false);
  });

  it.each([
    ['İ'.repeat(12), true],
    ['İ'.repeat(13), false],
    ['A'.repeat(24), true],
    ['A'.repeat(25), false],
  ])('validates normalized tag %p on create and update', (tag, accepted) => {
    const tags = [tag];
    const created = createPresetInputSchema.safeParse({ ...validPreset, tags });
    const updated = updatePresetInputSchema.safeParse({ tags });
    expect(created.success).toBe(accepted);
    expect(updated.success).toBe(accepted);
    if (created.success && updated.success) {
      expect(presetTagsSchema.parse(created.data.tags)).toEqual(created.data.tags);
      expect(presetTagsSchema.parse(updated.data.tags)).toEqual(updated.data.tags);
    }
  });
});

describe('updatePresetInputSchema', () => {
  it('accepts a partial update', () => {
    expect(updatePresetInputSchema.safeParse({ name: 'Renamed Preset' }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(updatePresetInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('presetQuerySchema', () => {
  it('defaults the limit and coerces query strings', () => {
    expect(presetQuerySchema.parse({}).limit).toBe(20);
    expect(presetQuerySchema.parse({ limit: '12' }).limit).toBe(12);
  });

  it('rejects limits above the list cap', () => {
    expect(presetQuerySchema.safeParse({ limit: String(PRESET_MAX_LIMIT + 1) }).success).toBe(
      false,
    );
  });

  it('rejects an over-long search term', () => {
    expect(presetQuerySchema.safeParse({ q: 'x'.repeat(65) }).success).toBe(false);
  });
});

describe('presetQuerySchema band filter', () => {
  it('accepts a band filter', () => {
    expect(presetQuerySchema.parse({ band: 'LIMINAL' }).band).toBe('LIMINAL');
  });
});

describe('reportInputSchema', () => {
  it('accepts a known reason', () => {
    expect(reportInputSchema.parse({ reason: 'spam' }).reason).toBe('spam');
  });

  it('rejects an unknown reason', () => {
    expect(reportInputSchema.safeParse({ reason: 'because' }).success).toBe(false);
  });
});

describe('presetSchema', () => {
  it('parses a public preset response', () => {
    const parsed = presetSchema.parse({
      id: 'preset-1',
      name: 'The Long Wave',
      description: '',
      payload: { frequency: 99.5, band: 'LOST', volume: 0.6 },
      tags: ['night'],
      authorName: 'STATIC-1A2B',
      schemaVersion: 1,
      status: 'published',
      reportCount: 0,
      createdAt: '2026-10-26T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
    });
    expect(parsed.status).toBe('published');
  });

  it('rejects a non-ISO timestamp', () => {
    expect(
      presetSchema.safeParse({
        id: 'preset-1',
        name: 'The Long Wave',
        description: '',
        payload: { frequency: 99.5, band: 'LOST' },
        tags: [],
        authorName: 'STATIC-1A2B',
        schemaVersion: 1,
        status: 'published',
        reportCount: 0,
        createdAt: 'yesterday',
        updatedAt: 'yesterday',
      }).success,
    ).toBe(false);
  });
});
