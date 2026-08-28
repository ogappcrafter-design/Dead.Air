# Contributing to Dead Air

This is a creative project with a specific vision. Contributions are welcome for bug fixes, performance improvements, UI/UX polish, platform-specific fixes, and test coverage.

## Prerequisites

- **Node.js** 24+
- **pnpm**
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

## Setup

```bash
git clone https://github.com/daggerstuff/deadair.git
cd deadair
pnpm install
pnpm start
```

## Development Workflow

1. Fork the repo and create a branch: `git checkout -b fix/whatever`
2. Make your changes
3. Verify locally before committing:

```bash
pnpm run format:check   # prettier formatting
pnpm run lint           # eslint
pnpm run typecheck      # tsc --noEmit
pnpm test              # jest
```

4. Commit — the pre-commit hook automatically runs eslint + prettier on staged files
5. Submit a PR

## Project Conventions

- **Pure engine logic** — everything in `engine/` is framework-agnostic with dependency injection. No React, no store imports, no I/O.
- **Zustand stores** — one store per domain. Persistence via `createJSONStorage`.
- **File-based routing** — Expo Router, screens in `app/`.
- **CRT theme** — centralized in `lib/theme.ts`. Amber, green, red on near-black.
- **IAP security** — entitlement setters are gated by purchase receipt validation. See `context/security-auth.md`.

## What Not to Change

- **The 18 hand-written transmissions** in `data/calls.js` — they're sacred.
- **The `.prettierrc` config** — it's gitignored as tool-specific config; formatting rules are enforced by CI.

## CI Pipeline

CI runs on every push and PR to `main`:

1. **Format check** — `prettier --check`
2. **Lint** — `eslint .`
3. **Typecheck** — `tsc --noEmit`
4. **Tests** — `jest --ci`

All four must pass. See `.github/workflows/ci.yml`.

## Content Warnings

This game contains themes of grief, death, loss, the supernatural, and psychological horror. Some transmissions are based on emotionally real scenarios.
