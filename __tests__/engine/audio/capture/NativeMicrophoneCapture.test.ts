// __tests__/engine/audio/capture/NativeMicrophoneCapture.test.ts
// DEA-90 — native capture wiring over a fake expo-audio PCM stream.
// No native module and no microphone: buffers are fed by hand.

import type { AudioStreamBuffer } from 'expo-audio';

const mockStreamStart = jest.fn(async () => {});
const mockStreamStop = jest.fn();
const mockStreamRelease = jest.fn();
let mockBufferListener: ((buffer: AudioStreamBuffer) => void) | null = null;
const mockSubscriptionRemove = jest.fn();

const mockAudioStream = jest.fn().mockImplementation(() => ({
  start: mockStreamStart,
  stop: mockStreamStop,
  release: mockStreamRelease,
  addListener: jest.fn((_event: string, listener: (buffer: AudioStreamBuffer) => void) => {
    mockBufferListener = listener;
    return { remove: mockSubscriptionRemove };
  }),
}));

const mockGetPermission = jest.fn();
const mockRequestPermission = jest.fn();
const mockSetAudioMode = jest.fn(async () => {});

jest.mock('expo-audio', () => ({
  __esModule: true,
  AudioModule: { AudioStream: mockAudioStream },
  getRecordingPermissionsAsync: () => mockGetPermission(),
  requestRecordingPermissionsAsync: () => mockRequestPermission(),
  setAudioModeAsync: (mode: unknown) => mockSetAudioMode(mode),
}));

const { NativeMicrophoneCapture } =
  require('@/engine/audio/capture/platform/native/NativeMicrophoneCapture') as typeof import('@/engine/audio/capture/platform/native/NativeMicrophoneCapture');

const granted = { granted: true, canAskAgain: true, status: 'granted' };
const deniedFinal = { granted: false, canAskAgain: false, status: 'denied' };
const deniedAskable = { granted: false, canAskAgain: true, status: 'denied' };

/** Build a float32 PCM buffer with a constant amplitude. */
const makeBuffer = (amplitude: number, samples = 32): AudioStreamBuffer => {
  const data = new Float32Array(samples);
  data.fill(amplitude);
  return { data: data.buffer, sampleRate: 48000, channels: 1, timestamp: 0 };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBufferListener = null;
});

describe('NativeMicrophoneCapture — permission', () => {
  it('reuses an existing grant without prompting', async () => {
    mockGetPermission.mockResolvedValue(granted);
    const capture = new NativeMicrophoneCapture();

    await expect(capture.requestPermission()).resolves.toBe('granted');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('asks when undetermined and accepts the grant', async () => {
    mockGetPermission.mockResolvedValue(deniedAskable);
    mockRequestPermission.mockResolvedValue(granted);
    const capture = new NativeMicrophoneCapture();

    await expect(capture.requestPermission()).resolves.toBe('granted');
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });

  it('reports denied when the OS will not ask again', async () => {
    mockGetPermission.mockResolvedValue(deniedFinal);
    const capture = new NativeMicrophoneCapture();

    await expect(capture.requestPermission()).resolves.toBe('denied');
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('reports denied when the player refuses the prompt', async () => {
    mockGetPermission.mockResolvedValue(deniedAskable);
    mockRequestPermission.mockResolvedValue(deniedFinal);
    const capture = new NativeMicrophoneCapture();

    await expect(capture.requestPermission()).resolves.toBe('denied');
  });

  it('reports unavailable when the native module throws', async () => {
    mockGetPermission.mockRejectedValue(new Error('no native module'));
    const capture = new NativeMicrophoneCapture();

    await expect(capture.requestPermission()).resolves.toBe('unavailable');
  });
});

describe('NativeMicrophoneCapture — capture', () => {
  it('streams PCM buffers as RMS levels', async () => {
    const capture = new NativeMicrophoneCapture();
    const onLevel = jest.fn();

    await expect(capture.start(onLevel)).resolves.toBe(true);
    expect(mockAudioStream).toHaveBeenCalledWith({
      sampleRate: 48000,
      channels: 1,
      encoding: 'float32',
    });
    expect(mockStreamStart).toHaveBeenCalledTimes(1);

    mockBufferListener?.(makeBuffer(0.25));
    expect(onLevel).toHaveBeenCalledTimes(1);
    expect(onLevel.mock.calls[0]?.[0]).toBeCloseTo(0.25, 6);

    capture.stop();
  });

  it('ignores malformed buffers without breaking the stream', async () => {
    const capture = new NativeMicrophoneCapture();
    const onLevel = jest.fn();
    await capture.start(onLevel);

    mockBufferListener?.({
      data: new ArrayBuffer(3),
      sampleRate: 48000,
      channels: 1,
      timestamp: 0,
    });
    mockBufferListener?.(makeBuffer(0.1));

    expect(onLevel).toHaveBeenCalledTimes(1);
    capture.stop();
  });

  it('releases the stream and restores playback on stop', async () => {
    const capture = new NativeMicrophoneCapture();
    await capture.start(jest.fn());

    capture.stop();

    expect(mockStreamStop).toHaveBeenCalledTimes(1);
    expect(mockStreamRelease).toHaveBeenCalledTimes(1);
    expect(mockSubscriptionRemove).toHaveBeenCalledTimes(1);
    expect(mockSetAudioMode).toHaveBeenCalledWith({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  });

  it('returns false and cleans up when the stream cannot start', async () => {
    mockStreamStart.mockRejectedValueOnce(new Error('microphone busy'));
    const capture = new NativeMicrophoneCapture();

    await expect(capture.start(jest.fn())).resolves.toBe(false);
    expect(mockStreamStop).toHaveBeenCalledTimes(1);
    expect(mockStreamRelease).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable when expo-audio has no PCM stream class', () => {
    const capture = new NativeMicrophoneCapture();
    const audioModule = require('expo-audio').AudioModule as { AudioStream?: unknown };
    const original = audioModule.AudioStream;
    audioModule.AudioStream = undefined;

    try {
      expect(capture.isAvailable()).toBe(false);
    } finally {
      audioModule.AudioStream = original;
    }
  });
});
