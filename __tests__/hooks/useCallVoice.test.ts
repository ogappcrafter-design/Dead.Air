// __tests__/hooks/useCallVoice.test.ts
// DEA-94: verifies the call-voice hook wires synthesized PCM into the voice
// chain and degrades to text-only on every failure path.

import { Platform } from 'react-native';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { CallData } from '../../engine/calls/types';
import { makeMockBridge } from '../../__mocks__/engine/audio/mockBridge';
import type { BridgeAudioContext, PlatformBridge } from '../../engine/audio/PlatformBridge';
import { useSettingsStore } from '../../store/useSettingsStore';

const mockBridge = makeMockBridge();

const ctx: BridgeAudioContext = {
  sampleRate: 22050,
  currentTime: 0,
  state: 'running',
  resume: async () => {},
  suspend: async () => {},
  close: async () => {},
};

const masterGain = { kind: 'gain', disconnect: () => {}, setGain: () => {} };

const makeAudioEngine = (ready: boolean, bridge: PlatformBridge = mockBridge) => ({
  init: jest.fn(async () => {}),
  isReady: () => ready,
  getContext: () => (ready ? ctx : null),
  getMasterGain: () => (ready ? masterGain : null),
  getBridge: () => bridge,
});

let mockAudioEngine = makeAudioEngine(true);

jest.mock('../../engine/audio/AudioEngine', () => ({
  getOrCreateAudioEngine: jest.fn(() => mockAudioEngine),
}));

jest.mock('../../engine/audio/CallVoiceBridgeLoader', () => ({
  loadCallVoiceBridge: jest.fn(async () => mockBridge),
}));

// Imported after the mocks so the hook picks them up.

const { useCallVoice } =
  require('../../hooks/useCallVoice') as typeof import('../../hooks/useCallVoice');
const { loadCallVoiceBridge } =
  require('../../engine/audio/CallVoiceBridgeLoader') as typeof import('../../engine/audio/CallVoiceBridgeLoader');

const call: CallData = {
  id: 1,
  band: 0,
  callerId: 'PRIVATE',
  callerName: 'THE COLLECTOR',
  signal: 4,
  type: 'JUST_LISTEN',
  staticReward: 45,
  lines: ['He laughs.', 'The signal fades slowly.'],
};

describe('useCallVoice', () => {
  const originalOS = Platform.OS;

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudioEngine = makeAudioEngine(true);
    useSettingsStore.setState({ voiceVolume: 1, audioQuality: 'balanced' });
  });

  it('renders and plays call lines through the voice chain', async () => {
    await renderHook(() => useCallVoice(call));

    await waitFor(() => {
      expect(mockBridge.createPcmSource).toHaveBeenCalled();
    });
    expect(mockBridge.createBiquad).toHaveBeenCalled();
    expect(mockBridge.createCompressor).toHaveBeenCalled();
  });

  it('does nothing when disabled', async () => {
    await renderHook(() => useCallVoice(call, { enabled: false }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockBridge.createPcmSource).not.toHaveBeenCalled();
  });

  it('does nothing when voice volume is zero', async () => {
    useSettingsStore.setState({ voiceVolume: 0 });
    await renderHook(() => useCallVoice(call));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockBridge.createPcmSource).not.toHaveBeenCalled();
  });

  it('stays text-only when the audio engine is unavailable', async () => {
    mockAudioEngine = makeAudioEngine(false);
    await renderHook(() => useCallVoice(call));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockBridge.createPcmSource).not.toHaveBeenCalled();
  });

  it('stays text-only for calls without lines', async () => {
    await renderHook(() => useCallVoice({ ...call, lines: [] }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockBridge.createPcmSource).not.toHaveBeenCalled();
  });

  it('stops playback when the call voice is disabled without throwing', async () => {
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useCallVoice(call, { enabled }),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(mockBridge.createPcmSource).toHaveBeenCalled());
    expect(() => rerender({ enabled: false })).not.toThrow();
  });

  it('voices calls on native as well as web', async () => {
    const nativeBridge = makeMockBridge('native');
    (loadCallVoiceBridge as jest.Mock).mockResolvedValueOnce(nativeBridge);
    mockAudioEngine = makeAudioEngine(true, nativeBridge);
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });

    try {
      await renderHook(() => useCallVoice(call));
      await waitFor(() => expect(nativeBridge.createPcmSource).toHaveBeenCalled());
      expect(nativeBridge.createBiquad).toHaveBeenCalled();
      expect(nativeBridge.createCompressor).toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    }
  });
});
