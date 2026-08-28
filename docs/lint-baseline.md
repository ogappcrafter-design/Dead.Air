# ESLint Baseline

The CI lint job (`.github/workflows/ci.yml`) enforces **zero errors** from `npx eslint .`.

## Current Baseline

| Metric   | Value      |
| -------- | ---------- |
| Errors   | 0          |
| Warnings | 324        |
| Date     | 2026-08-28 |

## Policy

- **Errors: 0 tolerance.** Any new error blocks CI.
- **Warnings: baseline-locked.** The current 324 warnings are pre-existing and tracked here. New code should not add warnings; the baseline may be reduced over time as warnings are fixed.
- To check locally: `npx eslint .`

## Top Warning Categories

1. `@typescript-eslint/explicit-function-return-type` — missing return type annotations
2. `@typescript-eslint/no-unused-vars` — unused variables (often intentional in test mocks)
3. `@typescript-eslint/no-require-imports` — `require()` usage (IAP module uses lazy `require` for `expo-in-app-purchases`)

## Reducing the Baseline

When fixing warnings, update the count in the table above. Do not suppress warnings with `eslint-disable` comments unless the suppression is documented with a reason.
