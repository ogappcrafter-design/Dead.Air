# Migration Notes — DEA-149

React Native → Godot asset migration notes. Documents palette discrepancies, moral choice tracking, audio asset status, and out-of-scope items.

## Band Colors (Sacred Bands)

Source: `data/calls.js` BANDS array — verbatim.

| ID  | Name       | Freq     | Color (Hex) | Color (Godot)  | Unlock At |
| --- | ---------- | -------- | ----------- | -------------- | --------- |
| 0   | LIVING     | 88.7 FM  | #FF8C00     | 1, 0.549, 0, 1 | 0         |
| 1   | LIMINAL    | 102.3 FM | #CCFF00     | 0.8, 1, 0, 1   | 4         |
| 2   | LOST       | 117.8 AM | #00FFD0     | 0, 1, 0.816, 1 | 8         |
| 3   | CLASSIFIED | ███.█ FM | #FF3366     | 1, 0.2, 0.4, 1 | 12        |
| 4   | ████████   | ???.?    | #FFFFFF     | 1, 1, 1, 1     | 15        |

### Band Vibes (from BAND_VIBES)

- **LIVING**: Eerily normal callers. Mundane conversations that reveal something deeply wrong in the last line. Suburban horror. The banal made sinister.
- **LIMINAL**: Time loops, echoes, callers from repeated moments or wrong timelines. Liminal spaces between was and is.
- **LOST**: The dead. The missing. Those who needed to say one last thing before they couldn't. Emotional, devastating, and real.
- **CLASSIFIED**: Government black sites, rogue AI, whistleblowers, classified transmissions intercepted by accident.
- **████████**: Something ancient. The frequency itself gaining awareness. Transmissions from the dawn of radio. Things with no name.

## CRT Color Palette

### theme.ts (React Native shipped palette)

| Token        | Hex     | Usage                   |
| ------------ | ------- | ----------------------- |
| background   | #030303 | App background          |
| amber        | #FF8C00 | Band 0 / primary accent |
| green        | #39FF14 | CRT text / signal       |
| red          | #FF3131 | Warning / danger        |
| dimGreen     | #1A5C0A | Dimmed text             |
| surface      | #0A0A0A | Card surface            |
| surfaceLight | #1A1A1A | Hover surface           |
| border       | #2A2A2A | Border / divider        |
| text         | #E0E0E0 | Body text               |
| textMuted    | #666666 | Muted text              |

Fonts: VT323 (mono), Eater (display)

### GDD Palette (docs/plans/redesign-gdd.md)

| Token      | Hex     | Usage              |
| ---------- | ------- | ------------------ |
| background | #0A0A0A | Station background |
| amber      | #FFA500 | Primary accent     |
| green      | #00FF41 | CRT text / signal  |
| red        | #FF3300 | Warning / danger   |
| white      | #FFFFFF | Pure text          |

### Discrepancy: theme.ts vs GDD

The shipped React Native palette (theme.ts) differs from the GDD palette:

- Background: #030303 (RN) vs #0A0A0A (GDD) — GDD is slightly lighter
- Amber: #FF8C00 (RN) vs #FFA500 (GDD) — GDD uses standard orange, RN uses dark orange
- Green: #39FF14 (RN) vs #00FF41 (GDD) — Different green hues
- Red: #FF3131 (RN) vs #FF3300 (GDD) — Slightly different red

**Resolution**: GDD is source truth per task spec. Band colors in `band_config.tres` use calls.js values (matching theme.ts), as those are the shipped originals. Godot rendering code should use GDD palette for UI/post-processing. This discrepancy is noted for downstream tasks (DEA-97, DEA-99, DEA-107) to resolve.

**DEA-107 update:** The CRT post-processing shader (`assets/shaders/crt_postprocess.gdshader`) and controller (`src/visual/crt_postprocess.gd`) use the GDD palette (amber #FFA500, green #00FF41, red #FF3300, background #0A0A0A). The post-processing color palette discrepancy is resolved; remaining UI palette work tracked under DEA-97 and DEA-99.

### No Tailwind Config

No `tailwind.config.js` or `tailwind.config.ts` was found in the repository. The React Native app uses theme.ts directly.

## Moral Choice Tracking

### Source: GDD Only (not in RN data)

The GDD (`docs/plans/redesign-gdd.md`) defines a Moral Choice Tracking System (§Moral Choice Tracking System) that is **not present in the React Native source data**. The RN CALLS array has choices with `outcome`, `sanityDelta`, `staticMult`, `tape`, and `tapeName` fields — but no explicit moral choice metadata.

The GDD specifies tracking these variables:

- `empathy`: choices that prioritize others' wellbeing
- `self_preservation`: choices that protect the player
- `curiosity`: choices that seek knowledge despite risk
- `sacrifice_count`: cumulative sacrifices made

### GDD-identified moral choice calls:

- **Call #0** (NUMBER DISCONNECTED): Answering "Yes" vs "No" vs "Wrong number"
- **Call #2** (THE COLLECTOR): Accepting or refusing the collector's offer
- **Call #9** (FOUND SIGNAL): How to respond to the signal
- **Call #12** (COURTESY CALL): Three choices with moral weight
- **Call #16** (THE CHOICE): The climactic moral decision

**Status: needs-decision upstream.** The moral choice system is a GDD addition not present in shipped RN data. Downstream tasks should implement this based on GDD spec, not RN source. The calls.json preserves all choice data verbatim; moral choice tracking variables should be added in the Godot gameplay layer.

## Audio Assets

**No audio files found in repository.** Searched for .ogg, .mp3, .wav extensions across entire repo. No audio assets exist to migrate.

The GDD specifies an 8-bus audio layout (MASTER, ROOM_TONE, RADIO_AMBIENT, CALL_AUDIO, DREAD_LAYER, STINGER, SILENCE, UI) which is already configured in `godot/default_bus_layout.tres`. The Godot project adds a 9th bus, `TAPE`, for the collectible tape playback system. Audio assets will need to be created or sourced separately.

## Out-of-Scope Items (Flagged: needs-decision)

The following RN data modules exist but are **not in GDD migration scope** for DEA-149:

| Module                                                | Description                        | Status         |
| ----------------------------------------------------- | ---------------------------------- | -------------- |
| `data/choiceGates.ts`                                 | Choice gating logic                | needs-decision |
| `data/tapePacks.ts`                                   | DLC tape pack definitions          | needs-decision |
| `data/tutorialCalls.ts`                               | Tutorial-specific call data        | needs-decision |
| `data/unlockGraph.ts`                                 | Band/feature unlock progression    | needs-decision |
| `data/relayPointCall.ts`                              | Relay point special call           | needs-decision |
| `data/ngPlusContent.ts`                               | New Game Plus content              | needs-decision |
| `data/fragments/`                                     | Fragment data modules              | needs-decision |
| `data/atmosphericPacks/`                              | Atmospheric audio pack data        | needs-decision |
| `data/tapes.ts` DLC_TAPES (tape-016 through tape-030) | 15 DLC tapes (premium IAP content) | needs-decision |

### Extra Bands (not in GDD scope)

`data/bands.ts` defines 8 bands, but only 5 are sacred (in calls.js). The extra 3 are:

- WEATHER (160-164 MHz, #4488FF)
- PIRATE (164-168 MHz, #FF44FF)
- HISTORICAL (168-172 MHz, #888888)

These are **not** in `data/calls.js` BANDS and are not part of the GDD sacred band system. Flagged as needs-decision for downstream.

### Call Types

`lib/constants.ts` defines 10 call types: JUST_LISTEN, DEAD_AIR, RIGHT_ANSWER, SIGNAL_DECODE, STAY_CALM, RECORDING, MULTI_CALLER, TIMING, PUZZLE, CONVERSATION. All 10 are represented in `call_types.gd`.

`lib/constants.ts` also defines MAX_SANITY=100 and MAX_STATIC=100, which are gameplay constants (not data assets) and belong in the Godot gameplay layer.

## File Inventory

### Created by DEA-149

| File                                | Description                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `godot/src/data/calls.json`         | 18 sacred calls, all fields verbatim (is_sacred flag added to 5 shift-finales: ids 3, 5, 9, 13, 17) |
| `godot/src/data/calls.schema.json`  | JSON Schema (draft-07) for calls.json                                                               |
| `godot/src/data/call_data.gd`       | Runtime loader + validator                                                                          |
| `godot/src/data/call_types.gd`      | CallType enum (10 types)                                                                            |
| `godot/src/data/band_data.gd`       | BandData resource class                                                                             |
| `godot/src/data/band_config.gd`     | BandConfig container resource                                                                       |
| `godot/src/data/band_config.tres`   | 5 sacred bands resource file                                                                        |
| `godot/src/data/tape_data.gd`       | TapeData resource class                                                                             |
| `godot/src/data/tape_library.gd`    | TapeLibrary container resource                                                                      |
| `godot/src/data/tapes.tres`         | 15 base tapes + 3 recording tapes (18 total, DEA-98 added recording tapes)                          |
| `godot/src/data/MIGRATION_NOTES.md` | This file                                                                                           |
| `godot/src/data/validation.gd`      | Validation script                                                                                   |
