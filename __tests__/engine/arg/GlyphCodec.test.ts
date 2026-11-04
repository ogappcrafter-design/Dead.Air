// __tests__/engine/arg/GlyphCodec.test.ts
// DEA-91: the ARG glyph codec must round-trip (a screenshot is decodable) and
// its dither must be seeded (same shift, same matrix).

import {
  GLYPH_ALPHABET,
  GLYPH_DATA_CELL_COUNT,
  GLYPH_MAX_CHARS,
  GLYPH_PAYLOAD_BITS,
  GLYPH_SIZE,
  decodeGlyphMatrix,
  encodeGlyphMatrix,
  glyphMatrixRows,
  hasGlyphFinders,
  normalizeGlyphText,
} from '../../../engine/arg/GlyphCodec';
import { ARG_TRACES } from '../../../data/arg';

describe('GlyphCodec', () => {
  it('reserves enough cells for a full-length payload', () => {
    expect(GLYPH_DATA_CELL_COUNT).toBeGreaterThanOrEqual(GLYPH_PAYLOAD_BITS);
    expect(GLYPH_SIZE).toBe(13);
  });

  it('round-trips every authored trace payload', () => {
    for (const trace of ARG_TRACES) {
      const grid = encodeGlyphMatrix(trace.payload, `arg:${trace.id}:shift:1`);
      expect(decodeGlyphMatrix(grid)).toBe(trace.payload);
    }
  });

  it('round-trips a payload that fills the matrix', () => {
    const payload = 'ABCDEFGHIJKLMNOPQRS'; // 19 chars
    const grid = encodeGlyphMatrix(payload, 'seed');
    expect(decodeGlyphMatrix(grid)).toBe(payload);
  });

  it('is case-insensitive on encode and trims trailing padding on decode', () => {
    const grid = encodeGlyphMatrix('relay 46 104.7', 'seed');
    expect(decodeGlyphMatrix(grid)).toBe('RELAY 46 104.7');
  });

  it('is deterministic: the same seed produces an identical matrix', () => {
    const a = encodeGlyphMatrix('RELAY 47 UNLISTED', 'arg:trace-row-47:shift:9');
    const b = encodeGlyphMatrix('RELAY 47 UNLISTED', 'arg:trace-row-47:shift:9');
    expect(a).toEqual(b);
  });

  it('varies the dither field by seed without changing the payload', () => {
    const a = encodeGlyphMatrix('RELAY 47 UNLISTED', 'arg:trace-row-47:shift:9');
    const b = encodeGlyphMatrix('RELAY 47 UNLISTED', 'arg:trace-row-47:shift:10');
    expect(decodeGlyphMatrix(a)).toBe('RELAY 47 UNLISTED');
    expect(decodeGlyphMatrix(b)).toBe('RELAY 47 UNLISTED');
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('draws three intact finder blocks', () => {
    const grid = encodeGlyphMatrix('RELAY 23 11.04.87', 'seed');
    expect(hasGlyphFinders(grid)).toBe(true);
  });

  it('refuses a matrix whose finders are damaged', () => {
    const grid = encodeGlyphMatrix('RELAY 23 11.04.87', 'seed');
    grid[0]![0] = false;
    expect(hasGlyphFinders(grid)).toBe(false);
    expect(decodeGlyphMatrix(grid)).toBeNull();
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => encodeGlyphMatrix('RELAY 23 @', 'seed')).toThrow(/glyph alphabet/);
  });

  it('truncates over-long payloads rather than overflowing the matrix', () => {
    const normalized = normalizeGlyphText('A'.repeat(GLYPH_MAX_CHARS + 5));
    expect(normalized).toHaveLength(GLYPH_MAX_CHARS);
  });

  it('renders one mono row per matrix row', () => {
    const rows = glyphMatrixRows(encodeGlyphMatrix('RELAY 46 104.7', 'seed'));
    expect(rows).toHaveLength(GLYPH_SIZE);
    for (const row of rows) {
      expect(row).toHaveLength(GLYPH_SIZE);
    }
  });

  it('exposes an alphabet that covers every authored payload character', () => {
    for (const trace of ARG_TRACES) {
      for (const char of trace.payload) {
        expect(GLYPH_ALPHABET).toContain(char);
      }
    }
  });
});
