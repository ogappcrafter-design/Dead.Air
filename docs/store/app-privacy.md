# Dead Air Radio — Privacy Policy

This document supports both the App Store Connect _App Privacy_ form and the Google Play _Data Safety_ declaration. The canonical metrics below match the runtime behavior implemented in `lib/analytics.ts` and `lib/errorTracking.ts`. If those implementations change, update this file in the same commit.

> Last updated: 2026-11-01  
> Effective date: 2026-08-06  
> Hosted at: `https://deadair.example.com/privacy` (placeholder — replace with the canonical URL before submission)

---

## What we collect

| Category                       | Detail                                                                                                                                                             | Stored where                                                                                  | On by default                                                                                                                                           | Used for                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Opt-in local analytics**     | Aggregate counts (calls answered, tapes unlocked, session length). No user identifiers, no device identifiers, no free-form text.                                  | **On-device only**, in `AsyncStorage` via `lib/analytics.ts`. Never sent over network.        | **Off**. The toggle lives in Settings; the player must explicitly opt in.                                                                               | Understanding aggregate play patterns across sessions on this device. |
| **Crash diagnostics**          | Stack traces, OS version, app version, language, and the screen route at the moment of the crash. **No message content, no caller audio, no player input.**        | Sentry cloud (SaaS). Configured via `EXPO_PUBLIC_SENTRY_DSN`, profile-specific in `eas.json`. | **On** for crash-only events. The player can turn this off in Settings.                                                                                 | Diagnosing crashes and shipping fixes.                                |
| **Audio for voice processing** | Microphone audio is processed in real time by the audio engine to drive call effects and voice-driven gameplay (detecting whether the player spoke during a call). | In-memory only, never written to disk, never transmitted.                                     | Required for core gameplay; the `RECORD_AUDIO` / `NSMicrophoneUsageDescription` permission enables real-time voice-activity detection, never recording. | Audio synthesis for call effects, and voice-activity detection.       |

## What we do NOT collect

- No advertising identifiers (IDFA / AAID). The app declares _Does Not Use Advertising_ in App Privacy.
- No location data — `app.json` `android.permissions` does not include any coarse/fine location permission.
- No contacts, calendar, photos, media, or files.
- No email, name, phone number, or any direct identifier.
- No IP address is retained server-side. Sentry redacts IP addresses at ingest.
- When community sharing is enabled, players may publish frequency names, descriptions, fragment references, tuning values and a friend code. Public presets are readable by other players. No chat is provided.
- Custom-call publishing sends an Apple transaction ID or Google purchase token to our community Worker for store verification. Local-only analytics remain on-device.

## Third parties

| Vendor                             | Purpose                                                                 | Data shared                                                                                                                                                                                    | Link                                                                            |
| ---------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Sentry (Functionland, Inc.)        | Crash reporting                                                         | Stack trace, app/OS version, anonymized event metadata. IP redacted at ingest.                                                                                                                 | https://sentry.io/privacy/                                                      |
| Cloudflare                         | Community publishing and purchase verification                          | Published preset metadata, community device token hash and purchase fingerprint; raw store proof processed transiently.                                                                        | https://www.cloudflare.com/privacypolicy/                                       |
| Apple App Store, Google Play Store | IAP fulfillment & app distribution                                      | Apple transaction IDs or Google purchase tokens are sent to our community Worker when publishing custom calls and checked with the corresponding store. No payment-card details are collected. | https://www.apple.com/legal/privacy/ , https://policies.google.com/privacy      |
| Google Cloud Run (optional)        | Proxy for Anthropic Claude API when the Infinite Signal IAP is unlocked | The `prompt` body sent to the proxy. No identities attached. Only used if the player unlocks and uses Infinite Signal.                                                                         | https://cloud.google.com/terms/servos , https://www.anthropic.com/legal/privacy |

> No third-party analytics, no ad SDKs, no social SDKs, no marketing SDKs are linked in `package.json`. Maintain this invariant whenever dependencies change — the App Privacy / Data Safety declarations above depend on it.

## Data retention

- **Opt-in local analytics**: kept in `AsyncStorage` until the player resets it in Settings → "Clear local analytics" or uninstalls the app.
- **Crash diagnostics**: Sentry retains crash events for 90 days, then deletes them.
- **Purchase proof**: platform receipts/purchase tokens are stored locally with purchase records. Publishing sends an Apple transaction ID or Google purchase token over TLS through the community Worker to its store API. Raw proof and API responses are transient and are not retained or logged by verification.
- **Community records**: D1 retains published presets, device token hashes, moderation records, and a purchase fingerprint bound to the community device with platform, last verified status and timestamp. These records persist until an operator deletes them; uninstalling does not delete server records. Contact the privacy address with the community device details for deletion. Public presets can be removed by their author.
- **Infinite Signal prompts (optional)**: not stored on device. A prompt body is sent to the Cloud Run proxy at request time and discarded after the response returns.

## Children

This app does not collect personal information from children. The App Store rating is **12+** and the Play rating is **Teen**. The app does not knowingly collect data from anyone under 13. If you believe a child under 13 has provided personal information, contact `privacy@deadair.example.com` and the data will be deleted.

> The `RECORD_AUDIO` permission is **not** used to record the user. The audio engine analyses the live microphone signal in real time — an energy/RMS check that answers "is the player speaking right now?" — and never writes, uploads, or stores it. Document this in any communication with reviewers — see [`review-notes.md`](./review-notes.md).

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

| Question                                             | Answer                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Do you collect data from this app?                   | Yes (crash diagnostics, optional community content and purchase verification; analytics stay local) |
| Crash data                                           | Collected — linked to a single user device session, not to user identity                            |
| Usage data                                           | Collected — local-only, never transmitted                                                           |
| Identifiers                                          | Community device token hash and purchase fingerprint collected when sharing is used                 |
| Health, financial, contact, location, sensitive info | Purchase history used for custom publishing; no payment-card details                                |
| Diagnostics not collected from you                   | No — only crash diagnostics                                                                         |
| Privacy URL                                          | `https://deadair.example.com/privacy` (placeholder)                                                 |

## Google Play "Data safety" form (responses)

| Question                                      | Answer                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Does your app collect or share any user data? | Yes — collects (does not share)                                                                                          |
| What data is collected?                       | Crash diagnostics, optional community content, device identifier and purchase verification data                          |
| Is data encrypted in transit?                 | Yes (TLS to Sentry, community API and store verification APIs)                                                           |
| Can users request data deletion?              | Yes — Settings → Clear local analytics; crash events auto-delete at 90 days; contact us to delete community records      |
| Is data shared with third parties?            | Sentry receives crash events; Cloudflare hosts community records; Apple/Google verify purchases. No advertising vendors. |
| Family policy applicable?                     | No — app does not target children                                                                                        |
| Government apps                               | No                                                                                                                       |
| Featured apps programs                        | No                                                                                                                       |

> Any change to `lib/analytics.ts`, `lib/errorTracking.ts`, or the package dependency manifest requires updating this file in the same commit. CI cannot enforce this automatically — code reviewers must verify.

## Supporting files

- [`app-store-listing.md`](./app-store-listing.md)
- [`play-store-listing.md`](./play-store-listing.md)
- [`review-notes.md`](./review-notes.md)
- [`release-checklist.md`](./release-checklist.md)
- [`../../lib/analytics.ts`](../../lib/analytics.ts) — opt-in local analytics implementation
- [`../../lib/errorTracking.ts`](../../lib/errorTracking.ts) — Sentry crash reporting
- [`../../app.json`](../../app.json) — declared permissions and IAP entries
