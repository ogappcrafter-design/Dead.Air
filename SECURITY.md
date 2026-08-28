# Security Policy

## Supported Versions

| Version  | Supported |
| -------- | --------- |
| `master` | ✅        |

Dead Air is a single-branch project. Security fixes land on `master` and ship with the next build.

## Reporting a Vulnerability

Please report vulnerabilities privately via **GitHub's Private Vulnerability Reporting** on this repository (Security tab → Report a vulnerability). Do not open a public issue for security problems.

Include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- Affected platforms (iOS / Android / Web) if relevant

You can expect an initial response within 7 days. We will credit reporters in the changelog unless you prefer to remain anonymous.

## Scope

- **In scope:** the Expo/React Native app, the Cloudflare PWA worker (`worker/`), and the companion Godot project
- **Out of scope:** the game's fictional horror content — it is intended to unsettle, not to attack

## Data Handling

Dead Air is local-first: saves, analytics, and the leaderboard live entirely on-device. No account system, no telemetry leaves the device except standard crash reporting via Sentry (opt-out in Settings).
