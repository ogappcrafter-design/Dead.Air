# Dead Air Radio — Privacy Policy

This document supports both the App Store Connect _App Privacy_ form and the Google Play _Data Safety_ declaration. The canonical metrics below match the runtime behavior implemented in `lib/analytics.ts` and `lib/errorTracking.ts`. If those implementations change, update this file in the same commit.

> Last updated: 2026-08-06  
> Effective date: 2026-08-06  
> Hosted at: `https://deadair.example.com/privacy` (placeholder — replace with the canonical URL before submission)

---

## What we collect

| Category                       | Detail                                                                                                                                                      | Stored where                                                                                  | On by default                                                                                                                             | Used for                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Opt-in local analytics**     | Aggregate counts (calls answered, tapes unlocked, session length). No user identifiers, no device identifiers, no free-form text.                           | **On-device only**, in `AsyncStorage` via `lib/analytics.ts`. Never sent over network.        | **Off**. The toggle lives in Settings; the player must explicitly opt in.                                                                 | Understanding aggregate play patterns across sessions on this device. |
| **Crash diagnostics**          | Stack traces, OS version, app version, language, and the screen route at the moment of the crash. **No message content, no caller audio, no player input.** | Sentry cloud (SaaS). Configured via `EXPO_PUBLIC_SENTRY_DSN`, profile-specific in `eas.json`. | **On** for crash-only events. The player can turn this off in Settings.                                                                   | Diagnosing crashes and shipping fixes.                                |
| **Audio for voice processing** | Microphone audio is processed in real time by the audio engine to drive call effects.                                                                       | In-memory only, never written to disk, never transmitted.                                     | Required for core gameplay; the `RECORD_AUDIO` / `NSMicrophoneUsageDescription` permission enables the synthesis path, not audio capture. | Audio synthesis for call effects.                                     |

## What we do NOT collect

- No advertising identifiers (IDFA / AAID). The app declares _Does Not Use Advertising_ in App Privacy.
- No location data — `app.json` `android.permissions` does not include any coarse/fine location permission.
- No contacts, calendar, photos, media, or files.
- No email, name, phone number, or any direct identifier.
- No IP address is retained server-side. Sentry redacts IP addresses at ingest.
- No user-generated content is uploaded anywhere — see [`review-notes.md`](./review-notes.md).
- No network-based social features, no chat, no in-app posting surfaces. Local-only community features (leaderboard, friend codes, call-of-the-day vote) exist but store data on-device only — see [`review-notes.md`](./review-notes.md).

## Third parties

| Vendor                             | Purpose                                                                 | Data shared                                                                                                                                                                 | Link                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Sentry (Functionland, Inc.)        | Crash reporting                                                         | Stack trace, app/OS version, anonymized event metadata. IP redacted at ingest.                                                                                              | https://sentry.io/privacy/                                                      |
| Apple App Store, Google Play Store | IAP fulfillment & app distribution                                      | Transaction receipt and transaction ID handled by the platform's billing SDK. Returned to the device for entitlement check. No receipt content is forwarded to any backend. | https://www.apple.com/legal/privacy/ , https://policies.google.com/privacy      |
| Google Cloud Run (optional)        | Proxy for Anthropic Claude API when the Infinite Signal IAP is unlocked | The `prompt` body sent to the proxy. No identities attached. Only used if the player unlocks and uses Infinite Signal.                                                      | https://cloud.google.com/terms/servos , https://www.anthropic.com/legal/privacy |

> No third-party analytics, no ad SDKs, no social SDKs, no marketing SDKs are linked in `package.json`. Maintain this invariant whenever dependencies change — the App Privacy / Data Safety declarations above depend on it.

## Data retention

- **Opt-in local analytics**: kept in `AsyncStorage` until the player resets it in Settings → "Clear local analytics" or uninstalls the app.
- **Crash diagnostics**: Sentry retains crash events for 90 days, then deletes them.
- **IAP receipts**: stored on device until the player uninstalls the app; never transmitted off device.
- **Infinite Signal prompts (optional)**: not stored on device. A prompt body is sent to the Cloud Run proxy at request time and discarded after the response returns.

## Children

This app does not collect personal information from children. The App Store rating is **12+** and the Play rating is **Teen**. The app does not knowingly collect data from anyone under 13. If you believe a child under 13 has provided personal information, contact `privacy@deadair.example.com` and the data will be deleted.

> The `RECORD_AUDIO` permission is **not** used to record the user. The audio engine pipes the live mic signal through an effects chain for the call-voice modulation; it is **never** written to disk, uploaded, or stored. Document this in any communication with reviewers — see [`review-notes.md`](./review-notes.md).

## Your choices

Players can, at any time, from **Settings**:

- Toggle **Send local analytics** (off by default). Turning this off stops writing telemetry to AsyncStorage; existing local events stay until "Clear local analytics" is pressed.
- Toggle **Send crash reports** (on by default). Turning this off disables Sentry and prevents any further crash events from being reported.
- Press **Clear local analytics** to wipe the existing analytics record from this device.
- Press **Reset game progress** to wipe save data, tapes, and unlocks. This does not affect IAP entitlements tracked by the platform.

## Changes to this policy

Material changes will be reflected here and shipped with the new app version. The "Last updated" date above tracks the policy revision in the source repository.

## Contact

`privacy@deadair.example.com` — placeholder address. Replace with a real contact before submission.

---

## App Store "App Privacy" form (responses)

| Question                                             | Answer                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| Do you collect data from this app?                   | Yes (crash diagnostics, opt-in local analytics)                          |
| Crash data                                           | Collected — linked to a single user device session, not to user identity |
| Usage data                                           | Collected — local-only, never transmitted                                |
| Identifiers                                          | Not collected                                                            |
| Health, financial, contact, location, sensitive info | Not collected                                                            |
| Diagnostics not collected from you                   | No — only crash diagnostics                                              |
| Privacy URL                                          | `https://deadair.example.com/privacy` (placeholder)                      |

## Google Play "Data safety" form (responses)

| Question                                      | Answer                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| Does your app collect or share any user data? | Yes — collects (does not share)                                                        |
| What data is collected?                       | Crash (Diagnostics), App activity (Usage — local only)                                 |
| Is data encrypted in transit?                 | Yes (TLS to Sentry)                                                                    |
| Can users request data deletion?              | Yes — Settings → Clear local analytics; crash events auto-delete at 90 days            |
| Is data shared with third parties?            | Yes — Sentry receives crash events. No advertising, no analytics, no audience vendors. |
| Family policy applicable?                     | No — app does not target children                                                      |
| Government apps                               | No                                                                                     |
| Featured apps programs                        | No                                                                                     |

> Any change to `lib/analytics.ts`, `lib/errorTracking.ts`, or the package dependency manifest requires updating this file in the same commit. CI cannot enforce this automatically — code reviewers must verify.

## Supporting files

- [`app-store-listing.md`](./app-store-listing.md)
- [`play-store-listing.md`](./play-store-listing.md)
- [`review-notes.md`](./review-notes.md)
- [`release-checklist.md`](./release-checklist.md)
- [`../../lib/analytics.ts`](../../lib/analytics.ts) — opt-in local analytics implementation
- [`../../lib/errorTracking.ts`](../../lib/errorTracking.ts) — Sentry crash reporting
- [`../../app.json`](../../app.json) — declared permissions and IAP entries
