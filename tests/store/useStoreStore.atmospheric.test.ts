// tests/store/useStoreStore.atmospheric.test.ts
// Tests for atmospheric DLC pack ownership in useStoreStore (DEA-30).

import { useStoreStore } from '@/store/useStoreStore';

describe('useStoreStore atmospheric packs', () => {
  beforeEach(() => {
    useStoreStore.getState().resetPurchases();
  });

  describe('initial state', () => {
    it('starts with empty ownedAtmosphericPacks', () => {
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual([]);
    });
  });

  describe('addOwnedAtmosphericPack', () => {
    it('adds a pack id', () => {
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual(['rain_night']);
    });

    it('adds multiple pack ids', () => {
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      useStoreStore.getState().addOwnedAtmosphericPack('winter_static');
      useStoreStore.getState().addOwnedAtmosphericPack('deep_space');
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual([
        'rain_night',
        'winter_static',
        'deep_space',
      ]);
    });

    it('deduplicates pack ids', () => {
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual(['rain_night']);
    });

    it('preserves order of first addition on dedup', () => {
      useStoreStore.getState().addOwnedAtmosphericPack('winter_static');
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      useStoreStore.getState().addOwnedAtmosphericPack('winter_static');
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual([
        'winter_static',
        'rain_night',
      ]);
    });
  });

  describe('resetPurchases', () => {
    it('clears ownedAtmosphericPacks', () => {
      useStoreStore.getState().addOwnedAtmosphericPack('rain_night');
      useStoreStore.getState().addOwnedAtmosphericPack('deep_space');
      useStoreStore.getState().resetPurchases();
      expect(useStoreStore.getState().ownedAtmosphericPacks).toEqual([]);
    });
  });
});
