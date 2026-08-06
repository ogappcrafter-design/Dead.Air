# Weekly Triage Process — P7-2

Recurring, low-ceremony Monday triage for Dead Air Radio issues,
crashes, and feature requests. Companion to `crash-triage.md`
(per-event flow, severity definitions, SLAs).

## Cadence

- **When:** every Monday, 10:00 local time, **after** the daily Sentry
  digest arrives (so the spike alert is one of the first things triaged).
- **Who:** any one maintainer. Rotate weekly if maintainer count > 1.
  The triager "owns" Monday's queue in and out.
- **Where:** asynchronous. No meeting. Open `daggerstuff/deadair` on GitHub
  - the Sentry "Dead Air Radio — Overview" dashboard in parallel tabs.
- **Budget:** 30 minutes for the queue, 60 minutes hard cap. Anything that
  can't be triaged in 30 minutes gets parked (see step 6) and re-triaged
  the next Monday.

## Inputs

1. Sentry **Issues** view for project `dead-air`, filtered:
   - `environment:production`
   - `is:unresolved`
   - sort by **Last Seen** descending
2. Sentry **Releases** view — last release's crash-free rate.
3. GitHub **Issues** on `daggerstuff/deadair` filtered `is:open` and
   `label:bug` and `label:enhancement`.
4. `docs/playtest-bugs.md` — any still-open playtest bugs flow back into
   the regular queue each Monday.
5. `docs/store/review-notes.md` — store reviews that report bugs.
   Carry them into the queue too.

## Steps

Each step has a "Done when" test. Don't move on until it passes.

### 1. Sweep Sentry for new issues

**Done when**: every Sentry issue seen for the first time this Monday has a
GitHub issue link in its sidebar.

For each unresolved Sentry issue **not already linked** to a GitHub issue:

1. Open the Sentry issue. Note the top of the stack signature.
2. Right-hand sidebar → **Create GitHub Issue** (Sentry ↔ GitHub wiring in
   `sentry-setup.md` step 6).
3. In the new GitHub issue pre-fill, set:
   - **Platform** dropdown — from the Sentry `platform` tag.
   - **App version** — from the `release` tag (e.g. `1.0.0`).
   - **Severity** dropdown:
     - **P0** — crash on launch (ッ stack frames hit `app/_layout.tsx`,
       `index`, splash components, or `ActiveCallDispatcher` cold-start).
     - **P1** — crash mid-gameplay.
     - **P2** — caught error, no user impact.
     - **P3** — Sentry `captureMessage('...', 'warning')` from
       `reportBug()` in `lib/errorTracking.ts`.
4. Apply labels: `bug`, plus `priority/p0`…`priority/p3` matching the
   severity. For P0 also apply `incident-response`.
5. Save the issue. Copy its URL back into the Sentry issue's sidebar
   comment so the link is bidirectional.

### 2. Sweep GitHub for new issues without Sentry linkage

**Done when**: every open GitHub `bug` issue has either a Sentry event link
in its body OR a comment "No Sentry event — repro'd locally" from the triager.

For each open GitHub issue with label `bug` and no `sentry:` URL in the body:

- If the issue body already contains the user-submitted Sentry event ID,
  search Sentry Issues by `sentry_event_id` and link it as in step 1.
- If no event ID is present, try to repro the bug locally:
  - Match the reporter's platform and `call_type` if stated.
  - If repo'd, capture a new Sentry event and link it back.
  - If **not** repo'd in 10 minutes, leave a comment "Could not reproduce
    in 10 min — watched for Sentry events; needs repro." and label
    `needs-repro`. Park for next Monday.

### 3. Classify and prioritize

**Done when**: every open issue has exactly one `priority/*` label matching
its severity, and the **most recent** P0 / P1 issue is assigned to a
maintainer.

Order the queue:

1. **P0** — assign on the spot, schedule a fix today (4h SLA — see
   `crash-triage.md`). If no maintainer can respond today, escalate per the
   `incident-response` label.
2. **P1** — assign to the next available maintainer (24h SLA).
3. **P2** — verify or set the `milestone`. Used by `game-sprint-plan`
   output / weekly roadmap.
4. **P3** + **enhancements** — bulk-triage: read the title, set
   `milestone: backlog` if not already, move on. These are informational
   only — no fix needed unless `game-producer` says otherwise.

### 4. Assign and close loops

**Done when**: every P0/P1 issue has an `assignee` and every resolved-from-
last-week issue has a closed-linking PR.

For each open P0/P1 issue without an assignee, choose an owner:

- The person who last touched the failing component (git blame the path in
  the stack signature).
- Or the rotating on-call maintainer for the week.

For each issue marked **Resolved in Released** in Sentry last week:

- Open the linked GitHub issue.
- Confirm a regression test exists — search `__tests__/` for the issue
  number referenced in a `describe` / `test` block.
- If no regression test, comment "Merge blocked: no regression test" and
  remove the `priority/*` label — do not close — re-open the issue as P1.
- If regression test exists and the fix is merged and shipped, close the
  GitHub issue with a comment citing the fix PR and the regression test
  commit. Also mark the Sentry issue **Ignore → Resolved in Released**.

### 5. Check the dashboard

**Done when**: any of the four metrics below are out-of-target AND have an
action item in the current sprint's notes.

Open the Sentry "Dead Air Radio — Overview" dashboard (built in
`sentry-setup.md` step 7). Read each metric against these targets:

| Metric                 | Target                                 | If out-of-target                                                                                      |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Crash-free users       | ≥ 99% over last 24h                    | < 99% → open a P1 issue for "crash-free rate drop < 99%" and start an incident thread.                |
| Crash-free sessions    | ≥ 95% over last 24h                    | < 95% → same as above but P0; page on-call.                                                           |
| Median time-to-resolve | ≤ SLA per severity (P0 24h, P1 1 week) | Out-of-target → re-assign the offending issue, surface in Slack.                                      |
| Open P0 / P1 count     | P0 = 0, P1 ≤ 3                         | If P0 > 0 → this is an incident, see step 1; if P1 > 3 → flag for `game-sprint-plan` scope reduction. |

Record today's numbers in a `triage/YYYY-MM-DD.md` audit file (create dir
if missing). Format — keep it one line per metric:

```
2026-08-06  crash_free_users   99.4   # above target — no action
2026-08-06  crash_free_sessions 96.3  # above target — no action
2026-08-06  median_ttr_p1     12h     # within SLA
2026-08-06  open_p0           0
2026-08-06  open_p1           1       # issue #142, assigned @owner
```

### 6. Park and report

**Done when**: any issue the triager couldn't close in 30 minutes has a
"parked" label and a one-line reason.

For each issue that couldn't be triaged in budget:

- Apply label `needs-triage` (catch-all for "I looked and I'm not sure").
- Comment one reason:
  - "Needs Sentry data — wait for next crash."
  - "Needs design input — moved to `game-designer` queue."
  - "Likely upstream — Sentry/Expo issue, waiting on release."
- Move on. It re-enters the queue next Monday.

Write a 3-bullet summary in `docs/plans/YYYY-Www.md` (same dir as the
existing plan files):

```
## YYYY-MM-DD triage
- New: 4 issues (2 P2, 2 P3) — all linked to Sentry
- Closed: 2 (P1 #142 via PR #157, P2 #139 via PR #161)
- Parked: 1 (P2 #158 — needs repro)
```

## Definition of done for a bug

Re-stated from `crash-triage.md` for quick reference — a bug is **done**
when and only when:

1. Fix merged to `master` and shipped in a release tag visible in Sentry's
   **Releases** view.
2. The Sentry issue is **Resolved in Released** (auto or manual).
3. A regression test exists in `__tests__/` and would have failed on the
   original bug, passes on the fix.
4. The GitHub issue is closed with a comment citing the fix PR and the
   regression test commit.

Triagers who close a P1/P0 issue without all four items must re-open it.

## Metrics to track (rolling)

- **Open P0 count** (target: 0)
- **Open P1 count** (target: ≤ 3)
- **Median P0 time-to-fix** in hours (target: ≤ 24h)
- **Median P1 time-to-fix** in days (target: ≤ 7d)
- **Crash-free sessions %** over last 24h (target: ≥ 95%)
- **Crash-free users %** over last 24h (target: ≥ 99%)
- **Spike alerts fired and not actioned** (target: 0)

Audit daily numbers but **trend weekly** — single-day drops are noise.

## Anti-patterns (do not)

- Closing a Sentry issue manually before the fix release is shipped. Always
  use **Resolved in Released** — closing early hides regressions.
- Closing a GitHub issue without a regression test. Use the rule above.
- Re-classifying a P0 as P1 because the SLA slipped. Fix the incident,
  then re-classify based on impact, not time.
- Paging on P2/P3 spikes. Those batch into this Monday queue by design;
  paging erodes signal from real P0/P1 alerts.
- Skipping the dashboard read. The metric drift is the only early-warning
  signal beyond the explicit alerts.

## Related docs

- Crash triage workflow (per-event, includes alert config + tag glossary):
  `docs/monitoring/crash-triage.md`
- Sentry one-time setup: `docs/monitoring/sentry-setup.md`
- Bug report issue template: `.github/ISSUE_TEMPLATE/bug-report.yml`
- Feature request issue template: `.github/ISSUE_TEMPLATE/feature-request.yml`
- Error tracking integration: `lib/errorTracking.ts`
- Existing known-bugs context: `docs/playtest-bugs.md`
- Store review notes (P0 spill-over feed): `docs/store/review-notes.md`
