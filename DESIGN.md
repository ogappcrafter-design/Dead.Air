# Dead Air — Design Document

## Understanding Summary

- **What:** Paranormal late-night radio horror game
- **Why:** Transform existing ~970-line prototype into a polished, addictive, multi-platform experience
- **Who:** Horror fans, indie game enthusiasts, mobile gamers
- **Platforms:** Web PWA + iOS/Android + Desktop via Expo
- **Horror Style:** Ambient psychological — quiet dread, not jump scares

## Assumptions

1. Expo SDK 52+ with Expo Router
2. Claude API backend for AI calls
3. Single developer + AI assistance
4. Minimal budget (open-source tools preferred)
5. Existing 18 calls are sacred — no rewriting
6. Web Audio API for real-time audio synthesis
7. Zustand for state management
8. Firebase/Supabase for optional cloud sync

## Non-Goals

- No multiplayer
- No predatory monetization
- No jump scares
- No combat
- No complex narrative trees

---

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|--------------|-----------|
| 1 | Multi-platform via Expo | React Native only, Web only | Maximum reach, single codebase |
| 2 | Ground-up rebuild | Refactor existing | Existing code too minimal to salvage |
| 3 | Triple-hook addiction | Single hook | Real-time + procedural + progression = maximum retention |
| 4 | Ambient psychological horror | Jump scares, action horror | Matches late-night radio vibe, more unsettling |
| 5 | Full audio engine | Pre-recorded only | Real-time synthesis = infinite variation, genuine unease |
| 6 | Hybrid sessions | Structured only, ambient only | Balances progression with ambient dread |
| 7 | Keep 18 calls sacred | Rewrite, expand | Writing is strong, add systems around them |
| 8 | Real radio UI | Minimalist, abstract | Physicality increases immersion |
| 9 | Local + cloud save | Cloud only, local only | Offline-first, optional sync |
| 10 | Zustand over Redux | Redux, MobX, Context | Lightweight, persistence built-in, perfect for games |
| 11 | Expo Router | React Navigation, manual routing | File-based, web-compatible, modern |

---

## Architecture

### Core Structure

```
dead-air/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout
│   ├── index.tsx           # Boot/splash
│   ├── radio.tsx           # Main radio screen
│   ├── tapes.tsx           # Tape collection
│   ├── store.tsx           # IAP store
│   └── settings.tsx        # Settings/account
├── components/
│   ├── radio/              # Physical radio UI
│   ├── calls/              # Call type renderers
│   ├── tapes/              # Tape collection UI
│   └── shared/             # CRT effects, glow text
├── engine/
│   ├── audio/              # Web Audio API engine
│   ├── radio/              # Band/tuning logic
│   └── save/               # Persistence layer
├── store/                  # Zustand stores
├── data/                   # Calls, bands, tapes
├── styles/                 # Theme, colors
└── assets/                 # Audio, images
```

### Key Systems

**Audio Engine:**
- Web Audio API context
- Effects chain: static synth → distortion → reverb → spatial
- Real-time voice processing for calls
- Ambient background layer

**Radio System:**
- 5 frequency bands (LIVING → LIMINAL → LOST → CLASSIFIED → ████████)
- Signal strength based on tuning accuracy
- Band unlocking via progression
- Time-based event scheduling

**Call System:**
- 5 call types with distinct mechanics
- Procedural variation (randomized details, timing)
- Sanity effects per call type
- Static currency rewards

**Progression:**
- Night shift structure (4-hour sessions)
- Band unlocking (metroidvania-style)
- Tape collection (15 unique)
- Sanity management

**Save System:**
- Local: AsyncStorage (default)
- Cloud: Firebase/optional (opt-in)
- Auto-save between shifts

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Expo project setup
- Basic navigation
- Theme/styling system
- Save/load system

### Phase 2: Radio UI (Week 3-4)
- Physical dial component
- Frequency display
- Band selector
- Volume control
- CRT effects

### Phase 3: Audio Engine (Week 5-6)
- Web Audio API setup
- Static synthesis
- Effects chain
- Ambient layer

### Phase 4: Call System (Week 7-8)
- Call renderer
- 5 call type components
- Procedural variation
- Sanity effects

### Phase 5: Progression (Week 9-10)
- Night shift structure
- Band unlocking
- Tape collection
- Store/IAP

### Phase 6: Polish (Week 11-12)
- Performance optimization
- Platform testing
- Bug fixes
- Release prep

---

## Technical Notes

**Audio API Choice:**
- Web: Web Audio API (native)
- Mobile: expo-av + custom native modules
- Fallback: Pre-recorded samples if real-time unavailable

**State Persistence:**
```typescript
// Zustand with persistence
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useGameStore = create(
  persist(
    (set, get) => ({
      sanity: 100,
      static: 0,
      tapes: [],
      unlockedBands: ['LIVING'],
      // ...
    }),
    {
      name: 'dead-air-save',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
```

**Audio Engine Skeleton:**
```typescript
class AudioEngine {
  private ctx: AudioContext
  private staticSynth: StaticSynth
  private effectsChain: EffectsChain
  
  constructor() {
    this.ctx = new AudioContext()
    this.staticSynth = new StaticSynth(this.ctx)
    this.effectsChain = new EffectsChain(this.ctx)
  }
  
  playStatic(intensity: number) {
    this.staticSynth.play(intensity)
  }
  
  processVoice(input: AudioNode): AudioNode {
    return this.effectsChain.process(input)
  }
}
```
