// tests/store/useAmbientStore.test.ts
// Tests for the ambient profile selection store (DEA-30).

import { useAmbientStore } from '@/store/useAmbientStore';

describe('useAmbientStore', () => {
  beforeEach(() => {
    useAmbientStore.getState().setActiveAmbient('default');
  });

  describe('initial state', () => {
    it('starts with default ambient', () => {
      expect(useAmbientStore.getState().activeAmbient).toBe('default');
    });
  });

  describe('setActiveAmbient', () => {
    it('sets the active ambient pack id', () => {
      useAmbientStore.getState().setActiveAmbient('rain_night');
      expect(useAmbientStore.getState().activeAmbient).toBe('rain_night');
    });

    it('can switch between packs', () => {
      useAmbientStore.getState().setActiveAmbient('rain_night');
      expect(useAmbientStore.getState().activeAmbient).toBe('rain_night');
      useAmbientStore.getState().setActiveAmbient('deep_space');
      expect(useAmbientStore.getState().activeAmbient).toBe('deep_space');
    });

    it('can return to default', () => {
      useAmbientStore.getState().setActiveAmbient('winter_static');
      useAmbientStore.getState().setActiveAmbient('default');
      expect(useAmbientStore.getState().activeAmbient).toBe('default');
    });
  });
});
