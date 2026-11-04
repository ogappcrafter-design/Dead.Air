// __tests__/engine/audio/tts/VoiceProfile.test.ts
import {
  voiceProfileFor,
  type VoiceProfileSource,
} from '../../../../engine/audio/tts/VoiceProfile';

const baseSource: VoiceProfileSource = {
  id: 42,
  callerId: 'LIVING-0001',
  callerName: 'The Archivist',
  band: 0,
  signal: 4,
};

describe('tts/VoiceProfile', () => {
  it('is deterministic for identical input', () => {
    const a = voiceProfileFor(baseSource);
    const b = voiceProfileFor(baseSource);
    expect(a).toEqual(b);
    expect(a.seed).toBe(b.seed);
  });

  it('gives different procedural variants different voices', () => {
    const a = voiceProfileFor(baseSource);
    const b = voiceProfileFor({ ...baseSource, callerId: 'LIVING-0002' });
    expect(a.seed).not.toBe(b.seed);
    expect(a.f0).not.toBe(b.f0);
  });

  it('separates multi-caller speakers', () => {
    const first = voiceProfileFor(baseSource, { speakerIndex: 0 });
    const second = voiceProfileFor(baseSource, { speakerIndex: 1 });
    expect(second.f0).toBeGreaterThan(first.f0);
    expect(second.seed).not.toBe(first.seed);
  });

  it('darker bands produce a lower base pitch', () => {
    const living = voiceProfileFor({ ...baseSource, band: 0 });
    const redacted = voiceProfileFor({ ...baseSource, band: 4 });
    expect(redacted.f0).toBeLessThan(living.f0);
  });

  it('keeps prosody parameters in sane ranges', () => {
    const p = voiceProfileFor(baseSource);
    expect(p.f0).toBeGreaterThanOrEqual(65);
    expect(p.f0).toBeLessThanOrEqual(240);
    expect(p.rate).toBeGreaterThanOrEqual(0.8);
    expect(p.rate).toBeLessThanOrEqual(1.2);
    expect(p.formantScale).toBeGreaterThanOrEqual(0.85);
    expect(p.formantScale).toBeLessThanOrEqual(1.15);
    expect(p.breathiness).toBeGreaterThanOrEqual(0);
    expect(p.breathiness).toBeLessThanOrEqual(0.6);
    expect(p.gain).toBeGreaterThan(0);
    expect(p.gain).toBeLessThanOrEqual(1);
  });

  it('has no sanity-driven pitch drift at or above 50 sanity', () => {
    expect(voiceProfileFor(baseSource, { sanity: 50 }).pitchCents).toBe(0);
    expect(voiceProfileFor(baseSource, { sanity: 100 }).pitchCents).toBe(0);
  });

  it('drifts pitch deterministically when sanity collapses', () => {
    const low = voiceProfileFor(baseSource, { sanity: 0 });
    const lowAgain = voiceProfileFor(baseSource, { sanity: 0 });
    expect(low.pitchCents).toBe(lowAgain.pitchCents);
    expect(Math.abs(low.pitchCents)).toBeLessThanOrEqual(200);
  });

  it('weak signal increases breathiness', () => {
    const strong = voiceProfileFor({ ...baseSource, signal: 5 });
    const weak = voiceProfileFor({ ...baseSource, signal: 0 });
    expect(weak.breathiness).toBeGreaterThan(strong.breathiness);
  });

  it('includes the variant discriminator in the seed', () => {
    const a = voiceProfileFor(baseSource, { variant: 'forge-1' });
    const b = voiceProfileFor(baseSource, { variant: 'forge-2' });
    expect(a.seed).not.toBe(b.seed);
  });
});
