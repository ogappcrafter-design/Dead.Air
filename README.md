<div align="center">

```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          ░██████╗░██╗░░░░░░██╗████████╗░█████╗░██╗            ║
║          ██╔════╝░██║░░░░░░██║╚══██╔══╝██╔══██╗██║            ║
║          ██║░░╚██╗██║░░██╔╝██║░░░██║░░██║░░██║██║            ║
║          ██║░░╚██║██║░░╚██═╝██║░░░██║░░██║░░██║██║            ║
║          ╚██████╔╝██████╗░░░╚██████╔╝░╚█████╔╝██████╗           ║
║          ░╚═════╝░╚═════╝░░░░╚═════╝░░░╚════╝░╚═════╝           ║
║                                                               ║
║                         ░░ A I R ░░                           ║
║                                                               ║
║              Something is trying to reach you.                ║
║              The signal is forming.                           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### A paranormal late-night radio game. You are the DJ. The calls are real.

[![Expo SDK 56](https://img.shields.io/badge/Expo_SDK-56-black?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.85-black?logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-orange)](https://github.com/pmndrs/zustand)
[![License](https://img.shields.io/badge/License-All_Rights_Reserved-red)](./LICENSE)

[📖 About](#-about) ·
[🎮 Features](#-features) ·
[🚀 Quick Start](#-quick-start) ·
[📡 Frequency Bands](#-frequency-bands) ·
[📞 Call Types](#-call-types) ·
[🏗️ Architecture](#-architecture) ·
[🛠️ Development](#-development) ·
[🤝 Contributing](#-contributing)

---

<!-- screenshots -->

<img src="assets/icon.png" width="120" align="right" alt="Dead Air app icon" />

</div>

## 📻 About

**Dead Air** is an atmospheric horror game about the people — and things — that call in after midnight.

You operate a late-night radio station. The dead call in. Classified sources break through. Time loops repeat. And something older than radio itself is trying to reach you.

Answer the call. Or don't. Either way, something heard you.

> Ambient psychological horror — quiet dread, not jump scares. No combat. No timers. Just the signal.

---

## 🎮 Features

|     | Feature                           | Description                                                                                        |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| 📡  | **18 hand-crafted transmissions** | Five unlockable frequency bands, each with its own escalating dread                                |
| 📞  | **5 call types**                  | Just Listen · Dead Air · Right Answer · Signal Decode · Stay Calm                                  |
| 🧠  | **Sanity + Static economy**       | Every choice shifts your sanity and earns static — your choices have weight                        |
| 🎵  | **Real-time audio synthesis**     | Web Audio API engine: static synth → distortion → reverb → spatial processing                      |
| 📼  | **15 collectible tapes**          | Archive every transmission. Rarity tiers from `common` to `legendary`                              |
| 🔄  | **New Game+**                     | Unlocks after the meta-ending — harder difficulty modifiers and exclusive content                  |
| 🌑  | **Endless Night**                 | Survival mode with escalating strangeness every 5 shifts                                           |
| 🔊  | **Tape Mastery**                  | Re-listen to tapes to unlock hidden audio layers: Surface, Depth, and Abyss                        |
| 🏆  | **20 achievements**               | Track milestones from First Contact to Into the Abyss, plus daily streaks                          |
| ♾️  | **Infinite Signal mode**          | Procedural calls — endless, never the same twice                                                   |
| 💾  | **Persistent saves**              | Pick up exactly where you left off, every single time                                              |
| 📱  | **Cross-platform**                | iOS · Android · Web PWA — single codebase                                                          |
| 🖥️  | **CRT aesthetic**                 | Amber and green on near-black, scanlines, glow text                                                |
| 📤  | **Share & community**             | Share transcripts as images, anonymous leaderboard, call of the day, friend codes — all local-only |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 24+
- **pnpm**
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- For iOS: macOS with Xcode & CocoaPods
- For Android: Android Studio with SDK

### Install & Run

```bash
git clone https://github.com/daggerstuff/deadair.git
cd deadair

pnpm install
pnpm start
```

```bash
pnpm run android    # Android emulator or device
pnpm run ios        # iOS simulator or device
pnpm run web        # browser
```

---

## 📡 Frequency Bands

Tune the dial. Each band is darker than the last.

| Band           | Frequency | Unlocks At                 | Vibe                                                                                              |
| -------------- | --------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| **LIVING**     | 88.7 FM   | Start                      | Eerily normal callers. Mundane conversations that reveal something deeply wrong in the last line. |
| **LIMINAL**    | 102.3 FM  | Survive 3 night shifts     | Whispers, reversed audio, time distortion. Something listens.                                     |
| **LOST**       | 117.8 AM  | Collect 5 tapes            | Children singing, dial-up tones, impossible distances.                                            |
| **CLASSIFIED** | ███.█ FM  | Complete "The Signal" call | Numbers stations, emergency alerts, distorted orders. They know you're listening.                 |
| **████████**   | ???.?     | Find all 15 tapes          | `[DATA EXPUNGED]`                                                                                 |

---

## 📞 Call Types

Every transmission is a different kind of encounter.

| Type              | Mechanic                                                       |
| ----------------- | -------------------------------------------------------------- |
| **Just Listen**   | Stay on the line. Don't touch anything. Let it finish.         |
| **Dead Air**      | The silence between stations. Something fills it.              |
| **Right Answer**  | They ask a question. Your answer determines what happens next. |
| **Signal Decode** | Break the code. Read between the frequencies.                  |
| **Stay Calm**     | Your sanity is draining. Keep it together.                     |

---

## 🏗️ Architecture

<div align="center">

```
deadair/
├── app/                        # Expo Router screens
│   ├── radio/                  #   Main radio interface
│   ├── tapes/                  #   Tape collection archive
│   ├── store/                  #   In-app store
│   └── settings/               #   Settings & achievements
├── components/                 # Reusable UI
│   ├── radio/                  #   Physical radio: dial, display, signal
│   ├── calls/                  #   Call type renderers & overlays
│   ├── tapes/                  #   Tape player & collection
│   ├── progression/            #   Achievements, band unlocks, shift status
│   ├── store/                  #   Store cards
│   ├── leaderboard/            #   Anonymous leaderboard (local-only)
│   ├── callOfTheDay/           #   Call of the day vote (local-only)
│   ├── friends/                #   Friend code manager (local-only)
│   ├── share/                  #   Transcript sharing via OS share sheet
│   └── shared/                 #   CRT effects, error boundaries
├── engine/                     # Framework-agnostic game logic
│   ├── audio/                  #   Web Audio API: synth, effects, latency
│   ├── calls/                  #   Call manager, scheduler, variation engine
│   └── progression/            #   Bands, tapes, achievements, NG+, Endless Night, Tape Mastery
├── store/                      # Zustand state stores
│   ├── useGameStore.ts         #   Sanity, static, tapes, bands, NG+, Endless Night, Tape Mastery
│   ├── useRadioStore.ts        #   Frequency, signal strength
│   ├── useSettingsStore.ts     #   Volume, CRT effects toggles
│   ├── useStoreStore.ts        #   IAP entitlements
│   ├── usePlayerStore.ts       #   Player name, DJ call sign, station name
│   ├── useAchievementStore.ts  #   Unlocked achievements
│   ├── useAnalyticsStore.ts    #   Event tracking
│   ├── useLeaderboardStore.ts  #   Anonymous leaderboard (local-only)
│   ├── useCallOfTheDayStore.ts #   Daily featured call + voting (local-only)
│   └── useFriendCodeStore.ts   #   Friend code management (local-only)
├── data/                       # Game content
│   ├── bands.ts                #   5 frequency bands
│   ├── calls.js                #   18 hand-written transmissions
│   ├── tapes.ts                #   15 collectible tapes
│   ├── ngPlusContent.ts        #   NG+-exclusive tapes & calls
│   └── tapeMasteryLayers.ts    #   Hidden audio layer data (Surface/Depth/Abyss)
├── hooks/                      # React hooks
├── lib/                        # Platform, theme, storage, analytics
├── utils/                      # Friend code generation, transcript formatting
├── assets/                     # Icons, splash screen
└── ...
```

</div>

### Key Systems

<details>
<summary><b>🔊 Audio Engine</b></summary>
<br>

A singleton `AudioEngine` owns the Web Audio API graph lifecycle — lazily created, SSR-safe, platform-bridged.

```
StaticSynth → Distortion → Reverb → Spatial → Master Gain → Output
```

- **Real-time synthesis** — infinite variation, no pre-recorded loops
- **Latency profiling** — adaptive performance config per platform
- **Platform bridge** — Web Audio API (web) / expo-av (native)
- **Graceful degradation** — enters `closed` state if audio unavailable

</details>

<details>
<summary><b>🧠 Sanity & Static Economy</b></summary>
<br>

Two resources that define your playthrough:

| Resource   | Range   | Effect                                                |
| ---------- | ------- | ----------------------------------------------------- |
| **Sanity** | 100 → 0 | Drops with disturbing calls. At 0, something happens. |
| **Static** | 0 → 100 | Earned by answering calls. Currency for progression.  |

Every call type has configurable `sanityDelta` and `staticReward` values. Some calls restore sanity. Some drain it. The choice is always yours — and always costs something.

</details>

<details>
<summary><b>💾 Save System</b></summary>
<br>

Zustand + AsyncStorage with automatic persistence:

```typescript
// State persists to AsyncStorage under "dead_air_save_v1"
persist(
  (set) => ({ sanity: 100, static: 0, tapes: [], unlockedBands: ['LIVING'], ... }),
  { name: 'dead_air_save_v1', storage: createJSONStorage(() => AsyncStorage) }
)
```

Saves automatically after every completed call. Loads before the first screen renders. Players resume exactly where they left off — mid-shift, mid-call, mid-dread.

</details>

---

## 🛠️ Tech Stack

<div align="center">

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react&logoColor=white)](https://reactnative.dev)
[![Expo](https://img.shields.io/badge/Expo-56-000020?logo=expo&logoColor=white)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-FF6B35?logo=zustand&logoColor=white)](https://github.com/pmndrs/zustand)
[![Web Audio API](https://img.shields.io/badge/Web_Audio-API-FF8C00)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Sentry](https://img.shields.io/badge/Sentry-7.11-362D59?logo=sentry&logoColor=white)](https://sentry.io)
[![Jest](https://img.shields.io/badge/Jest-29.7-C21325?logo=jest&logoColor=white)](https://jestjs.io)

</div>

| Layer          | Technology                             |
| -------------- | -------------------------------------- |
| Framework      | React 19 + React Native 0.85           |
| Build/Dev      | Expo SDK 56 · Expo Router · Metro      |
| Language       | TypeScript 6.0                         |
| State          | Zustand 5.0 + AsyncStorage persistence |
| Audio          | Web Audio API (custom engine)          |
| Testing        | Jest + React Native Testing Library    |
| Error Tracking | Sentry                                 |
| Builds         | EAS (Expo Application Services)        |

---

## 💻 Development

### Commands

```bash
pnpm start          # Expo dev server
pnpm run android    # Android emulator/device
pnpm run ios        # iOS simulator/device
pnpm run web        # Web browser
pnpm test           # Run tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # Coverage report
pnpm lint           # Lint with ESLint
pnpm lint:fix       # Lint and auto-fix
pnpm run eas-build  # Production build (all platforms)
```

### Project Conventions

- **Pure engine logic** — everything in `engine/` is framework-agnostic with dependency injection. No React, no store imports, no I/O. Fully testable.
- **Zustand stores** — one store per domain. Persistence via `createJSONStorage`.
- **File-based routing** — Expo Router, screens in `app/`.
- **CRT theme** — centralized in `lib/theme.ts`. Amber, green, red on near-black.

---

## 🤝 Contributing

This is a creative project with a specific vision. Contributions are welcome for:

- 🐛 Bug fixes
- ⚡ Performance improvements
- 🎨 UI/UX polish
- 📱 Platform-specific fixes
- 🧪 Test coverage

### How to Contribute

1. Fork the repo
2. Create a branch: `git checkout -b fix/whatever`
3. Make your changes
4. Run tests: `pnpm test`
5. Submit a PR

Please don't modify the 18 hand-written transmissions — they're sacred.

---

## ⚠️ Content Warnings

This game contains themes of grief, death, loss, the supernatural, and psychological horror. Some transmissions are based on emotionally real scenarios. Player discretion is advised.

---

## 📄 License

All original content © Dead Air. All rights reserved.
Not for redistribution without permission.

---

<div align="center">

_The frequency is open. Something is already waiting._

`░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░`

</div>
