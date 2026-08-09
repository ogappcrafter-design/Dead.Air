import { Platform, StatusBar } from 'react-native';

/** Amber-on-black CRT. Band accents live in src/content/bands.js. */
export const colors = {
  bg: '#030303',
  panel: '#0a0a0a',
  hairline: '#111111',
  line: '#1a1a1a',
  lineBright: '#2a2a2a',

  amber: '#FF8C00',
  amberInk: '#1a0e00',
  green: '#39FF14',
  red: '#FF3366',
  white: '#FFFFFF',

  text: '#e0e0e0',
  textSoft: '#aaaaaa',
  textDim: '#888888',
  textFaint: '#555555',
  textGhost: '#333333',
  textVoid: '#2a2a2a',
};

export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const type = {
  logo: { fontFamily: mono, fontSize: 18, letterSpacing: 5, color: colors.amber },
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 3, color: colors.textFaint },
  body: { fontFamily: mono, fontSize: 14, color: colors.text },
  line: { fontFamily: mono, fontSize: 15, lineHeight: 23 },
  timer: { fontFamily: mono, fontSize: 42, letterSpacing: 4, color: colors.amber },
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/**
 * Top inset without pulling in react-native-safe-area-context. Android reports
 * a real status bar height; iOS notch devices need a constant, and v1 simply
 * hard-coded 52 everywhere.
 */
export const safeTop =
  Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 52;
