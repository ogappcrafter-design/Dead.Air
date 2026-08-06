# Crash Report Triage Workflow — P7-2

How to triage Sentry crash reports received from the Dead Air Radio client
(`lib/errorTracking.ts` init flows events into Sentry with the tags and contexts
defined there).

## Sentry dashboard

- Project: **Dead Air Radio** (slug `dead-air`)
- URL: `https://sentry.io/organizations/<your-org>/projects/dead-air/`
- Required access: `Member` or higher (read on Issues + Releases)
- Recommended views (top-left dropdown):
  - **Issues** — every incoming error or crash, sorted by event count
  - **Releases** — per-version crash rate, regression detection
  - **Tags** — drill-down by `environment`, `release`, `platform`, `call_type`

If access request needed, ping the repo owner listed in `OWNER.md`
(or the GitHub repo's CODEOWNERS).

## Severity classification

Use the same scale GitHub issue templates use (`.github/ISSUE_TEMPLATE/bug-report.yml`)
so a crash can flow from Sentry → GitHub issue without re-classification.

| Severity                   | When to assign                                                                                                                    | Example                                                                                            | Response SLA |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| **P0 — Crash on launch**   | App refuses to start, or crashes on the splash / radio screen before any user action. Blocks all play.                            | `ActiveCallDispatcher` Rules-of-Hooks crash (see `docs/playtest-bugs.md` BUG-2) on app cold-start. | **4 hours**  |
| **P1 — Crash in gameplay** | Crash arrives mid-call, mid-tuning, mid-store, mid-tape, or any other screen a user reached intentionally. Gameplay is中断rupted. | `useGameStore` undefined-state read during a `JUST_LISTEN` call when `currentCall` is null.        | **24 hours** |
| **P2 — Minor error**       | Caught error, no crash, no UX regression, but stack trace landed in Sentry. Game continues.                                       | `AsyncStorage` quota exceeded during save; save retried next session.                              | **1 week**   |
| **P3 — Warning**           | A Sentry `captureMessage('...', 'warning')` event via `reportBug()` in `lib/errorTracking.ts`. No user impact, no crash.          | "Infinite Signal call denied — base game not unlocked".                                            | Backlog      |

If a single Sentry issue accumulates events at multiple severities, classify at
the **highest observed** severity, not the average.

## Triage flow

```
 incoming crash ─▶ classify (P0-P3) ─▶ search existing GitHub issue
                  │                       │
                  │                       ├─ found? ─▶ comment w/ Sentry link + new event ID ─▶ re-assign if stale
                  │                       └─ none?  ─▶ create GitHub issue using bug-report.yml template
                  │                                    title: "[Px] <short stack trace summary>"
                  │                                    body: copy Sentry stack, tags, release, environment, event URL
                  ▼
 assign owner ─▶ owner opens fix branch ─▶ fix + regression test ─▶ PR ─▶ merge ─▶ verify (see below)
```

### Creating the GitHub issue

1. From Sentry issue view, top-right **...** → **Create GitHub Issue**
   (requires the Sentry ↔ GitHub integration from `sentry-setup.md`).
2. Sentry autofills title + body. Add:
   - The `Severity` dropdown value from bug-report.yml (P0/P1/P2/P3).
   - The `Sentry event ID` field — paste the most recent event's hash.
3. Apply the `bug` label. For P0 also apply `priority/p0` and `incident-response`.

### Definition of done for a crash

A Sentry crash issue is **resolved** when ALL of the following are true:

1. Fix is merged to `master` and a release carrying the fix is in the hands of users
   (release tag visible in the Sentry **Releases** view).
2. The Sentry issue is **Resolved in Released** — Sentry auto-resolves once no
   events arrive from a release newer than the fix release. Manually marking
   resolved is acceptable only if events stop AND the fix release is verified.
3. A regression test exists (`__tests__/`) that would have failed on the original
   crash and passes on the fixed code. For hooks-rule crashes, snapshot the hook
   order in a renderer test; for state crashes, drive the store to the bad state.
4. The GitHub issue is closed with a comment linking the fix PR and the regression test commit.

## Alert configuration

Configure in Sentry under **Alerts → Create Alert**. Aim: paged alerts only for
P0/P1; P2/P3 are batched for the Monday triage (see `triage-process.md`).

| Alert                      | Trigger                                                             | Notify                          | Notes                                                      |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| **P0 — Crash on launch**   | `crash uri ~ /index` OR `app_launch_failure` tag present, new issue | PagerDuty / email high-priority | One alert per release build is fine.                       |
| **P1 — Crash in gameplay** | New issue AND `environment = production`                            | email + Slack `#deadair-alerts` | Audience: on-call maintainer.                              |
| **Regression**             | Issue marked resolved re-opens in a newer release                   | email + Slack                   | Sentry's built-in regression detection.                    |
| **Spike**                  | Event rate > 10× moving average over 1h                             | email only                      | Do not page on spikes — investigate during triage.         |
| **Crash-free rate drop**   | < 95% crash-free sessions over 24h                                  | Slack daily digest, no page     | Correlates with P2 accumulation — feeds the weekly review. |

**When NOT to page:**

- Any P2 or P3 individual event.
- Spikes on a release day for a known staging build (`environment = preview`).
- Events from the `development` environment (treat as QA noise).

## Response SLAs

| Severity | First response (acknowledge issue is real) | Fix target (PR merged) | Verify window                  |
| -------- | ------------------------------------------ | ---------------------- | ------------------------------ |
| P0       | 4h                                         | 24h                    | 48h after release ships        |
| P1       | 24h                                        | 1 week                 | 1 week after release ships     |
| P2       | 1 week                                     | Next milestone/backlog | When it unavoidably becomes P1 |
| P3       | Backlog                                    | Up to triage owner     | N/A — informational            |

SLAs are **targets, not contracts**. P0 missing an SLA converts to an
**incident** — open an incident channel, page a second maintainer, and post a
public note in `docs/store/review-notes.md` if users have reported it in a
store review.

## Sentry tag conventions

Tags are set in `lib/errorTracking.ts` (`initErrorTracking`, `attachGameContext`,
`reportBug`, `captureException`). The following tags appear on every event:

| Tag                     | Set by                                                                                                                                                                                       | Values                                                                  | Use in triage                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `release`               | `Sentry.init({ release: readRelease() })` — `Constants.expoConfig.version` from `app.json`                                                                                                   | e.g. `1.0.0`, `1.0.1`, `unknown`                                        | Filter by release to see "is this still happening in the latest build?"                   |
| `environment`           | `Sentry.init({ environment: __DEV__ ? 'development' : 'production' })`                                                                                                                       | `development` / `production` (`preview` via EAS env)                    | Drop `development` from triage — dev-time noise.                                          |
| `platform`              | Sentry SDK auto-attaches                                                                                                                                                                     | `android` / `ios` / `web`                                               | Platform-specific regressions (Web GL freezes, etc.).                                     |
| `call_type`             | Set via `attachGameContext` from `useGameStore.currentCall.type`                                                                                                                             | `JUST_LISTEN`, `DEAD_AIR`, `RIGHT_ANSWER`, `SIGNAL_DECODE`, `STAY_CALM` | Spike on one call type → isolate the bug to that call's component (`components/calls/*`). |
| Game-state context tags | `attachGameContext` exposes `sanity`, `sanityLowest`, `static`, `isPlaying`, `shiftsCompleted`, `longestCallSurvivedMs`, `unlockedBands`, `receivedCalls`, `tapes` as tags or `game` context | numeric / boolean                                                       | Reproducibility hints (e.g. crashes cluster at `sanity < 20`).                            |

### Adding a new tag

1. Update `attachGameContext` in `lib/errorTracking.ts` (and `reportBug` /
   `captureException` if you want it on those scopes too).
2. Restart the app — Sentry auto-picks up the new tag.
3. Add a row to this table so triagers know what to do with it.

## Related docs

- Sentry one-time setup: `docs/monitoring/sentry-setup.md`
- Weekly triage process: `docs/monitoring/triage-process.md`
- Bug report issue template: `.github/ISSUE_TEMPLATE/bug-report.yml`
- Existing known bugs (context): `docs/playtest-bugs.md`
- Store-review-notes streaming (P0 spill-over channel): `docs/store/review-notes.md`
