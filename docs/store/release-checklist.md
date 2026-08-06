# Release Checklist — Dead Air Radio v1.0.0

Step-by-step submission pipeline for **Dead Air Radio** v1.0.0 on App Store Connect + Google Play. Each phase has explicit "do not move to next phase until…" gates. Companions: [`app-store-listing.md`](./app-store-listing.md), [`play-store-listing.md`](./play-store-listing.md), [`screenshots.md`](./screenshots.md), [`app-privacy.md`](./app-privacy.md), [`review-notes.md`](./review-notes.md).

> Branch name: `release/1.0.0` (created from `main`). The PR for this checklist is the **store assets PR** — actual store submission happens after merge.

---

## Phase 0 — Acceptance gate (in this repo, before opening the release PR)

Run before every push to the release branch:

```bash
npx tsc --noEmit        # must be clean (excluding pre-existing baseline errors tied to environment)
npx jest                # all suites must pass
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8'))"   # app.json must parse
node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8'))"   # eas.json must parse
```

Existing pre-baseline issues (none expected in this PR):

- `lib/errorTracking.ts` previously reported `Cannot find module '@sentry/react-native'` when run on a machine without the package's TS types present. No impact on store assets; do not fix in this PR.

✅ **Do not move to Phase 1 until** both `tsc` and `jest` are clean against the baseline of this branch.

---

## Phase 1 — Store assets on disk

Every file below must exist on the release branch and reference the correct companions.

| File                                                          | Contents                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [`docs/store/app-store-listing.md`](./app-store-listing.md)   | Name, subtitle, description, keywords, promo text, IAP, rating                         |
| [`docs/store/play-store-listing.md`](./play-store-listing.md) | Title, short description (80), full description (4000), tags, IAP, rating, data safety |
| [`docs/store/screenshots.md`](./screenshots.md)               | Dimensions + capture plan for 6 core shots                                             |
| [`docs/store/app-privacy.md`](./app-privacy.md)               | Privacy policy + App Privacy form + Data Safety form                                   |
| [`docs/store/review-notes.md`](./review-notes.md)             | Reviewer brief: it's a game, audio is synthesized, etc.                                |
| [`docs/store/release-checklist.md`](./release-checklist.md)   | This file                                                                              |
| `app.json`                                                    | Store-ready config: version 1.0.0, icon refs, permissions, IAP bundle IDs              |

✅ **Do not move to Phase 2 until** `git diff --stat main..release/1.0.0 -- docs/store/ app.json` shows every expected file with content.

---

## Phase 2 — Credentials & build setup

| #   | Task                                                                                                                                                                                            | Owner           | Where                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------- |
| 2.1 | Apple Developer Program active team + App Store Connect app record created                                                                                                                      | release manager | App Store Connect                  |
| 2.2 | Replace `eas.json` placeholders: `appleId`, `ascAppId`, `appleTeamId`                                                                                                                           | release manager | `eas.json` `submit.production.ios` |
| 2.3 | Google Play Console account active + first app record created, package `com.deadair.app`                                                                                                        | release manager | Play Console                       |
| 2.4 | Service account JSON placed at `./.eas/credentials/play-service-account-key.json` (gitignored)                                                                                                  | release manager | local FS                           |
| 2.5 | Re-run `npx eas credentials` and confirm EAS can manage iOS credentials for the app                                                                                                             | release manager | local                              |
| 2.6 | Create both IAPs in App Store Connect and Google Play using the IDs in [`app-store-listing.md`](./app-store-listing.md) and [`play-store-listing.md`](./play-store-listing.md)                  | release manager | ASC + Play Console                 |
| 2.7 | Add IAP metadata (title, description, price tier) identical to that in the store listing docs                                                                                                   | release manager | ASC + Play Console                 |
| 2.8 | Confirm `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_ANALYTICS_KEY` for the `production` profile in `eas.json` point at real prod endpoints (not the LOREM_IPSUM placeholders) | release manager | `eas.json` `build.production.env`  |

✅ **Do not move to Phase 3 until** credentials are validated by a successful `eas build --profile production --platform all`.

---

## Phase 3 — Production build

```bash
# Single command (defined in package.json)
pnpm eas-build

# Or step-by-step
eas build --profile production --platform ios
eas build --profile production --platform android
```

✅ **Do not move to Phase 4 until** both production builds are green and downloadable in EAS dashboard.

---

## Phase 4 — Internal QA build

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Install preview builds, walk the call screens, exercise IAP sandbox/license-test:

- [ ] Tune across LIVING → LIMINAL → LOST → CLASSIFIED band manually
- [ ] Trigger a Just Listen call and a Right Answer call end-to-end
- [ ] Unlock 3 tapes in a single play session
- [ ] Open Store screen — both `dead_air_base` and `dead_air_infinite` prices appear
- [ ] Sandbox-buy `dead_air_base` via App Store sandbox and Play license-test
- [ ] Reset Settings → Progression, no crash, save file empty
- [ ] Toggle "Send local analytics" off, restart app, no `lib/analytics.ts` events written
- [ ] Toggle "Send crash reports" off, force a crash, no event sent to Sentry

✅ **Do not move to Phase 5 until** every checkbox above is checked on real hardware for both iOS and Android.

---

## Phase 5 — Screenshots (capture cycle)

Follow [`screenshots.md`](./screenshots.md) verbatim. Required per platform:

| Platform                     | Required shots | Dimensions                             |
| ---------------------------- | -------------- | -------------------------------------- |
| App Store, 6.7" iPhone       | 6              | 1290 × 2796                            |
| App Store, 6.5" iPhone       | 6              | 1284 × 2778                            |
| App Store, iPad 12.9"        | 6              | 2048 × 2732                            |
| Google Play, phone           | Up to 8        | 1080 × 1920 (or larger, ≤ 3840 × 3840) |
| Google Play, hi-res icon     | 1              | 512 × 512                              |
| Google Play, feature graphic | 1              | 1024 × 500                             |

Filename: `{NN}-{screen}-{WxH}.png`.

✅ **Do not move to Phase 6 until** every required PNG is on disk, opens at the exact target dimensions, was captured on a real device (not emulator), and passes visual review against [`screenshots.md`](./screenshots.md) composition notes.

---

## Phase 6 — Upload store listings

### App Store Connect

1. Open the App Store Connect record created in Phase 2.
2. From [`app-store-listing.md`](./app-store-listing.md):
   - Paste Name, Subtitle, Description, Keywords, Promotional Text.
   - Upload the 6 core screenshots for 6.7" and 6.5" iPhones.
   - Upload 6 iPad 12.9" screenshots.
   - Confirm Primary category **Games**, secondary **Entertainment**.
   - Fill the App Rating questionnaire — expected **12+**.
3. From [`review-notes.md`](./review-notes.md) copy full text into _App Review Information → Notes_.
4. From [`app-privacy.md`](./app-privacy.md) paste App Privacy form answers; set privacy URL to the hosted policy.
5. From IAP section of the listing doc, confirm `dead_air_base` and `dead_air_infinite` exist and are _Ready to Submit_.
6. Select the latest App Store build (the EAS production iOS build from Phase 3).
7. Click _Add for Review_.

### Google Play Console

1. Open the Play Console app created in Phase 2.
2. From [`play-store-listing.md`](./play-store-listing.md):
   - Paste App name, Short description, Full description, Tags.
   - Upload phone screenshots, hi-res icon, feature graphic.
   - Confirm App type **Game**, category **Puzzle** (primary), **Adventure** (secondary).
3. From Data Safety form section of [`app-privacy.md`](./app-privacy.md) fill the form. Confirm _Contains ads? — No_.
4. Set Target Audience questionnaire (16+). Confirm **Not a news app**.
5. From Content Rating section of the listing, run IARC questionnaire — expected **Teen**.
6. Under Monetize → Products → In-app products, confirm products `dead_air_base` and `dead_air_infinite` exist and are **Active**.
7. From Release → Production → Create release:
   - Upload the production AAB from Phase 3.
   - Set release name `1.0.0`.
   - Paste the _What's new_ blurb from [`app-store-listing.md`](./app-store-listing.md).
   - Rollout percentage → start at **10%**.
   - Save as draft.
8. From Release → Production → Review release → _Roll out to Production_.

✅ **Do not move to Phase 7 until** both apps are submitted for review on their respective consoles.

---

## Phase 7 — Reviewer feedback loop

- [ ] Monitor email inbox for App Review feedback. Typical first response 24–48 hours.
- [ ] Monitor Play Console _App content_ and _Policy_ tabs for any rejection issues.
- [ ] If reviewer rejects microphone / RECORD_AUDIO as a recording permission: reply with the language from [`review-notes.md`](./review-notes.md) verbatim plus a code reference to `engine/audio/`.
- [ ] If reviewer asks for sandbox/testing credentials: respond; app has no login, point to Reviewer Mode described in [`review-notes.md`](./review-notes.md).
- [ ] If reviewer rejects IAP, restore purchase info must be wired up in the app — verify the restore button calls `Purchases.restorePurchases()` (replace the simulated `buy()/restore()` stub in `app/store/index.tsx`).

✅ **Do not move to Phase 8 until** both apps are _Approved_ or _Ready for Sale/Publication_.

---

## Phase 8 — Phased rollout

- [ ] Play: bump rollout 10% → 50% → 100% over 7 days; monitor Play Vitals for ANR / crash rate spikes.
- [ ] App Store: no phased rollout for paid apps today — full release on approval date.
- [ ] Monitor Sentry crash-free users ≥ 99% over first 72 hours.
- [ ] Monitor GitHub issues labeled `v1.0.0-regression` for failing phones or senescent bugs.
- [ ] If a hotfix is needed: branch from `release/1.0.0`, fix, raise PR to `main`, build hotfix `1.0.1`. Same checklist constrained to the affected store.

---

## Post-release

- [ ] Bump `app.json` `version` to "1.1.0" for the next scheduled release on `main`.
- [ ] Tag `v1.0.0` in git: `git tag -a v1.0.0 -m "Dead Air Radio v1.0.0"` on the merged release commit.
- [ ] Update [`docs/store/release-checklist.md`](./release-checklist.md) — append a _Postmortem_ section if review rejected anything material.
- [ ] Update the _What's new_ field in App Store Connect and Play Console when v1.1.0 ships.

---

## Reference links

- App Store Connect: https://appstoreconnect.apple.com/
- Google Play Console: https://play.google.com/console
- EAS Build + Submit reference: [`docs/build.md`](../build.md)
- EAS Build profiles: [`../../eas.json`](../../eas.json)
- App metadata: [`../../app.json`](../../app.json)
