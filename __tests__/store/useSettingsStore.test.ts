// __tests__/store/useSettingsStore.test.ts
import { useSettingsStore } from '../../store/useSettingsStore';

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      masterVolume: 0.7,
      sfxVolume: 0.8,
      musicVolume: 0.5,
      voiceVolume: 1.0,
      staticEnabled: true,
      scanlineIntensity: 0.1,
      crtEnabled: true,
      crtIntensity: 0.3,
      reducedMotion: false,
      autoSave: true,
      callFrequency: 'medium',
      difficulty: 'insomniac',
      cloudSyncEnabled: false,
      userId: null,
    });
  });

  it('has initial state', () => {
    const state = useSettingsStore.getState();
    expect(state.masterVolume).toBe(0.7);
    expect(state.difficulty).toBe('insomniac');
    expect(state.cloudSyncEnabled).toBe(false);
  });

  it('updates volumes', () => {
    const { setMasterVolume, setSfxVolume } = useSettingsStore.getState();
    setMasterVolume(0.9);
    setSfxVolume(0.3);
    expect(useSettingsStore.getState().masterVolume).toBe(0.9);
    expect(useSettingsStore.getState().sfxVolume).toBe(0.3);
  });

  it('clamps volume to 0-1', () => {
    const { setMasterVolume } = useSettingsStore.getState();
    setMasterVolume(1.5);
    expect(useSettingsStore.getState().masterVolume).toBe(1);
    setMasterVolume(-0.5);
    expect(useSettingsStore.getState().masterVolume).toBe(0);
  });

  it('toggles settings', () => {
    const { setStaticEnabled, setCrtEnabled } = useSettingsStore.getState();
    setStaticEnabled(false);
    setCrtEnabled(false);
    expect(useSettingsStore.getState().staticEnabled).toBe(false);
    expect(useSettingsStore.getState().crtEnabled).toBe(false);
  });

  it('resets to defaults', () => {
    const { setMasterVolume, setDifficulty, resetSettings } = useSettingsStore.getState();
    setMasterVolume(0.1);
    setDifficulty('no_rest');
    resetSettings();
    expect(useSettingsStore.getState().masterVolume).toBe(0.7);
    expect(useSettingsStore.getState().difficulty).toBe('insomniac');
  });
});
