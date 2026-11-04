// __tests__/engine/audio/tts/FormantSynthesizer.test.ts
import { renderSpeech } from '../../../../engine/audio/tts/FormantSynthesizer';
import { voiceProfileFor, type VoiceProfile } from '../../../../engine/audio/tts/VoiceProfile';

const profile = (overrides: Partial<VoiceProfile> = {}): VoiceProfile => ({
  ...voiceProfileFor({ id: 7, callerId: 'TEST-1', band: 1, signal: 4 }, { sanity: 100 }),
  ...overrides,
});

const SAMPLE_RATE = 8000;

describe('tts/FormantSynthesizer', () => {
  it('renders PCM for spoken text', () => {
    const rendered = renderSpeech('hello', profile(), { sampleRate: SAMPLE_RATE });
    expect(rendered.samples.length).toBeGreaterThan(0);
    expect(rendered.segmentCount).toBeGreaterThan(0);
    expect(rendered.sampleRate).toBe(SAMPLE_RATE);
    expect(rendered.durationSec).toBeGreaterThan(0);
  });

  it('returns an empty buffer for silent input', () => {
    const rendered = renderSpeech('   ', profile(), { sampleRate: SAMPLE_RATE });
    expect(rendered.samples.length).toBe(0);
    expect(rendered.durationSec).toBe(0);
    expect(rendered.segmentCount).toBe(0);
  });

  it('is deterministic for identical text and profile', () => {
    const a = renderSpeech('the signal is forming', profile(), { sampleRate: SAMPLE_RATE });
    const b = renderSpeech('the signal is forming', profile(), { sampleRate: SAMPLE_RATE });
    expect(a.samples.length).toBe(b.samples.length);
    expect(a.samples).toEqual(b.samples);
  });

  it('produces different audio for different voices', () => {
    const a = renderSpeech('hello', profile({ f0: 100 }), { sampleRate: SAMPLE_RATE });
    const b = renderSpeech('hello', profile({ f0: 180 }), { sampleRate: SAMPLE_RATE });
    expect(a.samples).not.toEqual(b.samples);
  });

  it('fits speech into the requested window', () => {
    const target = 1200;
    const rendered = renderSpeech('hello there operator', profile(), {
      sampleRate: SAMPLE_RATE,
      targetDurationMs: target,
    });
    // Tail adds ~20 ms of release; allow a generous tolerance for fit clamping.
    expect(rendered.durationSec * 1000).toBeGreaterThan(target * 0.6);
    expect(rendered.durationSec * 1000).toBeLessThan(target * 1.35);
    expect(rendered.fitted).toBe(true);
  });

  it('normalizes output and never emits NaN or Infinity', () => {
    const rendered = renderSpeech('classified transmission', profile(), {
      sampleRate: SAMPLE_RATE,
    });
    let peak = 0;
    for (const sample of rendered.samples) {
      expect(Number.isFinite(sample)).toBe(true);
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
    }
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(0.9);
  });

  it('keeps the buffer length consistent with its reported duration', () => {
    const rendered = renderSpeech('one two', profile(), { sampleRate: SAMPLE_RATE });
    expect(rendered.durationSec).toBeCloseTo(rendered.samples.length / SAMPLE_RATE, 6);
  });

  it('honors very low sample rates without throwing', () => {
    const rendered = renderSpeech('test', profile(), { sampleRate: 1000 });
    expect(rendered.sampleRate).toBe(8000); // clamped to the supported floor
    expect(rendered.samples.length).toBeGreaterThan(0);
  });
});
