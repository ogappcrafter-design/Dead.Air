// tests/store/usePlayerStore.test.ts
// Tests for the player identity Zustand store (DEA-48).

import { usePlayerStore } from '@/store/usePlayerStore';

describe('usePlayerStore', () => {
  beforeEach(() => {
    // Reset to initial state before each test
    usePlayerStore.getState().resetPlayer();
  });

  describe('initial state', () => {
    it('starts with empty player name', () => {
      expect(usePlayerStore.getState().playerName).toBe('');
    });

    it('starts with empty DJ call sign', () => {
      expect(usePlayerStore.getState().djCallSign).toBe('');
    });

    it('starts with empty station name', () => {
      expect(usePlayerStore.getState().stationName).toBe('');
    });

    it('starts with hasOnboarded false', () => {
      expect(usePlayerStore.getState().hasOnboarded).toBe(false);
    });
  });

  describe('setPlayerName', () => {
    it('sets the player name', () => {
      usePlayerStore.getState().setPlayerName('Alice');
      expect(usePlayerStore.getState().playerName).toBe('Alice');
    });

    it('trims whitespace', () => {
      usePlayerStore.getState().setPlayerName('  Alice  ');
      expect(usePlayerStore.getState().playerName).toBe('Alice');
    });

    it('allows empty string', () => {
      usePlayerStore.getState().setPlayerName('Bob');
      usePlayerStore.getState().setPlayerName('');
      expect(usePlayerStore.getState().playerName).toBe('');
    });
  });

  describe('setDjCallSign', () => {
    it('sets the DJ call sign', () => {
      usePlayerStore.getState().setDjCallSign('DJ-01');
      expect(usePlayerStore.getState().djCallSign).toBe('DJ-01');
    });

    it('trims whitespace', () => {
      usePlayerStore.getState().setDjCallSign('  NIGHTOWL  ');
      expect(usePlayerStore.getState().djCallSign).toBe('NIGHTOWL');
    });
  });

  describe('setStationName', () => {
    it('sets the station name', () => {
      usePlayerStore.getState().setStationName('Dead Air Radio');
      expect(usePlayerStore.getState().stationName).toBe('Dead Air Radio');
    });

    it('trims whitespace', () => {
      usePlayerStore.getState().setStationName('  Static FM  ');
      expect(usePlayerStore.getState().stationName).toBe('Static FM');
    });
  });

  describe('completeOnboarding', () => {
    it('sets all identity fields and marks onboarded', () => {
      usePlayerStore.getState().completeOnboarding({
        playerName: 'Alice',
        djCallSign: 'NIGHTOWL',
        stationName: 'Dead Air Radio',
      });
      const state = usePlayerStore.getState();
      expect(state.playerName).toBe('Alice');
      expect(state.djCallSign).toBe('NIGHTOWL');
      expect(state.stationName).toBe('Dead Air Radio');
      expect(state.hasOnboarded).toBe(true);
    });

    it('trims all fields', () => {
      usePlayerStore.getState().completeOnboarding({
        playerName: '  Alice  ',
        djCallSign: '  NIGHTOWL  ',
        stationName: '  Dead Air Radio  ',
      });
      const state = usePlayerStore.getState();
      expect(state.playerName).toBe('Alice');
      expect(state.djCallSign).toBe('NIGHTOWL');
      expect(state.stationName).toBe('Dead Air Radio');
    });
  });

  describe('resetPlayer', () => {
    it('restores initial state', () => {
      usePlayerStore.getState().completeOnboarding({
        playerName: 'Alice',
        djCallSign: 'NIGHTOWL',
        stationName: 'Dead Air Radio',
      });
      usePlayerStore.getState().resetPlayer();
      const state = usePlayerStore.getState();
      expect(state.playerName).toBe('');
      expect(state.djCallSign).toBe('');
      expect(state.stationName).toBe('');
      expect(state.hasOnboarded).toBe(false);
    });
  });
});
