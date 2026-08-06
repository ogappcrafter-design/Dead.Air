# Screenshot Specifications

Production screenshot specs for App Store Connect and Google Play. This file documents which screens to capture and the required dimensions — it does **not** include rendered images. The capture plan uses real device builds (`eas build --profile preview`) so the shot list maps to exact in-game screens reachable in the current build of `app/`.

> For capture workflow (devicefarm/Playwright/screenshots-during-build), see [`release-checklist.md`](./release-checklist.md). The store copy that frames these shots lives in [`app-store-listing.md`](./app-store-listing.md) and [`play-store-listing.md`](./play-store-listing.md).

## Required dimensions

| Slot                             | Minimum (px)    | Maximum (px)      | Notes                                                                                       |
| -------------------------------- | --------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| App Store, 6.7" iPhone (Pro Max) | 1290 × 2796     | 1290 × 2796       | Required at first submission. 2688×1242 fallback accepted but not preferred.                |
| App Store, 6.5" iPhone           | 1284 × 2778     | 1284 × 2778       | Required if you ship 6.7" only (allowed fallback). Recommend uploading in addition to 6.7". |
| App Store, 5.5" iPhone (legacy)  | 1242 × 2208     | 1242 × 2208       | Optional but recommended for legacy iPad reviewers.                                         |
| App Store, iPad Pro 12.9"        | 2048 × 2732     | 2048 × 2732       | Required if `supportsTablet: true` (set in `app.json`).                                     |
| Google Play, phone               | 320 × 320 (min) | 3840 × 3840 (max) | 1080 × 1920 minimum recommended. 16:9 or 9:16 aspect.                                       |
| Google Play, tablet              | 320 × 320       | 3840 × 3840       | Optional. Use 2048 × 2732 to reuse iPad shots.                                              |
| Google Play, high-res icon       | 512 × 512       | 512 × 512         | PNG, 32-bit (no alpha).                                                                     |
| Google Play, feature graphic     | 1024 × 500      | 1024 × 500        | PNG/JPG. Recommend a CRT-still composition.                                                 |

## Shot list (capture plan)

The six core shots below cover both storefronts. Capture each in every required dimension; do not template-scale a single render across dimensions (text/scanline grain reads different per pixel density).

| #   | Screen              | Route                                                               | In-game state                                                            | Visual emphasis                                                           |
| --- | ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | **Radio tuning**    | `app/radio/index.tsx`                                               | Idle dial, no active call, signal strength animate but no caller         | Physical radio body, tuning dial, CRT scanlines, dark background #030303  |
| 2   | **Active call**     | `app/radio/index.tsx` + `components/calls/ActiveCallDispatcher.tsx` | Mid-Just-Listen or Right-Answer call, sanity/static bar visible          | Caller text visible, sanity overlay readable, amber accent #FF8C00        |
| 3   | **Tape collection** | `app/tapes/index.tsx`                                               | 5–8 tapes unlocked of 15                                                 | Tape grid, monospace Courier typography, unlock glow                      |
| 4   | **Band selector**   | `components/radio/BandSelector.tsx` (inside `app/radio/index.tsx`)  | 4 of 5 bands unlocked, current band highlighted                          | Frequency display, band list, store brand of dial                         |
| 5   | **Store**           | `app/store/index.tsx`                                               | Locked base product showing $0.99 + Infinite Signal $3.99 alongside path | IAP panels, monospace price tags, no play store branding                  |
| 6   | **Settings**        | `app/settings/index.tsx`                                            | Default state, all toggles in standard position                          | Settings rows, Share/Reset, accessibility hint for screen readers visible |

Optional bonus shots (upload after the six required):

| #   | Screen                   | Route                                | Visual emphasis                                                                                     |
| --- | ------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 7   | Onboarding / splash      | `app/index.tsx`                      | Boot splash, "Tap to begin"                                                                         |
| 8   | Achievements             | `app/settings/achievements.tsx`      | Achievement rows, two unlocked                                                                      |
| 9   | Sanity overlay edge case | `components/calls/SanityOverlay.tsx` | Sanity at critical threshold — distressed CRT look (used in App Review notes, not store hero image) |

## Capture checklist (per shot)

1. Build the app via `eas build --profile preview --platform ios` (and `android`).
2. Install the preview build on a physical device matching the device class.
3. Set device brightness to manual, ~40%, dark room, screenshot via device hardware button.
4. No developer menu overlays, no red DEBUG badge, no debugger frames, no simulator bezels.
5. Crop to required pixel dimensions exactly; do not upscale.
6. Save as PNG (lossless). Adjusted JPEG only if App Store Connect rejects PNG > 4 MB.
7. Name files `{NN}-{screen}-{WxH}.png` (e.g. `01-radio-tuning-1290x2796.png`).
8. Update this file's **Captured** column the moment a shot ships — reviewers pull by file spec.

## Composition notes

- **Theme must read in 2 seconds**: dark background #030303, amber accent #FF8C00, monospace Courier for any UI text visible in the shot. No generic flat palette.
- **No mocked-up text** — only in-game copy appears in screenshots. Reviewers will flag mismatched marketing text.
- **Avoid text overlay**. Add it only when the App Store "text overlay" slot is intentional. Plain screenshots rank better with App Store Search Ads.
- **Audio is not visible** — but the dial will look dead if no animation. Capture at the alive moment: strength animate, scanlines drifting.
- **iPad shots must not be letterboxed iPhone captures**. Take them on an actual iPad-class device (App Review rejects aspect mismatches).

## App Store screenshot frame sizes (recap)

App Store Connect screenshots must be **exactly** the slot dimensions — no scaling allowed.

| Slot          | Exact px    |
| ------------- | ----------- |
| 6.7" iPhone   | 1290 × 2796 |
| 6.5" iPhone   | 1284 × 2778 |
| 5.5" iPhone   | 1242 × 2208 |
| iPad Pro 12.9 | 2048 × 2732 |

## Google Play capture notes

- Google Play accepts any resolution between 320 × 320 and 3840 × 3840. Upload 1080 × 1920 minimum.
- Up to 8 phone screenshots — use the 6 core shots + achievements + onboarding.
- High-res icon must be 512 × 512 PNG, no transparency.
- Feature graphic must be 1024 × 500.

## Do not

- Don't turbulence / animate / video-still — store reviewers prefer clean static frames.
- Don't include external hardware (hands, device with notch). Cropped screen-only composition.
- Don't add a marketing tagline overlay to screenshots (App Store: not allowed; Play: allowed but penalized in Plain-search ranking).
- Don't fake IAP purchase receipts.
- Don't ship screenshots larger than 30 MB per file.

## Tooling reference

- For automated capture from a fresh preview build, the lint + tests in `__tests__/` and `eas.json` `preview` profile are the canonical surface. See [`release-checklist.md`](./release-checklist.md) capture phase for the EAS→screenshots loop.

## Supporting files

- [`app-store-listing.md`](./app-store-listing.md) — App Store Connect metadata
- [`play-store-listing.md`](./play-store-listing.md) — Google Play metadata
- [`review-notes.md`](./review-notes.md) — review notes referenced by reviewers
- [`release-checklist.md`](./release-checklist.md) — submission checklist (capture step)
