# Google Play Store Listing

Metadata for the **Dead Air Radio** Google Play console record. Copy-paste into the Play Console **Main Store Listing** form, or push via `eas submit --profile production --platform android`. Build/submit configuration lives in [`eas.json`](../../eas.json) (see `submit.production.android`).

> Keep this file in sync with [`app-store-listing.md`](./app-store-listing.md). The full description body is intentionally shared; only the App Store's 170-char promotional text differs from Play's 80-char short description.

## App identity

| Field               | Value                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| App name            | Dead Air Radio                                                                     |
| Default language    | English (United States)                                                            |
| App or game         | Game                                                                               |
| Category            | Puzzle (primary), Adventure (secondary)                                            |
| Content rating      | Teen — see _Content rating_ below                                                  |
| Target audience     | Older teens & adults                                                               |
| Package name        | `com.deadair.app` (already in `app.json`)                                          |
| App type            | Apps & Games (no Wear, no TV, no Auto)                                             |
| App signing         | Let Google Play generate the signing key (Play App Signing)                        |
| Service account key | `./.eas/credentials/play-service-account-key.json` (path referenced by `eas.json`) |

## Pricing

| Field               | Value                                                              |
| ------------------- | ------------------------------------------------------------------ |
| Default price       | $0.99 USD (paid app)                                               |
| Available countries | All Play-published countries                                       |
| Distribution        | Production track from `eas.json` `submit.production.android.track` |

## In-app products (defined in Play Console → Monetize → Products → In-app products)

| Product ID          | Title           | Description                                                                         | Price |
| ------------------- | --------------- | ----------------------------------------------------------------------------------- | ----- |
| `dead_air_base`     | Dead Air Radio  | Unlock the full base game — all 18 calls, all 5 frequency bands, full tape archive. | $0.99 |
| `dead_air_infinite` | Infinite Signal | Endless AI-generated calls. Keeps the frequency open after the base game ends.      | $3.99 |

Both products are **one-time (non-consumable)** entitlements — no subscriptions, no consumables.

## Short description (80 chars)

```
A paranormal radio game. Answer the calls. Something is listening.
```

> Character count: 66/80. Includes glyph count, not byte count.

## Full description (4000 chars)

```
You are a late-night DJ. The calls are not normal.

DEAD AIR RADIO is an atmospheric horror game about the people — and things — that call in after midnight. The dead. The classified. The ones stuck in loops. And something older than radio itself.

Answer every call. Collect every tape. And whatever you do — don't hang up.

REAL-TIME CALLS

Every transmission is synthesized live. The static is real, the voices are last-minute, and the silence between words carries weight. There is no script you can fast-forward through.

18 HAND-CRAFTED CALLS

Each caller is written to land like a real late-night broadcast — shortwave enthusiasts, grief, classified briefings, loops that shouldn't repeat. Nothing repeats itself the same way twice.

5 FREQUENCY BANDS

Living. Liminal. Lost. Classified. And the one we don't name. Each band unlocks as you progress deeper into the night.

PROCEDURAL VARIATION

Sanity and static respond to every choice. The dial drifts. The signal degrades. No two sessions tune in to the same radio.

PROGRESSION SYSTEM

A 15-tape archive to collect across a full playthrough. Every tape is a memory worth keeping — and some are worth forgetting.

INFINITE SIGNAL (OPTIONAL IAP)

Endless AI-generated calls, never the same twice. An expansion unlock that keeps the frequency open after the base game ends.

NO ADS. NO ENERGY TIMERS. JUST THE SIGNAL.

One price. One signal. Take the call.

---

⚠ CONTENT WARNING: This game contains themes of grief, death, loss, the supernatural, and psychological horror. Some transmissions are based on emotionally real scenarios. Headphones recommended. Player discretion advised.
```

## Tags (Play Console, max 5)

| #   | Tag           |
| --- | ------------- |
| 1   | Horror        |
| 2   | Atmospheric   |
| 3   | Narrative     |
| 4   | Single-player |
| 5   | Offline       |

> The last tag is informational only — the game works fully offline once installed (the optional Infinite Signal AI mode does require network, but it's gated by an IAP).

## Content rating (IARC questionnaire selections)

| Question area                   | Selection                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Cartoon violence                | No                                                                                         |
| Realistic violence              | No                                                                                         |
| Horror / fear themes            | Yes                                                                                        |
| Sexual content                  | No                                                                                         |
| Profanity                       | Yes (mild)                                                                                 |
| Controlled substances           | No                                                                                         |
| Gambling                        | No                                                                                         |
| User-generated content          | No                                                                                         |
| Sharing location                | No                                                                                         |
| Unrestricted internet           | No (only optional AI calls require network; not a social/Ugc surface)                      |
| Personal information collection | No (Sentry crash data + opt-in local analytics — see [`app-privacy.md`](./app-privacy.md)) |

Expected rating: **Teen** (Android) / **12+** (other stores via IARC).

## Ads

**No advertising.** No ad SDKs. In Play Console, declare _Contains ads? → No._

## App content → Target audience

| Field                  | Value                                |
| ---------------------- | ------------------------------------ |
| Target audience        | Older teens & adults (16+)           |
| Age range              | 16–24, 25–44, 45+                    |
| App appeal to children | Does not appeal to children under 13 |

## App content → News app

This is **not** a news app.

## Privacy policy

See [`app-privacy.md`](./app-privacy.md). The Play Console URL field should point at the hosted copy of that policy, e.g. `https://deadair.example.com/privacy` (placeholder — replace before submission).

## App access & permissions

| Permission                                             | Reason                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `android.permission.RECORD_AUDIO`                      | Voice-processing call effects (audio synthesis, not recording). See [`review-notes.md`](./review-notes.md). |
| `android.permission.FOREGROUND_SERVICE`                | Audio session continues when the screen is off.                                                             |
| `android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Foreground media playback type (Android 14+ requirement).                                                   |

> No advertising permissions, no location, no contacts, no camera, no microphones _as recording devices_ — the RECORD_AUDIO permission is for the audio engine's voice-processing path, not for storing user audio. Document this in `review-notes.md`.

## Google Play data safety form

| Data                   | Collected                          | Encrypted in transit | Optional                       | Purposes                      |
| ---------------------- | ---------------------------------- | -------------------- | ------------------------------ | ----------------------------- |
| Crash diagnostics      | Yes (Sentry)                       | Yes (TLS)            | Yes (opt-in, off by default)   | App functionality / Analytics |
| Performance usage      | No                                 | n/a                  | n/a                            | n/a                           |
| Location               | No                                 | n/a                  | n/a                            | n/a                           |
| Personal ID            | No                                 | n/a                  | n/a                            | n/a                           |
| Email                  | No                                 | n/a                  | n/a                            | n/a                           |
| Device or other IDs    | No                                 | n/a                  | n/a                            | n/a                           |
| Photos / videos        | No                                 | n/a                  | n/a                            | n/a                           |
| Files                  | No                                 | n/a                  | n/a                            | n/a                           |
| Microphone audio input | Processed in real-time, not stored | n/a                  | No (required for call effects) | App functionality             |

See [`app-privacy.md`](./app-privacy.md) for the complete privacy disclosure.

## Supporting files

- [`app-store-listing.md`](./app-store-listing.md) — App Store listing
- [`screenshots.md`](./screenshots.md) — screenshot specifications
- [`app-privacy.md`](./app-privacy.md) — privacy policy
- [`review-notes.md`](./review-notes.md) — review notes
- [`release-checklist.md`](./release-checklist.md) — submission checklist
- [`../../eas.json`](../../eas.json) — build profiles and submission targets
- [`../../app.json`](../../app.json) — Expo metadata
