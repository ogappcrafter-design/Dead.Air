# Dead Air Radio — Security & Auth

## Authentication

No user authentication system. Dead Air Radio is a single-player offline game with no login.

## IAP Security (Phase 1 Focus)

### Receipt Validation
- Purchase receipts must be validated before granting entitlement
- Store validated receipt in AsyncStorage for offline access
- `hasInfiniteSignal` flag must only be set after confirmed purchase
- Receipt should be re-validated on app launch (check for refunds/cancellations)

### Restore Purchases
- Settings screen must have "Restore Purchases" button
- Flow: query store → validate receipts → update `hasInfiniteSignal` → notify user
- Handle case where no purchases found gracefully

### Error States (No Silent Failures)
- Network failure → show retry option
- Purchase declined → graceful message, no crash
- Already owned → detect and inform user
- Interrupted purchases → recoverable on next launch
- Cross-device restore conflicts → resolve to most recent valid receipt

### Data Security
- AsyncStorage for receipt storage (not plaintext sensitive data)
- No server-side validation needed (client-side only for Phase 1)
- Product IDs must match exactly between iOS StoreKit and Android Play Billing configurations

## No Other Security Concerns

- No user data collection
- No network API calls (except IAP store communication)
- No third-party analytics
- No crash reporting SDK
