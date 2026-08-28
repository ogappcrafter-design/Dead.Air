# Changelog

All notable changes to Dead Air are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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
