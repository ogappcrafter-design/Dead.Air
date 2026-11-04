// engine/audio/platform/native/wavEncoder.ts
// Encode mono Float32 PCM as a 16-bit WAV data URI.
//
// expo-audio accepts `data:audio/wav;base64,...` sources on both platforms:
// iOS writes the base64 payload to a temp file before handing it to AVPlayer
// (AudioUtils.handleBase64Asset), and Android's ExoPlayer resolves the `data:`
// scheme natively. That lets the native bridge play synthesized speech without
// touching the filesystem or shipping an audio asset.

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const writeAscii = (view: DataView, offset: number, text: string): void => {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
};

/** Encode mono PCM in [-1, 1] as a 16-bit PCM WAV container. */
export const encodeWavMono16 = (samples: Float32Array, sampleRate: number): Uint8Array => {
  const rate = Math.max(1, Math.round(sampleRate));
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true); // sample rate
  view.setUint32(28, rate * 2, true); // byte rate (rate * channels * bytesPerSample)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i] ?? 0;
    const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return new Uint8Array(buffer);
};

/** Base64-encode bytes without relying on a platform `btoa`. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  let chunk = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;

    chunk += BASE64_ALPHABET.charAt(b0 >> 2);
    chunk += BASE64_ALPHABET.charAt(((b0 & 0x03) << 4) | (b1 >> 4));
    chunk += i + 1 < bytes.length ? BASE64_ALPHABET.charAt(((b1 & 0x0f) << 2) | (b2 >> 6)) : '=';
    chunk += i + 2 < bytes.length ? BASE64_ALPHABET.charAt(b2 & 0x3f) : '=';

    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = '';
    }
  }

  if (chunk.length > 0) chunks.push(chunk);
  return chunks.join('');
};

/** Encode mono PCM as a `data:audio/wav;base64,...` URI for expo-audio. */
export const encodeWavDataUri = (samples: Float32Array, sampleRate: number): string =>
  `data:audio/wav;base64,${bytesToBase64(encodeWavMono16(samples, sampleRate))}`;
