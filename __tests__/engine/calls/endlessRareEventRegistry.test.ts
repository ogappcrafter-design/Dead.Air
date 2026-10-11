// __tests__/engine/calls/endlessRareEventRegistry.test.ts
// DEA-86: Endless Night rare event call registry.
//
// Rare events are unique procedural calls generated on a per-run basis and
// registered in the live call registry under the 6000+ id space. They must:
//   - land on the requested core band with the forced (advanced) call type,
//   - be startable through the real call manager,
//   - be removed from the registry when the run ends, so they can never
//     leak into a later normal play session.

import { callManager } from '@/engine/calls/callManagerInstance';
import {
  ENDLESS_RARE_EVENT_ID_BASE,
  clearEndlessRareEventCalls,
  getEndlessRareEventCallIds,
  registerEndlessRareEventCall,
} from '@/engine/calls/callManagerInstance';

describe('DEA-86 endless rare event registry', () => {
  afterEach(() => {
    callManager.reset();
    clearEndlessRareEventCalls();
  });

  it('registers a startable call in the 6000+ id space', () => {
    const call = registerEndlessRareEventCall('MULTI_CALLER', 0);
    expect(call).not.toBeNull();
    expect(call!.id).toBeGreaterThanOrEqual(ENDLESS_RARE_EVENT_ID_BASE);
    expect(callManager.startCall(call!.id)).toBe(true);
  });

  it('lands on the requested core band with the forced call type', () => {
    const cases: Array<[string, number]> = [
      ['TIMING', 0],
      ['PUZZLE', 1],
      ['CONVERSATION', 2],
      ['DEAD_AIR', 3],
      ['MULTI_CALLER', 4],
    ];
    for (const [type, band] of cases) {
      const call = registerEndlessRareEventCall(type, band);
      expect(call).not.toBeNull();
      expect(call!.band).toBe(band);
      expect(call!.type).toBe(type);
    }
  });

  it('allocates a unique id per registered call', () => {
    const a = registerEndlessRareEventCall('TIMING', 0);
    const b = registerEndlessRareEventCall('PUZZLE', 2);
    expect(a!.id).not.toBe(b!.id);
  });

  it('rejects bands outside the core-band range', () => {
    expect(registerEndlessRareEventCall('TIMING', 5)).toBeNull();
    expect(registerEndlessRareEventCall('TIMING', -1)).toBeNull();
  });

  it('removes registered calls on clear and resets the id cursor', () => {
    const call = registerEndlessRareEventCall('TIMING', 1);
    expect(call).not.toBeNull();
    const firstId = call!.id;
    expect(callManager.startCall(firstId)).toBe(true);
    callManager.reset();

    clearEndlessRareEventCalls();

    expect(getEndlessRareEventCallIds()).toEqual([]);
    // The call is gone from the registry: it can no longer be started.
    expect(callManager.startCall(firstId)).toBe(false);

    // The id cursor resets so the next run reuses the low id space.
    const next = registerEndlessRareEventCall('PUZZLE', 0);
    expect(next!.id).toBe(ENDLESS_RARE_EVENT_ID_BASE);
  });

  it('cleared calls never leak into a later normal session', () => {
    const call = registerEndlessRareEventCall('CONVERSATION', 3);
    expect(call).not.toBeNull();
    const id = call!.id;
    clearEndlessRareEventCalls();

    // A fresh session: sacred calls still start, the old rare event does not.
    expect(callManager.startCall(0)).toBe(true);
    callManager.reset();
    expect(callManager.startCall(id)).toBe(false);
  });
});
