# Dead Air Radio — Security & Auth

_Status reconciled against `lib/iap.ts` and the app on 2026-09-29._

## Authentication

The app has no account sign-in flow; player progress and settings are local to the device unless a platform service is explicitly used.

## In-App Purchases

The native purchase flow is integrated through `expo-in-app-purchases` in `lib/iap.ts`. Purchase and restore controls are in `app/store/index.tsx`.

- A purchase is not granted as an entitlement unless the store response includes both a transaction receipt and an order ID.
- Purchase history is rechecked at launch; missing/refunded/cancelled Infinite Signal and base-game products can have their entitlements revoked.
- Restore queries native store purchase history and applies eligible purchase records.
- Purchase errors, cancellations, and deferred transactions are surfaced through store state and UI messages.

**Important boundary:** this repository does not send receipts to a backend for cryptographic/server-side verification. Current checks are based on the native store response and purchase history. Confirm whether server-side validation is required before production release, and complete product setup plus native sandbox testing as listed in `docs/store/release-checklist.md`.

## Data and Platform Boundaries

- Do not treat the local entitlement flag by itself as proof of purchase; its setter is gated by a matching purchase record with a receipt.
- IAP platform services communicate with the App Store or Google Play. Other network and data handling is documented with the relevant feature rather than assumed absent here.
