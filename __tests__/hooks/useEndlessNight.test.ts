// __tests__/hooks/useEndlessNight.test.ts
// DEA-86: pure call-planning logic for the Endless Night run loop.
//
// planNextCall decides the next call of a run: a rare event (when the
// escalation level has unlocked advanced types and the spawn roll lands)
// or a sacred call from the player's band (largest-pool fallback). It is
// exported from the hook module so it is testable without mounting the
// live loop or the call manager.

import { planNextCall } from '@/hooks/useEndlessNight';

// Sacred pool shaped like the real data: bands 0-4 have calls, band 5 does
// not. Ids are the sacred id space (0-17).
const sacredByBand: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2], // band 0: 3 calls
  [3, 4, 5, 6], // band 1: 4 calls
  [7, 8], // band 2: 2 calls
  [9], // band 3: 1 call
  [10, 11, 12, 13, 14, 15], // band 4: 6 calls (actual largest)
  [], // band 5: empty
];

describe('planNextCall', () => {
  it('plans a rare event when the spawn roll lands at level 1+', () => {
    const plan = planNextCall(1, sacredByBand, 2, 0.05, 0.5, 0.5);
    expect(plan.isRareEvent).toBe(true);
    expect(plan.callId).toBe(-1); // caller generates the unique call
    expect(plan.band).toBeGreaterThanOrEqual(0);
    expect(plan.band).toBeLessThan(5); // core bands only
  });

  it('never plans a rare event at level 0 (base calls only)', () => {
    for (let roll = 0; roll < 0.2; roll += 0.025) {
      const plan = planNextCall(0, sacredByBand, 2, roll, 0.5, 0.5);
      expect(plan.isRareEvent).toBe(false);
    }
  });

  it("picks a sacred call from the player's band when it has calls", () => {
    const plan = planNextCall(0, sacredByBand, 2, 0.99, 0.5, 0.1);
    expect(plan.isRareEvent).toBe(false);
    expect(plan.band).toBe(2);
    expect([7, 8]).toContain(plan.callId);
  });

  it("falls back to the largest sacred band when the player's band is empty", () => {
    const plan = planNextCall(0, sacredByBand, 5, 0.99, 0.5, 0.5);
    expect(plan.isRareEvent).toBe(false);
    expect(plan.band).toBe(4); // band 4 has the largest pool
    expect(plan.callId).toBeGreaterThanOrEqual(10);
    expect(plan.callId).toBeLessThanOrEqual(15);
  });

  it('picks within the chosen band pool deterministically by pickRoll', () => {
    // band 0 pool [0,1,2]: pickRoll 0 → idx 0
    const a = planNextCall(0, sacredByBand, 0, 0.99, 0.5, 0);
    expect(a.callId).toBe(0);
    // pickRoll 0.5 → idx 1
    const b = planNextCall(0, sacredByBand, 0, 0.99, 0.5, 0.5);
    expect(b.callId).toBe(1);
    // band 0 pool [0,1,2]: pickRoll 0.9 → idx 2 (floor(0.9*3)=2)
    const c = planNextCall(0, sacredByBand, 0, 0.99, 0.5, 0.9);
    expect(c.callId).toBe(2);
  });

  it('falls back to -1 callId when every band is empty (loop stalls safely)', () => {
    const empty: ReadonlyArray<ReadonlyArray<number>> = [[], [], []];
    const plan = planNextCall(0, empty, 0, 0.99, 0.5, 0.5);
    expect(plan.callId).toBe(-1);
    expect(plan.isRareEvent).toBe(false);
  });
});
