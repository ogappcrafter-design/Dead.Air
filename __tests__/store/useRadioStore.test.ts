// __tests__/store/useRadioStore.test.ts
import { useRadioStore } from '../../store/useRadioStore';

describe('useRadioStore', () => {
  beforeEach(() => {
    useRadioStore.setState({
      currentBand: 'LIVING',
      frequency: 87.5,
      volume: 0.5,
      isTuning: false,
      signalStrength: 1,
    });
  });

  it('has initial state', () => {
    const state = useRadioStore.getState();
    expect(state.currentBand).toBe('LIVING');
    expect(state.frequency).toBe(87.5);
    expect(state.volume).toBe(0.5);
    expect(state.isTuning).toBe(false);
  });

  it('sets band', () => {
    const { setBand } = useRadioStore.getState();
    setBand('LIMINAL');
    expect(useRadioStore.getState().currentBand).toBe('LIMINAL');
  });

  it('sets frequency within range', () => {
    const { setFrequency } = useRadioStore.getState();
    setFrequency(95.0);
    expect(useRadioStore.getState().frequency).toBe(95.0);
  });

  it('clamps frequency to valid range', () => {
    const { setFrequency } = useRadioStore.getState();
    setFrequency(50); // Below minimum
    expect(useRadioStore.getState().frequency).toBe(87.5);
    setFrequency(200); // Above maximum
    expect(useRadioStore.getState().frequency).toBe(108.0);
  });

  it('sets volume', () => {
    const { setVolume } = useRadioStore.getState();
    setVolume(0.8);
    expect(useRadioStore.getState().volume).toBe(0.8);
  });

  it('clamps volume to 0-1', () => {
    const { setVolume } = useRadioStore.getState();
    setVolume(-0.5);
    expect(useRadioStore.getState().volume).toBe(0);
    setVolume(1.5);
    expect(useRadioStore.getState().volume).toBe(1);
  });

  it('sets tuning state', () => {
    const { setTuning } = useRadioStore.getState();
    setTuning(true);
    expect(useRadioStore.getState().isTuning).toBe(true);
  });
});
