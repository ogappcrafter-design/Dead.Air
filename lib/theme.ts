export const colors = {
  // CRT colors
  background: '#030303',
  amber: '#FF8C00',
  green: '#39FF14',
  red: '#FF3131',
  dimGreen: '#1A5C0A',

  // UI colors
  surface: '#0A0A0A',
  surfaceLight: '#1A1A1A',
  border: '#2A2A2A',
  text: '#E0E0E0',
  textMuted: '#666666',
} as const;

export const fonts = {
  // Eater = text consumed by static/dead air, VT323 = green phosphor terminal
  // Loaded via Google Fonts (see app/_layout.tsx injectFonts)
  mono: 'VT323, Courier, monospace',
  display: 'Eater, Courier New, serif',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const theme = {
  colors,
  fonts,
  spacing,
} as const;

export type Theme = typeof theme;
