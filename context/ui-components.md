# Dead Air Radio — UI Components & Design System

## Design Language

CRT aesthetic — retro radio / analog horror vibe. Dark backgrounds, green/amber phosphor text, scanline effects, glitch styling.

## Component Architecture

- **Screens** in `app/` (Expo Router routes)
- **Components** in `components/` — presentational, receive props from Zustand stores
- **No component library** (no NativeBase, no Tamagui) — custom styled components with React Native StyleSheet

## Key UI Components

### Radio Screen (`app/radio/index.tsx` + `components/radio/RadioBody.tsx`)
- Frequency tuner (dial control)
- Band selector (5 bands: LIVING, LIMINAL, LOST, CLASSIFIED, ████████)
- Volume control
- Signal strength visualizer
- Call display area
- **CRITICAL:** Currently no audio playback — pure visual UI

### Store Screen (`app/store/index.tsx`)
- StoreCard components for IAP products
- Purchase button (currently mock)
- "Mock store. Real billing arrives in a later phase." disclaimer

### Tape Detail (TBD — PIX-4262 adds player UI)
- Will need: play/pause/stop controls, progress bar, visual feedback
- Must integrate with CRT aesthetic

### Settings Screen (`app/settings/`)
- Will need: "Restore Purchases" button (PIX-4264)

## Styling Patterns

- React Native `StyleSheet.create()` for all styles
- Dark theme: `#0a0a0a` backgrounds, phosphor green `#33ff33`, amber `#ffb000`
- Monospace fonts for terminal/radio text
- Animated components use `react-native-reanimated`

## State Management

- `useRadioStore` — frequency, band, volume, signal strength
- `useGameStore` — sanity, static level, tapes, collected calls
- `useStoreStore` — IAP state (hasInfiniteSignal, purchase methods — currently mock)

## No Design System File

No `DESIGN.md`, no theme config, no shared design tokens. Styling is inline per component. Match existing patterns when adding new UI.
