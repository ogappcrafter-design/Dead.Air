// __tests__/engine/audio/NativeAudioGraph.test.ts
// Offline DSP used by the native bridge: filters, bitcrush, compressor, gains
// and the linear chain renderer.

import {
  NativeBiquadNode,
  NativeCompressorNode,
  NativeGainNode,
  NativeWaveShaperNode,
  renderNativeChain,
} from '../../../engine/audio/platform/native/NativeAudioGraph';
import { makeBitcrushCurve } from '../../../engine/audio/VoiceProcessor';

const SAMPLE_RATE = 24000;

const sine = (frequency: number, length: number): Float32Array => {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
  }
  return samples;
};

const rms = (samples: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const value = samples[i] ?? 0;
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
};

describe('NativeAudioGraph', () => {
  describe('NativeBiquadNode', () => {
    it('passes the band centre and rejects far-off frequencies', () => {
      const node = new NativeBiquadNode();
      node.setType('bandpass');
      node.setFrequency(1800);
      node.setQ(0.8);

      const inBand = node.process(sine(1800, 4800), SAMPLE_RATE);
      const outOfBand = node.process(sine(100, 4800), SAMPLE_RATE);

      expect(rms(inBand)).toBeGreaterThan(rms(outOfBand) * 4);
    });

    it('attenuates high frequencies with a lowpass', () => {
      const node = new NativeBiquadNode();
      node.setType('lowpass');
      node.setFrequency(500);
      node.setQ(0.7);

      const passed = node.process(sine(200, 4800), SAMPLE_RATE);
      const stopped = node.process(sine(6000, 4800), SAMPLE_RATE);

      expect(rms(passed)).toBeGreaterThan(rms(stopped) * 4);
    });

    it('clamps degenerate parameters instead of emitting NaN', () => {
      const node = new NativeBiquadNode();
      node.setFrequency(0);
      node.setQ(0);
      const out = node.process(sine(440, 1024), SAMPLE_RATE);
      expect(out.every((value) => Number.isFinite(value))).toBe(true);
    });
  });

  describe('NativeWaveShaperNode', () => {
    it('quantizes samples onto the bitcrush curve', () => {
      const node = new NativeWaveShaperNode();
      node.setCurve(makeBitcrushCurve(0.85, 1024));

      const out = node.process(sine(440, 2048), SAMPLE_RATE);
      // A heavy bitcrush collapses the waveform to a handful of levels.
      const distinct = new Set(Array.from(out, (value) => value.toFixed(4)));
      expect(distinct.size).toBeLessThan(12);
    });

    it('clamps out-of-range input to the curve endpoints', () => {
      const node = new NativeWaveShaperNode();
      node.setCurve(new Float32Array([-0.5, 0.5]));

      const out = node.process(new Float32Array([-2, 2]), SAMPLE_RATE);
      expect(out[0]).toBeCloseTo(-0.5);
      expect(out[1]).toBeCloseTo(0.5);
    });

    it('passes audio through unchanged without a curve', () => {
      const node = new NativeWaveShaperNode();
      const input = sine(440, 128);
      expect(Array.from(node.process(input, SAMPLE_RATE))).toEqual(Array.from(input));
    });
  });

  describe('NativeCompressorNode', () => {
    it('reduces loud signals and leaves quiet ones alone', () => {
      const node = new NativeCompressorNode();
      node.setThreshold(-24);
      node.setRatio(6);
      node.setKnee(0);
      node.setAttack(0.003);
      node.setRelease(0.25);

      const loud = sine(440, 4800);
      for (let i = 0; i < loud.length; i++) loud[i] = (loud[i] ?? 0) * 0.9;
      const quiet = sine(440, 4800);
      for (let i = 0; i < quiet.length; i++) quiet[i] = (quiet[i] ?? 0) * 0.05;

      const loudOut = node.process(loud, SAMPLE_RATE);
      const quietOut = node.process(quiet, SAMPLE_RATE);

      expect(rms(loudOut)).toBeLessThan(rms(loud) * 0.6);
      expect(rms(quietOut)).toBeCloseTo(rms(quiet), 1);
    });
  });

  describe('renderNativeChain', () => {
    it('walks the chain in connect order and stops at the last node', () => {
      const source = new NativeGainNode(1);
      const first = new NativeGainNode(0.5);
      const second = new NativeGainNode(0.5);

      source.connect(first);
      first.connect(second);

      const input = new Float32Array([1, -1, 0.5]);
      const out = renderNativeChain(source, input, SAMPLE_RATE);

      expect(Array.from(out)).toEqual([0.25, -0.25, 0.125]);
      // The input buffer is not mutated.
      expect(Array.from(input)).toEqual([1, -1, 0.5]);
    });

    it('returns the input untouched for an unconnected source', () => {
      const source = new NativeGainNode(1);
      const input = new Float32Array([0.1, 0.2]);
      const out = renderNativeChain(source, input, SAMPLE_RATE);
      expect(out[0]).toBeCloseTo(0.1, 6);
      expect(out[1]).toBeCloseTo(0.2, 6);
    });

    it('survives a cycle without looping forever', () => {
      const a = new NativeGainNode(0.5);
      const b = new NativeGainNode(0.5);
      a.connect(b);
      b.connect(a);
      const out = renderNativeChain(a, new Float32Array([1]), SAMPLE_RATE);
      expect(Array.from(out)).toEqual([0.5]);
    });
  });
});
