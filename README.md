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

## Feel

The app opens on a title screen where **DEAD AIR** resolves out of an unlit
dot-matrix panel — cells light in a ragged left-to-right sweep, so the word
forms out of noise rather than wiping in. It is the same 5×7 bitmap font the
icon generator uses, rendered as blocks. The whole ~300-cell display is driven
by one shared animated value, so it costs two animated nodes and runs entirely
on the native driver.

Moving between screens fires a **burst of TV snow** — three noise frames cycled
while the burst is up, because one tile held still reads as a texture and
swapping between them reads as live static. Changing band fires a lighter one.
Getting around the app should feel like retuning, not like swapping views.

Everything else is restrained: transmission lines fade and lift in as they
arrive, call cards form in sequence when the dial moves, buttons take the weight
on press, the anxiety bar glides instead of stepping, and the signal meter
wavers on an open line. The CRT layer breathes and drops a frame every ten
seconds or so.

All motion is opacity and transform only, so it runs on the native driver and
never competes with the JS thread while a call is ticking — and all of it
honours the OS **reduce-motion** setting, which skips straight to the settled
state.

**Haptics** fire on exactly the moments that make a sound, routed through one
`src/feedback` facade so the two cannot drift apart. Both have their own toggle
in Settings.

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
arbitrary prompts on your account. The model is asked for a
[structured output](proxy/prompt.js) rather than "reply with only JSON", so the
response is parseable by construction, and the app clamps every field again
before playing it (`src/engine/generation.js`) — a strange generation is a
strange call, not a crash.

### Pointing the app at your proxy

Deploy `proxy/`, then set one environment variable — no tracked file to edit:

```bash
SIGNAL_PROXY_URL=https://dead-air-proxy-xxxx.run.app npx expo start
```

`app.config.js` folds it into the Expo config at build time and the app reads it
back through `expo-constants`. For EAS, set it per profile in `eas.json` under
`env`, or as an EAS environment variable.

The URL is vetted before use: plaintext `http` is refused anywhere but a local
dev host, so a shipped build cannot end up talking to the proxy in the clear.
Settings reports the outcome — `CONNECTED`, `NOT CONFIGURED`, `BAD PROXY URL` or
`PROXY MUST USE HTTPS` — because an unset proxy and a misconfigured one need
different fixes.

---

## Layout

```
App.js                  root: save, purchases, which screen is up
app.config.js           folds SIGNAL_PROXY_URL into the Expo config
index.js                Expo entry point
src/
  content/              the writing — bands, 18 calls, 15 tapes, glyphs
    calls/              one file per band
  engine/               pure game logic, no React (this is what the tests cover)
    save.js             save shape, v1→v2 migration, reward + sanity math
    progression.js      band unlocks, available calls, generation credits
    generation.js       clamping AI-generated calls into playable ones
    proxyUrl.js         resolving and vetting the Infinite Signal endpoint
    settings.js         player preferences, kept apart from progress
  feedback/             the one facade screens use for sound + haptics
  audio/                the sound bus — manifest (data), assets, player
  haptics/              patterns (data) + the expo-haptics adapter
  motion/               shared durations/easings, reduce-motion hook
  services/             boundaries: storage, billing, the signal proxy client
  calls/                the five call players + the type→player registry
  screens/              title, boot, dial, call, sign-off, archive, store, settings
  components/           wordmark, static burst, CRT, fade, buttons, log
  hooks/                line reveal, countdown
  theme/                colors, type, spacing, safe-area top
plugins/                Expo config plugins (native debug symbols)
proxy/
  app.js                createApp({client}) — injectable, so it can be tested
  prompt.js             system prompt + structured-output schema
scripts/gen-assets.py   icons, splash and static frames, from geometry
scripts/gen-audio.py    synthesizes the sound set
__tests__/              engine, content, audio and proxy tests
```

The engine is free of React and React Native imports, and the proxy takes its
Anthropic client as a parameter — which is why the whole suite runs on plain
Jest with no renderer and no native mocking, and why the proxy's routes can be
driven over real HTTP against a stub.

## Develop

```bash
npm install
npm test          # 162 tests: engine, content, audio, proxy, build plugin
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

## Publishing

**[`docs/PLAY_CONSOLE.md`](docs/PLAY_CONSOLE.md)** has every field Play Console
asks for, ready to paste — listing copy with character counts, categorisation,
data safety answers, content-rating guidance, IAP SKUs, and the build/submit
commands. The 512×512 store icon and 1024×500 feature graphic are generated
into `assets/store/`; screenshots you have to capture yourself.

`docs/privacy-policy.md` is the policy Play requires a public URL for; the
guide explains hosting it on GitHub Pages.

Two things to know before you start:

- **Billing is not wired.** A release build refuses to unlock paid content
  rather than granting it free — see `BILLING_WIRED` in
  `src/services/billing.js`. Ship free first, or wire billing before creating
  in-app products.
- **`expo-audio` wants `RECORD_AUDIO` by default.** The plugin is configured in
  `app.json` to drop it along with the foreground-service permissions, so the
  listing does not claim microphone access for a game that never records.

Crash reporting needs no manual step: `plugins/withNativeDebugSymbols.js`
embeds native debug symbols in the AAB, so Play symbolicates crashes in the
React Native and Hermes libraries automatically and never asks for an upload.
There is no ProGuard mapping file to go with it — minification is off.

**Three native modules were added after v1** — `expo-audio`, `expo-haptics`
and `expo-constants`. Native modules cannot ship over the air, so the next
release needs a real EAS build rather than an `expo-updates` push.

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

Sound, haptics, motion and the title screen all arrived after the rebuild —
see **Feel** and **Sound** above. v1 had none of them.

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
