// __tests__/engine/calls/CallManager.test.ts
// Unit tests for CallManager — lifecycle, outcome, observer, store+audio.

import {
  CallManager,
  resetCallManager,
  type CallManagerConfig,
  type CallManagerStoreAccess,
  type CallManagerRadioAccess,
  type CallManagerAudioAccess,
} from '@/engine/calls/CallManager';
import type { Band } from '@/lib/constants';
import type { CallData, CallOutcome } from '@/engine/calls/types';

// --- Test fixture helpers ---

const makeCall = (overrides: Partial<CallData> = {}): CallData => ({
  id: 1,
  band: 0,
  callerId: 'caller-1',
  callerName: 'Operator',
  signal: 3,
  type: 'JUST_LISTEN',
  staticReward: 5,
  ...overrides,
});

const makeStores = (): CallManagerStoreAccess => ({
  setCurrentCall: jest.fn(),
  decreaseSanity: jest.fn(),
  increaseSanity: jest.fn(),
  addStatic: jest.fn(),
  addTape: jest.fn(),
  unlockBand: jest.fn(),
  getReceivedCalls: jest.fn(() => []),
  getUnlockedBands: jest.fn(() => ['LIVING'] as Band[]),
  markCallReceived: jest.fn(),
  recordCallDuration: jest.fn(),
  getPlayerStats: jest.fn(() => ({
    callsReceived: 0,
    bandsUnlocked: 1,
    tapesCollected: 0,
    sanityLowest: 100,
    shiftsCompleted: 0,
    longestCallSurvivedMs: 0,
  })),
});

const makeRadio = (band: Band = 'LIVING'): CallManagerRadioAccess => ({
  getCurrentBand: jest.fn(() => band),
});

const makeAudio = (): CallManagerAudioAccess => ({
  // Provide a stub VoiceProcessor so applyBandPreset's null-check passes.
  // The test asserts on audio.applyPresetForBand, not on the VP itself.
  voiceProcessor: {
    applyPresetForBand: jest.fn(),
    preloadVoiceForBand: jest.fn(),
  } as unknown as never,
  applyPresetForBand: jest.fn(),
  preloadVoiceForBand: jest.fn(),
});

const TEST_BANDS = [
  { id: 0, name: 'LIVING', freq: '88.7 FM', color: '#FF8C00', unlockAt: 0 },
  { id: 1, name: 'LIMINAL', freq: '102.3 FM', color: '#CCFF00', unlockAt: 4 },
  { id: 2, name: 'LOST', freq: '117.8 AM', color: '#00FFD0', unlockAt: 8 },
  { id: 3, name: 'CLASSIFIED', freq: '███.█ FM', color: '#FF3366', unlockAt: 12 },
  { id: 4, name: '████████', freq: '???.?', color: '#FFFFFF', unlockAt: 15 },
] as const;

const makeConfig = (overrides: Partial<CallManagerConfig> = {}): CallManagerConfig => {
  const calls = [
    makeCall({ id: 1, band: 0, type: 'JUST_LISTEN' }),
    makeCall({ id: 2, band: 1, type: 'RIGHT_ANSWER' }),
  ];
  const registry = new Map<number, CallData>(calls.map((c) => [c.id, c] as const));
  return {
    registry,
    stores: makeStores(),
    radio: makeRadio(),
    audio: makeAudio(),
    bands: TEST_BANDS,
    ...overrides,
  };
};

describe('CallManager lifecycle', () => {
  let config: CallManagerConfig;

  beforeEach(() => {
    resetCallManager();
    config = makeConfig();
  });

  it('starts idle with no active call', () => {
    const cm = new CallManager(config);
    expect(cm.getCallState()).toBe('idle');
    expect(cm.getCurrentCall()).toBeNull();
    expect(cm.getActiveRoute()).toBeNull();
  });

  it('startCall transitions idle → incoming → active and sets currentCall', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    const ok = cm.startCall(1);
    expect(ok).toBe(true);
    expect(cm.getCallState()).toBe('active');
    const active = cm.getCurrentCall();
    expect(active).not.toBeNull();
    expect(active?.call.id).toBe(1);
    expect(active?.state).toBe('active');
    expect(stores.setCurrentCall).toHaveBeenCalledWith('1');
    expect(cm.getActiveRoute()).toBe('JUST_LISTEN');
  });

  it('startCall returns false for unknown id', () => {
    const cm = new CallManager(config);
    const ok = cm.startCall(999);
    expect(ok).toBe(false);
    expect(cm.getCallState()).toBe('idle');
  });

  it('startCall returns false if a call is already active', () => {
    const cm = new CallManager(config);
    expect(cm.startCall(1)).toBe(true);
    expect(cm.startCall(2)).toBe(false);
    expect(cm.getCurrentCall()?.call.id).toBe(1);
  });

  it('startCall can start after completed', () => {
    const cm = new CallManager(config);
    expect(cm.startCall(1)).toBe(true);
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(cm.getCallState()).toBe('idle');
    expect(cm.startCall(2)).toBe(true);
    expect(cm.getCurrentCall()?.call.id).toBe(2);
  });

  it('setResolving transitions active → resolving', () => {
    const cm = new CallManager(config);
    cm.startCall(1);
    cm.setResolving();
    expect(cm.getCallState()).toBe('resolving');
    expect(cm.getCurrentCall()?.state).toBe('resolving');
  });

  it('setResolving is a no-op when not active', () => {
    const cm = new CallManager(config);
    cm.setResolving();
    expect(cm.getCallState()).toBe('idle');
  });

  it('endCall transitions → resolving → completed → idle', () => {
    const cm = new CallManager(config);
    cm.startCall(1);
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(cm.getCallState()).toBe('idle');
    expect(cm.getCurrentCall()).toBeNull();
  });

  it('endCall clears currentCall in store', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(stores.setCurrentCall).toHaveBeenCalledWith(null);
  });

  it('endCall is a no-op when no active call', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(stores.decreaseSanity).not.toHaveBeenCalled();
    expect(stores.addStatic).not.toHaveBeenCalled();
  });

  it('startCall is blocked during completed notification (subscriber re-entry)', () => {
    const cm = new CallManager(config);
    cm.startCall(1);
    let reentryStarted = false;
    cm.subscribe((state) => {
      if (state === 'completed') {
        reentryStarted = cm.startCall(2);
      }
    });
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(reentryStarted).toBe(false);
    expect(cm.getCallState()).toBe('idle');
  });

  it('endCall is blocked during completed notification (no double rewards)', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.subscribe((state) => {
      if (state === 'completed') {
        cm.endCall({ sanityDelta: -20, staticReward: 50, staticMultiplier: 2 });
      }
    });
    cm.endCall({ sanityDelta: -10, staticReward: 5, staticMultiplier: 1 });
    expect(stores.decreaseSanity).toHaveBeenCalledTimes(1);
    expect(stores.decreaseSanity).toHaveBeenCalledWith(10);
    expect(stores.addStatic).toHaveBeenCalledTimes(1);
    expect(stores.addStatic).toHaveBeenCalledWith(5);
  });
});

describe('CallManager outcome application', () => {
  let config: CallManagerConfig;

  beforeEach(() => {
    resetCallManager();
    config = makeConfig();
  });

  it('applies negative sanityDelta via decreaseSanity(-delta)', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    const outcome: CallOutcome = { sanityDelta: -10, staticReward: 0, staticMultiplier: 1 };
    cm.endCall(outcome);
    // -10 → decreaseSanity(10)
    expect(stores.decreaseSanity).toHaveBeenCalledWith(10);
  });

  it('applies positive sanityDelta via increaseSanity (upper-clamped by store)', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    const outcome: CallOutcome = { sanityDelta: 5, staticReward: 0, staticMultiplier: 1 };
    cm.endCall(outcome);
    expect(stores.increaseSanity).toHaveBeenCalledWith(5);
    expect(stores.decreaseSanity).not.toHaveBeenCalled();
  });

  it('applies static reward with multiplier, rounded, clamped >=0', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    const outcome: CallOutcome = {
      sanityDelta: 0,
      staticReward: 10,
      staticMultiplier: 1.5,
    };
    cm.endCall(outcome);
    // round(10*1.5)=15
    expect(stores.addStatic).toHaveBeenCalledWith(15);
  });

  it('clamps static reward to >= 0 when multiplier is negative/nonsense', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    const outcome: CallOutcome = {
      sanityDelta: 0,
      staticReward: 10,
      staticMultiplier: -2,
    };
    cm.endCall(outcome);
    // max(0, round(-20)) = 0 → guarded, not called
    expect(stores.addStatic).not.toHaveBeenCalled();
  });

  it('calls addStatic with reward 0 → does not actually call store', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    const outcome: CallOutcome = {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 1,
    };
    cm.endCall(outcome);
    expect(stores.addStatic).not.toHaveBeenCalled();
  });

  it('unlocks tape via stores.addTape when tapeUnlocked provided', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.endCall({
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 1,
      tapeUnlocked: 'TAPE_RADIO',
    });
    expect(stores.addTape).toHaveBeenCalledWith('TAPE_RADIO');
  });

  it('skips tape unlock when tapeUnlocked is empty string', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.endCall({
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 1,
      tapeUnlocked: '',
    });
    expect(stores.addTape).not.toHaveBeenCalled();
  });

  it('unlocks band when bandUnlocked provided', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.endCall({
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 1,
      bandUnlocked: 'LOST',
    });
    expect(stores.unlockBand).toHaveBeenCalledWith('LOST');
  });

  it('zero sanityDelta does NOT call decreaseSanity', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    expect(stores.decreaseSanity).not.toHaveBeenCalled();
  });
});

describe('CallManager observer pattern', () => {
  let config: CallManagerConfig;

  beforeEach(() => {
    resetCallManager();
    config = makeConfig();
  });

  it('subscribe fires immediately with current state', () => {
    const cm = new CallManager(config);
    const listener = jest.fn();
    cm.subscribe(listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('idle', null);
  });

  it('subscribe fires on every transition', () => {
    const cm = new CallManager(config);
    const listener = jest.fn();
    cm.subscribe(listener); // 1 call: idle
    cm.startCall(1); // incoming + active = 2 transitions + 2 notifies
    expect(listener).toHaveBeenCalledTimes(3); // idle, incoming, active
    cm.endCall({ sanityDelta: 0, staticReward: 0, staticMultiplier: 1 });
    // resolving, completed, idle = 3 more
    expect(listener).toHaveBeenCalledTimes(6);
  });

  it('unsubscribe stops notifications', () => {
    const cm = new CallManager(config);
    const listener = jest.fn();
    const unsub = cm.subscribe(listener);
    unsub();
    cm.startCall(1);
    expect(listener).toHaveBeenCalledTimes(1); // only the initial notify
  });

  it('multiple subscribers all fire', () => {
    const cm = new CallManager(config);
    const a = jest.fn();
    const b = jest.fn();
    cm.subscribe(a);
    cm.subscribe(b);
    cm.startCall(1);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});

describe('CallManager audio integration', () => {
  let config: CallManagerConfig;

  beforeEach(() => {
    resetCallManager();
    config = makeConfig();
  });

  it('startCall applies band preset via audio.applyPresetForBand', () => {
    const audio = makeAudio();
    const cm = new CallManager({ ...config, audio });
    cm.startCall(1);
    expect(audio.applyPresetForBand).toHaveBeenCalledWith('LIVING');
  });

  it('startCall uses voiceProcessor.applyPresetForBand when applyPresetForBand not provided', () => {
    const vp = { applyPresetForBand: jest.fn() } as unknown;
    const audio: CallManagerAudioAccess = {
      voiceProcessor: vp as never,
    };
    const cm = new CallManager({ ...config, audio });
    cm.startCall(1);
    expect(vp.applyPresetForBand).toHaveBeenCalledWith('LIVING');
  });

  it('startCall is best-effort: no audio → no throw', () => {
    const cm = new CallManager({ ...config, audio: null });
    expect(() => cm.startCall(1)).not.toThrow();
    expect(cm.getCallState()).toBe('active');
  });

  it('startCall is best-effort: no audio at all → no throw', () => {
    const cm = new CallManager({ ...config, audio: undefined });
    expect(() => cm.startCall(1)).not.toThrow();
  });

  it('setAudioAccess applies preset immediately if a call is active', () => {
    const audio = makeAudio();
    const cm = new CallManager({ ...config, audio: null });
    cm.startCall(1);
    // No audio yet — preset not applied.
    expect(audio.applyPresetForBand).not.toHaveBeenCalled();
    cm.setAudioAccess(audio);
    expect(audio.applyPresetForBand).toHaveBeenCalledWith('LIVING');
  });

  it('setAudioAccess preloads band preset when no call is active', () => {
    const audio = makeAudio();
    const cm = new CallManager({ ...config, audio: null });
    cm.setAudioAccess(audio);
    expect(audio.preloadVoiceForBand).toHaveBeenCalledWith('LIVING');
    expect(audio.applyPresetForBand).not.toHaveBeenCalled();
  });

  it('preloadBandPreset delegates to audio.preloadVoiceForBand', () => {
    const audio = makeAudio();
    const cm = new CallManager({ ...config, audio });
    cm.preloadBandPreset();
    expect(audio.preloadVoiceForBand).toHaveBeenCalledWith('LIVING');
  });

  it('preloadBandPreset falls back to voiceProcessor.preloadVoiceForBand', () => {
    const vp = { preloadVoiceForBand: jest.fn(), applyPresetForBand: jest.fn() } as unknown;
    const audio: CallManagerAudioAccess = { voiceProcessor: vp as never };
    const cm = new CallManager({ ...config, audio });
    cm.preloadBandPreset();
    expect(vp.preloadVoiceForBand).toHaveBeenCalledWith('LIVING');
  });

  it('preloadBandPreset is best-effort: no audio → no throw', () => {
    const cm = new CallManager({ ...config, audio: null });
    expect(() => cm.preloadBandPreset()).not.toThrow();
  });
});

describe('CallManager reset', () => {
  let config: CallManagerConfig;

  beforeEach(() => {
    resetCallManager();
    config = makeConfig();
  });

  it('reset while active clears current call and returns to idle', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    expect(cm.getCallState()).toBe('active');
    cm.reset();
    expect(cm.getCallState()).toBe('idle');
    expect(cm.getCurrentCall()).toBeNull();
    expect(stores.setCurrentCall).toHaveBeenCalledWith(null);
  });

  it('reset when idle does not call setCurrentCall(null)', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.reset();
    // startCall not called → no setCurrentCall(null) from reset (only from endCall/startCall)
    expect(stores.setCurrentCall).not.toHaveBeenCalledWith(null);
  });

  it('reset does NOT apply rewards', () => {
    const stores = makeStores();
    const cm = new CallManager({ ...config, stores });
    cm.startCall(1);
    cm.reset();
    expect(stores.decreaseSanity).not.toHaveBeenCalled();
    expect(stores.addStatic).not.toHaveBeenCalled();
    expect(stores.addTape).not.toHaveBeenCalled();
    expect(stores.unlockBand).not.toHaveBeenCalled();
  });
});

describe('CallManager singleton', () => {
  beforeEach(() => {
    resetCallManager();
  });

  it('getCallManager returns null before init', () => {
    expect(getCallManagerImport()).toBeNull();
  });

  it('initCallManager creates the singleton and getCallManager returns it', () => {
    const config = makeConfig();
    const cm = initCallManagerForTest(config);
    expect(cm).not.toBeNull();
    expect(getCallManagerImport()).toBe(cm);
  });

  it('initCallManager is idempotent — returns existing instance', () => {
    const config = makeConfig();
    const a = initCallManagerForTest(config);
    const b = initCallManagerForTest(config);
    expect(a).toBe(b);
  });

  it('resetCallManager clears the singleton', () => {
    initCallManagerForTest(makeConfig());
    resetCallManager();
    expect(getCallManagerImport()).toBeNull();
  });
});

// --- Lazy import helpers so tests stay independent of module-eval order ---

// Re-import lazily to avoid hoisting the singleton initialization before reset.
function getCallManagerImport() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/engine/calls/CallManager') as typeof import('@/engine/calls/CallManager');
  return mod.getCallManager();
}

function initCallManagerForTest(config: CallManagerConfig): CallManager {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@/engine/calls/CallManager') as typeof import('@/engine/calls/CallManager');
  return mod.initCallManager(config);
}
