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
    });
  });

  it('has initial state', () => {
    const state = useGameStore.getState();
    expect(state.sanity).toBe(100);
    expect(state.static).toBe(0);
    expect(state.tapes).toEqual([]);
    expect(state.unlockedBands).toEqual(['LIVING']);
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
  });
});
