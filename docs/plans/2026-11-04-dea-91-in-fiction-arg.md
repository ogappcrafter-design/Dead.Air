# DEA-91 — In-fiction ARG layer

**Status:** implemented (app layer)
**Ticket:** DEA-91 ARG integration / real-world mystery layer
**Ruling (2026-11-04):** the ticket's real-world infrastructure — callable phone
numbers (Twilio) and an external website — is rejected. Only the **in-world
fiction direction** is approved: the ARG's energy, kept inside the game.

## What this is

A hidden-mystery layer that lives entirely inside the broadcast. There is no
phone number to dial, no site to visit, no account to make. The trail is made of
things the console was already doing — scanline interference on the CRT and text
bleeding through the CLASSIFIED band — and it resolves into one hidden call.

The design thesis is unchanged from the ticket: **player agency**. Nothing
forces the trail on anyone. A player who never looks at the static keeps the base
game exactly as it was and loses only the hidden call.

## Craft grounding

- **Season 1 "Hold Music" spine.** Relay 23 was decommissioned on 11.04.87 and
  the line stayed open; Twenty-Three clocked out and left the chair warm; the
  finale is about who pays for a line that is held. The ARG does not invent a
  second mythology — it reads the paperwork behind that one.
- **47 stations.** `data/relayPointCall.ts` (DEA-59) already establishes the
  network as forty-seven stations, each operated by a relay point. The trail's
  answer is the register row that was left blank so the count would come out
  right.
- **Classic ARG discipline.** Clues have diegetic reasons to exist (a register
  has rows; a carrier has a tone; a maintenance channel has a work order), the
  trail rewards attention rather than payment, and it **resolves** — one decode
  artifact, one fragment set, one call.

## Where it lives, and why

The CRT treatment exists twice in this repo:

| Layer    | Treatment                                                                  | Can host a decodable artifact?                                                                       |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Expo app | `components/shared/CRTEffects.tsx` — 20 drifting scanline Views            | Yes: 13 mono text rows rendered inside the same drifting layer                                       |
| Godot    | `godot/assets/shaders/crt_postprocess.gdshader` — full-screen post-process | No: barrel distortion, chromatic aberration, subpixel mask and per-frame noise destroy cell geometry |

The ARG is implemented on the **app layer**, where the shipped engine lives
(bands, `data/unlockGraph.ts`, Season 1, the call registry) and where the
deterministic-RNG and jest conventions already exist. The Godot CRT shader is
left untouched.

Because the app's scanline overlay is 20 Views — deliberately reduced from 80
for render cost — the trace is **not** 169 block Views. It is a 13×13 matrix
rendered as 13 monospace text rows inside the drifting scanline layer, so it
costs less than the existing scanline stack.

### Honest limitation: it is not a QR code

A literal QR symbol cannot survive the app's overlay budget or the Godot shader's
distortion. What ships is the closest in-world equivalent: a **finder-anchored
glyph matrix** with QR's visual grammar (three 3×3 finders, timing row and
column at index 6) carrying a real 6-bit-per-character payload. It is genuinely
decodable — by screenshot and by hand, or through the in-game DECODE action,
which runs the actual encode → decode round-trip rather than a lookup keyed on
the trace id.

## The trail

All conditions read state the shipped app actually advances: `useRadioStore`
(band, frequency), `useGameStore` (static, `receivedCalls`), plus a session
dwell counter for time held on the band.

| #   | Piece                      | Band       | Dwell          | Static | Prior unlock                        | Reward                                        |
| --- | -------------------------- | ---------- | -------------- | ------ | ----------------------------------- | --------------------------------------------- |
| 1   | Trace `RELAY 23 11.04.87`  | CLASSIFIED | ≥ 10s          | ≥ 35   | call 12                             | register row 23                               |
| 2   | Bleed "count"              | CLASSIFIED | ≥ 15s          | ≥ 45   | call 12                             | the register's arithmetic is wrong on purpose |
| 3   | Trace `RELAY 46 104.7`     | CLASSIFIED | ≥ 20s          | ≥ 55   | call 13, row 23                     | register row 46                               |
| 4   | Bleed "date"               | CLASSIFIED | ≥ 25s          | ≥ 65   | call 13, row 23, count bleed        | the date is a door, not a record              |
| 5   | Trace `RELAY 47 UNLISTED`  | CLASSIFIED | ≥ 30s          | ≥ 75   | call 14 or Season 1's 16005, row 46 | register row 47                               |
| 6   | Bleed "carrier"            | CLASSIFIED | ≥ 35s          | ≥ 85   | same, row 46, date bleed            | tune the carrier, not the station             |
| 7   | **Hidden call** `RELAY·47` | CLASSIFIED | trail resolved | —      | tuned to **104.7**                  | the unlisted row answers                      |

The assembled answer is **designation 47 · date 11.04.87 · carrier 104.7**.
Rows 46 and 47 share a carrier, which is why the register could list one and
not the other; the count stays correct because the row was left blank.

Tuning is the deliberate act. Holding CLASSIFIED at 104.7 — the console prints
one decimal, so a displayed `104.7` always falls inside the ±0.05 window — arms
a `CARRIER LIVE` prompt. The player presses **ANSWER**; the call is never
auto-started, so the one-shot payoff cannot be spent by tuning past the carrier
while looking at something else.

### Temporal axis

The brief asked for "time in the shift". The first cut used
`gameStore.shiftsCompleted` — and that was wrong: `incrementShiftsCompleted` is
only called from `useNightShift.endShift`, and `useNightShift` is not mounted on
the radio screen, so the counter only ever reaches 1 (the tutorial-completion
effect in `useEndlessNight`). Gating on it made **every piece of the trail
unreachable dead content**.

The temporal axis is therefore **dwell: seconds held on the CLASSIFIED band this
session**. It is measurable, it advances every session, it resets when the
player tunes away (the carrier has to be held, not visited), and it is exactly
what the fiction asks — the trace panel's hint, "hold still and read it", is
literal. **Accumulated static** stays as the depth gauge: the deeper into the
static, the more the carrier bleeds.

Dwell is tracked in the hook (5-second tick, so the radio does not re-render
every second) and is deliberately session-scoped rather than persisted.

## Silent degradation

- No new screen, no new nav entry, no badge, no notification.
- The trail surface renders nothing until the player has decoded or filed
  something, or a piece is currently visible.
- The glyph trace rides the scanline layer, so turning CRT/scanline density off
  removes it. That is consistent with the contract: a player who turns the CRT
  off is not investigating.
- The hidden call is registered lazily (`registerArgHiddenCall`) only when the
  player answers an armed carrier, so no pool, scheduler, daily rotation or
  achievement path can ever reach it.

## Determinism

`engine/arg/GlyphCodec.ts` seeds the dither field with
`arg:<traceId>:phase:<receivedCalls.length>` through the repo's existing
`SeededRNG` (mulberry32). The same trace at the same phase renders an identical
matrix; the payload never varies as the phase advances — only the noise around
it. Both properties are tested (`__tests__/engine/arg/GlyphCodec.test.ts`),
alongside a full encode → decode round-trip for every authored payload.

Unlit cells render as spaces, never middle dots: a missing or non-monospaced
glyph would change the advance width and shear the grid, destroying
hand-decoding.

## Files

```
data/arg/{types,registry,traces,fragments,hiddenCall,index}.ts   content + conditions
engine/arg/GlyphCodec.ts                                         13x13 matrix codec (pure)
engine/arg/ArgTrail.ts                                           gating + resolution (pure)
store/argTrailStore.ts                                           persisted discovery log
hooks/useArgTrail.ts                                             wiring + hidden-call arming
components/arg/ScanlineTrace.tsx                                 matrix inside the scanline layer
components/arg/ArgSignalBleed.tsx                                bleed + trail log surface
components/shared/CRTEffects.tsx                                 scanline `trace` slot
components/shared/CRTView.tsx                                    `scanlineTrace` pass-through
app/radio/index.tsx                                              mount point
engine/calls/callManagerInstance.ts                              registerArgHiddenCall (lazy)
```

The hidden call lives at id **16100** in the reserved seasonal block (15000+),
clear of Season 1's 16000–16007. `data/calls.js` is untouched.

## Deliberately not built

- Real QR error correction / versioning — the matrix is a fixed 13×13 codec.
- Twilio numbers, external sites, out-of-game channels — rejected by the ruling.
- A dedicated ARG screen or collectible UI — the trail lives on the radio, where
  the fiction does.
- Season-store gating — the season registration layer is not mounted yet, so
  Season 1's CLASSIFIED call (16005) is accepted as an _alternative_ prior
  unlock rather than a requirement.
