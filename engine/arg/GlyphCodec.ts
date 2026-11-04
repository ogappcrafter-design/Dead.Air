// engine/arg/GlyphCodec.ts
// DEA-91: the in-fiction ARG glyph codec.
//
// The CRT scanline layer carries a 13x13 phosphor glyph matrix. It is not a
// real QR code — no error correction, no versioning — it is a fixed-size,
// finder-anchored bit matrix the player can screenshot, count by hand, and
// read, or resolve in-game through the signal-bleed DECODE action. The shape
// borrows QR's visual grammar (three finders, timing lines) so the
// screenshot-and-decode impulse fires, while staying cheap enough to ride the
// 20-View scanline stack as 13 mono text rows.
//
// Layout (13x13):
//   3x3 solid finder blocks at top-left, top-right, bottom-left
//   timing row 6 + timing column 6, alternating cells (QR's convention)
//   117 data cells in row-major order, 6 bits per character (MSB first)
//
// A payload is at most 19 characters from GLYPH_ALPHABET. The trailing cells
// after the payload carry a seeded dither, so the same payload renders with a
// slightly different noise field on every shift — the trace reads as
// interference, not as a printed label. The payload itself never varies.

import { SeededRNG } from '../calls/SeededRNG';

export const GLYPH_SIZE = 13;
export const GLYPH_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-';
export const GLYPH_BITS_PER_CHAR = 6;
export const GLYPH_TIMING_INDEX = 6;
export const GLYPH_MAX_CHARS = 19;

/** Phosphor matrix. `true` = lit cell. Row-major, GLYPH_SIZE x GLYPH_SIZE. */
export type GlyphGrid = boolean[][];

/**
 * Lit / unlit characters used to render a grid as text rows. The unlit cell is
 * a space, not a dot: a middle dot is missing from many mono fallbacks and
 * renders at a different advance width, which would shear the matrix. Space and
 * a block element keep every cell exactly one character wide in any monospace
 * font.
 */
export const GLYPH_ON = '█';
export const GLYPH_OFF = ' ';

const FINDER_ORIGINS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, GLYPH_SIZE - 3],
  [GLYPH_SIZE - 3, 0],
];

function isFinderCell(row: number, col: number): boolean {
  return FINDER_ORIGINS.some(
    ([originRow, originCol]) =>
      row >= originRow && row < originRow + 3 && col >= originCol && col < originCol + 3,
  );
}

function isTimingCell(row: number, col: number): boolean {
  return row === GLYPH_TIMING_INDEX || col === GLYPH_TIMING_INDEX;
}

/** Data cells in row-major order (payload bits first, dither bits last). */
const DATA_CELLS: ReadonlyArray<readonly [number, number]> = (() => {
  const cells: Array<readonly [number, number]> = [];
  for (let row = 0; row < GLYPH_SIZE; row++) {
    for (let col = 0; col < GLYPH_SIZE; col++) {
      if (!isFinderCell(row, col) && !isTimingCell(row, col)) {
        cells.push([row, col]);
      }
    }
  }
  return cells;
})();

/** Number of payload/dither cells available in a 13x13 grid. */
export const GLYPH_DATA_CELL_COUNT = DATA_CELLS.length;

/** Bits consumed by a full-length payload (19 chars x 6 bits). */
export const GLYPH_PAYLOAD_BITS = GLYPH_MAX_CHARS * GLYPH_BITS_PER_CHAR;

function emptyGrid(): GlyphGrid {
  return Array.from({ length: GLYPH_SIZE }, () => Array.from({ length: GLYPH_SIZE }, () => false));
}

function charToBits(char: string): boolean[] {
  const index = GLYPH_ALPHABET.indexOf(char);
  if (index < 0) {
    throw new Error(`GlyphCodec: character "${char}" is not in the glyph alphabet`);
  }
  return Array.from(
    { length: GLYPH_BITS_PER_CHAR },
    (_, bit) => ((index >> (GLYPH_BITS_PER_CHAR - 1 - bit)) & 1) === 1,
  );
}

/**
 * Upper-case, pad with spaces and truncate to the glyph capacity.
 * Payloads are authored in data/ and are always short enough; truncation is
 * the safe failure mode rather than a silent overflow.
 */
export function normalizeGlyphText(text: string): string {
  return text.toUpperCase().padEnd(GLYPH_MAX_CHARS, ' ').slice(0, GLYPH_MAX_CHARS);
}

/**
 * Encode a payload into a glyph matrix.
 *
 * @param text payload (case-insensitive, must be drawn from GLYPH_ALPHABET)
 * @param seed deterministic dither seed — same seed, same matrix
 */
export function encodeGlyphMatrix(text: string, seed: string): GlyphGrid {
  const normalized = normalizeGlyphText(text);
  const grid = emptyGrid();

  for (const [originRow, originCol] of FINDER_ORIGINS) {
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
      const row = grid[originRow + rowOffset];
      if (row === undefined) continue;
      for (let colOffset = 0; colOffset < 3; colOffset++) {
        row[originCol + colOffset] = true;
      }
    }
  }

  for (let index = 0; index < GLYPH_SIZE; index++) {
    const lit = index % 2 === 0;
    const timingRow = grid[GLYPH_TIMING_INDEX];
    if (timingRow !== undefined) timingRow[index] = lit;
    const row = grid[index];
    if (row !== undefined) row[GLYPH_TIMING_INDEX] = lit;
  }

  const bits = normalized.split('').flatMap(charToBits);
  const rng = new SeededRNG(seed);

  DATA_CELLS.forEach(([row, col], index) => {
    const bit = bits[index] ?? rng.chance(0.5);
    const target = grid[row];
    if (target !== undefined) target[col] = bit;
  });

  return grid;
}

/** True when all three finder blocks are intact (the matrix is a trace). */
export function hasGlyphFinders(grid: GlyphGrid): boolean {
  if (grid.length !== GLYPH_SIZE) return false;
  return FINDER_ORIGINS.every(([originRow, originCol]) => {
    for (let rowOffset = 0; rowOffset < 3; rowOffset++) {
      const row = grid[originRow + rowOffset];
      if (row === undefined) return false;
      for (let colOffset = 0; colOffset < 3; colOffset++) {
        if (row[originCol + colOffset] !== true) return false;
      }
    }
    return true;
  });
}

/**
 * Read a payload back out of a glyph matrix. Returns null when the finders are
 * damaged or a character code falls outside the alphabet — a screenshot with a
 * scanline burned through it fails cleanly instead of printing garbage.
 */
export function decodeGlyphMatrix(grid: GlyphGrid): string | null {
  if (!hasGlyphFinders(grid)) return null;

  const bits = DATA_CELLS.map(([row, col]) => grid[row]?.[col] === true);
  let text = '';

  for (let charIndex = 0; charIndex < GLYPH_MAX_CHARS; charIndex++) {
    let value = 0;
    for (let bit = 0; bit < GLYPH_BITS_PER_CHAR; bit++) {
      const lit = bits[charIndex * GLYPH_BITS_PER_CHAR + bit] === true;
      value = (value << 1) | (lit ? 1 : 0);
    }
    const char = GLYPH_ALPHABET[value];
    if (char === undefined) return null;
    text += char;
  }

  return text.trimEnd();
}

/** Render a grid as mono text rows (one row per matrix row). */
export function glyphMatrixRows(grid: GlyphGrid): string[] {
  return grid.map((row) => row.map((lit) => (lit ? GLYPH_ON : GLYPH_OFF)).join(''));
}
