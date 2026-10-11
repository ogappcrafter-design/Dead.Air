// __tests__/store/endlessNightWiring.test.ts
// DEA-86: Endless Night store wiring.
//
// Covers the two store seams that make a run playable:
//   1. endlessNightSlice — guarded start (eligibility + idle call manager),
//      active-only score advancement, voluntary quit, restart from game over.
//   2. gameStateSlice — the escalation × difficulty drain multiplier applied
//      in decreaseSanity, the endless game-over at sanity 0 (which must fire
//      BEFORE the no_rest permadeath wipe), and the shift-completion gate so
//      endless shifts never inflate normal-mode progress.
//   3. useLeaderboardStore — endless score submission + achievement labels.

import { useGameStore } from '@/store/useGameStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import {
  useLeaderboardStore,
  submitEndlessScore,
  endlessAchievementLabel,
} from '@/store/useLeaderboardStore';
import { MAX_SANITY } from '@/lib/constants';
import { initialState } from '@/store/slices/initialState';

// Full endless-run state for a store in a known, eligible condition:
// one completed shift, no NG+ active, run active at a given level.
function activeRunState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...initialState,
    shiftsCompleted: 1,
    ngPlusActive: false,
    endlessModeActive: true,
    endlessScore: 2,
    endlessHighScore: 4,
    escalationLevel: 1,
    endlessWeather: 'Overcast',
    endlessGameOver: false,
    ...overrides,
  };
}

describe('DEA-86 endlessNightSlice wiring', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState, shiftsCompleted: 0, ngPlusActive: false });
    useSettingsStore.setState({ difficulty: 'insomniac' });
  });

  describe('startEndlessNightMode', () => {
    it('rejects the start when the player has not completed a shift', () => {
      useGameStore.setState({ ...initialState, shiftsCompleted: 0, ngPlusActive: false });
      useGameStore.getState().startEndlessNightMode();
      expect(useGameStore.getState().endlessModeActive).toBe(false);
    });

    it('rejects the start while an NG+ run is active', () => {
      useGameStore.setState({ ...initialState, shiftsCompleted: 3, ngPlusActive: true });
      useGameStore.getState().startEndlessNightMode();
      expect(useGameStore.getState().endlessModeActive).toBe(false);
    });

    it('starts a run when eligible: resets the run, preserves main-game progress', () => {
      useGameStore.setState({
        ...initialState,
        shiftsCompleted: 1,
        ngPlusActive: false,
        sanity: 42,
        static: 55,
        tapes: ['tape-1'],
        receivedCalls: [3],
      });

      useGameStore.getState().startEndlessNightMode();

      const s = useGameStore.getState();
      expect(s.endlessModeActive).toBe(true);
      expect(s.sanity).toBe(MAX_SANITY);
      expect(s.static).toBe(0);
      expect(s.endlessScore).toBe(0);
      expect(s.escalationLevel).toBe(0);
      expect(s.endlessWeather).toBe('Clear');
      expect(s.endlessGameOver).toBe(false);
      // Main-game progress must survive starting a run.
      expect(s.tapes).toEqual(['tape-1']);
      expect(s.receivedCalls).toEqual([3]);
      expect(s.shiftsCompleted).toBe(1);
    });
  });

  describe('incrementEndlessScore', () => {
    it('advances score, escalation and weather while a run is active', () => {
      useGameStore.setState(
        activeRunState({ endlessScore: 4, escalationLevel: 0, endlessWeather: 'Clear' }),
      );
      useGameStore.getState().incrementEndlessScore();
      const s = useGameStore.getState();
      expect(s.endlessScore).toBe(5);
      expect(s.endlessHighScore).toBe(5);
      expect(s.escalationLevel).toBe(1);
      expect(s.endlessWeather).toBe('Overcast');
    });

    it('does not advance when no run is active', () => {
      useGameStore.setState({
        ...initialState,
        shiftsCompleted: 1,
        endlessModeActive: false,
        endlessScore: 0,
      });
      useGameStore.getState().incrementEndlessScore();
      const s = useGameStore.getState();
      expect(s.endlessScore).toBe(0);
      expect(s.escalationLevel).toBe(0);
    });
  });

  describe('restartEndlessRun', () => {
    it('restarts from game over, clearing the flag and keeping the best', () => {
      useGameStore.setState(
        activeRunState({
          endlessModeActive: false,
          endlessGameOver: true,
          endlessScore: 3,
          endlessHighScore: 9,
        }),
      );
      useGameStore.getState().restartEndlessRun();
      const s = useGameStore.getState();
      expect(s.endlessModeActive).toBe(true);
      expect(s.endlessGameOver).toBe(false);
      expect(s.endlessScore).toBe(0);
      expect(s.endlessHighScore).toBe(9);
      expect(s.sanity).toBe(MAX_SANITY);
    });
  });

  describe('endEndlessNightMode', () => {
    it('ends the run without marking game over', () => {
      useGameStore.setState(activeRunState({ endlessScore: 6, endlessHighScore: 6 }));
      useGameStore.getState().endEndlessNightMode();
      const s = useGameStore.getState();
      expect(s.endlessModeActive).toBe(false);
      expect(s.endlessGameOver).toBe(false);
      expect(s.endlessHighScore).toBe(6);
    });
  });
});

describe('DEA-86 gameStateSlice: endless drain + game over', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState, shiftsCompleted: 1, ngPlusActive: false });
    useSettingsStore.setState({ difficulty: 'insomniac' });
  });

  it('applies the escalation drain multiplier to sanity loss during a run', () => {
    // insomniac (1.0) × level 2 (1.2) → 5 * 1.2 = 6
    useGameStore.setState(activeRunState({ escalationLevel: 2, sanity: MAX_SANITY }));
    useGameStore.getState().decreaseSanity(5);
    expect(useGameStore.getState().sanity).toBeCloseTo(MAX_SANITY - 6, 5);
  });

  it('composes difficulty and escalation (no_rest 1.5 × level 2 1.2 = 1.8)', () => {
    useSettingsStore.setState({ difficulty: 'no_rest' });
    useGameStore.setState(activeRunState({ escalationLevel: 2, sanity: MAX_SANITY }));
    useGameStore.getState().decreaseSanity(10);
    expect(useGameStore.getState().sanity).toBeCloseTo(MAX_SANITY - 18, 5);
  });

  it('does not apply the escalation multiplier outside a run', () => {
    // Same escalation level in state, but no active run → multiplier is 1.
    useGameStore.setState(
      activeRunState({ endlessModeActive: false, escalationLevel: 2, sanity: MAX_SANITY }),
    );
    useGameStore.getState().decreaseSanity(5);
    expect(useGameStore.getState().sanity).toBeCloseTo(MAX_SANITY - 5, 5);
  });

  it('flips endless game over at sanity 0 BEFORE the no_rest permadeath wipe', () => {
    useSettingsStore.setState({ difficulty: 'no_rest' });
    useGameStore.setState(
      activeRunState({
        escalationLevel: 0,
        sanity: 3,
        endlessScore: 7,
        endlessHighScore: 7,
        tapes: ['tape-1'],
      }),
    );

    useGameStore.getState().decreaseSanity(10);

    const s = useGameStore.getState();
    expect(s.sanity).toBe(0);
    // The endless run ends with a recorded game over (not a silent wipe).
    expect(s.endlessModeActive).toBe(false);
    expect(s.endlessGameOver).toBe(true);
    expect(s.endlessScore).toBe(7);
    expect(s.endlessHighScore).toBe(7);
    // The wipe did NOT run: progress survived so the banner can offer a restart.
    expect(s.tapes).toEqual(['tape-1']);
  });

  it('still permadeath-wipes when sanity hits 0 outside a run', () => {
    useSettingsStore.setState({ difficulty: 'no_rest' });
    useGameStore.setState({
      ...initialState,
      sanity: 3,
      endlessModeActive: false,
      tapes: ['tape-1'],
    });

    useGameStore.getState().decreaseSanity(10);

    const s = useGameStore.getState();
    expect(s.sanity).toBe(MAX_SANITY);
    expect(s.tapes).toEqual([]);
    expect(s.endlessGameOver).toBe(false);
  });
});

describe('DEA-86 gameStateSlice: shift-completion gate', () => {
  beforeEach(() => {
    useGameStore.setState({ ...initialState, shiftsCompleted: 1, ngPlusActive: false });
    useSettingsStore.setState({ difficulty: 'insomniac' });
  });

  it('does not count endless shifts toward normal-mode progress', () => {
    useGameStore.setState(activeRunState({ shiftsCompleted: 1 }));
    useGameStore.getState().incrementShiftsCompleted();
    expect(useGameStore.getState().shiftsCompleted).toBe(1);
  });

  it('counts shifts normally when no endless run is active', () => {
    useGameStore.setState(activeRunState({ endlessModeActive: false, shiftsCompleted: 1 }));
    useGameStore.getState().incrementShiftsCompleted();
    const s = useGameStore.getState();
    expect(s.shiftsCompleted).toBe(2);
    expect(s.shiftsCompletedByDifficulty.insomniac).toBe(1);
  });
});

describe('DEA-86 leaderboard submission', () => {
  it('labels scores by escalation tier', () => {
    expect(endlessAchievementLabel(0)).toBe('Night Shift');
    expect(endlessAchievementLabel(5)).toBe('Overcast Listener');
    expect(endlessAchievementLabel(10)).toBe('Storm Survivor');
    expect(endlessAchievementLabel(15)).toBe('Electrical Storm');
    expect(endlessAchievementLabel(20)).toBe('Anomalous Static');
    expect(endlessAchievementLabel(25)).toBe('Signal Collapsed');
    expect(endlessAchievementLabel(99)).toBe('Signal Collapsed');
  });

  it("submits a run under the player's call sign and keeps the board sorted", () => {
    const before = useLeaderboardStore.getState().entries.length;
    submitEndlessScore(42, 'TEST-SIGN-42');

    const { entries } = useLeaderboardStore.getState();
    expect(entries.length).toBe(before + 1);
    const mine = entries.find((e) => e.callSign === 'TEST-SIGN-42');
    expect(mine).toBeDefined();
    expect(mine!.score).toBe(42);
    // 42 >= 25 → top tier
    expect(mine!.achievement).toBe('Signal Collapsed');
    // Board stays sorted descending.
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].score).toBeGreaterThanOrEqual(entries[i].score);
    }
  });

  it('falls back to a generated call sign when the player has none set', () => {
    const before = useLeaderboardStore.getState().entries.length;
    submitEndlessScore(12, '   ');

    const { entries } = useLeaderboardStore.getState();
    expect(entries.length).toBe(before + 1);
    const mine = entries.find((e) => e.score === 12);
    expect(mine).toBeDefined();
    expect(mine!.callSign).not.toBe('');
    expect(mine!.callSign).not.toBe('   ');
  });
});
