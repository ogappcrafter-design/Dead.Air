# Changelog

All notable changes to Dead Air are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Player-facing call builder — the Frequency Forge** (PR #188): compose a call from the five band fragment libraries in three call types (Just Listen, Dead Air, Right Answer), tune sanity/static/signal within the band's existing variation range, preview and play it, and keep up to 50 frequencies locally. Custom frequencies publish and install through the community preset API with friend-code attribution, clipboard share text, and browse/search discovery; composing, playback and publishing require Infinite Signal, while any player can install a shared frequency read-only
- **On-device call voice synthesis on web** (PR #189): every call line is spoken from its own text by a formant synthesizer (`engine/audio/tts/`) and played live into the existing voice chain, so synthesized voices inherit the same EQ → compressor → bitcrush treatment. No network TTS, no provider key, no per-request cost; a bridge that cannot render PCM leaves the call text-only
- **Native call voice playback** (PR #190): the same synthesized voices play on iOS/Android through `expo-audio`. An offline `PlatformBridge` implementation renders the EQ → compressor → bitcrush chain into a mono PCM buffer, encodes it as a 16-bit WAV, and plays it; bridge operations outside the call-voice path stay explicitly unsupported
- **Microphone voice-activity detection** (PR #191): speaking during a STAY_CALM call now flinches through the same outcome path as a tap. Energy/RMS detection with a calibration window, hysteresis and short-burst rejection; permission is requested lazily and at most once per session, and a denied or missing microphone falls back silently to tap-only. Adds `NSMicrophoneUsageDescription` and `RECORD_AUDIO`; audio is never recorded, stored or transmitted
- **Season 1 content and engine — "Hold Music" (TRANSMISSION 01)** (PR #192): eight authored calls in the reserved seasonal block (ids 16000–16007), a station-ident prologue, one ending with tag-selected opening beats, a five-tape collection, and a five-band unlock ladder, plus the pure `NarrativeSeason` act/gate state machine, a persisted `seasonStore`, and a 13-test suite covering content integrity, act gates, band ladder and ending selection
- **Godot 4.7 rebuild (`godot/`) — complete** (PRs #178, #179): all playable content — five station shifts, four Phase 2 segments, four Phase 3 locations, the four Phase 4 descent steps, and all four endings (THE SIGNAL, THE RELAY, DEAD AIR, THE WITNESS). 697-test suite plus 18 visual verification drivers. Accessibility: radio text mode, colorblind-safe band glyphs, call-type pulse patterns
- GitHub Actions CI: lint/format/typecheck, jest with coverage reporting, and Trivy secret scanning, running on every push and PR to `master`
- Circular-dependency gate (`pnpm run deps:circular`) enforced in CI
- Dependabot config for npm and GitHub Actions ecosystems with grouped update PRs
- `LICENSE` (All Rights Reserved), `CONTRIBUTING.md`, `SECURITY.md`
- IAP launch-time revalidation: refunded/cancelled purchases revoke entitlements from purchase history on startup

### Changed

- Store entitlements (`setInfiniteSignal`, `setBase`) are now receipt-gated: entitlements only grant when a matching purchase record with a non-null transaction receipt exists
- pnpm build-script approvals migrated to `allowBuilds` in `pnpm-workspace.yaml` (pnpm 11), unblocking clean CI installs
- CI toolchain aligned with project engines: Node 24 + pnpm 11 with dependency caching

### Fixed

- Documentation drift: build docs now reference the committed EAS workflow; architecture docs describe the wired `expo-in-app-purchases` layer instead of the old mock
- Test infrastructure: self-contained mocks for `react-native-worklets` and `react-native-reanimated`; SplashRouting timeout aligned with source (2000ms → 4500ms)
- Circular dependency between `engine/audio/AmbientLayer.ts` and `engine/audio/profiles/types.ts`
- ~57 ESLint errors (unused vars, stray requires) removed; eslint flat config registers the React plugin correctly
- Dead code removed: legacy `.eslintrc.js`, uppercase fragment files shadowed by lowercase imports
