// engine/audio/tts/Phonemizer.ts
// Deterministic grapheme → phoneme-segment conversion for the DEA-94 call voice.
//
// This is NOT a linguistic phonemizer: it is a compact, dependency-free
// English-ish grapheme reader that produces enough articulation detail for a
// formant synthesizer to sound like speech through a lo-fi radio chain. Every
// output is a pure function of the input text — no randomness, no I/O — so call
// lines always sound the same on every playthrough and in tests.

/** Articulation class of a segment. */
export type PhonemeKind = 'vowel' | 'fricative' | 'plosive' | 'nasal' | 'liquid' | 'pause';

/** One articulatory segment produced from the source text. */
export interface PhonemeSegment {
  kind: PhonemeKind;
  /** Source grapheme(s) that produced this segment (for debugging/tests). */
  source: string;
  /** Base duration in milliseconds at rate 1.0. */
  durationMs: number;
  /** Formant (or noise-band) center frequencies in Hz: [F1, F2, F3]. */
  formants: readonly [number, number, number];
  /** Resonator bandwidths in Hz, parallel to `formants`. */
  bandwidths: readonly [number, number, number];
  /** Noise mix 0..1. 1 = fully unvoiced (fricative/plosive burst). */
  noise: number;
  /** Amplitude 0..1. */
  amplitude: number;
  /** True when the glottal source drives the segment. */
  voiced: boolean;
}

/** A formant triple plus articulation metadata used by the rules tables. */
interface Articulation {
  kind: PhonemeKind;
  formants: readonly [number, number, number];
  bandwidths: readonly [number, number, number];
  noise: number;
  amplitude: number;
  voiced: boolean;
  durationMs: number;
}

const vowel = (
  formants: readonly [number, number, number],
  durationMs = 130,
  amplitude = 0.9,
): Articulation => ({
  kind: 'vowel',
  formants,
  bandwidths: [80, 110, 160],
  noise: 0,
  amplitude,
  voiced: true,
  durationMs,
});

const liquid = (formants: readonly [number, number, number], durationMs = 85): Articulation => ({
  kind: 'liquid',
  formants,
  bandwidths: [90, 120, 180],
  noise: 0,
  amplitude: 0.62,
  voiced: true,
  durationMs,
});

const nasal = (formants: readonly [number, number, number], durationMs = 90): Articulation => ({
  kind: 'nasal',
  formants,
  bandwidths: [110, 180, 240],
  noise: 0,
  amplitude: 0.45,
  voiced: true,
  durationMs,
});

const fricative = (
  formants: readonly [number, number, number],
  opts: { voiced?: boolean; amplitude?: number; durationMs?: number } = {},
): Articulation => ({
  kind: 'fricative',
  formants,
  bandwidths: [260, 380, 520],
  noise: 1,
  amplitude: opts.amplitude ?? (opts.voiced === true ? 0.32 : 0.26),
  voiced: opts.voiced === true,
  durationMs: opts.durationMs ?? 95,
});

const plosive = (
  formants: readonly [number, number, number],
  opts: { voiced?: boolean } = {},
): Articulation => ({
  kind: 'plosive',
  formants,
  bandwidths: [420, 600, 800],
  noise: 1,
  amplitude: opts.voiced === true ? 0.5 : 0.42,
  voiced: opts.voiced === true,
  durationMs: 55,
});

const pause = (durationMs: number): Articulation => ({
  kind: 'pause',
  formants: [0, 0, 0],
  bandwidths: [0, 0, 0],
  noise: 0,
  amplitude: 0,
  voiced: false,
  durationMs,
});

/** Vowel articulations keyed by normalized vowel class. */
const VOWELS: Record<string, Articulation> = {
  a: vowel([730, 1090, 2440]),
  ae: vowel([660, 1720, 2410], 140),
  e: vowel([530, 1840, 2480], 120),
  i: vowel([270, 2290, 3010], 115),
  o: vowel([570, 840, 2410], 135),
  u: vowel([300, 870, 2240], 125),
  schwa: vowel([500, 1500, 2500], 80, 0.62),
  er: vowel([490, 1350, 1690], 130),
  au: vowel([570, 900, 2400], 145),
  oi: vowel([500, 1900, 2500], 150),
};

/** Consonant articulations keyed by normalized letter/digraph class. */
const CONSONANTS: Record<string, Articulation> = {
  m: nasal([280, 1000, 2200]),
  n: nasal([280, 1700, 2600]),
  ng: nasal([280, 2000, 2700], 100),
  l: liquid([360, 1300, 2700]),
  r: liquid([420, 1300, 1600]),
  w: liquid([300, 610, 2200], 70),
  y: liquid([260, 2070, 3020], 65),
  f: fricative([1200, 2500, 4000]),
  v: fricative([1200, 2500, 4000], { voiced: true }),
  s: fricative([5000, 6500, 8000], { amplitude: 0.22 }),
  z: fricative([5000, 6500, 8000], { voiced: true, amplitude: 0.28 }),
  sh: fricative([2500, 4000, 5500], { amplitude: 0.3 }),
  zh: fricative([2500, 4000, 5500], { voiced: true, amplitude: 0.3 }),
  th: fricative([1400, 3500, 5000], { amplitude: 0.18 }),
  dh: fricative([1400, 3500, 5000], { voiced: true, amplitude: 0.24 }),
  h: fricative([1500, 3000, 4500], { amplitude: 0.16, durationMs: 70 }),
  p: plosive([800, 1500, 2500]),
  b: plosive([800, 1500, 2500], { voiced: true }),
  t: plosive([3000, 4500, 6000]),
  d: plosive([3000, 4500, 6000], { voiced: true }),
  k: plosive([2000, 3500, 5000]),
  g: plosive([2000, 3500, 5000], { voiced: true }),
};

/** Multi-letter graphemes, longest first so `tch` wins over `ch`. */
const GRAPHEMES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['ough', ['o']],
  ['tion', ['sh', 'schwa', 'n']],
  ['tch', ['ch']],
  ['sch', ['s', 'k']],
  ['air', ['er']],
  ['ear', ['er']],
  ['igh', ['i']],
  ['ee', ['i']],
  ['ea', ['i']],
  ['ie', ['i']],
  ['ei', ['i']],
  ['oo', ['u']],
  ['ou', ['au']],
  ['ow', ['o']],
  ['oa', ['o']],
  ['ue', ['u']],
  ['ew', ['u']],
  ['ui', ['u']],
  ['ai', ['e']],
  ['ay', ['e']],
  ['oi', ['oi']],
  ['oy', ['oi']],
  ['au', ['o']],
  ['aw', ['o']],
  ['ar', ['a', 'r']],
  ['or', ['o', 'r']],
  ['er', ['er']],
  ['ir', ['er']],
  ['ur', ['er']],
  ['th', ['th']],
  ['sh', ['sh']],
  ['ch', ['ch']],
  ['ph', ['f']],
  ['wh', ['w']],
  ['ck', ['k']],
  ['qu', ['k', 'w']],
  ['ng', ['ng']],
  ['gh', []],
  ['kn', ['n']],
  ['wr', ['r']],
];

/** Single-letter fallbacks. `y` is resolved contextually before this table. */
const SINGLE_LETTERS: Record<string, readonly string[]> = {
  a: ['a'],
  b: ['b'],
  c: ['k'],
  d: ['d'],
  e: ['e'],
  f: ['f'],
  g: ['g'],
  h: ['h'],
  i: ['i'],
  j: ['j'],
  k: ['k'],
  l: ['l'],
  m: ['m'],
  n: ['n'],
  o: ['o'],
  p: ['p'],
  q: ['k'],
  r: ['r'],
  s: ['s'],
  t: ['t'],
  u: ['u'],
  v: ['v'],
  w: ['w'],
  x: ['k', 's'],
  y: ['i'],
  z: ['z'],
};

/** Additional single-letter consonant not in CONSONANTS. */
const J_ARTICULATION: Articulation = fricative([2200, 3200, 4200], {
  voiced: true,
  amplitude: 0.3,
});

/** Digit names, expanded before phonemization. */
const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

/** Gap inserted between words (ms). */
const WORD_GAP_MS = 55;

/** Resolve a phoneme class name to an articulation. */
const articulationFor = (name: string): Articulation | null => {
  if (name === 'j') return J_ARTICULATION;
  return VOWELS[name] ?? CONSONANTS[name] ?? null;
};

/** Expand digits inside a token to spoken words. */
const expandDigits = (token: string): string =>
  token
    .split('')
    .map((ch) => DIGIT_WORDS[ch] ?? ch)
    .join('');

/**
 * Convert text into articulatory segments.
 *
 * Pure and deterministic: identical input always produces an identical array.
 * Empty/whitespace-only input produces an empty array.
 */
export function phonemize(text: string): PhonemeSegment[] {
  const segments: PhonemeSegment[] = [];
  if (typeof text !== 'string' || text.length === 0) return segments;

  const push = (art: Articulation, source: string): void => {
    segments.push({
      kind: art.kind,
      source,
      durationMs: art.durationMs,
      formants: art.formants,
      bandwidths: art.bandwidths,
      noise: art.noise,
      amplitude: art.amplitude,
      voiced: art.voiced,
    });
  };

  // Split on whitespace but keep punctuation attached to words.
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  tokens.forEach((rawToken, tokenIndex) => {
    const token = expandDigits(rawToken.replace(/[^a-z0-9']/g, ''));
    const trailing = rawToken.match(/[.,;:!?]+$/)?.[0] ?? '';

    if (token.length > 0) {
      const before = segments.length;

      let i = 0;
      while (i < token.length) {
        const rest = token.slice(i);
        let matched = false;

        for (const [grapheme, names] of GRAPHEMES) {
          if (rest.startsWith(grapheme)) {
            for (const name of names) {
              const art = articulationFor(name);
              if (art !== null) push(art, grapheme);
            }
            i += grapheme.length;
            matched = true;
            break;
          }
        }

        if (matched) continue;

        const ch = token[i] ?? '';
        // Silent trailing `e` after a consonant (e.g. "time", "gone").
        const isSilentFinalE =
          ch === 'e' && i === token.length - 1 && i > 0 && !/[aeiou]/.test(token[i - 1] ?? '');
        if (isSilentFinalE) {
          i += 1;
          continue;
        }

        // Word-final `y` reads as a long vowel ("every", "city").
        if (ch === 'y' && i === token.length - 1) {
          push(VOWELS['i'] as Articulation, ch);
          i += 1;
          continue;
        }

        const names = SINGLE_LETTERS[ch];
        if (names !== undefined) {
          for (const name of names) {
            const art = articulationFor(name);
            if (art !== null) push(art, ch);
          }
        }
        i += 1;
      }

      // Slight final-syllable lengthening: extend the last voiced vowel.
      const wordEnd = segments.length;
      for (let s = wordEnd - 1; s >= before; s--) {
        const seg = segments[s];
        if (seg !== undefined && seg.kind === 'vowel') {
          segments[s] = { ...seg, durationMs: Math.round(seg.durationMs * 1.18) };
          break;
        }
      }
    }

    if (tokenIndex < tokens.length - 1) {
      push(pause(WORD_GAP_MS), ' ');
    }

    if (trailing.length > 0) {
      const hard = /[.!?]/.test(trailing);
      push(pause(hard ? 340 : 170), trailing);
    }
  });

  return segments;
}

/** Sum of segment durations (ms) before any rate/target scaling. */
export function estimateSpeechDurationMs(segments: readonly PhonemeSegment[]): number {
  let total = 0;
  for (const seg of segments) total += seg.durationMs;
  return total;
}
