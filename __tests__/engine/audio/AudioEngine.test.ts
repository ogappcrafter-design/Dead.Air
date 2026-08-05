// __tests__/engine/audio/AudioEngine.test.ts
import {
  AudioEngine,
  getOrCreateAudioEngine,
  resetAudioEngine,
  getAudioEngine,
  AudioEngineState,
} from '../../../engine/audio/AudioEngine';
import { makeMockBridge } from '../../../__mocks__/engine/audio/mockBridge';

describe('AudioEngine', () => {
  beforeEach(() => {
    resetAudioEngine();
  });

  describe('singleton lifecycle', () => {
    it('throws on first call without opts', () => {
      expect(() => getOrCreateAudioEngine()).toThrow('requires options');
    });
    it('creates a singleton on first call w/ opts', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e).toBeInstanceOf(AudioEngine);
    });
    it('returns same instance on subsequent calls', () => {
      const bridge = makeMockBridge();
      const first = getOrCreateAudioEngine({ bridge });
      const second = getOrCreateAudioEngine();
      expect(first).toBe(second);
    });
    it('resetInstance clears singleton (close called)', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      resetAudioEngine();
      expect(getAudioEngine()).toBeNull();
    });
    it('getAudioEngine returns null before init', () => {
      expect(getAudioEngine()).toBeNull();
    });
    it('getAudioEngine returns instance after init', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(getAudioEngine()).toBe(e);
    });
  });

  describe('state transitions', () => {
    it('starts uninitialized', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e.getState()).toBe('uninitialized');
      expect(e.isReady()).toBe(false);
    });
    it('init → running', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge, initialMasterVolume: 0.5 });
      await e.init();
      expect(e.getState()).toBe('running');
      expect(e.isReady()).toBe(true);
    });
    it('init is idempotent', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.init();
      expect(e.getState()).toBe('running');
      expect(bridge.createContext).toHaveBeenCalledTimes(1);
    });
    it('suspend → suspended', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.suspend();
      expect(e.getState()).toBe('suspended');
      expect(e.isReady()).toBe(true);
    });
    it('resume from suspended → running', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.suspend();
      await e.resume();
      expect(e.getState()).toBe('running');
    });
    it('suspend is no-op when not running', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.suspend();
      expect(e.getState()).toBe('uninitialized');
    });
    it('resume is no-op when not suspended', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.resume();
      expect(e.getState()).toBe('running');
    });
    it('close → closed', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.close();
      expect(e.getState()).toBe('closed');
      expect(e.isReady()).toBe(false);
      expect(e.getMasterGain()).toBeNull();
      expect(e.getContext()).toBeNull();
    });
    it('init after close is no-op (must reset)', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.close();
      await e.init();
      expect(e.getState()).toBe('closed');
    });
    it('close is idempotent', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      await e.close();
      await e.close();
      expect(e.getState()).toBe('closed');
    });
  });

  describe('SSR safety', () => {
    it('enters closed state when createContext rejects', async () => {
      const bridge = makeMockBridge();
      (bridge.createContext as jest.Mock).mockRejectedValueOnce(new Error('SSR'));
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      expect(e.getState()).toBe('closed');
      expect(e.getContext()).toBeNull();
      expect(e.getMasterGain()).toBeNull();
    });
  });

  describe('volume control', () => {
    it('defaults to 0.7 master volume', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e.getMasterVolume()).toBe(0.7);
    });
    it('respects initialMasterVolume opt', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge, initialMasterVolume: 0.3 });
      expect(e.getMasterVolume()).toBe(0.3);
    });
    it('setMasterVolume clamps to [0,1]', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      e.setMasterVolume(1.5);
      expect(e.getMasterVolume()).toBe(1);
      e.setMasterVolume(-0.5);
      expect(e.getMasterVolume()).toBe(0);
    });
    it('setMasterVolume at 0 and 1 boundaries', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      e.setMasterVolume(0);
      expect(e.getMasterVolume()).toBe(0);
      e.setMasterVolume(1);
      expect(e.getMasterVolume()).toBe(1);
    });
    it('mute sets volume to 0', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge, initialMasterVolume: 0.5 });
      e.mute();
      expect(e.getMasterVolume()).toBe(0);
      expect(e.isMuted()).toBe(true);
    });
    it('unmute restores saved volume', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge, initialMasterVolume: 0.5 });
      e.mute();
      e.unmute();
      expect(e.getMasterVolume()).toBe(0.5);
      expect(e.isMuted()).toBe(false);
    });
    it('mute twice does not overwrite saved volume', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge, initialMasterVolume: 0.6 });
      e.mute();
      e.setMasterVolume(0.2); // not via mute API
      e.mute();
      e.unmute();
      expect(e.getMasterVolume()).toBe(0.6);
    });
  });

  describe('getBridge', () => {
    it('returns the bridge passed in', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e.getBridge()).toBe(bridge);
    });
  });

  describe('latency profiler', () => {
    it('getLatencyProfiler returns a LatencyProfiler instance', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e.getLatencyProfiler()).toBeDefined();
      expect(typeof e.getLatencyProfiler().startCall).toBe('function');
    });
    it('getLatencyStats returns stats snapshot', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      const stats = e.getLatencyStats();
      expect(stats.count).toBe(0);
    });
    it('same profiler instance returned on repeated calls', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      const p1 = e.getLatencyProfiler();
      const p2 = e.getLatencyProfiler();
      expect(p1).toBe(p2);
    });
  });

  describe('perf config', () => {
    it('defaults to BALANCED_CONFIG when not provided', () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      expect(e.getPerfConfig().latencyHint).toBe('balanced');
    });
    it('uses provided perfConfig when given', () => {
      const bridge = makeMockBridge();
      const { INTERACTIVE_CONFIG } = require('../../../engine/audio/AudioPerformanceConfig');
      const e = getOrCreateAudioEngine({ bridge, perfConfig: INTERACTIVE_CONFIG });
      expect(e.getPerfConfig().latencyHint).toBe('interactive');
    });
    it('passes latencyHint to bridge.createContext on init', async () => {
      const bridge = makeMockBridge();
      const { INTERACTIVE_CONFIG } = require('../../../engine/audio/AudioPerformanceConfig');
      const e = getOrCreateAudioEngine({ bridge, perfConfig: INTERACTIVE_CONFIG });
      await e.init();
      expect(bridge.createContext).toHaveBeenCalledWith('interactive');
    });
    it('default balanced config passes balanced hint', async () => {
      const bridge = makeMockBridge();
      const e = getOrCreateAudioEngine({ bridge });
      await e.init();
      expect(bridge.createContext).toHaveBeenCalledWith('balanced');
    });
  });
});
