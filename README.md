# ◈ DEAD AIR

> *Something is trying to reach you. The signal is forming.*

A paranormal late-night radio game. You are the DJ. The calls are real.

---

## What it is

You run a radio station after midnight. Calls come in on five frequency bands —
from the recently dead, from people stuck in a loop, from a government line that
should not be reaching you, and eventually from the frequency itself. Each call
plays out as one of five small interactions. Answering costs you something and
pays you something. Some calls leave a tape behind.

There is no combat, no timer pressure outside the calls that are *about*
pressure, and no ads.

## The loop

1. **Tune** to a band on the dial.
2. **Answer** a waiting call. Its type decides how it plays:

   | Type | What you do |
   |---|---|
   | `JUST_LISTEN` | Nothing. The call plays itself out. |
   | `DEAD_AIR` | Hold a near-silent line until the countdown ends. |
   | `RIGHT_ANSWER` | Choose what to say. The ending changes. |
   | `SIGNAL_DECODE` | Tap back a five-glyph sequence. |
   | `STAY_CALM` | Keep the anxiety bar down until time runs out. |

3. **Sign off** — the readout shows the static earned, the sanity moved, and
   any tape recovered.
4. Completed calls drop off the dial. Completed calls open new bands.

**Static** (`◈`) is the score. **Sanity** runs 0–100 and drifts with your
choices; the header shows it as `STABLE` / `FRAYED` / `CRITICAL` / `DEAD AIR`.

## Bands

| Band | Frequency | Opens at |
|---|---|---|
| LIVING | 88.7 FM | start (free) |
| LIMINAL | 102.3 FM | 4 calls |
| LOST | 117.8 AM | 8 calls |
| CLASSIFIED | ███.█ FM | 12 calls |
| ████████ | ???.? | 15 calls |

LIVING is the free tier — four calls, plus three Infinite Signal generations.
The other four bands are the base purchase **and** are gated on progress: buying
the game does not hand you every frequency at once.

## Sound

Eight sounds, and they only fire where the game already treats something as
significant: the dial moving, a line opening and closing, the two decode
responses, the BREATHE control, and a tape reaching the archive. Ordinary
buttons, tabs and scrolling stay silent — a station that chirps at every touch
stops sounding like a station.

The one continuous element is a station bed: hiss, mains hum and a faint
drifting whistle, sitting well under everything and playing only while a call
is live. It loops sample-perfectly rather than crossfading — the noise is
filtered *circularly* and the tonal parts sit at exact multiples of the loop
frequency, so the wrap is a smaller step than the average gap between adjacent
samples.

Everything is synthesized by `scripts/gen-audio.py` from noise, sines and
one-pole/state-variable filters — no audio libraries and no licensed samples.
The whole palette is bandlimited on purpose; it should sound like it came down
a wire. `npm run audio` rebuilds it (~480 KB total, 32 kHz mono 16-bit).

The station honours the device silent switch and mixes with other audio rather
than interrupting it, so answering a call will not stop the player's music.
Sound can be switched off in Settings and the choice is remembered separately
from the save, so erasing progress does not turn it back on.

## Content

18 hand-authored transmissions and a 15-tape archive. Every tape is reachable in
a single playthrough, but several are locked behind one specific branch of a
`RIGHT_ANSWER` call — a full archive means choosing right, not just playing
everything. `__tests__/content.test.js` enforces both of those properties.

## Infinite Signal

Once the authored calls run out, the frequency keeps going: Claude generates new
calls in the voice of whichever band you are tuned to. Three are free; unlimited
is a $0.99 unlock.

The API key lives in [`proxy/`](proxy/README.md), never in the app bundle. The
proxy exposes one narrow route that takes a band id and returns a call — it is
**not** a passthrough for `/v1/messages`, so a leaked URL cannot be used to run
arbitrary prompts on your account. The app clamps every field of the response
before playing it (`src/engine/generation.js`), so a strange generation is a
strange call rather than a crash.

Until `expo.extra.signalProxyUrl` is set in `app.json`, the Generate button
reports that Infinite Signal is not configured.

---

## Layout

```
App.js                  root: save, purchases, which screen is up
index.js                Expo entry point
src/
  content/              the writing — bands, 18 calls, 15 tapes, glyphs
    calls/              one file per band
  engine/               pure game logic, no React (this is what the tests cover)
    save.js             save shape, v1→v2 migration, reward + sanity math
    progression.js      band unlocks, available calls, generation credits
    generation.js       clamping AI-generated calls into playable ones
    settings.js         player preferences, kept apart from progress
  audio/                the sound bus — manifest (data), assets, player
  services/             boundaries: storage, billing, the signal proxy client
  calls/                the five call players + the type→player registry
  screens/              boot, dial, call, sign-off, archive, store, settings
  components/           CRT overlay, buttons, signal bars, transmission log
  hooks/                line reveal, countdown
  theme/                colors, type, spacing, safe-area top
proxy/                  Cloud Run service holding the Anthropic key
scripts/gen-assets.py   regenerates the icons and splash from geometry
scripts/gen-audio.py    synthesizes the sound set
__tests__/              engine, content and audio tests (no RN renderer needed)
```

The engine is deliberately free of React and React Native imports, which is why
its tests run on plain Jest with no native mocking.

## Develop

```bash
npm install
npm test          # 122 tests: engine, content, audio
npm run lint
npm start         # Expo dev server
npm run android
```

Node 22+. Both asset sets are generated rather than authored — `npm run assets`
rebuilds the icons and splash from geometry plus a 5×7 bitmap font, and
`npm run audio` rebuilds the sound set. Neither needs an image or audio library.

## Build

```bash
eas build --platform android --profile preview      # APK
eas build --platform android --profile production   # AAB for Play
```

**Sound added a native module.** `expo-audio` is the first runtime dependency
added since v1, and native modules cannot ship over the air — the next release
needs a real EAS build, not an `expo-updates` push.

## Store products

Wire real billing by replacing the two marked bodies in
`src/services/billing.js`; nothing else in the UI needs to change.

| Product ID | Title | Price |
|---|---|---|
| `dead_air_base` | Base Transmission | $1.99 |
| `dead_air_infinite` | Infinite Signal | $0.99 |

## Saves

`dead_air_save_v1` holds sanity, static, completed calls, tapes and generation
count; `dead_air_purchases_v1` holds entitlements; `dead_air_settings_v1` holds
preferences. All three load before the first frame renders.

Saves are migrated on read (`migrateSave`). v1 stored completed calls as indices
into one flat list, so reordering the content would have silently rewritten a
player's history; v2 uses stable string ids and converts old files on load.
Out-of-range values are clamped and unknown tapes dropped rather than trusted.

Erasing a save (Settings → Erase Station) keeps purchases. You never buy the
game twice.

---

## What changed in this rebuild

The v1 tree was a single 544-line `game.js` plus two components. This is a
rewrite against the same design, keeping every line of the writing intact.
Behaviour that changed on purpose:

- **Buying the game no longer unlocks all five bands immediately.** v1
  short-circuited the progression gate whenever `baseUnlocked` was set, which
  made the unlock table above decorative. Both gates now apply.
- **Store prices are one source of truth.** The v1 README advertised
  $0.99 / $3.99 while the store UI charged $1.99 / $0.99. The UI's prices won;
  they now live in `src/services/billing.js` and the README reads from there.
- **`STAY_CALM` resolves ties deterministically.** Anxiety reaches 100 at
  exactly the moment the countdown expires, so an untouched call was a race
  between two independent timer chains. Losing is now checked first: if you
  never breathe, you lose.
- **A sign-off screen exists.** v1 computed payout, sanity drift and tape
  awards and then returned straight to the dial, so the economy was invisible.

Fixed along the way: the CRT scanlines the README had promised since v1 but
which were never drawn; 1×1-pixel placeholder icons; a dangling `setTimeout` in
the decode minigame that set state after unmount; hard-coded `paddingTop: 52`
standing in for a safe area; timer drift from chained `setTimeout`s; and a
corrupted file named `UPDATE FILE` sitting in the repo root, which turned out to
be a mangled ESLint config that was never wired to anything.

Sound arrived after the rebuild — see **Sound** above. v1 had none.

Still outstanding: there is nothing to spend static on — it is a score, not a
currency, and the store sells unlocks rather than upgrades. Worth deciding
before launch.

## Content warning

Grief, death, loss, the supernatural, and psychological horror. Several
transmissions are built on emotionally real scenarios.

## License

All original content © Dead Air Radio. All rights reserved.
Not for redistribution without permission.

---

*The frequency is open. Something is already waiting.*
