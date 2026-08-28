# Dead Air — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up Expo project with navigation, theme, save/load system, and basic state stores — the foundation everything else builds on.

**Architecture:** Expo Router for file-based navigation, Zustand for state management with persistence, AsyncStorage for local save, CRT aesthetic theme system.

**Tech Stack:** Expo SDK 52+, React Native, TypeScript, Zustand, AsyncStorage, Expo Router

## Global Constraints

- Expo SDK 52+ (latest stable)
- TypeScript strict mode
- No `any` types
- No `@ts-ignore` or `@ts-expect-error`
- ESLint + Prettier enforced
- Target: Web PWA + iOS + Android
- Existing 18 calls in `components/calls.js` are sacred — do not modify

---

## File Structure

```
dead-air/
├── app/
│   ├── _layout.tsx         # Root layout with theme provider
│   ├── index.tsx           # Boot/splash screen
│   ├── +not-found.tsx      # 404 screen
│   ├── radio/
│   │   └── index.tsx       # Main radio screen (placeholder)
│   ├── tapes/
│   │   └── index.tsx       # Tape collection (placeholder)
│   ├── store/
│   │   └── index.tsx       # IAP store (placeholder)
│   └── settings/
│       └── index.tsx       # Settings (placeholder)
├── lib/
│   ├── theme.ts            # CRT colors, fonts, spacing
│   ├── storage.ts          # AsyncStorage wrapper
│   └── constants.ts        # App constants
├── store/
│   ├── useGameStore.ts     # Sanity, static, tapes, bands
│   ├── useRadioStore.ts    # Current band, frequency, volume
│   └── useSettingsStore.ts # Preferences, audio settings
├── components/
│   └── shared/
│       └── CRTView.tsx     # CRT scanline overlay
├── __tests__/
│   ├── lib/
│   │   └── storage.test.ts
│   └── store/
│       ├── useGameStore.test.ts
│       └── useRadioStore.test.ts
└── package.json
```

---

## Tasks

### Task 1: Initialize Expo Project

**Files:**

- Create: `package.json` (via expo-cli)
- Create: `tsconfig.json`
- Create: `app.json`
- Create: `.eslintrc.js`
- Create: `.prettierrc`

**Interfaces:**

- Consumes: None
- Produces: Working Expo project with TypeScript

- [ ] **Step 1: Create Expo project**

```bash
npx create-expo-app@latest dead-air --template blank-typescript
cd dead-air
```

- [ ] **Step 2: Install dependencies**

```bash
npx expo install expo-router expo-constants expo-linking expo-status-bar react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated @react-native-async-storage/async-storage zustand
```

- [ ] **Step 3: Configure TypeScript strict mode**

```json
// tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 4: Configure ESLint**

```javascript
// .eslintrc.js
module.exports = {
  extends: ['expo', '@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
  },
};
```

- [ ] **Step 5: Configure Prettier**

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100
}
```

- [ ] **Step 6: Verify project runs**

```bash
npx expo start
```

Expected: Project starts without errors

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize expo project with typescript, eslint, prettier"
```

---

### Task 2: Set Up Theme System

**Files:**

- Create: `lib/theme.ts`
- Create: `components/shared/CRTView.tsx`

**Interfaces:**

- Consumes: None
- Produces: `theme` object with colors/fonts/spacing, `CRTView` component

- [ ] **Step 1: Create theme constants**

```typescript
// lib/theme.ts
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
  mono: 'Courier',
  display: 'Courier New',
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
```

- [ ] **Step 2: Create CRT overlay component**

```tsx
// components/shared/CRTView.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

interface CRTViewProps {
  children: React.ReactNode;
  intensity?: number;
}

export function CRTView({ children, intensity = 0.1 }: CRTViewProps) {
  return (
    <View style={styles.container}>
      {children}
      <View style={[styles.scanlines, { opacity: intensity }]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030303',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Scanline effect via repeating gradient
    // Applied via platform-specific code or SVG
  },
});
```

- [ ] **Step 3: Write theme test**

```typescript
// __tests__/lib/theme.test.ts
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
```

- [ ] **Step 4: Run test**

```bash
npx jest __tests__/lib/theme.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts components/shared/CRTView.tsx __tests__/lib/theme.test.ts
git commit -m "feat: add CRT theme system with colors, fonts, spacing"
```

---

### Task 3: Create Storage Wrapper

**Files:**

- Create: `lib/storage.ts`
- Create: `__tests__/lib/storage.test.ts`

**Interfaces:**

- Consumes: `@react-native-async-storage/async-storage`
- Produces: `storage.get<T>(key)`, `storage.set<T>(key, value)`, `storage.remove(key)`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/lib/storage.test.ts
import { storage } from '../../lib/storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('Storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets value by key', async () => {
    const mockGetItem = require('@react-native-async-storage/async-storage').default.getItem;
    mockGetItem.mockResolvedValueOnce(JSON.stringify({ test: 'value' }));

    const result = await storage.get<{ test: string }>('test-key');
    expect(result).toEqual({ test: 'value' });
    expect(mockGetItem).toHaveBeenCalledWith('test-key');
  });

  it('returns null for missing key', async () => {
    const mockGetItem = require('@react-native-async-storage/async-storage').default.getItem;
    mockGetItem.mockResolvedValueOnce(null);

    const result = await storage.get('missing');
    expect(result).toBeNull();
  });

  it('sets value by key', async () => {
    const mockSetItem = require('@react-native-async-storage/async-storage').default.setItem;

    await storage.set('test-key', { foo: 'bar' });
    expect(mockSetItem).toHaveBeenCalledWith('test-key', JSON.stringify({ foo: 'bar' }));
  });

  it('removes value by key', async () => {
    const mockRemoveItem = require('@react-native-async-storage/async-storage').default.removeItem;

    await storage.remove('test-key');
    expect(mockRemoveItem).toHaveBeenCalledWith('test-key');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/storage.test.ts
```

Expected: FAIL with "Cannot find module '../../lib/storage'"

- [ ] **Step 3: Implement storage wrapper**

```typescript
// lib/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silently fail — game should work offline
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/storage.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: add AsyncStorage wrapper with get/set/remove"
```

---

### Task 4: Create Game Store

**Files:**

- Create: `store/useGameStore.ts`
- Create: `__tests__/store/useGameStore.test.ts`

**Interfaces:**

- Consumes: `lib/storage.ts`, `lib/constants.ts`
- Produces: `useGameStore` hook with sanity, static, tapes, unlockedBands

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/store/useGameStore.test.ts
import { useGameStore } from '../../store/useGameStore';

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.setState({
      sanity: 100,
      static: 0,
      tapes: [],
      unlockedBands: ['LIVING'],
      isPlaying: false,
      currentCall: null,
    });
  });

  it('has initial state', () => {
    const state = useGameStore.getState();
    expect(state.sanity).toBe(100);
    expect(state.static).toBe(0);
    expect(state.tapes).toEqual([]);
    expect(state.unlockedBands).toEqual(['LIVING']);
  });

  it('decreases sanity', () => {
    const { decreaseSanity } = useGameStore.getState();
    decreaseSanity(10);
    expect(useGameStore.getState().sanity).toBe(90);
  });

  it('does not go below 0 sanity', () => {
    const { decreaseSanity } = useGameStore.getState();
    decreaseSanity(150);
    expect(useGameStore.getState().sanity).toBe(0);
  });

  it('adds static', () => {
    const { addStatic } = useGameStore.getState();
    addStatic(50);
    expect(useGameStore.getState().static).toBe(50);
  });

  it('caps static at 100', () => {
    const { addStatic } = useGameStore.getState();
    addStatic(150);
    expect(useGameStore.getState().static).toBe(100);
  });

  it('adds tape', () => {
    const { addTape } = useGameStore.getState();
    addTape('tape-1');
    expect(useGameStore.getState().tapes).toContain('tape-1');
  });

  it('does not add duplicate tape', () => {
    const { addTape } = useGameStore.getState();
    addTape('tape-1');
    addTape('tape-1');
    expect(useGameStore.getState().tapes.filter((t) => t === 'tape-1')).toHaveLength(1);
  });

  it('unlocks band', () => {
    const { unlockBand } = useGameStore.getState();
    unlockBand('LIMINAL');
    expect(useGameStore.getState().unlockedBands).toContain('LIMINAL');
  });

  it('resets game', () => {
    const { decreaseSanity, addTape, resetGame } = useGameStore.getState();
    decreaseSanity(50);
    addTape('tape-1');
    resetGame();
    expect(useGameStore.getState().sanity).toBe(100);
    expect(useGameStore.getState().tapes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/store/useGameStore.test.ts
```

Expected: FAIL with "Cannot find module '../../store/useGameStore'"

- [ ] **Step 3: Create constants file first**

```typescript
// lib/constants.ts
export const SAVE_KEY = 'dead_air_save_v1';
export const PURCHASES_KEY = 'dead_air_purchases_v1';

export const BANDS = ['LIVING', 'LIMINAL', 'LOST', 'CLASSIFIED', '████████'] as const;
export type Band = (typeof BANDS)[number];

export const CALL_TYPES = [
  'JUST_LISTEN',
  'DEAD_AIR',
  'RIGHT_ANSWER',
  'SIGNAL_DECODE',
  'STAY_CALM',
] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const MAX_SANITY = 100;
export const MAX_STATIC = 100;
```

- [ ] **Step 4: Implement game store**

```typescript
// store/useGameStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY, MAX_SANITY, MAX_STATIC } from '../lib/constants';

interface GameState {
  sanity: number;
  static: number;
  tapes: string[];
  unlockedBands: Band[];
  isPlaying: boolean;
  currentCall: string | null;

  // Actions
  decreaseSanity: (amount: number) => void;
  addStatic: (amount: number) => void;
  addTape: (tapeId: string) => void;
  unlockBand: (band: Band) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentCall: (callId: string | null) => void;
  resetGame: () => void;
}

const initialState = {
  sanity: MAX_SANITY,
  static: 0,
  tapes: [] as string[],
  unlockedBands: ['LIVING'] as Band[],
  isPlaying: false,
  currentCall: null as string | null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...initialState,

      decreaseSanity: (amount) =>
        set((state) => ({
          sanity: Math.max(0, state.sanity - amount),
        })),

      addStatic: (amount) =>
        set((state) => ({
          static: Math.min(MAX_STATIC, state.static + amount),
        })),

      addTape: (tapeId) =>
        set((state) => ({
          tapes: state.tapes.includes(tapeId) ? state.tapes : [...state.tapes, tapeId],
        })),

      unlockBand: (band) =>
        set((state) => ({
          unlockedBands: state.unlockedBands.includes(band)
            ? state.unlockedBands
            : [...state.unlockedBands, band],
        })),

      setPlaying: (playing) => set({ isPlaying: playing }),

      setCurrentCall: (callId) => set({ currentCall: callId }),

      resetGame: () => set(initialState),
    }),
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/store/useGameStore.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/constants.ts store/useGameStore.ts __tests__/store/useGameStore.test.ts
git commit -m "feat: add game store with sanity, static, tapes, bands"
```

---

### Task 5: Create Radio Store

**Files:**

- Create: `store/useRadioStore.ts`
- Create: `__tests__/store/useRadioStore.test.ts`

**Interfaces:**

- Consumes: `lib/constants.ts`
- Produces: `useRadioStore` hook with band, frequency, volume, isTuning

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/store/useRadioStore.test.ts
import { useRadioStore } from '../../store/useRadioStore';

describe('useRadioStore', () => {
  beforeEach(() => {
    useRadioStore.setState({
      currentBand: 'LIVING',
      frequency: 87.5,
      volume: 0.5,
      isTuning: false,
      signalStrength: 1,
    });
  });

  it('has initial state', () => {
    const state = useRadioStore.getState();
    expect(state.currentBand).toBe('LIVING');
    expect(state.frequency).toBe(87.5);
    expect(state.volume).toBe(0.5);
    expect(state.isTuning).toBe(false);
  });

  it('sets band', () => {
    const { setBand } = useRadioStore.getState();
    setBand('LIMINAL');
    expect(useRadioStore.getState().currentBand).toBe('LIMINAL');
  });

  it('sets frequency within range', () => {
    const { setFrequency } = useRadioStore.getState();
    setFrequency(95.0);
    expect(useRadioStore.getState().frequency).toBe(95.0);
  });

  it('clamps frequency to valid range', () => {
    const { setFrequency } = useRadioStore.getState();
    setFrequency(50); // Below minimum
    expect(useRadioStore.getState().frequency).toBe(87.5);
    setFrequency(200); // Above maximum
    expect(useRadioStore.getState().frequency).toBe(108.0);
  });

  it('sets volume', () => {
    const { setVolume } = useRadioStore.getState();
    setVolume(0.8);
    expect(useRadioStore.getState().volume).toBe(0.8);
  });

  it('clamps volume to 0-1', () => {
    const { setVolume } = useRadioStore.getState();
    setVolume(-0.5);
    expect(useRadioStore.getState().volume).toBe(0);
    setVolume(1.5);
    expect(useRadioStore.getState().volume).toBe(1);
  });

  it('sets tuning state', () => {
    const { setTuning } = useRadioStore.getState();
    setTuning(true);
    expect(useRadioStore.getState().isTuning).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/store/useRadioStore.test.ts
```

Expected: FAIL with "Cannot find module '../../store/useRadioStore'"

- [ ] **Step 3: Implement radio store**

```typescript
// store/useRadioStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Band, SAVE_KEY } from '../lib/constants';

const MIN_FREQUENCY = 87.5;
const MAX_FREQUENCY = 108.0;

interface RadioState {
  currentBand: Band;
  frequency: number;
  volume: number;
  isTuning: boolean;
  signalStrength: number;

  // Actions
  setBand: (band: Band) => void;
  setFrequency: (freq: number) => void;
  setVolume: (vol: number) => void;
  setTuning: (tuning: boolean) => void;
  setSignalStrength: (strength: number) => void;
  resetRadio: () => void;
}

const initialState = {
  currentBand: 'LIVING' as Band,
  frequency: MIN_FREQUENCY,
  volume: 0.5,
  isTuning: false,
  signalStrength: 1,
};

export const useRadioStore = create<RadioState>()(
  persist(
    (set) => ({
      ...initialState,

      setBand: (band) => set({ currentBand: band }),

      setFrequency: (freq) =>
        set({
          frequency: Math.max(MIN_FREQUENCY, Math.min(MAX_FREQUENCY, freq)),
        }),

      setVolume: (vol) =>
        set({
          volume: Math.max(0, Math.min(1, vol)),
        }),

      setTuning: (tuning) => set({ isTuning: tuning }),

      setSignalStrength: (strength) =>
        set({
          signalStrength: Math.max(0, Math.min(1, strength)),
        }),

      resetRadio: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_radio`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/store/useRadioStore.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add store/useRadioStore.ts __tests__/store/useRadioStore.test.ts
git commit -m "feat: add radio store with band, frequency, volume controls"
```

---

### Task 6: Create Settings Store

**Files:**

- Create: `store/useSettingsStore.ts`

**Interfaces:**

- Consumes: `lib/constants.ts`
- Produces: `useSettingsStore` hook with audio, display, gameplay preferences

- [ ] **Step 1: Implement settings store**

```typescript
// store/useSettingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAVE_KEY } from '../lib/constants';

interface SettingsState {
  // Audio
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  voiceVolume: number;
  staticEnabled: boolean;

  // Display
  scanlineIntensity: number;
  crtEnabled: boolean;
  reducedMotion: boolean;

  // Gameplay
  autoSave: boolean;
  callFrequency: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'normal' | 'hard';

  // Account
  cloudSyncEnabled: boolean;
  userId: string | null;

  // Actions
  setMasterVolume: (vol: number) => void;
  setSfxVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;
  setVoiceVolume: (vol: number) => void;
  setStaticEnabled: (enabled: boolean) => void;
  setScanlineIntensity: (intensity: number) => void;
  setCrtEnabled: (enabled: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setAutoSave: (enabled: boolean) => void;
  setCallFrequency: (freq: 'low' | 'medium' | 'high') => void;
  setDifficulty: (diff: 'easy' | 'normal' | 'hard') => void;
  setCloudSyncEnabled: (enabled: boolean) => void;
  setUserId: (id: string | null) => void;
  resetSettings: () => void;
}

const initialState = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  voiceVolume: 1.0,
  staticEnabled: true,
  scanlineIntensity: 0.1,
  crtEnabled: true,
  reducedMotion: false,
  autoSave: true,
  callFrequency: 'medium' as const,
  difficulty: 'normal' as const,
  cloudSyncEnabled: false,
  userId: null as string | null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setMasterVolume: (vol) => set({ masterVolume: Math.max(0, Math.min(1, vol)) }),
      setSfxVolume: (vol) => set({ sfxVolume: Math.max(0, Math.min(1, vol)) }),
      setMusicVolume: (vol) => set({ musicVolume: Math.max(0, Math.min(1, vol)) }),
      setVoiceVolume: (vol) => set({ voiceVolume: Math.max(0, Math.min(1, vol)) }),
      setStaticEnabled: (enabled) => set({ staticEnabled: enabled }),
      setScanlineIntensity: (intensity) =>
        set({ scanlineIntensity: Math.max(0, Math.min(1, intensity)) }),
      setCrtEnabled: (enabled) => set({ crtEnabled: enabled }),
      setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
      setAutoSave: (enabled) => set({ autoSave: enabled }),
      setCallFrequency: (freq) => set({ callFrequency: freq }),
      setDifficulty: (diff) => set({ difficulty: diff }),
      setCloudSyncEnabled: (enabled) => set({ cloudSyncEnabled: enabled }),
      setUserId: (id) => set({ userId: id }),
      resetSettings: () => set(initialState),
    }),
    {
      name: `${SAVE_KEY}_settings`,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
```

- [ ] **Step 2: Write test**

```typescript
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
      reducedMotion: false,
      autoSave: true,
      callFrequency: 'medium',
      difficulty: 'normal',
      cloudSyncEnabled: false,
      userId: null,
    });
  });

  it('has initial state', () => {
    const state = useSettingsStore.getState();
    expect(state.masterVolume).toBe(0.7);
    expect(state.difficulty).toBe('normal');
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
    setDifficulty('hard');
    resetSettings();
    expect(useSettingsStore.getState().masterVolume).toBe(0.7);
    expect(useSettingsStore.getState().difficulty).toBe('normal');
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx jest __tests__/store/useSettingsStore.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add store/useSettingsStore.ts __tests__/store/useSettingsStore.test.ts
git commit -m "feat: add settings store with audio, display, gameplay prefs"
```

---

### Task 7: Set Up Expo Router

**Files:**

- Modify: `app.json` (add scheme)
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `app/+not-found.tsx`
- Create: `app/radio/index.tsx` (placeholder)
- Create: `app/tapes/index.tsx` (placeholder)
- Create: `app/store/index.tsx` (placeholder)
- Create: `app/settings/index.tsx` (placeholder)

**Interfaces:**

- Consumes: `lib/theme.ts`, stores
- Produces: Working navigation between screens

- [ ] **Step 1: Update app.json for router**

```json
{
  "expo": {
    "name": "Dead Air",
    "slug": "dead-air",
    "version": "1.0.0",
    "scheme": "deadair",
    "platforms": ["ios", "android", "web"],
    "web": {
      "bundler": "metro",
      "output": "single"
    }
  }
}
```

- [ ] **Step 2: Create root layout**

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { CRTView } from '../components/shared/CRTView';
import { colors } from '../lib/theme';
import { useSettingsStore } from '../store/useSettingsStore';

export default function RootLayout() {
  const crtEnabled = useSettingsStore((s) => s.crtEnabled);

  return (
    <CRTView intensity={crtEnabled ? 0.1 : 0}>
      <View style={styles.container}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="radio" />
          <Stack.Screen name="tapes" />
          <Stack.Screen name="store" />
          <Stack.Screen name="settings" />
        </Stack>
        <StatusBar style="light" />
      </View>
    </CRTView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
```

- [ ] **Step 3: Create splash/index screen**

```tsx
// app/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { colors, fonts, spacing } from '../lib/theme';
import { useGameStore } from '../store/useGameStore';

export default function IndexScreen() {
  const router = useRouter();
  const isPlaying = useGameStore((s) => s.isPlaying);

  useEffect(() => {
    // Auto-navigate after splash
    const timer = setTimeout(() => {
      router.replace('/radio');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DEAD AIR</Text>
      <Text style={styles.subtitle}>Late Night Radio</Text>
      <Text style={styles.loading}>Tuning frequencies...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.amber,
    letterSpacing: 8,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.green,
    marginBottom: spacing.xxl,
  },
  loading: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
});
```

- [ ] **Step 4: Create 404 screen**

```tsx
// app/+not-found.tsx
import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, fonts, spacing } from '../lib/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NO SIGNAL</Text>
      <Text style={styles.subtitle}>Frequency not found</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Return to station</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.red,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  link: {
    padding: spacing.md,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
  },
});
```

- [ ] **Step 5: Create placeholder screens**

```tsx
// app/radio/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export default function RadioScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RADIO</Text>
      <Text style={styles.placeholder}>Coming in Phase 2</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
});
```

```tsx
// app/tapes/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export default function TapesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>TAPES</Text>
      <Text style={styles.placeholder}>Coming in Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
});
```

```tsx
// app/store/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export default function StoreScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>STORE</Text>
      <Text style={styles.placeholder}>Coming in Phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
});
```

```tsx
// app/settings/index.tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, spacing } from '../../lib/theme';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SETTINGS</Text>
      <Text style={styles.placeholder}>Coming in Phase 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.amber,
    marginBottom: spacing.md,
  },
  placeholder: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textMuted,
  },
});
```

- [ ] **Step 6: Verify navigation works**

```bash
npx expo start
```

Expected: App launches, shows splash, navigates to radio screen

- [ ] **Step 7: Commit**

```bash
git add app/ app.json
git commit -m "feat: set up expo router with all screens"
```

---

### Task 8: Create Data Files

**Files:**

- Create: `data/bands.ts`
- Create: `data/tapes.ts`
- Create: `data/calls.ts` (copy from existing)

**Interfaces:**

- Consumes: `lib/constants.ts`
- Produces: Band definitions, tape metadata, calls data

- [ ] **Step 1: Create bands data**

```typescript
// data/bands.ts
import { Band } from '../lib/constants';

export interface BandInfo {
  id: Band;
  name: string;
  description: string;
  frequencyRange: [number, number];
  vibe: string;
  unlockRequirement: string;
}

export const BANDS: Record<Band, BandInfo> = {
  LIVING: {
    id: 'LIVING',
    name: 'LIVING',
    description: 'Normal broadcasts. Safe. Boring.',
    frequencyRange: [87.5, 92.0],
    vibe: 'static, distant music, talk radio',
    unlockRequirement: 'None — starting band',
  },
  LIMINAL: {
    id: 'LIMINAL',
    name: 'LIMINAL',
    description: 'Between stations. Something listens.',
    frequencyRange: [92.0, 96.5],
    vibe: 'whispers, reversed audio, time distortion',
    unlockRequirement: 'Survive 3 night shifts',
  },
  LOST: {
    id: 'LOST',
    name: 'LOST',
    description: "Frequencies that shouldn't exist.",
    frequencyRange: [96.5, 101.0],
    vibe: 'children singing, dial-up tones, impossible distances',
    unlockRequirement: 'Collect 5 tapes',
  },
  CLASSIFIED: {
    id: 'CLASSIFIED',
    name: 'CLASSIFIED',
    description: "Government stations. They know you're listening.",
    frequencyRange: [101.0, 105.5],
    vibe: 'numbers stations, emergency alerts, distorted orders',
    unlockRequirement: 'Complete "The Signal" call',
  },
  '████████': {
    id: '████████',
    name: '████████',
    description: '[REDACTED]',
    frequencyRange: [105.5, 108.0],
    vibe: '[DATA EXPUNGED]',
    unlockRequirement: 'Find all 15 tapes',
  },
};

export const getBandByFrequency = (freq: number): BandInfo | null => {
  return (
    Object.values(BANDS).find(
      (band) => freq >= band.frequencyRange[0] && freq <= band.frequencyRange[1],
    ) ?? null
  );
};
```

- [ ] **Step 2: Create tapes data**

```typescript
// data/tapes.ts

export interface TapeInfo {
  id: string;
  title: string;
  description: string;
  band: string;
  duration: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export const TAPES: TapeInfo[] = [
  {
    id: 'tape-001',
    title: 'First Night',
    description: 'Your first shift. Everything seems normal.',
    band: 'LIVING',
    duration: '4:32',
    rarity: 'common',
  },
  {
    id: 'tape-002',
    title: 'Static Lullaby',
    description: 'A child hums through the interference.',
    band: 'LIMINAL',
    duration: '3:18',
    rarity: 'common',
  },
  {
    id: 'tape-003',
    title: 'The Last Broadcast',
    description: "They signed off. They didn't come back.",
    band: 'LIVING',
    duration: '6:45',
    rarity: 'uncommon',
  },
  {
    id: 'tape-004',
    title: 'Numbers',
    description: 'Seven. Seven. Seven. Seven.',
    band: 'CLASSIFIED',
    duration: '2:14',
    rarity: 'rare',
  },
  {
    id: 'tape-005',
    title: 'Dead Air',
    description: 'The silence between stations.',
    band: 'LOST',
    duration: '5:00',
    rarity: 'uncommon',
  },
  {
    id: 'tape-006',
    title: 'Emergency',
    description: 'This is not a test.',
    band: 'CLASSIFIED',
    duration: '1:58',
    rarity: 'rare',
  },
  {
    id: 'tape-007',
    title: 'Lullaby',
    description: 'Go to sleep. Go to sleep. Go to sleep.',
    band: 'LIMINAL',
    duration: '4:12',
    rarity: 'uncommon',
  },
  {
    id: 'tape-008',
    title: 'The Signal',
    description: 'You found it. Now it found you.',
    band: '████████',
    duration: '13:33',
    rarity: 'legendary',
  },
  {
    id: 'tape-009',
    title: 'Frequencies',
    description: 'Every number has a name.',
    band: 'CLASSIFIED',
    duration: '3:44',
    rarity: 'rare',
  },
  {
    id: 'tape-010',
    title: 'Whispers',
    description: "They're talking about you.",
    band: 'LIMINAL',
    duration: '2:56',
    rarity: 'uncommon',
  },
  {
    id: 'tape-011',
    title: 'The Void',
    description: 'Listen too long and it listens back.',
    band: 'LOST',
    duration: '7:21',
    rarity: 'rare',
  },
  {
    id: 'tape-012',
    title: 'Broadcast',
    description: 'One final transmission.',
    band: 'LIVING',
    duration: '5:33',
    rarity: 'common',
  },
  {
    id: 'tape-013',
    title: 'Static',
    description: 'White noise. Pure. Perfect.',
    band: 'LOST',
    duration: '4:00',
    rarity: 'uncommon',
  },
  {
    id: 'tape-014',
    title: 'Protocol',
    description: 'Follow instructions. Do not deviate.',
    band: 'CLASSIFIED',
    duration: '3:12',
    rarity: 'rare',
  },
  {
    id: 'tape-015',
    title: '███████',
    description: '[CORRUPTED]',
    band: '████████',
    duration: '9:99',
    rarity: 'legendary',
  },
];

export const getTapeById = (id: string): TapeInfo | undefined => {
  return TAPES.find((tape) => tape.id === id);
};

export const getTapesByBand = (band: string): TapeInfo[] => {
  return TAPES.filter((tape) => tape.band === band);
};
```

- [ ] **Step 3: Copy existing calls data**

```bash
cp components/calls.js data/calls.js
```

- [ ] **Step 4: Commit**

```bash
git add data/
git commit -m "feat: add bands, tapes, and calls data files"
```

---

### Task 9: Add Jest Configuration

**Files:**

- Create: `jest.config.js`
- Modify: `package.json` (add test script)

**Interfaces:**

- Consumes: None
- Produces: Working Jest setup

- [ ] **Step 1: Create Jest config**

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*)',
  ],
  setupFilesAfterSetup: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};
```

- [ ] **Step 2: Add test script to package.json**

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add jest.config.js package.json
git commit -m "chore: add jest configuration"
```

---

### Task 10: Clean Up and Verify

**Files:**

- Delete: Old `App.js` (replaced by app/_layout.tsx)
- Delete: Old `components/` (replaced by new structure)

**Interfaces:**

- Consumes: All previous tasks
- Produces: Clean project ready for Phase 2

- [ ] **Step 1: Remove old files**

```bash
rm App.js
rm -rf components/
```

- [ ] **Step 2: Update package.json entry point**

```json
{
  "main": "expo-router/entry"
}
```

- [ ] **Step 3: Verify everything works**

```bash
npx expo start
npm test
```

Expected: App launches, all tests pass

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: clean up old files, verify foundation"
```

---

## Summary

Phase 1 establishes:

- ✅ Expo project with TypeScript
- ✅ CRT theme system
- ✅ AsyncStorage wrapper
- ✅ Game store (sanity, static, tapes, bands)
- ✅ Radio store (band, frequency, volume)
- ✅ Settings store (audio, display, gameplay)
- ✅ Expo Router navigation
- ✅ Data files (bands, tapes, calls)
- ✅ Jest testing setup

**Next:** Phase 2 — Radio UI components (dial, display, band selector, volume)
