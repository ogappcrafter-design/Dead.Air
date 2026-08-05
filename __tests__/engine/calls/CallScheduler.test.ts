// __tests__/engine/calls/CallScheduler.test.ts
// Unit tests for CallScheduler — timing, band selection, received tracking, reset.

import {
  CallScheduler,
  resetCallScheduler,
  type SchedulingConfig,
} from '@/engine/calls/CallScheduler';
import type { Band } from '@/lib/constants';
import type { CallData } from '@/engine/calls/types';

// --- Test fixture helpers ---

const makeCall = (id: number, band: number, overrides: Partial<CallData> = {}): CallData => ({
  id,
  band,
  callerId: `cid-${id}`,
  callerName: `Caller ${id}`,
  signal: 3,
  type: 'JUST_LISTEN',
  staticReward: 5,
  ...overrides,
});

// 18-call registry matching the live data shape (band call counts: 4/4/4/4/2).
const makeRegistry = (): ReadonlyArray<CallData> => [
  makeCall(1, 0),
  makeCall(2, 0),
  makeCall(3, 0),
  makeCall(4, 0),
  makeCall(5, 1),
  makeCall(6, 1),
  makeCall(7, 1),
  makeCall(8, 1),
  makeCall(9, 2),
  makeCall(10, 2),
  makeCall(11, 2),
  makeCall(12, 2),
  makeCall(13, 3),
  makeCall(14, 3),
  makeCall(15, 3),
  makeCall(16, 3),
  makeCall(17, 4),
  makeCall(18, 4),
];

const makeConfig = (overrides: Partial<SchedulingConfig> = {}): SchedulingConfig => ({
  frequency: 'medium',
  currentBand: 'LIVING',
  unlockedBands: ['LIVING'],
  receivedCallIds: [],
  ...overrides,
});

describe('CallScheduler timing', () => {
  let scheduler: CallScheduler;
  const originalNow = Date.now;
  let fakeNow = 0;

  beforeEach(() => {
    resetCallScheduler();
    fakeNow = 0;
    Date.now = jest.fn(() => fakeNow) as typeof Date.now;
    scheduler = new CallScheduler(makeRegistry());
  });

  afterEach(() => {
    Date.now = originalNow;
  });

  it('shouldTriggerCall: true on first call (no last trigger)', () => {
    scheduler.configure(makeConfig());
    expect(scheduler.shouldTriggerCall(0)).toBe(true);
  });

  it('low frequency: 60s interval', () => {
    scheduler.configure(makeConfig({ frequency: 'low' }));
    expect(scheduler.shouldTriggerCall(59_000)).toBe(true);
  });

  it('low frequency: false right after markReceived', () => {
    scheduler.configure(makeConfig({ frequency: 'low' }));
    scheduler.markReceived(1); // sets lastTriggerAt via Date.now (= fakeNow = 0)
    expect(scheduler.shouldTriggerCall(0)).toBe(false);
    fakeNow = 59_999;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(false);
    fakeNow = 60_000;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(true);
  });

  it('medium frequency: 30s interval', () => {
    scheduler.configure(makeConfig({ frequency: 'medium' }));
    expect(scheduler.shouldTriggerCall(30_000)).toBe(true);
    scheduler.markReceived(1);
    fakeNow = 29_999;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(false);
    fakeNow = 30_000;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(true);
  });

  it('high frequency: 15s interval', () => {
    scheduler.configure(makeConfig({ frequency: 'high' }));
    expect(scheduler.shouldTriggerCall(15_000)).toBe(true);
    scheduler.markReceived(1);
    fakeNow = 14_999;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(false);
    fakeNow = 15_000;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(true);
  });

  it('configure does not reset lastTriggerAt (timestamp preserved across reconfigs)', () => {
    scheduler.configure(makeConfig({ frequency: 'low' }));
    scheduler.markReceived(1);
    fakeNow = 10_000;
    scheduler.configure(makeConfig({ frequency: 'high' }));
    // Even though high interval is 15s, lastTriggerAt is 10s ago → 5s left.
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(false);
    fakeNow = 25_000;
    expect(scheduler.shouldTriggerCall(fakeNow)).toBe(true);
  });
});

describe('CallScheduler band gating', () => {
  let scheduler: CallScheduler;

  beforeEach(() => {
    resetCallScheduler();
    scheduler = new CallScheduler(makeRegistry());
  });

  it('selectCall returns null when current band not unlocked', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LOST',
        unlockedBands: ['LIVING'],
      }),
    );
    expect(scheduler.selectCall()).toBeNull();
  });

  it('selectCall returns a call from the current band', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LIVING',
        unlockedBands: ['LIVING'],
      }),
    );
    const id = scheduler.selectCall();
    expect(id).not.toBeNull();
    expect(id).toBeGreaterThanOrEqual(1);
    expect(id).toBeLessThanOrEqual(4);
  });

  it('selectCall returns null when registry empty for current band', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LIVING',
        unlockedBands: ['LIVING'],
      }),
    );
    scheduler.setRegistry([]);
    expect(scheduler.selectCall()).toBeNull();
  });
});

describe('CallScheduler cycle-before-repeat', () => {
  let scheduler: CallScheduler;

  beforeEach(() => {
    resetCallScheduler();
    scheduler = new CallScheduler(makeRegistry());
  });

  it('selectCall cycles through band calls before repeating', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LIVING',
        unlockedBands: ['LIVING'],
      }),
    );
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) {
      const id = scheduler.selectCall();
      expect(id).not.toBeNull();
      seen.add(id as number);
      scheduler.markReceived(id as number);
    }
    // All 4 band-0 calls seen exactly once.
    expect(seen.size).toBe(4);
    expect(Array.from(seen).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('cycle wraps: 5th selectCall picks the first call again', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LIVING',
        unlockedBands: ['LIVING'],
      }),
    );
    for (let i = 0; i < 4; i++) {
      const id = scheduler.selectCall();
      scheduler.markReceived(id as number);
    }
    // All 4 received → wrap → pick first.
    const fifth = scheduler.selectCall();
    expect(fifth).toBe(1);
  });

  it('configure with receivedCallIds respects the snapshot', () => {
    scheduler.configure(
      makeConfig({
        currentBand: 'LIVING',
        unlockedBands: ['LIVING'],
        receivedCallIds: [1, 2],
      }),
    );
    expect(scheduler.selectCall()).toBe(3);
    scheduler.markReceived(3);
    expect(scheduler.selectCall()).toBe(4);
  });

  it('band 4 (████████) has exactly 2 calls', () => {
    scheduler.configure(
      makeConfig({
        currentBand: '████████',
        unlockedBands: ['LIVING', '████████'],
      }),
    );
    expect(scheduler.selectCall()).toBe(17);
    scheduler.markReceived(17);
    expect(scheduler.selectCall()).toBe(18);
    scheduler.markReceived(18);
    // Wrap → back to 17.
    expect(scheduler.selectCall()).toBe(17);
  });
});

describe('CallScheduler reset + getReceivedCalls', () => {
  let scheduler: CallScheduler;

  beforeEach(() => {
    resetCallScheduler();
    scheduler = new CallScheduler(makeRegistry());
  });

  it('getReceivedCalls returns sorted received IDs', () => {
    scheduler.configure(makeConfig());
    scheduler.markReceived(3);
    scheduler.markReceived(1);
    scheduler.markReceived(2);
    expect(scheduler.getReceivedCalls()).toEqual([1, 2, 3]);
  });

  it('reset clears received list and lastTrigger timestamp', () => {
    scheduler.configure(makeConfig());
    scheduler.markReceived(1);
    scheduler.markReceived(2);
    scheduler.reset();
    expect(scheduler.getReceivedCalls()).toEqual([]);
    // After reset, shouldTriggerCall at t=0 → true (no last trigger).
    expect(scheduler.shouldTriggerCall(0)).toBe(true);
  });
});

describe('CallScheduler singleton', () => {
  beforeEach(() => {
    resetCallScheduler();
  });

  it('getCallScheduler returns null before init', () => {
    expect(getScheduler()).toBeNull();
  });

  it('initCallScheduler creates singleton', () => {
    const s = initScheduler(makeRegistry());
    expect(s).not.toBeNull();
    expect(getScheduler()).toBe(s);
  });

  it('initCallScheduler is idempotent', () => {
    const a = initScheduler(makeRegistry());
    const b = initScheduler(makeRegistry());
    expect(a).toBe(b);
  });

  it('resetCallScheduler clears singleton', () => {
    initScheduler(makeRegistry());
    resetCallScheduler();
    expect(getScheduler()).toBeNull();
  });
});

// --- Lazy import helpers (independent of hoisting) ---

function getScheduler() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('@/engine/calls/CallScheduler') as typeof import('@/engine/calls/CallScheduler');
  return mod.getCallScheduler();
}

function initScheduler(registry: ReadonlyArray<CallData>) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod =
    require('@/engine/calls/CallScheduler') as typeof import('@/engine/calls/CallScheduler');
  return mod.initCallScheduler(registry);
}

// Ensure unused-symbol check doesn't choke on Band import below.
type _UnusedBand = Band;
