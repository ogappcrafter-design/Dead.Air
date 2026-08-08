// __tests__/store/useSkinStore.test.ts
// Tests for the cosmetic skin store: state transitions, ownership, reset.

import { useSkinStore, isSkinProductId, skinIdFromProductId } from '../../store/useSkinStore';
import { DEFAULT_SKIN_ID, PURCHASABLE_SKIN_IDS } from '../../lib/skins';

describe('useSkinStore', () => {
  beforeEach(() => {
    useSkinStore.setState({
      activeSkin: DEFAULT_SKIN_ID,
      ownedSkins: [DEFAULT_SKIN_ID],
    });
  });

  describe('initial state', () => {
    it('defaults activeSkin to "default"', () => {
      expect(useSkinStore.getState().activeSkin).toBe('default');
    });

    it('defaults ownedSkins to ["default"]', () => {
      expect(useSkinStore.getState().ownedSkins).toEqual(['default']);
    });
  });

  describe('setActiveSkin', () => {
    it('sets active skin when skin is owned', () => {
      useSkinStore.getState().addOwnedSkin('vintage_wood');
      useSkinStore.getState().setActiveSkin('vintage_wood');
      expect(useSkinStore.getState().activeSkin).toBe('vintage_wood');
    });

    it('does not set active skin when skin is not owned', () => {
      useSkinStore.getState().setActiveSkin('vintage_wood');
      expect(useSkinStore.getState().activeSkin).toBe('default');
    });

    it('allows setting back to default', () => {
      useSkinStore.getState().addOwnedSkin('military_green');
      useSkinStore.getState().setActiveSkin('military_green');
      useSkinStore.getState().setActiveSkin('default');
      expect(useSkinStore.getState().activeSkin).toBe('default');
    });
  });

  describe('addOwnedSkin', () => {
    it('adds a new skin to ownedSkins', () => {
      useSkinStore.getState().addOwnedSkin('space_age_blue');
      expect(useSkinStore.getState().ownedSkins).toContain('space_age_blue');
    });

    it('does not duplicate when adding existing skin', () => {
      useSkinStore.getState().addOwnedSkin('digital_pixel');
      useSkinStore.getState().addOwnedSkin('digital_pixel');
      const count = useSkinStore.getState().ownedSkins.filter((s) => s === 'digital_pixel').length;
      expect(count).toBe(1);
    });
  });

  describe('isOwned', () => {
    it('returns true for default skin', () => {
      expect(useSkinStore.getState().isOwned('default')).toBe(true);
    });

    it('returns false for unpurchased skin', () => {
      expect(useSkinStore.getState().isOwned('vintage_wood')).toBe(false);
    });

    it('returns true after purchase', () => {
      useSkinStore.getState().addOwnedSkin('vintage_wood');
      expect(useSkinStore.getState().isOwned('vintage_wood')).toBe(true);
    });
  });

  describe('resetSkins', () => {
    it('resets to default state', () => {
      useSkinStore.getState().addOwnedSkin('vintage_wood');
      useSkinStore.getState().addOwnedSkin('military_green');
      useSkinStore.getState().setActiveSkin('vintage_wood');
      useSkinStore.getState().resetSkins();
      expect(useSkinStore.getState().activeSkin).toBe('default');
      expect(useSkinStore.getState().ownedSkins).toEqual(['default']);
    });
  });

  describe('isSkinProductId', () => {
    it('returns true for valid skin product IDs', () => {
      expect(isSkinProductId('com.deadair.skin.vintage_wood')).toBe(true);
      expect(isSkinProductId('com.deadair.skin.military_green')).toBe(true);
      expect(isSkinProductId('com.deadair.skin.space_age_blue')).toBe(true);
      expect(isSkinProductId('com.deadair.skin.digital_pixel')).toBe(true);
    });

    it('returns false for non-skin product IDs', () => {
      expect(isSkinProductId('com.deadair.base')).toBe(false);
      expect(isSkinProductId('com.deadair.infinite_signal')).toBe(false);
      expect(isSkinProductId('random_product')).toBe(false);
    });
  });

  describe('skinIdFromProductId', () => {
    it('maps product ID to skin id', () => {
      expect(skinIdFromProductId('com.deadair.skin.vintage_wood')).toBe('vintage_wood');
      expect(skinIdFromProductId('com.deadair.skin.military_green')).toBe('military_green');
    });

    it('returns null for non-skin product IDs', () => {
      expect(skinIdFromProductId('com.deadair.base')).toBeNull();
      expect(skinIdFromProductId('com.deadair.infinite_signal')).toBeNull();
    });

    it('returns null for invalid skin product IDs', () => {
      expect(skinIdFromProductId('com.deadair.skin.nonexistent')).toBeNull();
    });

    it('maps all purchasable skin IDs', () => {
      PURCHASABLE_SKIN_IDS.forEach((skinId) => {
        const productId = `com.deadair.skin.${skinId}`;
        expect(skinIdFromProductId(productId)).toBe(skinId);
      });
    });
  });
});
