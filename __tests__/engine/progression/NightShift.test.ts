// __tests__/engine/progression/NightShift.test.ts
// Unit tests for the NightShift engine + TimeCompression helper.

import { NightShift, resetNightShift } from '@/engine/progression/NightShift';
import { realMsToInGameMinutes } from '@/engine/progression/TimeCompression';
import type { NightShiftConfig } from '@/engine/progression/NightShiftConfig';

// --- Test fixtures ---

const DEFAULT_SHIFT_MS = 1_200_000; // 20 min real-time
const DEFAULT_IN_GAME_MIN = 240; // 4 hours in-game

const makeConfig = (overrides: Partial<NightShiftConfig> = {}): NightShiftConfig => ({
  shiftDurationMs: DEFAULT_SHIFT_MS,
  inGameMinutes: DEFAULT_IN_GAME_MIN,
  callFrequency: 'medium',
  availableCallIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  ...overrides,
});

describe('TimeCompression', () => {
  it('realMsToInGameMinutes(60_000, 1_200_000, 240) → 12', () => {
    expect(realMsToInGameMinutes(60_000, 1_200_000, 240)).toBe(12);
  });

  it('returns 0 for zero real-time', () => {
    expect(realMsToInGameMinutes(0, 1_200_000, 240)).toBe(0);
  });

  it('clamps to inGameMinutes at full duration', () => {
    expect(realMsToInGameMinutes(1_200_000, 1_200_000, 240)).toBe(240);
  });

  it('clamps overshoot beyond full duration', () => {
    expect(realMsToInGameMinutes(2_000_000, 1_200_000, 240)).toBe(240);
  });

  it('returns 0 for non-positive shiftDurationMs', () => {
    expect(realMsToInGameMinutes(60_000, 0, 240)).toBe(0);
    expect(realMsToInGameMinutes(60_000, -1, 240)).toBe(0);
  });
});

describe('NightShift.startShift', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it("startShift() returns phase='on-air', inGameMinutes=0", () => {
    const shift = new NightShift(makeConfig());
    const state = shift.startShift();
    expect(state.phase).toBe('on-air');
    expect(state.inGameMinutes).toBe(0);
    expect(state.realTimeMs).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.nextCallIndex).toBe(0);
  });

  it('startShift pre-computes scheduled calls', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(8);
    expect(state.scheduledCalls[0]).toBeDefined();
    expect(state.scheduledCalls[0]!.triggerMinute).toBeGreaterThan(0);
  });
});

describe('NightShift.tick', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it('tick(60_000) with 20min/240min → inGameMinutes=12', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    const state = shift.tick(60_000);
    expect(state.inGameMinutes).toBe(12);
    expect(state.realTimeMs).toBe(60_000);
    expect(state.phase).toBe('on-air');
  });

  it('tick past shift duration → isComplete=true, phase=sign-off', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    const state = shift.tick(DEFAULT_SHIFT_MS);
    expect(state.inGameMinutes).toBe(DEFAULT_IN_GAME_MIN);
    expect(state.isComplete).toBe(true);
    expect(state.phase).toBe('sign-off');
  });

  it('tick is a no-op when shift is complete', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    shift.tick(DEFAULT_SHIFT_MS);
    // Shift is complete — another tick should not change state.
    const state = shift.tick(60_000);
    expect(state.isComplete).toBe(true);
    expect(state.inGameMinutes).toBe(DEFAULT_IN_GAME_MIN);
  });

  it('tick(0) or negative delta returns current state unchanged', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    const before = shift.getState();
    const state = shift.tick(0);
    expect(state.inGameMinutes).toBe(before.inGameMinutes);
    expect(state.realTimeMs).toBe(before.realTimeMs);
  });

  it('phase transitions to break mid-shift', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    // Break starts at 45% of 240 = 108 in-game minutes.
    // 108 in-game minutes = 108 * 5000 = 540_000 real ms.
    const state = shift.tick(540_000);
    expect(state.inGameMinutes).toBe(108);
    expect(state.phase).toBe('break');
  });

  it('phase returns to on-air after break', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    // Break ends at 55% of 240 = 132 in-game minutes.
    // 132 * 5000 = 660_000 real ms.
    const state = shift.tick(660_000);
    expect(state.inGameMinutes).toBe(132);
    expect(state.phase).toBe('on-air');
  });
});

describe('NightShift.shouldTriggerCall + consumeCall', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it('shouldTriggerCall returns true when inGameMinutes >= first scheduled call triggerMinute', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    const startState = shift.startShift();
    const firstTrigger = startState.scheduledCalls[0]!.triggerMinute;
    // Advance to exactly the first trigger minute.
    // inGameMinutes = realMs * 240 / 1_200_000 = realMs / 5000.
    const realMs = firstTrigger * 5000;
    shift.tick(realMs);
    expect(shift.getState().inGameMinutes).toBe(firstTrigger);
    expect(shift.shouldTriggerCall()).toBe(true);
  });

  it('shouldTriggerCall false before first trigger', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    shift.startShift();
    // Before the first trigger minute.
    shift.tick(10_000);
    expect(shift.shouldTriggerCall()).toBe(false);
  });

  it('shouldTriggerCall false when shift is complete', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    shift.startShift();
    shift.tick(DEFAULT_SHIFT_MS);
    expect(shift.shouldTriggerCall()).toBe(false);
  });

  it('consumeCall returns scheduled call and advances index', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    const startState = shift.startShift();
    const firstCall = startState.scheduledCalls[0];
    const consumed = shift.consumeCall();
    expect(consumed).toEqual(firstCall);
    expect(shift.getState().nextCallIndex).toBe(1);

    // Consume second call.
    const secondCall = startState.scheduledCalls[1];
    const consumed2 = shift.consumeCall();
    expect(consumed2).toEqual(secondCall);
    expect(shift.getState().nextCallIndex).toBe(2);
  });

  it('consumeCall returns null when no calls remain', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'low', availableCallIds: [1] }));
    shift.startShift();
    shift.consumeCall();
    expect(shift.consumeCall()).toBeNull();
  });
});

describe('NightShift.endShift', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it('endShift → isComplete=true', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    const state = shift.endShift();
    expect(state.isComplete).toBe(true);
    expect(state.phase).toBe('sign-off');
  });

  it('endShift before any tick keeps inGameMinutes at 0', () => {
    const shift = new NightShift(makeConfig());
    shift.startShift();
    const state = shift.endShift();
    expect(state.inGameMinutes).toBe(0);
    expect(state.isComplete).toBe(true);
  });
});

describe('NightShift schedule respects call frequency', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it('pre-computed schedule has more calls for high than low', () => {
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    const lowShift = new NightShift(makeConfig({ callFrequency: 'low', availableCallIds: ids }));
    const highShift = new NightShift(makeConfig({ callFrequency: 'high', availableCallIds: ids }));
    const lowState = lowShift.startShift();
    const highState = highShift.startShift();
    expect(highState.scheduledCalls.length).toBeGreaterThan(lowState.scheduledCalls.length);
  });

  it('low frequency schedules exactly 4 calls', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'low' }));
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(4);
  });

  it('medium frequency schedules exactly 8 calls', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'medium' }));
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(8);
  });

  it('high frequency schedules exactly 16 calls', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'high' }));
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(16);
  });

  it('caps schedule to availableCallIds length', () => {
    const shift = new NightShift(
      makeConfig({ callFrequency: 'high', availableCallIds: [1, 2, 3] }),
    );
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(3);
  });

  it('empty availableCallIds produces empty schedule', () => {
    const shift = new NightShift(makeConfig({ callFrequency: 'high', availableCallIds: [] }));
    const state = shift.startShift();
    expect(state.scheduledCalls.length).toBe(0);
    expect(state.nextCallIndex).toBe(0);
  });
});

describe('NightShift singleton', () => {
  beforeEach(() => {
    resetNightShift();
  });

  it('getNightShift returns null before init', () => {
    expect(getNightShift()).toBeNull();
  });

  it('initNightShift creates singleton', () => {
    const s = initNightShift(makeConfig());
    expect(s).not.toBeNull();
    expect(getNightShift()).toBe(s);
  });

  it('initNightShift is idempotent', () => {
    const a = initNightShift(makeConfig());
    const b = initNightShift(makeConfig());
    expect(a).toBe(b);
  });

  it('resetNightShift clears singleton', () => {
    initNightShift(makeConfig());
    resetNightShift();
    expect(getNightShift()).toBeNull();
  });
});

// --- Lazy import helpers ---

function getNightShift() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('@/engine/progression/NightShift') as typeof import('@/engine/progression/NightShift');
  return mod.getNightShift();
}

function initNightShift(config: NightShiftConfig) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('@/engine/progression/NightShift') as typeof import('@/engine/progression/NightShift');
  return mod.initNightShift(config);
}
