// __tests__/engine/progression/EndlessNight.test.ts
// Tests for the pure Endless Night state machine.

import {
  SHIFTS_PER_ESCALATION,
  SANITY_DRAIN_ESCALATION_PER_LEVEL,
  ESCALATION_CALL_TYPES,
  RARE_EVENT_CHANCE,
  ENDLESS_SHIFT_CALL_BASE_INTERVAL_MS,
  ENDLESS_SHIFT_CALL_MIN_INTERVAL_MS,
  canStartEndlessNight,
  startEndlessNight,
  getEscalationLevel,
  getEscalationCallTypes,
  getWeatherForLevel,
  getEscalationSanityDrainMultiplier,
  onShiftCompleted,
  onGameOver,
  endEndlessNight,
  selectRareEvent,
  getEndlessDrainMultiplier,
  getEndlessCallInterval,
} from '@/engine/progression/EndlessNight';

describe('constants', () => {
  it('SHIFTS_PER_ESCALATION is 5', () => {
    expect(SHIFTS_PER_ESCALATION).toBe(5);
  });

  it('SANITY_DRAIN_ESCALATION_PER_LEVEL is 0.1', () => {
    expect(SANITY_DRAIN_ESCALATION_PER_LEVEL).toBe(0.1);
  });

  it('ESCALATION_CALL_TYPES has level 0 empty, level 1 with MULTI_CALLER+TIMING', () => {
    expect(ESCALATION_CALL_TYPES[0]).toEqual([]);
    expect(ESCALATION_CALL_TYPES[1]).toEqual(['MULTI_CALLER', 'TIMING']);
  });
});

describe('canStartEndlessNight', () => {
  it('returns true when shiftsCompleted >= 1 and ngPlusActive is false', () => {
    expect(canStartEndlessNight(1, false)).toBe(true);
    expect(canStartEndlessNight(5, false)).toBe(true);
  });

  it('returns false when shiftsCompleted is 0', () => {
    expect(canStartEndlessNight(0, false)).toBe(false);
  });

  it('returns false when ngPlusActive is true (even with shifts)', () => {
    expect(canStartEndlessNight(10, true)).toBe(false);
  });
});

describe('startEndlessNight', () => {
  it('returns initial state with active=true, score=0, level=0, weather=Clear', () => {
    const result = startEndlessNight(0);
    expect(result.endlessModeActive).toBe(true);
    expect(result.endlessScore).toBe(0);
    expect(result.endlessHighScore).toBe(0);
    expect(result.escalationLevel).toBe(0);
    expect(result.weather).toBe('Clear');
    expect(result.isGameOver).toBe(false);
  });

  it('preserves previousHighScore from argument', () => {
    const result = startEndlessNight(42);
    expect(result.endlessHighScore).toBe(42);
  });
});

describe('getEscalationLevel', () => {
  it('returns 0 for scores 0-4', () => {
    expect(getEscalationLevel(0)).toBe(0);
    expect(getEscalationLevel(4)).toBe(0);
  });

  it('returns 1 for scores 5-9', () => {
    expect(getEscalationLevel(5)).toBe(1);
    expect(getEscalationLevel(9)).toBe(1);
  });

  it('returns 2 for scores 10-14', () => {
    expect(getEscalationLevel(10)).toBe(2);
    expect(getEscalationLevel(14)).toBe(2);
  });

  it('returns 4 for score 20', () => {
    expect(getEscalationLevel(20)).toBe(4);
  });
});

describe('getEscalationCallTypes', () => {
  it('returns empty array at level 0', () => {
    expect(getEscalationCallTypes(0)).toEqual([]);
  });

  it('returns MULTI_CALLER+TIMING at level 1', () => {
    expect(getEscalationCallTypes(1)).toEqual(['MULTI_CALLER', 'TIMING']);
  });

  it('returns cumulative types at level 2 (MULTI_CALLER, TIMING, PUZZLE)', () => {
    expect(getEscalationCallTypes(2)).toEqual(['MULTI_CALLER', 'TIMING', 'PUZZLE']);
  });

  it('returns all types at level 4', () => {
    const result = getEscalationCallTypes(4);
    expect(result).toContain('MULTI_CALLER');
    expect(result).toContain('TIMING');
    expect(result).toContain('PUZZLE');
    expect(result).toContain('CONVERSATION');
    expect(result).toContain('DEAD_AIR');
  });

  it('does not duplicate types already present at lower levels', () => {
    const result = getEscalationCallTypes(10);
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });
});

describe('getWeatherForLevel', () => {
  it('returns "Clear" at level 0', () => {
    expect(getWeatherForLevel(0)).toBe('Clear');
  });

  it('returns "Overcast" at level 1', () => {
    expect(getWeatherForLevel(1)).toBe('Overcast');
  });

  it('returns "Storm" at level 2', () => {
    expect(getWeatherForLevel(2)).toBe('Storm');
  });

  it('returns "Signal Collapse" at level 5', () => {
    expect(getWeatherForLevel(5)).toBe('Signal Collapse');
  });

  it('clamps to highest defined weather for levels beyond 5', () => {
    expect(getWeatherForLevel(100)).toBe('Signal Collapse');
  });
});

describe('getEscalationSanityDrainMultiplier', () => {
  it('returns 1.0 at level 0', () => {
    expect(getEscalationSanityDrainMultiplier(0)).toBe(1.0);
  });

  it('returns 1.1 at level 1', () => {
    expect(getEscalationSanityDrainMultiplier(1)).toBeCloseTo(1.1, 5);
  });

  it('returns 1.2 at level 2', () => {
    expect(getEscalationSanityDrainMultiplier(2)).toBeCloseTo(1.2, 5);
  });

  it('returns 2.0 at level 10', () => {
    expect(getEscalationSanityDrainMultiplier(10)).toBeCloseTo(2.0, 5);
  });
});

describe('onShiftCompleted', () => {
  it('increments score by 1 and updates highScore', () => {
    const state = startEndlessNight(5);
    const result = onShiftCompleted(state);
    expect(result.endlessScore).toBe(1);
    expect(result.endlessHighScore).toBe(5);
  });

  it('updates highScore when new score exceeds it', () => {
    const state = startEndlessNight(0);
    const result = onShiftCompleted(state);
    expect(result.endlessHighScore).toBe(1);
  });

  it('updates escalation level when score crosses threshold', () => {
    let state = startEndlessNight(0);
    for (let i = 0; i < 5; i++) {
      state = onShiftCompleted(state);
    }
    expect(state.endlessScore).toBe(5);
    expect(state.escalationLevel).toBe(1);
    expect(state.weather).toBe('Overcast');
  });

  it('does not mutate the input state', () => {
    const state = startEndlessNight(0);
    const result = onShiftCompleted(state);
    expect(result).not.toBe(state);
    expect(state.endlessScore).toBe(0);
  });
});

describe('onGameOver', () => {
  it('sets endlessModeActive=false and isGameOver=true', () => {
    const state = startEndlessNight(0);
    const result = onGameOver(state);
    expect(result.endlessModeActive).toBe(false);
    expect(result.isGameOver).toBe(true);
  });

  it('preserves the score and highScore', () => {
    const state = { ...startEndlessNight(10), endlessScore: 15, endlessHighScore: 15 };
    const result = onGameOver(state);
    expect(result.endlessScore).toBe(15);
    expect(result.endlessHighScore).toBe(15);
  });
});

describe('endEndlessNight', () => {
  it('sets endlessModeActive=false but does NOT set isGameOver', () => {
    const state = startEndlessNight(0);
    const result = endEndlessNight(state);
    expect(result.endlessModeActive).toBe(false);
    expect(result.isGameOver).toBe(false);
  });

  it('preserves score and highScore', () => {
    const state = { ...startEndlessNight(10), endlessScore: 7 };
    const result = endEndlessNight(state);
    expect(result.endlessScore).toBe(7);
    expect(result.endlessHighScore).toBe(10);
  });
});

// --- DEA-86: procedural depth helpers ---

describe('RARE_EVENT_CHANCE', () => {
  it('is 0.2 and in (0, 1)', () => {
    expect(RARE_EVENT_CHANCE).toBe(0.2);
    expect(RARE_EVENT_CHANCE).toBeGreaterThan(0);
    expect(RARE_EVENT_CHANCE).toBeLessThan(1);
  });
});

describe('selectRareEvent', () => {
  it('never spawns a rare event at level 0 (no advanced types unlocked)', () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      const r = selectRareEvent(0, roll, 0);
      expect(r.isRareEvent).toBe(false);
      expect(r.callType).toBeNull();
      expect(r.band).toBeNull();
    }
  });

  it('spawns a rare event when the roll is under RARE_EVENT_CHANCE', () => {
    const r = selectRareEvent(1, 0.05, 0.5);
    expect(r.isRareEvent).toBe(true);
    expect(r.callType).not.toBeNull();
    expect(r.band).not.toBeNull();
    expect(r.band).toBeGreaterThanOrEqual(0);
    expect(r.band).toBeLessThan(5);
  });

  it('does not spawn a rare event when the roll is at or above RARE_EVENT_CHANCE', () => {
    expect(selectRareEvent(1, RARE_EVENT_CHANCE, 0.5).isRareEvent).toBe(false);
    expect(selectRareEvent(1, 0.99, 0.5).isRareEvent).toBe(false);
  });

  it('only picks call types unlocked at the escalation level', () => {
    // Level 2 unlocks MULTI_CALLER, TIMING, PUZZLE — never CONVERSATION/DEAD_AIR.
    const allowed = new Set(['MULTI_CALLER', 'TIMING', 'PUZZLE']);
    for (let roll = 0; roll < RARE_EVENT_CHANCE; roll += 0.005) {
      const r = selectRareEvent(2, roll, 0.5);
      if (r.isRareEvent) {
        expect(allowed.has(r.callType as string)).toBe(true);
      }
    }
  });

  it('covers every unlocked type across the rare-event roll range at level 1', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const r = selectRareEvent(1, (i / 200) * RARE_EVENT_CHANCE, 0.5);
      if (r.isRareEvent && r.callType !== null) {
        seen.add(r.callType);
      }
    }
    expect(seen).toEqual(new Set(['MULTI_CALLER', 'TIMING']));
  });

  it('always targets a core band (0-4)', () => {
    for (let bandRoll = 0; bandRoll < 1; bandRoll += 0.01) {
      const r = selectRareEvent(3, 0.01, bandRoll);
      if (r.isRareEvent && r.band !== null) {
        expect(r.band).toBeGreaterThanOrEqual(0);
        expect(r.band).toBeLessThan(5);
      }
    }
  });
});

describe('getEndlessDrainMultiplier', () => {
  it('returns the difficulty multiplier unchanged at level 0', () => {
    expect(getEndlessDrainMultiplier(0.7, 0)).toBeCloseTo(0.7, 5);
    expect(getEndlessDrainMultiplier(1, 0)).toBeCloseTo(1, 5);
    expect(getEndlessDrainMultiplier(1.5, 0)).toBeCloseTo(1.5, 5);
  });

  it('multiplies difficulty × escalation (insomniac level 2 → 1.2)', () => {
    expect(getEndlessDrainMultiplier(1, 2)).toBeCloseTo(1.2, 5);
  });

  it('multiplies difficulty × escalation (no_rest level 3 → 1.95)', () => {
    expect(getEndlessDrainMultiplier(1.5, 3)).toBeCloseTo(1.95, 5);
  });
});

describe('getEndlessCallInterval', () => {
  it('is the base interval at level 0 with a 1.0 frequency multiplier', () => {
    expect(getEndlessCallInterval(0, 1)).toBe(ENDLESS_SHIFT_CALL_BASE_INTERVAL_MS);
  });

  it('scales with the call-frequency multiplier', () => {
    // night_owl (1.3) at level 0 → 180s * 1.3 = 234s
    expect(getEndlessCallInterval(0, 1.3)).toBeCloseTo(234_000, 0);
  });

  it('shortens as escalation level rises', () => {
    const l0 = getEndlessCallInterval(0, 1);
    const l5 = getEndlessCallInterval(5, 1);
    expect(l5).toBeCloseTo(l0 / 1.5, 0);
    expect(l5).toBeLessThan(l0);
  });

  it('never goes below the floor', () => {
    // 180s / (1 + 0.1 * 70) = 22.5s < 25s → clamped to the floor
    expect(getEndlessCallInterval(70, 1)).toBe(ENDLESS_SHIFT_CALL_MIN_INTERVAL_MS);
    expect(getEndlessCallInterval(100, 0.1)).toBe(ENDLESS_SHIFT_CALL_MIN_INTERVAL_MS);
  });
});
