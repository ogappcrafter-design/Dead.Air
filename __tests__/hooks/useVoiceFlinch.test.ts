// __tests__/hooks/useVoiceFlinch.test.ts
// DEA-90 — the optional microphone path: voice flinches once, and every
// failure degrades silently to the tap-only mechanic.

import { renderHook, waitFor } from '@testing-library/react-native';

import {
  __resetMicrophonePermissionCache,
  type MicrophoneCapture,
  type MicrophonePermission,
} from '@/engine/audio/capture/MicrophoneCapture';
import { useVoiceFlinch } from '@/hooks/useVoiceFlinch';

const VAD_CONFIG = {
  calibrationFrames: 1,
  minSpeechFrames: 2,
  minSilenceFrames: 2,
};

interface FakeCapture extends MicrophoneCapture {
  emit(rms: number): void;
  readonly started: boolean;
}

const makeCapture = (
  options: {
    permission?: MicrophonePermission;
    available?: boolean;
    startResult?: boolean;
    startThrows?: boolean;
  } = {},
): FakeCapture => {
  let listener: ((rms: number) => void) | null = null;
  let started = false;

  return {
    platform: 'web',
    isAvailable: jest.fn(() => options.available ?? true),
    requestPermission: jest.fn(async () => options.permission ?? 'granted'),
    start: jest.fn(async (onLevel: (rms: number) => void) => {
      if (options.startThrows) throw new Error('capture exploded');
      if (options.startResult === false) return false;
      listener = onLevel;
      started = true;
      return true;
    }),
    stop: jest.fn(() => {
      listener = null;
      started = false;
    }),
    emit(rms: number) {
      listener?.(rms);
    },
    get started() {
      return started;
    },
  };
};

const emitFrames = (capture: FakeCapture, level: number, frames: number): void => {
  for (let i = 0; i < frames; i += 1) capture.emit(level);
};

const SILENCE = 0.001;
const SPEECH = 0.25;

beforeEach(() => {
  __resetMicrophonePermissionCache();
});

describe('useVoiceFlinch — detection', () => {
  it('reports a voice flinch once speech latches', async () => {
    const capture = makeCapture();
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected,
        loadCapture: async () => capture,
        vadConfig: VAD_CONFIG,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalledTimes(1));

    emitFrames(capture, SILENCE, 2);
    expect(onVoiceDetected).not.toHaveBeenCalled();

    emitFrames(capture, SPEECH, 2);
    expect(onVoiceDetected).toHaveBeenCalledTimes(1);
  });

  it('ignores steady room noise and short bursts', async () => {
    const capture = makeCapture();
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected,
        loadCapture: async () => capture,
        vadConfig: VAD_CONFIG,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());

    emitFrames(capture, 0.004, 30);
    emitFrames(capture, SPEECH, 1); // single-frame spike
    emitFrames(capture, 0.004, 30);

    expect(onVoiceDetected).not.toHaveBeenCalled();
  });

  it('stops capture and stays quiet after the first flinch', async () => {
    const capture = makeCapture();
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected,
        loadCapture: async () => capture,
        vadConfig: VAD_CONFIG,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());

    emitFrames(capture, SILENCE, 1);
    emitFrames(capture, SPEECH, 2);
    expect(onVoiceDetected).toHaveBeenCalledTimes(1);
    expect(capture.stop).toHaveBeenCalled();

    emitFrames(capture, SPEECH, 10);
    expect(onVoiceDetected).toHaveBeenCalledTimes(1);
  });
});

describe('useVoiceFlinch — graceful degradation', () => {
  it('does nothing while inactive', async () => {
    const capture = makeCapture();
    const loadCapture = jest.fn(async () => capture);

    await renderHook(() =>
      useVoiceFlinch({ active: false, onVoiceDetected: jest.fn(), loadCapture }),
    );

    await Promise.resolve();
    expect(loadCapture).not.toHaveBeenCalled();
    expect(capture.start).not.toHaveBeenCalled();
  });

  it('never starts capture when permission is denied', async () => {
    const capture = makeCapture({ permission: 'denied' });
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({ active: true, onVoiceDetected, loadCapture: async () => capture }),
    );

    await waitFor(() => expect(capture.requestPermission).toHaveBeenCalled());
    expect(capture.start).not.toHaveBeenCalled();
    expect(onVoiceDetected).not.toHaveBeenCalled();
  });

  it('skips the permission prompt when the capture API is missing', async () => {
    const capture = makeCapture({ available: false });

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected: jest.fn(),
        loadCapture: async () => capture,
      }),
    );

    await waitFor(() => expect(capture.isAvailable).toHaveBeenCalled());
    expect(capture.requestPermission).not.toHaveBeenCalled();
    expect(capture.start).not.toHaveBeenCalled();
  });

  it('survives a missing platform module', async () => {
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({ active: true, onVoiceDetected, loadCapture: async () => null }),
    );

    await Promise.resolve();
    expect(onVoiceDetected).not.toHaveBeenCalled();
  });

  it('survives a loader that throws', async () => {
    const onVoiceDetected = jest.fn();

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected,
        loadCapture: async () => {
          throw new Error('no module');
        },
      }),
    );

    await Promise.resolve();
    expect(onVoiceDetected).not.toHaveBeenCalled();
  });

  it('releases capture when start() fails', async () => {
    const capture = makeCapture({ startResult: false });

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected: jest.fn(),
        loadCapture: async () => capture,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());
    await waitFor(() => expect(capture.stop).toHaveBeenCalled());
  });

  it('releases capture when start() throws', async () => {
    const capture = makeCapture({ startThrows: true });

    await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected: jest.fn(),
        loadCapture: async () => capture,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());
    await waitFor(() => expect(capture.stop).toHaveBeenCalled());
  });

  it('stops capture on unmount', async () => {
    const capture = makeCapture();

    const { unmount } = await renderHook(() =>
      useVoiceFlinch({
        active: true,
        onVoiceDetected: jest.fn(),
        loadCapture: async () => capture,
        vadConfig: VAD_CONFIG,
      }),
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());
    await unmount();
    expect(capture.stop).toHaveBeenCalled();
  });

  it('stops capture when the call leaves the countdown', async () => {
    const capture = makeCapture();

    const { rerender } = await renderHook(
      ({ active }: { active: boolean }) =>
        useVoiceFlinch({
          active,
          onVoiceDetected: jest.fn(),
          loadCapture: async () => capture,
          vadConfig: VAD_CONFIG,
        }),
      { initialProps: { active: true } },
    );

    await waitFor(() => expect(capture.start).toHaveBeenCalled());
    await rerender({ active: false });
    expect(capture.stop).toHaveBeenCalled();
  });
});
