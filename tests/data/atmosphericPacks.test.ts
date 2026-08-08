// tests/data/atmosphericPacks.test.ts
// Tests for the atmospheric pack registry (DEA-30).

// Mock expo-in-app-purchases native module before any import that pulls it in.
jest.mock('expo-in-app-purchases', () => ({
  connectAsync: jest.fn(),
  disconnectAsync: jest.fn(),
  getProducts: jest.fn(),
  purchaseItem: jest.fn(),
  acknowledgeItem: jest.fn(),
  getPurchaseHistory: jest.fn(),
  InitConnectionResult: {},
  PurchaseState: { DOWNLOADED: 0, INSTALLED: 1, RESTORED: 2 },
  PurchaseErrorReason: {},
  IAPResponseCode: { OK: 0, ERROR: 1 },
}));

import {
  ATMOSPHERIC_PACKS,
  getAtmosphericPack,
  getPackByProductId,
  getOwnedPacks,
  DEFAULT_PACK_ID,
} from '@/data/atmosphericPacks';
import { PRODUCT_IDS } from '@/lib/iap';

describe('Atmospheric pack registry', () => {
  it('has exactly 3 packs', () => {
    expect(ATMOSPHERIC_PACKS).toHaveLength(3);
  });

  it('all packs have unique ids', () => {
    const ids = ATMOSPHERIC_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all packs have unique productIds', () => {
    const productIds = ATMOSPHERIC_PACKS.map((p) => p.productId);
    expect(new Set(productIds).size).toBe(productIds.length);
  });

  it('all packs have $1.99 price', () => {
    for (const pack of ATMOSPHERIC_PACKS) {
      expect(pack.price).toBe('$1.99');
    }
  });

  it('all packs have non-empty name and description', () => {
    for (const pack of ATMOSPHERIC_PACKS) {
      expect(pack.name.length).toBeGreaterThan(0);
      expect(pack.description.length).toBeGreaterThan(0);
    }
  });

  it('all packs have an ambientProfile', () => {
    for (const pack of ATMOSPHERIC_PACKS) {
      expect(pack.ambientProfile).toBeDefined();
      expect(pack.ambientProfile.id).toBe(pack.id);
    }
  });

  it('all packs have a fragments library', () => {
    for (const pack of ATMOSPHERIC_PACKS) {
      expect(pack.fragments).toBeDefined();
      expect(pack.fragments.bandName).toBe('LIVING');
    }
  });

  describe('getAtmosphericPack', () => {
    it('returns pack by id', () => {
      const pack = getAtmosphericPack('rain_night');
      expect(pack).toBeDefined();
      expect(pack?.name).toBe('Rain Night');
    });

    it('returns undefined for unknown id', () => {
      expect(getAtmosphericPack('nonexistent')).toBeUndefined();
    });
  });

  describe('getPackByProductId', () => {
    it('returns pack by product id', () => {
      const pack = getPackByProductId(PRODUCT_IDS.ATMOS_RAIN_NIGHT);
      expect(pack).toBeDefined();
      expect(pack?.id).toBe('rain_night');
    });

    it('returns undefined for unknown product id', () => {
      expect(getPackByProductId('com.deadair.unknown')).toBeUndefined();
    });
  });

  describe('getOwnedPacks', () => {
    it('returns packs for owned ids', () => {
      const packs = getOwnedPacks(['rain_night', 'deep_space']);
      expect(packs).toHaveLength(2);
      expect(packs[0].id).toBe('rain_night');
      expect(packs[1].id).toBe('deep_space');
    });

    it('filters out unknown ids', () => {
      const packs = getOwnedPacks(['rain_night', 'nonexistent']);
      expect(packs).toHaveLength(1);
      expect(packs[0].id).toBe('rain_night');
    });

    it('returns empty for empty input', () => {
      expect(getOwnedPacks([])).toEqual([]);
    });
  });

  it('DEFAULT_PACK_ID is "default"', () => {
    expect(DEFAULT_PACK_ID).toBe('default');
  });
});
