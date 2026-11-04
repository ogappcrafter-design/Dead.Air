// __tests__/engine/audio/tts/Phonemizer.test.ts
import { phonemize, estimateSpeechDurationMs } from '../../../../engine/audio/tts/Phonemizer';

describe('tts/Phonemizer', () => {
  it('returns no segments for empty or whitespace input', () => {
    expect(phonemize('')).toEqual([]);
    expect(phonemize('   ')).toEqual([]);
  });

  it('is deterministic for identical text', () => {
    expect(phonemize('The signal is forming.')).toEqual(phonemize('The signal is forming.'));
  });

  it('produces voiced vowels and unvoiced consonants', () => {
    const segments = phonemize('ma');
    const kinds = segments.map((s) => s.kind);
    expect(kinds).toContain('nasal');
    expect(kinds).toContain('vowel');

    const vowel = segments.find((s) => s.kind === 'vowel');
    expect(vowel?.voiced).toBe(true);
    expect(vowel?.formants[0]).toBeGreaterThan(0);
  });

  it('marks fricatives as noisy', () => {
    const segments = phonemize('sss');
    const fricative = segments.find((s) => s.kind === 'fricative');
    expect(fricative?.noise).toBe(1);
    expect(fricative?.voiced).toBe(false);
  });

  it('adds a long pause for sentence punctuation and a short pause for commas', () => {
    const sentence = phonemize('Hello.');
    const comma = phonemize('Hello,');
    expect(sentence[sentence.length - 1]?.kind).toBe('pause');
    expect(sentence[sentence.length - 1]?.durationMs).toBe(340);
    expect(comma[comma.length - 1]?.durationMs).toBe(170);
  });

  it('expands digits into spoken words', () => {
    const segments = phonemize('2');
    const sources = segments.map((s) => s.source);
    expect(sources).toContain('t');
    expect(segments.some((s) => s.kind === 'vowel')).toBe(true);
  });

  it('resolves word-final y as a vowel', () => {
    const segments = phonemize('city');
    expect(segments.some((s) => s.kind === 'vowel' && s.source === 'y')).toBe(true);
  });

  it('handles punctuation-only and symbol-only input without throwing', () => {
    expect(() => phonemize('--- ... ###')).not.toThrow();
  });

  it('estimates total duration from segment durations', () => {
    const segments = phonemize('dead air');
    const expected = segments.reduce((sum, s) => sum + s.durationMs, 0);
    expect(estimateSpeechDurationMs(segments)).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
