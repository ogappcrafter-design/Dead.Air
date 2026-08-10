# Google Play Console — everything to paste

Work top to bottom. Each block is ready to copy; character counts are shown
against Play's limits so nothing gets truncated on paste.

> **Read this first — two decisions before you start.**
>
> **1. Billing is not wired.** The store UI exists, but there is no billing
> library in the project. A release build now *refuses* to unlock paid content
> rather than granting it for free (`src/services/billing.js`). So:
>
> - **Path A — ship free first (recommended).** Publish with no in-app
>   products. Players get the LIVING band's four calls. This gets your whole
>   pipeline — signing, review, tracks — working end to end with nothing at
>   stake. Skip §8 entirely.
> - **Path B — full launch.** Wire billing first (RevenueCat's
>   `react-native-purchases` or `react-native-iap`), flip `BILLING_WIRED` to
>   `true`, then do §8. **Do not create in-app products for a build that
>   cannot complete a purchase** — listing products the app can't sell is a
>   policy problem, not just a broken feature.
>
> **2. Screenshots must be real.** Play requires 2–8 phone screenshots and they
> must show actual app content. I cannot produce those — see §5 for the exact
> capture recipe. It takes about five minutes.

---

## 1. Create the app

**Play Console → All apps → Create app**

| Field | Value |
|---|---|
| App name | `Dead Air` |
| Default language | English (United States) – en-US |
| App or game | **Game** |
| Free or paid | **Free** (in-app purchases are declared separately) |

Tick both declarations (developer programme policies, US export laws).

---

## 2. Store listing

**Grow → Store presence → Main store listing**

### App name — 8/30

```
Dead Air
```

Longer alternative if you want the genre in the name — 26/30:

```
Dead Air: Late Night Radio
```

### Short description — 66/80

```
A paranormal radio game. Answer the calls. Something is listening.
```

### Full description — 2,268/4,000

```
You are the only DJ still on air after midnight.

The calls that come in are not normal. Some are from people who are grieving. Some are from people who are already dead. Some are from a government line that should not be reaching you. And one, eventually, is from the frequency itself.

DEAD AIR is a quiet horror game about listening. No combat. No energy timers. No ads. Just a radio desk, five frequency bands, and eighteen people who need you to pick up.

◈ HOW IT WORKS

Tune to a band. Answer a waiting call. Each one plays out differently:

• JUST LISTEN — Do nothing. Some calls only need a witness.
• DEAD AIR — Hold a near-silent line and wait it out.
• RIGHT ANSWER — Choose what to say. The ending changes.
• SIGNAL DECODE — Tap back a five-glyph sequence.
• STAY CALM — Keep your nerve while the caller loses theirs.

Every call costs you something and pays you something. Sanity drifts with your choices. Static accumulates. Some calls leave a tape behind — and a complete 15-tape archive means choosing right, not just playing everything.

◈ FIVE BANDS

88.7 FM — LIVING. Ordinary callers, ordinary conversations, something wrong in the last line.
102.3 FM — LIMINAL. Loops, echoes, and callers from the wrong timeline.
117.8 AM — LOST. The dead and the missing, saying the thing they never got to say.
CLASSIFIED — Transmissions you were not meant to intercept.
████████ — Something older than radio, and it knows your name.

◈ INFINITE SIGNAL

When the written calls run out, the frequency keeps going. Infinite Signal generates new callers in the voice of whichever band you are tuned to, so the station never quite closes.

◈ NO NONSENSE

No ads. No energy meters. No daily rewards. No account, and no sign-up. Your progress lives on your phone and nowhere else. Sound and haptics each have an off switch, and the game follows your system's reduce-motion setting.

Answer every call. Collect every tape. And whatever you do — don't hang up.

CONTENT WARNING: grief, death, loss, and psychological horror. Several transmissions are built on emotionally real scenarios.
```

---

## 3. Graphics

Two of the three are generated and ready to upload:

| Asset | File in this repo | Spec |
|---|---|---|
| App icon | `assets/store/play-icon-512.png` | 512×512, 32-bit PNG ✔ |
| Feature graphic | `assets/store/play-feature-1024x500.png` | 1024×500, 24-bit PNG, no alpha ✔ |
| Phone screenshots | **you capture** — see §5 | 2–8, 9:16, no alpha |

Regenerate either with `npm run assets`.

---

## 4. Categorisation and contact

**Grow → Store presence → Store settings**

| Field | Value |
|---|---|
| App category | **Game** |
| Category | **Adventure** |
| Tags | Horror · Narrative · Interactive Fiction · Single player · Offline |
| Email address | `outcastingaway@gmail.com` |
| Website | *(optional — your GitHub repo or itch page)* |
| Phone | *(optional, leave blank)* |
| External marketing | Leave unticked unless you plan Play-driven ads |

---

## 5. Screenshots — the five-minute recipe

Play needs at least two. These four show the game best:

1. **Title screen** — after the wordmark has resolved.
2. **The dial** — LIVING band, call list visible.
3. **A call mid-transmission** — HAROLD is the strongest one; wait until four
   or five lines are on screen.
4. **A decode or the sign-off readout** — shows there is mechanics, not just text.

Capture them:

```bash
# Android emulator or a device over USB
npx expo run:android          # or install the preview APK from EAS
adb exec-out screencap -p > shot-1.png
```

Or take them on the phone and pull them off. Requirements Play enforces:
**PNG or JPEG, no alpha channel, each side between 320 px and 3,840 px, 9:16
portrait.** A standard 1080×2400 phone screenshot satisfies all of that.

> If a screenshot has an alpha channel, Play rejects it. `adb screencap`
> output is fine.

---

## 6. App content declarations

**Monetise/Policy → App content.** Every item on this checklist must be green
before you can release. Answers for this app:

| Section | Answer |
|---|---|
| **App access** | All functionality is available without restrictions. No login. |
| **Ads** | **No**, this app does not contain ads. |
| **Content rating** | Complete the questionnaire — see §7. |
| **Target audience** | Age groups: **13–15, 16–17, 18+**. Do **not** tick under-13. |
| **Appeals to children** | No. |
| **News app** | No. |
| **COVID-19 tracing/status** | No. |
| **Data safety** | See below. |
| **Government app** | No. |
| **Financial features** | **None of these.** (In-app purchases are not "financial features".) |
| **Health apps** | No. |
| **Privacy policy** | URL — see §9. |

### Data safety — the exact answers

**Does your app collect or share any of the required user data types? → NO**

That is accurate: the app has no accounts, no analytics, no ad SDKs, and no
text input. Progress is stored only on the device, which Play explicitly does
*not* count as collection. The only outbound request the app can make is
Infinite Signal, and its payload is a band number plus caller names drawn from
the game's **own** written content — none of Play's enumerated data types.

Then answer the follow-ups:

| Question | Answer |
|---|---|
| Data encrypted in transit | Yes *(the app refuses non-HTTPS endpoints)* |
| Users can request data deletion | Not applicable — but the app does provide **Settings → Erase Station** |

> **One nuance, so it doesn't surprise you later.** If you deploy the Infinite
> Signal proxy, its host (Cloud Run) keeps ordinary web access logs that
> include IP addresses, for security. Google's Data Safety guidance treats
> security logging like this as out of scope for the form, and the app itself
> transmits no personal data — so "No" remains the accurate answer. The
> privacy policy discloses the logs anyway. If you never deploy the proxy, the
> app makes **zero** network requests and the question is moot.

---

## 7. Content rating questionnaire

**Policy → App content → Content rating.** Category: **Game**.

Suggested answers, but **read them against the game yourself** — this is a
declaration you are making, and a wrong answer can get an app pulled later.

| Question area | Answer | Why |
|---|---|---|
| Violence — realistic or graphic | **No** | Nothing is depicted; deaths are referred to, never shown |
| Violence — cartoon/fantasy | No | |
| Sexuality / nudity | **No** | None |
| Profanity / crude humour | **No** | No profanity in any of the 18 calls |
| Controlled substances | **No** | None |
| Gambling / simulated gambling | **No** | None |
| **Horror / fear themes** | **YES** | This is the core of the game |
| **References to death / disturbing content** | **YES** | Callers are frequently deceased; grief is the central subject |
| User-generated content / user interaction | **No** | Single player, no chat, no sharing |
| Shares user location | **No** | |
| Allows purchase of digital goods | **Path A: No · Path B: Yes** | Depends on whether you ship IAP |

**Read this call before answering the self-harm question.** One transmission
(`FREE SPIRIT`, LOST band, in `src/content/calls/lost.js`) is a deceased caller
saying dying "was easier than you'd think". It is written as peaceful
acceptance rather than encouragement, and there is no method or instruction
anywhere in the game — but it is the one line a rater could read as touching on
suicide. Read it in full and answer honestly. If your questionnaire asks
whether the app *depicts or encourages* self-harm, the accurate answer is
**No**.

Expect roughly **ESRB Teen / PEGI 12–16 / USK 12**.

---

## 8. In-app products — Path B only

**Skip this entirely on Path A.** Only do this once billing is actually wired
and `BILLING_WIRED = true`.

**Monetise → Products → In-app products → Create product.** Both are
**one-time purchases** (managed products, non-consumable).

**Product 1**

| Field | Value |
|---|---|
| Product ID | `dead_air_base` |
| Name (17/55) | `Base Transmission` |
| Description (123/200) | `Unlocks all five frequency bands and the 14 remaining hand-written transmissions. The full story, every signal, every tape.` |
| Default price | **USD 1.99** |

**Product 2**

| Field | Value |
|---|---|
| Product ID | `dead_air_infinite` |
| Name (15/55) | `Infinite Signal` |
| Description (127/200) | `Unlimited AI-generated calls. Each one unique, in the voice of whichever band you are tuned to. The frequency never goes quiet.` |
| Default price | **USD 0.99** |

The product IDs must match `src/services/billing.js` exactly — the app looks
them up by those strings.

---

## 9. Privacy policy URL

Play requires a public URL, not a file. The policy is written and ready at
`docs/privacy-policy.md`. Fastest way to host it:

1. Merge this branch into `main` (or just point Pages at this branch —
   either works; Pages can deploy from any branch).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → pick the
   branch holding these files, folder **`/docs`** → Save.
3. Wait about a minute, then your URL is:

```
https://ogappcrafter-design.github.io/Dead.Air/privacy-policy
```

Paste that into **Policy → App content → Privacy policy**, and into the
**Store listing** privacy field if prompted.

> If you'd rather not enable Pages, any public URL works — a Gist, Notion page,
> or your own site. It just has to be reachable without a login.

---

## 10. Build and upload

### One-time: link Play to EAS

1. **Play Console → Setup → API access** → link a Google Cloud project.
2. In Google Cloud, create a **service account**; download its **JSON key**.
3. Back in **Play Console → Users and permissions**, invite that service
   account and grant **Release to testing tracks** and **Release to
   production**.
4. Save the key in the repo root as `play-service-account.json`.
   **It is already gitignored — never commit it.**

### Build

```bash
npm install -g eas-cli
eas login

# Optional: set the Infinite Signal endpoint for this build
export SIGNAL_PROXY_URL=https://your-proxy.run.app

eas build --platform android --profile production   # produces an .aab
```

`eas.json` is configured with `autoIncrement`, so every production build gets a
fresh `versionCode` and Play will not reject it as a duplicate.

### Upload

The very first upload has to go through the Console so Play can set up app
signing:

**Release → Testing → Internal testing → Create new release** → upload the
`.aab` EAS produced → let Play manage the signing key (**Play App Signing**,
the default — accept it).

Every release after that can go straight from the CLI:

```bash
eas submit --platform android --profile production
```

### Suggested first path

Internal testing → Closed testing → Production. Internal testing goes live in
minutes and does not need a content review, so it is the quickest way to prove
the whole chain works before anything is public.

---

## 11. Pre-flight checklist

- [ ] `versionCode` handled by EAS `autoIncrement` — nothing to set by hand
- [ ] `applicationId` is `com.deadair.app` — **permanent once published; you cannot change it**
- [ ] Permissions the build declares: `INTERNET`, `ACCESS_NETWORK_STATE`, `MODIFY_AUDIO_SETTINGS`, `VIBRATE` — all non-sensitive, none need justification
- [ ] `RECORD_AUDIO` is explicitly blocked in `app.json`, so the listing will not claim microphone access
- [ ] No ads SDK, no analytics SDK — Data Safety stays "no data collected"
- [ ] Privacy policy URL resolves publicly
- [ ] 2+ real screenshots, no alpha channel
- [ ] Content rating questionnaire submitted
- [ ] Decided Path A (free, no IAP) or Path B (billing wired first)
