# Privacy Policy — Dead Air

**Last updated: 10 August 2026**

Dead Air is a single-player game. It does not have accounts, it does not ask
who you are, and it does not collect or sell personal information.

---

## What the app stores

Everything the game remembers is stored **only on your device**, using your
device's own app storage:

- Your progress: sanity, static, which calls you have logged, which tapes you
  have recovered.
- Your purchases: which content you have unlocked.
- Your preferences: whether sound and haptics are on.

None of this is transmitted anywhere. Uninstalling the app deletes it. You can
also erase your progress at any time from **Settings → Erase Station**.

## What the app sends

**Infinite Signal** is an optional feature that generates new calls using
Anthropic's Claude model. When — and only when — you tap *Generate AI Call*,
the app sends a request containing:

- the numeric id of the frequency band you are tuned to, and
- a short list of caller names **from the game's own written content**, so the
  generator avoids repeating them.

That is the entire contents of the request. It includes no account identifier,
no device identifier, no advertising id, no location, and nothing you have
typed — the game has no text input. The request is sent over HTTPS; the app
refuses to use a non-HTTPS endpoint.

The request is handled by a small service operated by the developer, which
passes it to Anthropic's API. Anthropic's handling of API requests is covered
by their own privacy policy: <https://www.anthropic.com/legal/privacy>

Like any web service, that service's hosting provider records standard request
logs, which include the originating IP address, for security and abuse
prevention. These logs are not used to identify you, are not combined with
anything else, and are not shared.

If Infinite Signal is not configured in your build of the app, the app makes
**no network requests at all**.

## What the app does not do

- No analytics, telemetry, or crash reporting.
- No advertising, and no advertising identifiers.
- No tracking across apps or websites.
- No location, contacts, photos, camera, or microphone access. The app plays
  audio but has no recording capability and does not request microphone
  permission.
- No sale or sharing of personal information.

## Permissions

| Permission | Why |
|---|---|
| Internet / network state | Only to reach the Infinite Signal service when you use that feature |
| Modify audio settings | To play the game's sound at the correct output level |
| Vibrate | Haptic feedback, which you can turn off in Settings |

## Children

Dead Air is a horror game intended for teenage and adult players. It is not
directed at children, and it does not knowingly collect information from
anyone. There is nothing to collect.

## Changes

If this policy changes, the revised version will be posted at this address with
an updated date above.

## Contact

Questions about this policy: **outcastingaway@gmail.com**
