// __tests__/engine/audio/capture/WebMicrophoneCapture.test.ts
// DEA-90 — web capture wiring over a fake getUserMedia/AudioContext.
// No real microphone is touched: the analyser returns a constant frame.

import { WebMicrophoneCapture } from '@/engine/audio/capture/platform/web/WebMicrophoneCapture';

interface FakeAnalyser {
  fftSize: number;
  smoothingTimeConstant: number;
  connect: jest.Mock;
  disconnect: jest.Mock;
  getFloatTimeDomainData: jest.Mock;
}

const makeAnalyser = (amplitude = 0.5): FakeAnalyser => ({
  fftSize: 0,
  smoothingTimeConstant: 0,
  connect: jest.fn(),
  disconnect: jest.fn(),
  getFloatTimeDomainData: jest.fn((frame: Float32Array) => {
    frame.fill(amplitude);
  }),
});

const makeStream = (): {
  getTracks: () => Array<{ stop: jest.Mock }>;
  track: { stop: jest.Mock };
} => {
  const track = { stop: jest.fn() };
  return { getTracks: () => [track], track };
};

interface Harness {
  capture: WebMicrophoneCapture;
  analyser: FakeAnalyser;
  stream: ReturnType<typeof makeStream>;
  getUserMedia: jest.Mock;
  close: jest.Mock;
}

const installHarness = (
  options: { amplitude?: number; getUserMediaError?: { name: string } } = {},
): Harness => {
  const analyser = makeAnalyser(options.amplitude ?? 0.5);
  const stream = makeStream();
  const getUserMedia = jest.fn(async () => {
    if (options.getUserMediaError) throw options.getUserMediaError;
    return stream;
  });
  const close = jest.fn(async () => {});

  const context = {
    state: 'running',
    createAnalyser: () => analyser,
    createMediaStreamSource: () => ({ connect: jest.fn() }),
    resume: jest.fn(async () => {}),
    close,
  };

  function MockAudioContext(this: unknown): unknown {
    return context;
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    value: MockAudioContext,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { mediaDevices: { getUserMedia } },
    configurable: true,
    writable: true,
  });

  return { capture: new WebMicrophoneCapture(), analyser, stream, getUserMedia, close };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('WebMicrophoneCapture', () => {
  it('reports availability when getUserMedia and AudioContext exist', () => {
    const { capture } = installHarness();
    expect(capture.isAvailable()).toBe(true);
  });

  it('reports unavailable without navigator.mediaDevices', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });
    expect(new WebMicrophoneCapture().isAvailable()).toBe(false);
  });

  it('grants permission and keeps the stream for start()', async () => {
    const { capture, getUserMedia, stream } = installHarness();

    await expect(capture.requestPermission()).resolves.toBe('granted');
    expect(getUserMedia).toHaveBeenCalledTimes(1);

    await expect(capture.start(jest.fn())).resolves.toBe(true);
    // The stream acquired for the prompt is reused, not re-requested.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stream.track.stop).not.toHaveBeenCalled();
    capture.stop();
  });

  it('classifies a browser refusal as denied', async () => {
    const { capture } = installHarness({ getUserMediaError: { name: 'NotAllowedError' } });
    await expect(capture.requestPermission()).resolves.toBe('denied');
  });

  it('classifies a missing device as unavailable', async () => {
    const { capture } = installHarness({ getUserMediaError: { name: 'NotFoundError' } });
    await expect(capture.requestPermission()).resolves.toBe('unavailable');
  });

  it('delivers RMS levels on the poll interval', async () => {
    const { capture } = installHarness({ amplitude: 0.5 });
    const onLevel = jest.fn();

    await expect(capture.start(onLevel)).resolves.toBe(true);
    expect(onLevel).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(50);
    expect(onLevel).toHaveBeenCalledTimes(1);
    expect(onLevel.mock.calls[0]?.[0]).toBeCloseTo(0.5, 6);

    await jest.advanceTimersByTimeAsync(100);
    expect(onLevel).toHaveBeenCalledTimes(3);
    capture.stop();
  });

  it('stops tracks, the analyser and the context', async () => {
    const { capture, analyser, stream, close } = installHarness();
    await capture.start(jest.fn());

    capture.stop();

    expect(analyser.disconnect).toHaveBeenCalled();
    expect(stream.track.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('is idempotent and safe to stop twice', async () => {
    const { capture, stream } = installHarness();
    await capture.start(jest.fn());

    capture.stop();
    capture.stop();

    expect(stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it('returns false when start() cannot build the graph', async () => {
    const { capture } = installHarness();
    Object.defineProperty(globalThis, 'AudioContext', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    await expect(capture.start(jest.fn())).resolves.toBe(false);
  });
});
