// __tests__/store/useGameStore.test.ts
import { useGameStore } from '../../store/useGameStore';

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      sanity: 100,
      static: 0,
      tapes: [],
      unlockedBands: ['LIVING'],
      isPlaying: false,
      currentCall: null,
      receivedCalls: [],
      sanityLowest: 100,
      shiftsCompleted: 0,
      longestCallSurvivedMs: 0,
    });
  });

  it('has initial state', () => {
    const state = useGameStore.getState();
    expect(state.sanity).toBe(100);
    expect(state.static).toBe(0);
    expect(state.tapes).toEqual([]);
    expect(state.unlockedBands).toEqual(['LIVING']);
    expect(state.sanityLowest).toBe(100);
    expect(state.shiftsCompleted).toBe(0);
    expect(state.longestCallSurvivedMs).toBe(0);
  });

  it('decreases sanity', () => {
    const { decreaseSanity } = useGameStore.getState();
    decreaseSanity(10);
    expect(useGameStore.getState().sanity).toBe(90);
  });

  it('does not go below 0 sanity', () => {
    const { decreaseSanity } = useGameStore.getState();
    decreaseSanity(150);
    expect(useGameStore.getState().sanity).toBe(0);
  });

  it('adds static', () => {
    const { addStatic } = useGameStore.getState();
    addStatic(50);
    expect(useGameStore.getState().static).toBe(50);
  });

  it('caps static at 100', () => {
    const { addStatic } = useGameStore.getState();
    addStatic(150);
    expect(useGameStore.getState().static).toBe(100);
  });

  it('adds tape', () => {
    const { addTape } = useGameStore.getState();
    addTape('tape-1');
    expect(useGameStore.getState().tapes).toContain('tape-1');
  });

  it('does not add duplicate tape', () => {
    const { addTape } = useGameStore.getState();
    addTape('tape-1');
    addTape('tape-1');
    expect(useGameStore.getState().tapes.filter((t) => t === 'tape-1')).toHaveLength(1);
  });

  it('unlocks band', () => {
    const { unlockBand } = useGameStore.getState();
    unlockBand('LIMINAL');
    expect(useGameStore.getState().unlockedBands).toContain('LIMINAL');
  });

  it('resets game', () => {
    const { decreaseSanity, addTape, resetGame } = useGameStore.getState();
    decreaseSanity(50);
    addTape('tape-1');
    resetGame();
    expect(useGameStore.getState().sanity).toBe(100);
    expect(useGameStore.getState().tapes).toEqual([]);
    expect(useGameStore.getState().sanityLowest).toBe(100);
  });

  it('tracks sanityLowest as cumulative minimum on decreaseSanity', () => {
    const { decreaseSanity } = useGameStore.getState();
    decreaseSanity(30);
    expect(useGameStore.getState().sanity).toBe(70);
    expect(useGameStore.getState().sanityLowest).toBe(70);
    decreaseSanity(40);
    expect(useGameStore.getState().sanity).toBe(30);
    expect(useGameStore.getState().sanityLowest).toBe(30);
  });

  it('does not raise sanityLowest when sanity recovers', () => {
    const { decreaseSanity, increaseSanity } = useGameStore.getState();
    decreaseSanity(40);
    expect(useGameStore.getState().sanityLowest).toBe(60);
    increaseSanity(20);
    expect(useGameStore.getState().sanity).toBe(80);
    expect(useGameStore.getState().sanityLowest).toBe(60);
  });

  it('increments shiftsCompleted', () => {
    const { incrementShiftsCompleted } = useGameStore.getState();
    incrementShiftsCompleted();
    incrementShiftsCompleted();
    expect(useGameStore.getState().shiftsCompleted).toBe(2);
  });

  it('records longest call duration as running maximum', () => {
    const { recordCallDuration } = useGameStore.getState();
    recordCallDuration(5000);
    expect(useGameStore.getState().longestCallSurvivedMs).toBe(5000);
    recordCallDuration(3000);
    expect(useGameStore.getState().longestCallSurvivedMs).toBe(5000);
    recordCallDuration(10000);
    expect(useGameStore.getState().longestCallSurvivedMs).toBe(10000);
  });
});
