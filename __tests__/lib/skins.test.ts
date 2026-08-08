// __tests__/lib/skins.test.ts
// Tests for the skin registry: completeness, structure, getSkin fallback.

import {
  SKINS,
  SKIN_IDS,
  PURCHASABLE_SKIN_IDS,
  getSkin,
  DEFAULT_SKIN_ID,
  Skin,
} from '../../lib/skins';

describe('skin registry', () => {
  describe('SKIN_IDS', () => {
    it('includes all 5 skins', () => {
      expect(SKIN_IDS).toHaveLength(5);
      expect(SKIN_IDS).toContain('default');
      expect(SKIN_IDS).toContain('vintage_wood');
      expect(SKIN_IDS).toContain('military_green');
      expect(SKIN_IDS).toContain('space_age_blue');
      expect(SKIN_IDS).toContain('digital_pixel');
    });
  });

  describe('PURCHASABLE_SKIN_IDS', () => {
    it('includes 4 purchasable skins (excludes default)', () => {
      expect(PURCHASABLE_SKIN_IDS).toHaveLength(4);
      expect(PURCHASABLE_SKIN_IDS).not.toContain('default');
    });

    it('all purchasable skins have price > 0', () => {
      PURCHASABLE_SKIN_IDS.forEach((skinId) => {
        expect(SKINS[skinId].price).toBeGreaterThan(0);
      });
    });
  });

  describe('each skin has valid structure', () => {
    SKIN_IDS.forEach((skinId) => {
      it(`${skinId} has complete Skin structure`, () => {
        const skin: Skin = SKINS[skinId];
        expect(skin).toBeDefined();
        expect(skin.id).toBe(skinId);
        expect(typeof skin.name).toBe('string');
        expect(skin.name.length).toBeGreaterThan(0);
        expect(typeof skin.description).toBe('string');
        expect(skin.description.length).toBeGreaterThan(0);
        expect(typeof skin.price).toBe('number');
        expect(skin.price).toBeGreaterThanOrEqual(0);

        // Colors
        expect(skin.colors.background).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.surface).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.textSecondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.power).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(skin.colors.station).toMatch(/^#[0-9A-Fa-f]{6}$/);

        // Fonts
        expect(typeof skin.fonts.primary).toBe('string');
        expect(skin.fonts.primary.length).toBeGreaterThan(0);
        expect(typeof skin.fonts.secondary).toBe('string');
        expect(skin.fonts.secondary.length).toBeGreaterThan(0);

        // Spacing
        expect(typeof skin.spacing.compact).toBe('number');
        expect(skin.spacing.compact).toBeGreaterThan(0);
        expect(typeof skin.spacing.comfortable).toBe('number');
        expect(skin.spacing.comfortable).toBeGreaterThan(0);
      });
    });
  });

  describe('skins are visually distinct', () => {
    it('all skins have distinct background colors', () => {
      const backgrounds = SKIN_IDS.map((id) => SKINS[id].colors.background);
      const unique = new Set(backgrounds);
      expect(unique.size).toBe(SKIN_IDS.length);
    });

    it('all skins have distinct surface colors', () => {
      const surfaces = SKIN_IDS.map((id) => SKINS[id].colors.surface);
      const unique = new Set(surfaces);
      expect(unique.size).toBe(SKIN_IDS.length);
    });

    it('all skins have distinct accent colors', () => {
      const accents = SKIN_IDS.map((id) => SKINS[id].colors.accent);
      const unique = new Set(accents);
      expect(unique.size).toBe(SKIN_IDS.length);
    });
  });

  describe('getSkin', () => {
    it('returns the correct skin for valid id', () => {
      expect(getSkin('default').id).toBe('default');
      expect(getSkin('vintage_wood').id).toBe('vintage_wood');
      expect(getSkin('digital_pixel').id).toBe('digital_pixel');
    });

    it('returns default skin for unknown id', () => {
      const skin = getSkin('nonexistent');
      expect(skin.id).toBe('default');
    });

    it('returns default skin for empty string', () => {
      const skin = getSkin('');
      expect(skin.id).toBe('default');
    });
  });

  describe('DEFAULT_SKIN_ID', () => {
    it('is "default"', () => {
      expect(DEFAULT_SKIN_ID).toBe('default');
    });
  });

  describe('default skin matches theme', () => {
    it('default skin surface matches theme surface color', () => {
      expect(SKINS.default.colors.surface).toBe('#0A0A0A');
    });

    it('default skin border matches theme border color', () => {
      expect(SKINS.default.colors.border).toBe('#2A2A2A');
    });

    it('default skin background matches theme background color', () => {
      expect(SKINS.default.colors.background).toBe('#030303');
    });
  });
});
