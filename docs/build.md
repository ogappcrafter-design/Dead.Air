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

| Profile       | Distribution | Channel       | Platforms                   | Use                             |
| ------------- | ------------ | ------------- | --------------------------- | ------------------------------- |
| `development` | internal     | `development` | iOS sim + Android apk       | Local dev client, dev API       |
| `preview`     | internal     | `preview`     | iOS ad-hoc + Android apk    | QA on real devices, staging API |
| `production`  | store        | `production`  | iOS universal + Android aab | Release to stores               |

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

The committed workflow at [`.github/workflows/eas-build.yml`](../.github/workflows/eas-build.yml) uses the [`expo/eas-build-action`](https://github.com/expo/expo-github-action) GitHub Action. It triggers on version tags (`v*`) and manual dispatch with a profile selector.

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

---

## Godot desktop exports (Linux + Windows)

Dead Air's Godot rebuild lives under [`godot/`](../godot). Release artifacts for `Linux Desktop` and `Windows Desktop` are produced from the committed `godot/export_presets.cfg` using the Godot 4.7-stable toolchain. The CI pipeline for this lives at [`.github/workflows/godot-release.yml`](../.github/workflows/godot-release.yml); `ci.yml` only runs the headless test suite and must stay green within the baseline (28 Godot test failures).

### Test job robustness (`ci.yml`)

The headless suite intermittently deadlocks inside the engine: the main thread waits on a lock held by a spinning engine thread and all output stops. It reproduces on GitHub's `ubuntu-latest` runner and locally (~3 hangs in 18 loaded local runs, at a different suite each time), and it is not fixed by Godot 4.7.2-stable, so the test job stays on the same **4.7-stable** engine the export job pins. `ci.yml` therefore wraps each attempt in a 120s `timeout` and retries up to 5 times, but only when the attempt timed out (exit 124); any other exit code is final, so assertion regressions are never retried away. A persistent hang fails fast with the last suite named instead of burning a 30-minute job timeout. The failure baseline (28) is unchanged.

### Prerequisites

1. **Godot 4.7-stable engine** (exact version, pinned to the CI download):

   ```bash
   curl -sL -o /tmp/godot.zip \
     https://github.com/godotengine/godot-builds/releases/download/4.7-stable/Godot_v4.7-stable_linux.x86_64.zip
   unzip -q /tmp/godot.zip -d /tmp/godot
   chmod +x /tmp/godot/Godot_v4.7-stable_linux.x86_64
   sudo mv /tmp/godot/Godot_v4.7-stable_linux.x86_64 /usr/local/bin/godot
   godot --version
   ```

2. **Export templates** (must match the engine byte-for-byte):

   ```bash
   mkdir -p "$HOME/.local/share/godot/export_templates/4.7.stable"
   curl -sL -o /tmp/templates.tpz \
     https://github.com/godotengine/godot-builds/releases/download/4.7-stable/Godot_v4.7-stable_export_templates.tpz
   mkdir -p "$HOME/.local/share/godot/export_templates/4.7.stable"
   unzip -q /tmp/templates.tpz -d "$HOME/.local/share/godot/export_templates/4.7.stable"
   # The tpz ships files under a top-level templates/ dir; flatten for Godot.
   if [ -d "$HOME/.local/share/godot/export_templates/4.7.stable/templates" ]; then
     mv "$HOME/.local/share/godot/export_templates/4.7.stable/templates"/* "$HOME/.local/share/godot/export_templates/4.7.stable/"
     rmdir "$HOME/.local/share/godot/export_templates/4.7.stable/templates"
   fi
   ```

3. **Version tag** is read from `VERSION` (root) / the git tag. The value written into `application/file_version` and `application/product_version` in the presets should stay in sync with it.

### Local reproduce

Run from the repository root:

```bash
cd godot
godot --headless --import
godot --headless --export-release "Linux Desktop"  ../build/deadair-test.x86_64
godot --headless --export-release "Windows Desktop"   ../build/deadair-test.exe

# Smoke-test the Linux binary (must stay alive for 10s; timeout exit 124 = pass).
timeout 10s ./../build/deadair-test.x86_64
echo "exit=$?"   # 124 means it survived idle; anything else is a (near-)immediate crash
```

The exported build embeds its `.pck` (`binary_format/embed_pck=true`), leaves `scenes/test/*` out of the payload (`exclude_filter`), and starts at `res://scenes/main_menu.tscn`. The CRT post-process (`src/visual/crt_postprocess.gd`) ships as compiled bytecode, so no editor-only paths are required.

Expected artifact sizes are ~60–90 MB per platform (see the release PR for recorded values).
