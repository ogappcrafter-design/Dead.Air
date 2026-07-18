import { colors, fonts, spacing, theme } from '../../lib/theme';

describe('Theme', () => {
  it('has all required color keys', () => {
    expect(colors).toHaveProperty('background');
    expect(colors).toHaveProperty('amber');
    expect(colors).toHaveProperty('green');
    expect(colors).toHaveProperty('background', '#030303');
  });

  it('has monospace font', () => {
    expect(fonts.mono).toBeDefined();
  });

  it('has spacing scale', () => {
    expect(spacing.xs).toBeLessThan(spacing.sm);
    expect(spacing.sm).toBeLessThan(spacing.md);
  });

  it('theme object contains all parts', () => {
    expect(theme.colors).toBe(colors);
    expect(theme.fonts).toBe(fonts);
    expect(theme.spacing).toBe(spacing);
  });
});
