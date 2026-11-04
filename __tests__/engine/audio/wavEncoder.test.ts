// __tests__/engine/audio/wavEncoder.test.ts
// 16-bit WAV + base64 encoding for native PCM playback.

import {
  bytesToBase64,
  encodeWavDataUri,
  encodeWavMono16,
} from '../../../engine/audio/platform/native/wavEncoder';

describe('wavEncoder', () => {
  it('writes a valid mono 16-bit PCM header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const bytes = encodeWavMono16(samples, 24000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const ascii = (offset: number, length: number): string =>
      String.fromCharCode(...Array.from(bytes.subarray(offset, offset + length)));

    expect(ascii(0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint32(28, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(bytes.length).toBe(44 + samples.length * 2);
  });

  it('clamps and quantizes samples to signed 16-bit', () => {
    const bytes = encodeWavMono16(new Float32Array([2, -2, 0]), 8000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
    expect(view.getInt16(48, true)).toBe(0);
  });

  it('base64-encodes with padding', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
    expect(bytesToBase64(new Uint8Array([0x66]))).toBe('Zg==');
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f]))).toBe('Zm8=');
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe('Zm9v');
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]))).toBe('Zm9vYmFy');
  });

  it('builds an expo-audio data URI', () => {
    const uri = encodeWavDataUri(new Float32Array([0, 0.25]), 16000);
    expect(uri.startsWith('data:audio/wav;base64,UklGR')).toBe(true);
  });
});
