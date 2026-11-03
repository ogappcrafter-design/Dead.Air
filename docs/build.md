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

## Community preset backend (DEA-95 Phase 1)

Phase 1 ships the backend starting point for shared frequency presets: a
Cloudflare Worker API (`worker/community/`), a D1 schema
(`migrations/0001_community.sql`, extended by
`migrations/0002_custom_frequencies.sql`), shared Zod contracts
(`lib/community/schema.ts`), and an offline-safe client
(`lib/community/client.ts`).

DEA-89 adds player-authored custom frequencies on the same surface: a preset
payload may carry a `composition` + `difficulty` pair assembled from the
existing band fragment libraries, and an optional `friendCode` for social
sharing. The Infinite Signal boundary is enforced in the app: composing,
publishing, and playing custom calls require ownership, while any player may
browse and install a shared frequency read-only. Legacy tuning-only presets
remain valid and are not installable as playable calls.

### Feature flag

Community ships dark on both sides:

| Side   | Variable                        | Default | Notes                                                    |
| ------ | ------------------------------- | ------- | -------------------------------------------------------- |
| App    | `EXPO_PUBLIC_COMMUNITY_ENABLED` | off     | Only `on` enables it.                                    |
| Worker | `COMMUNITY_ENABLED`             | `off`   | Set per environment in `wrangler.toml`; defaults to off. |

The Worker flag is independent of the app flag, so a client build cannot turn
the API on by itself. `/community/health` stays reachable while the flag is off
and reports `{ "enabled": false }` so the app can confirm the switch.

### Local database and tests

The opt-in `community` environment in `wrangler.toml` declares `COMMUNITY_DB`
with a placeholder `database_id`. The default PWA deployment has no database
binding. Nothing in this phase creates or touches remote infrastructure.

```bash
# Apply the migration to a local D1 database.
pnpm dlx wrangler d1 migrations apply deadair-community --local --env community

# Unit + integration tests (memory and SQLite stores, no remote D1 needed).
pnpm test tests/worker/community tests/lib/community --runInBand
```

To wire a real deployment later: `pnpm dlx wrangler d1 create deadair-community`,
paste the returned id into `wrangler.toml` under `env.community.d1_databases`,
set `ADMIN_TOKEN` with `pnpm dlx wrangler secret put ADMIN_TOKEN --env community`,
then apply the migration with `--remote --env community`. Select `--env community`
when deploying this environment, and enable `env.community.vars.COMMUNITY_ENABLED`
only after the store-policy and moderation work lands. This repository
intentionally carries no deployment credentials.

### API surface

All routes live under `/community` and are JSON. Device auth uses
`Authorization: Bearer <token>` from `POST /auth/device`; only the token hash is
stored. Admin routes use the `X-Admin-Token` secret.

| Method | Route                                  | Auth   | Purpose                                                    |
| ------ | -------------------------------------- | ------ | ---------------------------------------------------------- |
| GET    | `/community/health`                    | —      | Flag status                                                |
| POST   | `/community/auth/device`               | —      | Register a device, receive token                           |
| GET    | `/community/auth/device`               | Device | Device profile                                             |
| GET    | `/community/presets`                   | —      | List/search (`q`, `band`, `friendCode`, `limit`, `cursor`) |
| POST   | `/community/presets`                   | Device | Create a preset                                            |
| GET    | `/community/presets/:id`               | —      | Read one preset                                            |
| PATCH  | `/community/presets/:id`               | Owner  | Update a preset                                            |
| DELETE | `/community/presets/:id`               | Owner  | Delete a preset                                            |
| POST   | `/community/presets/:id/report`        | Device | Report a preset (once per device)                          |
| GET    | `/community/admin/reports`             | Admin  | Moderation queue                                           |
| POST   | `/community/admin/reports/:id/resolve` | Admin  | Resolve/dismiss a report                                   |
| POST   | `/community/admin/presets/:id/hide`    | Admin  | Hide a preset                                              |
| POST   | `/community/admin/presets/:id/restore` | Admin  | Restore a preset                                           |

### Offline-safe client

`CommunityClient` caches successful list results by their complete query
(search, band, limit, and cursor), and falls back to the matching result when
the network is unavailable, returning `{ source: 'cache', stale: true }`.
An uncached query returns an empty result with the error code. The cache is
injected (`asyncStorageCommunityCache` in the app, `createMemoryCache()` in
tests) so storage stays out of the pure client. Reading a preset by ID requires
a network connection; cached list entries already contain the tuning payload
for offline use. Requests and local input validation surface a `CommunityError`
with a stable `code` (`community_disabled`, `unauthorized`, `forbidden`,
`validation_failed`, `rate_limited`, `network_error`, `timeout`, …).

### Custom frequency payload

A composed preset adds two optional fields to `payload`:

- `composition` — `{ band, callType, openingIndex, middleIndices, closingIndex, choiceIndices? }`.
  Fragment indices reference the band's existing library; `choiceIndices` is
  required for `RIGHT_ANSWER` and forbidden otherwise.
- `difficulty` — `{ sanityDelta, staticReward, signal }`, clamped to the
  band's `BAND_VARIATIONS` range.

Both fields travel together. The app and the Worker validate them with the same
engine helper (`engine/calls/CustomFrequency.ts`), so a recipe accepted by the
client passes API recipe validation too; custom publishing also requires store verification. `friendCode` is an optional
top-level `DA-XXXXX` value and doubles as a `GET /community/presets` filter.

### Verified Infinite Signal publishing

Apply `migrations/0003_verified_entitlements.sql` with the other D1 migrations before enabling custom-call publishing. No deployment or store credentials are included in this change.

Both POST and PATCH require a device bearer token and a top-level `entitlementProof` for composition-bearing presets. PATCH checks the resulting payload, including metadata-only edits to an existing custom call. Tuning-only presets and public reads require no purchase. Removing composition returns a preset to ordinary tuning-only behavior.

The native app reads purchase history when the player presses Publish and submits either `{ platform: "apple", transactionId }` or `{ platform: "google", purchaseToken }`. Each write contacts the store again, so a previous verified record or local ownership flag never authorizes a new write. Web publishing has no store proof and is unavailable. Apple restore may prompt for App Store credentials.

Configure these Worker bindings in the community environment, keeping all private keys in Worker secrets (never `EXPO_PUBLIC_*` or committed files):

| Binding                                                | Value                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_BUNDLE_ID`                                      | `com.daggerstuff.deadair`, matching `app.json` and App Store Connect                                                                    |
| `APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | App Store Connect In-App Purchase API issuer, key ID and PKCS#8 ES256 private key                                                       |
| `GOOGLE_PACKAGE_NAME`                                  | `com.daggerstuff.deadair`, matching `app.json` and Play Console                                                                         |
| `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`            | Service account email and PKCS#8 RSA private key authorized for the app's purchases in Play Console, with Android Publisher API enabled |

The expected non-consumable product is `ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL` (`com.deadair.infinite_signal`) on both stores. Configure that exact product before release. Only production purchases are accepted; sandbox, test-card, rental and consumed purchases do not grant publishing access. Missing platform configuration returns `verification_not_configured` (503); rejected/revoked proofs return `purchase_invalid` (403); store outages, bad credentials or malformed store responses return `verification_unavailable` (503). The Forge displays the returned failure and retains the local draft.

Apple verification uses [Get Transaction Info](https://developer.apple.com/documentation/appstoreserverapi/get-transaction-info) with [an ES256 API JWT](https://developer.apple.com/documentation/appstoreserverapi/generating-json-web-tokens-for-api-requests). The Worker decodes only the transaction returned directly by Apple's authenticated HTTPS API, never a client-supplied JWS. It checks application, product, transaction, production environment, non-consumable ownership and revocation. Google uses [service-account OAuth](https://developers.google.com/identity/protocols/oauth2/service-account) and [ProductPurchaseV2](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2), scoped to the configured package, checking product, PURCHASED state, unrefunded quantity and non-consumption.

D1 retains only a SHA-256 purchase fingerprint, community device ID, platform, last verified active status and timestamp. Raw receipts, purchase tokens and store responses are not retained or logged by verification. A purchase fingerprint binds to one community device token; preserve that token across app updates. Reinstalling and losing it cannot automatically rebind the purchase, since this design has no accounts or migration service. Operator-assisted recovery must check the purchaser's ownership before removing an old binding. Records represent the last check; revocation is rechecked before every custom write.

Deterministic tests exercise mocked store responses, real JWT signing, native proof extraction, both write boundaries and D1 persistence. Live Apple/Google validation is untested without store credentials. Production release still requires a credentialed store integration check and updated store privacy declarations.
