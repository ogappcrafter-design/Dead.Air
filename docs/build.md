# EAS Build & Submission Guide

Dead Air Radio uses [EAS Build](https://docs.expo.dev/build/introduction/) for cloud-based native builds and store submission. The build configuration lives in [`eas.json`](../eas.json); the app metadata lives in [`app.json`](../app.json).

## Prerequisites

1. **EAS CLI** (dev tool, installed locally or via npx):
   ```bash
   npm install -g eas-cli
   # or use npx: npx eas@latest ...
   ```
2. **Expo account** — authenticate with `eas login` (or run a build; EAS will prompt).
3. **Project linked** — `app.json` already carries `extra.eas.projectId = c4d8ec91-b038-4fc5-83a8-af266aeca7ff`. If the project is not yet associated, run `eas init` once.
4. **Credentials** — for production store submissions you need:
   - iOS: Apple Developer account, App Store Connect app, and an EAS-managed or manual provisioning profile. EAS can manage these for you (`eas credentials`).
   - Android: Google Play service account key (JSON) placed at `./.eas/credentials/play-service-account-key.json` (path referenced by `eas.json`). This file is gitignored.

## Build profiles

| Profile | Distribution | Channel | Platforms | Use |
|---|---|---|---|---|
| `development` | internal | `development` | iOS sim + Android apk | Local dev client, dev API |
| `preview` | internal | `preview` | iOS ad-hoc + Android apk | QA on real devices, staging API |
| `production` | store | `production` | iOS universal + Android aab | Release to stores |

Each profile injects `EXPO_PUBLIC_*` env vars (see `eas.json`) so the client bundle picks up the right API, Sentry DSN, and analytics key for that environment. See [`.env.example`](../.env.example) for the full list.

## Common commands

```bash
# Build a development client for iOS simulator (fastest local loop)
eas build --profile development --platform ios

# Build a preview APK for QA (Android)
eas build --profile preview --platform android

# Build production AAB for Google Play
eas build --profile production --platform android

# Build production universal IPA for App Store
eas build --profile production --platform ios

# Build all platforms for a profile
eas build --profile production --platform all

# Shortcut defined in package.json
pnpm eas-build          # = eas build --profile production --platform all
```

## Submitting to stores

```bash
# Submit the latest production Android build to the production track
eas submit --profile production --platform android

# Submit the latest production iOS build to App Store Connect
eas submit --profile production --platform ios

# Build and submit in one go
eas build --profile production --platform android --auto-submit
```

The `submit` section of `eas.json` defines which Apple ID, App Store Connect app, and Play service-account key to use. Replace the placeholder values (`appleId`, `ascAppId`, `appleTeamId`, `serviceAccountKeyPath`) with real credentials before first submission.

## Overriding env vars at build time

For one-off values without editing `eas.json`, pass env vars directly:

```bash
eas build --profile production --platform ios \
  --env EXPO_PUBLIC_SENTRY_DSN=https://real-dsn@sentry.io/123
```

Secrets that should never be tracked can also be stored with `eas secret:create` and referenced via the EAS profile (`eas.json` `env` block) — the resolved value is injected at build time and never written to the repo.

## Running EAS builds in CI

Use the [`expo/eas-build-action`](https://github.com/expo/expo-github-action) GitHub Action. Example workflow:

```yaml
# .github/workflows/eas-build.yml
name: EAS Build
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      profile:
        description: Build profile
        required: true
        default: preview
        type: choice
        options: [development, preview, production]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - run: pnpm install --frozen-lockfile
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: eas build --platform all --profile ${{ github.event.inputs.profile || 'preview' }} --non-interactive
```

Required CI secrets:
- `EXPO_TOKEN` — Expo access token (`eas token:create` locally).
- For production submit, also set credentials via `eas credentials` or store them as GitHub secrets.

## Local verification before pushing a build

```bash
# Type-check (must be clean)
npx tsc --noEmit

# Run tests (config tests validate eas.json)
npx jest
```
