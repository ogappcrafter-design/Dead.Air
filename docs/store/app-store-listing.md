# App Store Connect Listing

Metadata for the **Dead Air Radio** App Store Connect record. Copy-paste into the App Store Connect web UI or Push via `eas submit --profile production --platform ios`. The companion build/submit configuration lives in [`eas.json`](../../eas.json) (see `submit.production.ios`).

> Keep this file in sync with [`play-store-listing.md`](./play-store-listing.md) so both storefronts describe the same product. The description text shared below is intentionally cross-store, with App Store-specific character budgets noted inline.

## App identity

| Field                        | Value                                                                       |
| ---------------------------- | --------------------------------------------------------------------------- |
| Name                         | Dead Air Radio                                                              |
| Primary language             | English (U.S.)                                                              |
| Primary category             | Games                                                                       |
| Secondary category           | Entertainment                                                               |
| Content rights               | No content rights claimed (all original)                                    |
| Bundle ID                    | `com.deadair.app` (already in `app.json`)                                   |
| SKU                          | `deadair.app.ios.1`                                                         |
| Apple ID (App Store Connect) | Reuse `eas.json` `submit.production.ios.ascAppId` after creating the record |

## Pricing & availability

| Field            | Value                                               |
| ---------------- | --------------------------------------------------- |
| Price tier       | Tier 1 — $0.99 USD base app                         |
| Availability     | All App Store regions where paid apps are supported |
| In-app purchases | See _In-app purchases_ below                        |

## Subtitle (30 chars)

```
Late-night paranormal radio
```

## Promotional text (170 chars)

```
Something is trying to reach you. The signal is forming. Tune in. Answer. Don't hang up.
```

## Description (4000 chars)

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

## Keywords (100 chars, comma-separated)

```
radio,horror,paranormal,atmospheric,late-night,mystery,signals,calls,supernatural,shortwave
```

## What's new (per release)

```
v1.0.0 — Initial release. 18 calls, 5 frequency bands, progression system, 15-tape archive.
```

## In-app purchases

| Product ID          | Display name    | Description                                                                         | Price tier     |
| ------------------- | --------------- | ----------------------------------------------------------------------------------- | -------------- |
| `dead_air_base`     | Dead Air Radio  | Unlock the full base game — all 18 calls, all 5 frequency bands, full tape archive. | Tier 1 ($0.99) |
| `dead_air_infinite` | Infinite Signal | Endless AI-generated calls. Keeps the frequency open after the base game ends.      | Tier 4 ($3.99) |

> Note: App Store Connect does not accept the literal `dead_air_*` strings until the IAPs are created in the App Store Connect UI. Use the **App Information → In-App Purchases** tab and reference these IDs verbatim.

## App Store rating (expected)

| Category                 | Selection        |
| ------------------------ | ---------------- |
| Cartoon/fantasy violence | None             |
| Realistic violence       | None             |
| Horror/fear themes       | Frequent/Intense |
| Medical/treatment info   | None             |
| Alcohol/drug references  | None             |
| Simulated gambling       | None             |
| Sexual content           | None             |
| Profanity                | Mild             |
| User-generated content   | None             |

Expected rating: **12+** for infrequent horror/fear themes.

## App Review information

See [`review-notes.md`](./review-notes.md) for the full review brief. Summary:

- This is a game, not a real radio or podcast player.
- All audio is synthesized at runtime — no real broadcasts, no copyrighted audio.
- No user-generated content, no networked social features, no chat. Local-only community features (leaderboard, friend codes, call-of-the-day) store data on-device only.
- IAP products are: `dead_air_base` and `dead_air_infinite`, listed above.
- No subscription, no consumables.

## Demo account

The app has no login and no network account. Reviewers can use the app without credentials.

## Supporting files

- [`play-store-listing.md`](./play-store-listing.md) — Google Play listing
- [`screenshots.md`](./screenshots.md) — screenshot specifications
- [`app-privacy.md`](./app-privacy.md) — privacy policy
- [`review-notes.md`](./review-notes.md) — review notes
- [`release-checklist.md`](./release-checklist.md) — submission checklist
- [`../../eas.json`](../../eas.json) — build profiles and submission targets
- [`../../app.json`](../../app.json) — Expo metadata
