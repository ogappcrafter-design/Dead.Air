# Sentry Setup — Dead Air Radio — P7-2

One-time configuration guide for Sentry error tracking in the Dead Air Radio
client. Used in production by `lib/errorTracking.ts::initErrorTracking()`.

If Sentry is already set up, jump to the section you need; otherwise run all
steps in order.

## 1. Create the Sentry project

1. Sign in at `https://sentry.io` with the team account.
2. **Projects → Create Project**.
3. Platform: **React Native** (Sentry auto-detects Expo via the SDK).
4. Project name: `dead-air`.
5. Set the default environment to `production` and the default release
   tracking to `1.0.0` (matches `app.json` `expo.version`).
6. **Create Project**. Sentry displays a DSN looking like
   `https://<key>@o<orgid>.ingest.sentry.io/<projectid>`.
   Copy it — used in step 2.

## 2. Wire the DSN into `eas.json`

Sentry DSN is exposed to the client via the `EXPO_PUBLIC_SENTRY_DSN`
environment variable, read by `lib/errorTracking.ts::readDsn()`.

Replace the placeholder values in `eas.json` (currently `DEV_LOREM_IPSUM_DSN`,
`STAGING_LOREM_IPSUM_DSN`, `PROD_LOREM_IPSUM_DSN`) with the real DSN:

```jsonc
// eas.json (excerpt — production profile)
"production": {
  "channel": "production",
  "distribution": "store",
  // ...
  "env": {
    "EXPO_PUBLIC_SENTRY_DSN": "https://<realkey>@o<orgid>.ingest.sentry.io/<projectid>",
    // ...
  }
}
```

Keep the **development** and **preview** DSNs as either a separate Sentry
project (`dead-air-dev`, `dead-air-staging`) or the same project filtered by
the `environment` tag. Recommended: same project, distinct `environment`
values already set by `lib/errorTracking.ts::__DEV__ ? 'development' :
'production'`. The `preview` EAS profile needs `EXPO_PUBLIC_SENTRY_DSN` set
to the same production URL — Sentry's `environment` tag will distinguish
events because the SDK sets it from `__DEV__`, not from the EAS env. To
override `environment` for preview builds, set it explicitly:

```ts
// In lib/errorTracking.ts — optional override for preview builds
Sentry.init({
  dsn,
  release: readRelease(),
  environment:
    process.env.EXPO_PUBLIC_EAS_PROFILE === 'preview'
      ? 'preview'
      : __DEV__
        ? 'development'
        : 'production',
  beforeSend(event) {
    return attachGameContext(event);
  },
});
```

> Do NOT commit the DSN to public history. The `.gitignore` should not ignore
> `eas.json` (it ships with the build config) — the DSN is a public
> ingest-only key by design. The **secret** you must rotate separately is the
> Sentry auth token used for source-map uploads (step 4).

## 3. Release tracking

`lib/errorTracking.ts::readRelease()` returns
`Constants.expoConfig?.version ?? 'unknown'` — i.e. the `version` field from
`app.json`. Every Sentry event ships with a `release` tag equal to that
version string.

To make Sentry **resolve** the release (see crash-free rate per release,
regressions, suspect commits), tell Sentry which commits shipped in which
release:

### Option A — Sentry CLI (CI)

```bash
export SENTRY_AUTH_TOKEN=sntrys_...
export SENTRY_ORG=your-org
export SENTRY_PROJECT=dead-air

# At build time, after `eas build`:
sentry-cli releases new "1.0.0"
sentry-cli releases set-commits --auto "1.0.0"
sentry-cli releases finalize "1.0.0"
```

### Option B — EAS build hook (recommended)

Add to `eas.json`:

```jsonc
"build": {
  "production": {
    // ...
    "experimental": {
      "sentry": {
        "enabled": true,
        "authToken": "$SENTRY_AUTH_TOKEN",
        "org": "your-org",
        "project": "dead-air",
        "release": "${ Constants.expoConfig?.version }"
      }
    }
  }
}
```

Then store `SENTRY_AUTH_TOKEN` as an EAS secret:

```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value sntrys_...
```

Releases will appear in Sentry under **Releases** as `1.0.0`, `1.0.1`, etc.,
matching `app.json` `expo.version`.

## 4. Source maps upload

Source maps let Sentry symbolicate minified bundle stack traces back to your
TypeScript source. Without them, every crash shows up as `index.js:1:12345`
which is useless.

### EAS Build post-install hook

Use the official `@sentry/react-native` EAS hook. In `app.json`:

```jsonc
"plugins": [
  // ... existing plugins ...
  [
    "@sentry/react-native/expo",
    {
      "authTokenEnvVar": "SENTRY_AUTH_TOKEN",
      "org": "your-org",
      "project": "dead-air"
    }
  ]
]
```

Install the plugin as a build-time dep:

```bash
pnpm add -D @sentry/react-native
```

`EAS_BUILD` will pick up `SENTRY_AUTH_TOKEN` from the EAS secret set in step 3.
On every `eas build --platform android` the hook uploads source maps tagged
with the current `release` (from `app.json` `expo.version`) and `dist`
(app bundle ID).

Verified symbolication: open a sample crash in Sentry, the stack frames should
read `lib/errorTracking.ts:62` instead of `index.js:1`. If you still see
`index.js:1`, see [Sentry's JS source-map troubleshooting][1].

[1]: https://docs.sentry.io/platforms/react-native/sourcemaps/

## 5. Alert rules

Configure in Sentry under **Alerts → Create Alert**. Three rules cover the
triage flow in `crash-triage.md`:

| Rule                      | Type        | Trigger                                                                                                            | Channel                         |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **New crash on launch**   | Issue Alert | `event.type:error AND tags["crash_uri"]:/index AND issue.is_new:1` AND `environment:production`                    | email + PagerDuty high-priority |
| **New crash in gameplay** | Issue Alert | `event.type:error AND issue.is_new:1 AND environment:production` (excludes the launch rule by inverting crash_uri) | email + Slack `#deadair-alerts` |
| **Regression**            | Issue Alert | `issue.is_regression:1 AND environment:production`                                                                 | email + Slack `#deadair-alerts` |
| **Spike**                 | Issue Alert | `rate(per_hour) > 10 * moving_avg(per_hour, 1h) AND environment:production`                                        | email only — do not page        |

Save each rule, then **Run a Test** from the alert page (Sentry will emit a
fake event; verify your channel receives it).

## 6. Sentry ↔ GitHub integration

So a crash can leave Sentry and become a tracked GitHub issue in
`daggerstuff/deadair` (used by the triage flow in `crash-triage.md`):

1. Sentry → **Settings → Integrations → GitHub**.
2. Install the Sentry GitHub app on the `daggerstuff` org, granting repo
   access to `deadair`.
3. Back in Sentry → **Project Settings → Issue Tracking → GitHub**.
4. Select `daggerstuff/deadair` and the `.github/ISSUE_TEMPLATE/bug-report.yml`
   default issue type (Sentry will read this schema).
5. Under **Issue Linking**, enable "Create issue from Sentry".

From any Sentry issue, the right-hand sidebar now has a **Create GitHub Issue**
button that pre-fills the bug-report form's `sentry-event-id` field with the
current event hash.

## 7. Dashboard creation

In Sentry → **Dashboards → Create Dashboard** → "Dead Air Radio — Overview".

Recommended widgets (all support scope filters `environment:production`,
`release:1.0.0`):

| Widget                 | Type                                               | Query                                      | Purpose                                    |
| ---------------------- | -------------------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| Crash-free users       | `crash_free_users` rate, 24h                       | `is:crashed`                               | Single top-line number; aim ≥ 99%.         |
| Crash-free sessions    | `crash_free_sessions` rate, 24h                    | `is:crashed`                               | Same, session-weighted.                    |
| Error rate             | `error_rate(production)`, 24h                      | `event.type:error`                         | Catch creeping P2/P3 traffic.              |
| Top issues             | `top_issues(production)`, 7d                       | `is:unresolved`                            | Monday-triage queue.                       |
| Top call types         | `event_count` grouped by `call_type`               | `event.type:error`                         | Identify which call component is failing.  |
| Sanity at crash        | histogram or `event_count` grouped by `sanity` tag | `event.type:error AND tags.sanity:<value>` | Patterns like "all crashes @ sanity < 20". |
| Median time to resolve | `time_to_resolve(median)`                          | resolved issues only                       | SLA tracking.                              |

Pin the dashboard to project `dead-air` so every team-member sees it on
login.

## 8. Verify the integration end-to-end

After all the above is set up:

1. `eas build --profile preview --platform android` (preview for staging).
2. Install the preview APK.
3. Trigger a deliberate error via the `reportBug("setup-check", { step: 1 })`
   code path (or, in a dev build, call `captureException(new Error("e2e-check"))`).
4. Confirm the event arrives in Sentry with the correct `release`,
   `environment`, and tags set (sanity, sanityLowest, etc.).
5. Open the event; the stack trace should be symbolicated to
   `lib/errorTracking.ts:<line>`.
6. Trigger the **Create GitHub Issue** flow on that event. A new issue
   should land in `daggerstuff/deadair` with `sev: P2` and the Sentry link.

If any of those fail, the failure is in step N — re-run that step's
instructions.

## Related docs

- Crash triage workflow: `docs/monitoring/crash-triage.md`
- Weekly triage process: `docs/monitoring/triage-process.md`
- Error tracking module: `lib/errorTracking.ts`
- EAS build config: `eas.json`
- App config (version + Expo plugins): `app.json`
- Issue templates: `.github/ISSUE_TEMPLATE/bug-report.yml`,
  `.github/ISSUE_TEMPLATE/feature-request.yml`
