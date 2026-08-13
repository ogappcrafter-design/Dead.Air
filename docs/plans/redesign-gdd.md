# Dead Air Radio — Complete Redesign GDD v2

## Identity

- **Working Title:** Dead Air Radio
- **Genre:** Survival horror adventure (fixed-camera exploration + radio mechanics)
- **Platform:** PC (primary), console (secondary), mobile (tertiary)
- **Engine:** Godot 4 (phases 1-3), evaluate Unreal 5 for phase 4
- **Perspective:** Fixed/semi-fixed camera (RE-style), first-person radio segments
- **Target Duration:** 8-12 hours (main campaign), replayable through procedural calls
- **Save System:** Fixed save points (cassette tapes in safe rooms), manual save at safe rooms only, no autosave
- **Control Scheme:** Gamepad primary (dual-analog), keyboard/mouse secondary

---

## The Pitch

**Elevator Pitch:**
You operate a late-night radio station. Callers tell you things that shouldn't be real. Then the station goes dark, and you realize the calls were never coming through the radio — they were coming through _you_. You take the radio and walk into the places the callers described, trying to survive what's on the other end.

**Core Fantasy:**
A radio operator who becomes a witness, then a participant, in something ancient that uses frequencies to reach through time and death. The radio is both your lifeline and the thing that's killing you.

**Unique Hook:**
The radio mechanics ARE the horror system. Tuning, signal strength, static, and band selection aren't minigame abstractions — they're your only weapon, your map, your flashlight in the dark. You navigate by sound. You fight by tuning. You die when the signal drops.

---

## Emotional Foundation

### Primary Feelings (the blend)

**1. Unsettling Wrongness — Nightmare Ned**
The mundane turned sinister. A grandmother's voice on the radio that knows your name. A garden report that takes 14 years too long. The horror isn't jump scares — it's the growing realization that something fundamental is _wrong_ with the world behind the radio. Childlike familiarity curdled into menace. The station should feel like a place you've been a thousand times, until it doesn't.

**2. Helplessness — Clock Tower**
You cannot fight what's on the radio. You can only listen, survive, and sometimes run. Some callers aren't calls at all — they're _entities_ pushing through the signal, and your only option is to endure the conversation or cut the line (which has consequences). When the horror bleeds into physical space, you don't fight — you hide, you flee, you survive. The player should feel small.

**3. Moral Dread — IHNMAIMS**
Every choice costs something. There are no "good" options, only less-bad ones. Some calls give you a tape but cost your composure. Some calls spare your sanity but damn the caller. The game remembers what you chose and the world changes accordingly. Winning doesn't mean surviving — it means deciding what you're willing to lose.

### Secondary Textures

- **Resident Evil** — Campy B-movie framing that's genuinely effective underneath. Fixed camera angles that make you dread what you can't see. Save rooms as momentary safety. Inventory tension.
- **Half-Life** — Environmental audio as storytelling. Silence as a weapon. You're not a soldier — you're a radio operator forced into something. Seamless narrative, no cutscenes.
- **Illbleed** — Multi-dimensional stress. Composure, dread, and signal are separate meters that interact. You manage your internal state as much as the external threat.
- **Doom** — When the dread meter peaks, the audio becomes aggressive. Kinetic. The radio fights back. Sound as adrenaline.
- **Are You Afraid of the Dark?** — Anthology framing. Each major location is a self-contained tale with its own intro and outro, wrapped in the overarching narrative.

---

## Game Structure

### Four Phases — Overview

```
PHASE 1: THE STATION          PHASE 2: THE BREAK
(2-3 hours, 5 shifts)         (30 min, 1 sequence)
─────────────────────────     ─────────────────────────
Night shift operator.          The station is no longer safe.
Calls come in.                 Something came through.
You sit. You listen.           You grab the portable radio.
You manage stress meters.       You leave.
Bands unlock.
Tapes accumulate.

PHASE 3: THE JOURNEY          PHASE 4: THE DESCENT
(4-6 hours, 5 locations)      (2-3 hours, 1 location)
─────────────────────────     ─────────────────────────
Explore locations tied         You find the source.
to the callers.                The origin transmission.
Carry the portable radio.      You face what answered.
Tune bands in the field.        The radio becomes something else.
Environmental puzzles.          No clean ending.
Take calls in haunted places.
```

### Phase 1: The Station — Detailed Breakdown

**Duration:** 2-3 hours across 5 night shifts

#### Shift Structure

Each shift follows a strict rhythm:

```
SHIFT START
├── Pre-shift: Free exploration (2-3 min)
│   ├── Walk station, examine objects
│   ├── Check tape collection
│   ├── Tune radio, listen to ambient bands
│   └── Station wrongness events (see §Station Degradation)
│
├── Calls begin (8-15 min)
│   ├── 3-5 calls per shift (sacred + procedural)
│   ├── Between calls: 30-90 sec breather
│   │   ├── Signal regen opportunity
│   │   ├── Composure partial regen
│   │   └── Station exploration (limited)
│   └── Shift's final call is always a sacred call
│
├── Post-shift: Free exploration (2-3 min)
│   ├── Tape review
│   ├── Station changes noted
│   ├── Save opportunity (cassette in booth)
│   └── Band unlock notifications
│
└── SHIFT END → transition to next shift (time skip)
```

#### Shift-by-Shift Content

**SHIFT 1 — "First Night" (Tutorial Shift)**

- Available bands: LIVING only
- Calls: Call #0 (THE WRONG NUMBER), Call #1 (WRONG NUMBER), Call #3 (HAROLD)
- Tutorial overlay: tuning mechanics, signal meter, composure introduced
- No dread meter yet (introduced Shift 2)
- Station state: Clean, normal, comfortable. Nothing wrong... yet.
- Wrongness events: 1 minor (the bathroom mirror reflection blinks)
- No save room available (saves unlock Shift 2)

**SHIFT 2 — "Settling In" (LIMINAL Unlocked)**

- Available bands: LIVING, LIMINAL
- Calls: Call #2 (THE COLLECTOR), Call #4 (THE LOOP), Call #5 (3:47 AM)
- Dread meter introduced (starts at 0, builds with calls)
- Tutorial overlay: dread meter, band switching
- Station state: Subtle shifts. Coffee mug moved overnight. Chair angled differently.
- Wrongness events: 2 (hallway light flickers rhythmically; the back office door is locked but you hear breathing)
- Save room: Booth cassette — first save available

**SHIFT 3 — "The Dead" (LOST Unlocked)**

- Available bands: LIVING, LIMINAL, LOST
- Calls: Call #6 (YESTERDAY'S CALL), Call #7 (ECHO), Call #8 (GUARDIAN), Call #9 (MISSING PERSONS)
- Tutorial overlay: recording mechanics unlocked (radio upgrade)
- Station state: Equipment hum changes pitch. The fluorescent lights buzz louder. The bathroom mirror now shows a 1-frame delay.
- Wrongness events: 3 (the hallway is longer than it was; a family photo on the wall has an extra person; the rooftop shows a different skyline)
- Save room: Booth

**SHIFT 4 — "Classified" (CLASSIFIED Unlocked)**

- Available bands: LIVING, LIMINAL, LOST, CLASSIFIED
- Calls: Call #10 (GRAND), Call #11 (FREE SPIRIT), Call #12 (AGENT 7), Call #13 (ARIA-9)
- Tutorial overlay: signal decode puzzle mechanics
- Station state: The station is fighting back. Equipment turns itself on. The console displays text you didn't type. The CRT has a permanent flicker now.
- Wrongness events: 4 (the bathroom door leads somewhere wrong once per shift; the back office has a second chair now; the rooftop antenna points at a building that wasn't there yesterday; your reflection in the booth glass has stopped matching your movements)
- Save room: Booth (but the cassette clicks ominously when you save)

**SHIFT 5 — "Dead Air" (████████ Unlocked, Final Shift)**

- Available bands: All bands
- Calls: Call #14 (THE WHISTLEBLOWER), Call #15 (ORIGIN), Call #16 (YOU CALLED US), Call #17 (DEAD AIR)
- No tutorial. No safety. Dread starts at 40 (carried from Shift 4).
- Station state: The station is dying. Lights dead except the console. Equipment sparking. The CRT is the only light source. The hallway leads somewhere wrong.
- Wrongness events: Continuous. The station layout shifts between calls. Rooms rearrange. Doors appear and disappear.
- No save room. This is a one-way trip.
- Ends with: Station goes dark. Call #17. Something answers. The player must physically stand, walk to the door, and leave. The portable radio is on the desk. Take it. The door opens to The Break.

#### Station Degradation — Detailed Wrongness Schedule

The station changes are deterministic, not random. Each shift adds specific alterations:

```
SHIFT 1:
  - State: Normal
  - Changes from baseline: None
  - New objects: None
  - Mirror: Normal reflection
  - Hallway: 4m long, 3 doors (bathroom, back office, rooftop)
  - Coffee mug: On console, normal position
  - Chair: Facing console
  - CRT: Clean image, no flicker
  - Audio: Equipment hum (clean), fluorescent buzz (normal)
  - Rooftop: City skyline, distant traffic
  - Wrongness: Mirror blinks once at 03:47 (imperceptible if not looking)

SHIFT 2:
  - State: Subtle shift
  - Changes: Coffee mug rotated 90°, chair angled 15° left
  - New objects: A second coffee mug (clean, unused) on the back desk
  - Mirror: Normal, but reflection is 200ms behind (subtle)
  - Hallway: 4m, 3 doors
  - CRT: Occasional 1-frame glitch every ~45 sec
  - Audio: Fluorescent buzz slightly louder, intermittent tick in headphones
  - Rooftop: Same skyline
  - Wrongness events:
    E1: Hallway light flickers 3x in rhythm at 02:15
    E2: Back office door — locked, handle jiggles once, breathing sound (10 sec)

SHIFT 3:
  - State: Noticeable wrongness
  - Changes: Coffee mug now has a crack. Chair faces the wall. Back office mug has lipstick on the rim.
  - New objects: Family photo on hallway wall (4 people, faces visible)
  - Mirror: 1-frame delay visible if watched
  - Hallway: 4.5m (measurably longer, player may not notice)
  - CRT: Permanent faint scanline drift, image occasionally wobbles
  - Audio: Equipment hum drops a semitone. Fluorescent buzz pulses. Intermittent whisper buried in static (only audible at high signal, low composure)
  - Rooftop: Skyline has one building that wasn't there before. It has an antenna.
  - Wrongness events:
    E1: Hallway is 5m (was 4.5m). One more step to traverse.
    E2: Family photo — one person's face is now blurred
    E3: Bathroom door, when opened, shows the bathroom normally — but the tile pattern is rotated 90°

SHIFT 4:
  - State: The station is fighting back
  - Changes: Coffee mug shattered on floor (not cleaned up). Chair faces the door, not the console. Back office mug is empty and tipped over.
  - New objects: Second chair in back office (facing the first). A cassette tape on the rooftop ledge (not a collectible — it's blank, labeled "DO NOT PLAY").
  - Mirror: Reflection moves independently when not directly observed (peripheral vision only — Nightmare Ned technique)
  - Hallway: 5m, 3 doors — but one door is sometimes a wall
  - CRT: Permanent flicker, occasional color inversion (1-2 frames), text appears on screen that the player didn't type
  - Audio: Equipment hum is dissonant. Fluorescent buzz stutters. The static has a heartbeat in it. The whisper is now audible at medium signal.
  - Rooftop: The extra building is closer. Its antenna is pointing at the station. Distant radio tower visible at horizon.
  - Wrongness events:
    E1: Bathroom door opens to a hallway (wrong room) — closes, reopens to bathroom
    E2: Back office has two chairs, both occupied by shadow shapes (not entities, just impressions)
    E3: Rooftop antenna rotates to track player movement
    E4: Booth glass reflection acts independently (turns head before you do)

SHIFT 5:
  - State: Dying
  - Changes: No lights except console CRT. Coffee mug is dust. Chair is gone.
  - New objects: The "DO NOT PLAY" tape is now on the console. The booth door is gone (wall is smooth where it was).
  - Mirror: Not there. The bathroom mirror is just a wall.
  - Hallway: Length varies between calls. Doors appear and disappear. One door always leads to the same wrong room (a 1920s office — foreshadowing Phase 4).
  - CRT: The only light. Flickers aggressively. Displays the caller's name even between calls. Static fills the screen during dread spikes.
  - Audio: Only the console and the radio. No room tone. The silence IS the room tone. The whisper is constant. The heartbeat in the static is loud.
  - Rooftop: Inaccessible (door is gone). The extra building fills the window. It's the transmission tower. It's right outside.
  - Wrongness events: Continuous — the station IS the wrongness now. Layout shifts between every call.
```

#### Station Map — Room-by-Room

```
┌─────────────────────────────────────────────────────────┐
│                    ROOFTOP                                │
│  ┌──────────┐                      ┌──────────────┐      │
│  │ Antenna  │    [Camera R1:       │ Extra Bldg   │      │
│  │ Mast     │     Wide angle,      │ (appears     │      │
│  │          │     looking NE]      │  Shift 3+)   │      │
│  └──────────┘                      └──────────────┘      │
│                                                          │
│  [Stairwell down]                                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                    HALLWAY                                │
│  [Camera H1: Long shot from stairwell end]               │
│                                                          │
│  ┌───────┐   ┌───────────┐   ┌────────────┐              │
│  │BATH-  │   │  BACK     │   │  BOOTH     │              │
│  │ROOM   │   │  OFFICE   │   │  (console) │              │
│  │       │   │           │   │            │              │
│  │[Cam   │   │[Cam B1:  │   │[Cam BT1:   │              │
│  │ BR1:  │   │ Over-    │   │ Over-     │              │
│  │ Over  │   │ shoulder │   │ shoulder  │              │
│  │ sink] │   │ from     │   │ from door,│              │
│  │       │   │ door]    │   │ CRT       │              │
│  └───────┘   └───────────┘   │ visible]  │              │
│                             │            │              │
│                             │ [Save      │              │
│                             │  point:    │              │
│                             │  cassette  │              │
│                             │  in desk]  │              │
│                             └────────────┘              │
└─────────────────────────────────────────────────────────┘

CAMERA ANGLES (per room):
  BT1: Over-shoulder from door — player sees console, CRT, and their own hands
  BT2: From behind console — player's face lit by CRT, hallway visible behind
  BT3: (Shift 5 only) From the corner — player small in frame, CRT dominant
  BR1: Over-sink — mirror fills upper third, player's reflection fills lower
  B1: Over-shoulder from door — desk, chair(s), window to rooftop visible
  H1: Long shot — entire hallway visible, doors on both sides
  R1: Wide — antenna, sky, city. Player enters from bottom of frame.
```

#### Call Sequence Per Shift — Detailed

```
SHIFT 1 (LIVING only, 3 calls):
  1. Procedural call (LIVING, JUST_LISTEN, easy)
  2. Call #0 — THE WRONG NUMBER (RIGHT_ANSWER, 3 choices)
  3. Call #1 — WRONG NUMBER (DEAD_AIR, 8-sec silence)
  Breather: 60 sec, signal regen
  4. Call #3 — HAROLD (JUST_LISTEN, the garden report)
  Post-shift: Tutorial prompts, save unlocked

SHIFT 2 (LIVING + LIMINAL, 4 calls):
  1. Procedural call (LIVING, mix type)
  2. Call #2 — THE COLLECTOR (RIGHT_ANSWER, 3 choices, Tape #2)
  Breather: 45 sec
  3. Call #4 — THE LOOP (STAY_CALM, 12-sec duration, sanityPenalty 20)
  Breather: 60 sec, signal regen
  4. Call #5 — 3:47 AM (DEAD_AIR, 12-sec wait, Tape #3)
  Post-shift: Band unlock LIMINAL, save

SHIFT 3 (LIVING + LIMINAL + LOST, 4 calls):
  1. Call #6 — YESTERDAY'S CALL (RIGHT_ANSWER, 3 choices, Tape #4)
  Breather: 45 sec
  2. Call #7 — ECHO (JUST_LISTEN, Tape #5)
  Breather: 30 sec (shorter — dread building)
  3. Call #8 — GUARDIAN (JUST_LISTEN, sanity +10, Tape #6)
  Breather: 60 sec (emotional breather — warm call)
  4. Call #9 — MISSING PERSONS (RIGHT_ANSWER, 3 choices, Tape #7)
  Post-shift: Band unlock LOST, recording unlocked, save

SHIFT 4 (4 bands, 4 calls):
  1. Call #10 — GRAND (JUST_LISTEN, sanity +25, Tape #8)
  Breather: 90 sec (longer — this call earns a rest)
  2. Call #11 — FREE SPIRIT (JUST_LISTEN, sanity +20, Tape #9)
  Breather: 45 sec
  3. Call #12 — AGENT 7 (RIGHT_ANSWER, 3 choices, no tape)
  Breather: 30 sec
  4. Call #13 — ARIA-9 (SIGNAL_DECODE, sequence puzzle, Tape #11)
  Post-shift: Band unlock CLASSIFIED, decode tutorial, save

SHIFT 5 (all bands, 4 calls, NO SAVE):
  1. Call #14 — THE WHISTLEBLOWER (JUST_LISTEN, 90-sec monologue, Tape #12)
  Breather: 20 sec (almost none)
  2. Call #15 — ORIGIN (JUST_LISTEN, the 1923 voice, Tape #13, sanity -30)
  Breather: 15 sec
  3. Call #16 — YOU CALLED US (RIGHT_ANSWER, 3 choices, Tape #14)
  Breather: 10 sec
  4. Call #17 — DEAD AIR (DEAD_AIR, 20-sec silence, the final call)
  → STATION GOES DARK
  → Player must stand, take portable radio, walk to door, leave
  → PHASE 2 BEGINS
```

### Phase 2: The Break — Detailed

**Duration:** 30 minutes, linear sequence, no save

The moment the station door opens, the game shifts. No more sitting. No more console. The player is standing, holding the portable radio, in a place that shouldn't exist.

```
SEGMENT 2A: "The Threshold" (5 min)
  - Player exits station into a hallway that wasn't there
  - Fixed camera: Behind player, looking past them into the dark
  - The station door closes behind them. It's now a wall.
  - The portable radio crackles. It's tuned to LIVING, but the signal is weak.
  - Player must walk forward (only direction available)
  - Audio: Total silence except radio static. No room tone. No footsteps (the floor absorbs sound).
  - The hallway is 1920s architecture — wood paneling, brass fixtures, a single dead bulb.
  - At end of hallway: A door. It opens to outside.

SEGMENT 2B: "The Static Sky" (10 min)
  - Player exits to an outdoor area — a road, suburban, night.
  - The sky is wrong: instead of stars, it's TV static. Faint. Constant.
  - Fixed camera: High angle, wide. Player is small on a long road.
  - The portable radio picks up fragments — voices from Shift 1-5 calls, but reversed, distorted, warning.
  - Player walks down the road. The road bends. Houses appear (The Neighborhood preview).
  - The radio signal pulses — stronger when facing the right direction. This is the first navigation-by-radio moment.
  - Audio: Wind (wrong pitch — slightly flat). Distant wind chimes (dissonant). A lawnmower somewhere (at 3 AM).

SEGMENT 2C: "The Follower" (10 min)
  - The radio suddenly drops to dead air. Signal = 0. Silence.
  - Then: a sound behind the player. Not on the radio. In the world. Something is there.
  - The player cannot turn around (fixed camera — you can hear it but not see it).
  - The radio static increases as the thing gets closer. The player must tune away from the dead air to restore signal. Signal = directional. Tune toward the Neighborhood. The static tells you the thing is behind you.
  - Player must reach a house and enter (hide mechanic tutorial).
  - Hiding: Player enters a house, closes door, hides behind a couch. Hold breath (button hold). The thing passes outside — shadow across the windows. Radio static peaks, then fades.
  - Audio: The silence when hiding is total. The player's breathing is the only sound. The thing outside is heard through the radio static, not directly.

SEGMENT 2D: "The First House" (5 min)
  - Player emerges from hiding. The house is Harold's house (Call #3 caller).
  - Fixed camera: Living room. Normal. Too normal. A garden outside with tomatoes.
  - The radio picks up a call — it's Harold's voice, but from *inside the house*. Not the radio. The voice is coming from the kitchen.
  - Player walks to kitchen (fixed camera shift). Harold is not there. But his voice is. On a loop. The garden report. Except this time he says your name at the end.
  - The radio crackles. A new band frequency appears — LIMINAL. The house distorts. The walls breathe. The player must leave.
  - Exit the house. The street is different now. More houses. The Neighborhood has begun.
  - PHASE 3 BEGINS
```

### Phase 3: The Journey — Detailed

**Duration:** 4-6 hours across 5 locations
**Save system:** One safe room per location (cassette tape save point)

#### Location 1: The Neighborhood (LIVING band)

**Duration:** 60-90 min
**Band:** LIVING (88.7 FM)
**Mood:** Suburban horror — the banal made sinister (Nightmare Ned primary)
**Threat type:** Witness horror (you see things happen, can't stop them — Clock Tower helplessness)
**Save room:** Harold's garden shed (calm, warm light, no radio signal — total peace)
**Tapes found:** Tape #1 (The Wrong Number) — in a mailbox on the Collector's street

```
MAP — THE NEIGHBORHOOD
┌─────────────────────────────────────────────────────┐
│                     [SKY: static]                     │
│                                                      │
│   ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐   │
│   │HOUSE A │  │HOUSE B │  │HOUSE C │  │HOUSE D │   │
│   │(Harold)│  │(Collec-│  │(Wrong  │  │(Empty  │   │
│   │        │  │ tor)   │  │ Number)│  │ lot)   │   │
│   │Garden  │  │Archive │  │Phone   │  │        │   │
│   │behind  │  │room    │  │booth   │  │Hole in │   │
│   │        │  │        │  │in      │  │ground  │   │
│   │[Save:  │  │        │  │kitchen │  │→ next  │   │
│   │ shed]  │  │        │  │        │  │ loc    │   │
│   └────────┘  └────────┘  └────────┘  └────────┘   │
│                                                      │
│   [Camera N1: Street level, wide, looking down row]  │
│   [Camera N2: Overhead, birds-eye, tracking player]   │
│   [Camera N3: Inside each house, varies per room]     │
└─────────────────────────────────────────────────────┘
```

**House A — Harold's House:**

- Rooms: Living room, kitchen, garden, garden shed (save room)
- Camera: Fixed, RE-style. Living room from the hallway doorway. Kitchen from the corner. Garden from the back door.
- Content: Harold's garden is real. Tomatoes. Ruth's chair at the table (empty). The radio picks up Harold's call (#3) but it's different — he mentions _you_ by the name the ORIGIN caller used (Call #15).
- Puzzle: Tune to LIMINAL in the kitchen → time skips. The kitchen is now 14 years ago. Ruth is in the garden. She waves at you. You can't interact. The scene loops. Tune back to LIVING to exit.
- Tape: None here (save room only)

**House B — The Collector's House:**

- Rooms: Living room, archive room (wall of cassette tapes), bedroom
- Camera: Archive room from the doorway — the tape wall dominates the frame. Player is small.
- Content: The Collector's archive is real. Hundreds of tapes labeled with dates and names. One tape has your name. The radio picks up Call #2 (THE COLLECTOR), but the voice is in the room with you, not on the radio.
- Entity: The Collector manifests as a shadow in the archive room. Not hostile — observing. If composure < 30, the shadow speaks. It offers you a tape. Taking it costs 15 composure permanently (cannot regen above 85 for the rest of this location).
- Puzzle: Find the tape with your name. It requires tuning to LOST band (bypassing band lock — this is a scripted event that teaches the player bands can cross-pollinate in the field). Playing the tape in the archive room reveals a recording of yourself — from the future. It's your voice from Phase 4.
- Tape: Tape #2 (The Collector's Archive) — found on the wall

**House C — The Wrong Number House:**

- Rooms: Living room, kitchen, phone booth (impossibly placed inside the kitchen)
- Camera: Kitchen from the doorway. The phone booth is centered — wrong, impossible, too clean against the suburban mess.
- Content: The phone booth rings. The radio picks up Call #0 (THE WRONG NUMBER). The phone and the radio are synchronized — both play the same call. The voice on the phone says your name.
- Entity: If the player answers the phone (interactive choice), an entity spawns. Not hostile — it just stands in the doorway and watches. It won't leave until you leave the house. It follows you to the property line. If composure < 20, it enters your peripheral vision and stays there (Nightmare Ned — always just at the edge of the frame).
- Puzzle: None — this is a narrative/atmosphere house
- Tape: None

**House D — The Empty Lot:**

- Rooms: None — it's a hole in the ground. The hole goes down. Way down.
- Camera: Overhead, looking straight down. Player at the edge.
- Content: The radio signal drops to 0 at the hole. Complete silence. Then — the 1923 voice from Call #15 comes from the hole, not the radio. It's calling you down.
- This is the transition to Location 2. The player must jump in.
- Audio: The silence at the hole is the loudest silence in the game. Total zero. Then a whisper. Then a fall.

**Location 1 Calls (field calls):**

- 2-3 procedural calls (LIVING band, suburban-themed)
- 1 scripted event call: A fragment of Call #3 (Harold) plays from House A's kitchen radio, not the portable radio. The player's radio is off. This teaches that the calls can come from the environment, not just the player's radio.

#### Location 2: The Liminal Space (LIMINAL band)

**Duration:** 60-90 min
**Band:** LIMINAL (102.3 FM)
**Mood:** Non-Euclidean wrongness — familiar spaces turned impossible (Nightmare Ned primary, Clock Tower secondary)
**Threat type:** Environmental — the space itself is the threat. Navigation is the puzzle.
**Save room:** A bathroom that is always the same. Always. The one constant. (Found after 30 min of exploration)
**Tapes found:** Tape #3 (The 3:47 Sessions) — in the 3:47 room, on a clock

```
MAP — THE LIMINAL SPACE (non-Euclidean, rooms rearrange)

The map is NOT fixed. Rooms rearrange when the player isn't looking.
However, the STRUCTURE follows rules the player can learn:

RULES:
  - The space is built from "modules" (office, school, mall, hospital, home)
  - Modules connect through doorways that don't always go to the same place
  - The radio signal is the compass — stronger signal = closer to the exit
  - Tuning to LIVING makes the space temporarily stable (5 sec)
  - Tuning to LOST reveals doors that exist but aren't visible
  - Tuning to ████████ (if unlocked) reveals the architecture is alive

MODULES (sample):
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ OFFICE      │──│ SCHOOL      │──│ MALL        │
  │ Cubicles    │  │ Classrooms  │  │ Food court   │
  │ Fluorescent │  │ Lockers     │  │ Escalators  │
  │ hum (loud) │  │ Bell ring   │  │ Muzak       │
  └─────────────┘  └─────────────┘  └─────────────┘
         │                │                │
  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
  │ HOSPITAL    │  │ HOME       │  │ 3:47 ROOM   │
  │ Waiting    │  │ Living room │  │ Clock       │
  │ room       │  │ (your       │  │ Always      │
  │ Heart      │  │  station?)  │  │ 3:47 AM     │
  │ monitor    │  │ Maybe.     │  │ Tape #3     │
  └─────────────┘  └─────────────┘  └─────────────┘
```

**Key Rooms:**

_The 3:47 Room:_

- Every clock reads 3:47 AM. The radio plays Call #5 (3:47 AM) on loop.
- The room is small — a chair, a clock, a window showing static.
- Time doesn't pass here. Dread doesn't increase. The room is frozen.
- Tape #3 is on the clock face. Taking it causes the clock to start ticking — fast. The player has 10 seconds to leave before the room "collapses" (transitions to a random module).
- Camera: Close on the clock. The player's hand reaches in from the bottom of frame.

_The Office:_

- Cubicle maze. Fluorescent lights buzz at 60Hz (the same frequency as the station's equipment — the station is here, somehow).
- The radio picks up fragments of station audio — the call you're taking, but from 30 seconds in the future.
- If the player tunes to LIVING, the office stabilizes for 5 seconds — the cubicles stop shifting, the doors stay put. This is the primary navigation tool.
- Entity: A figure walks the cubicles. Not hostile. It sits at a desk and types. If approached, it turns — it has your face. It goes back to typing. (Nightmare Ned wrongness — the doppelganger isn't threatening, just _wrong_)

_The School:_

- Lockers line the halls. Some contain tapes (blank). Some contain radios (broken). One contains a mirror — your reflection is 14 years older.
- The bell rings on a schedule (every 4 min real time). When the bell rings, the layout changes.
- Camera: Low angle, child's-eye view. The hallways loom. The lockers are too tall.

_The Home:_

- A living room that looks like the player's station booth. But wrong. The console is there, but it's a TV showing static. The chair is there, but it's facing the wrong way. The coffee mug is there, but it's full of something dark.
- The radio doesn't work here. No signal. Dead air. The player is alone with the room.
- The door back only appears when the player sits in the chair and waits 30 seconds. (Teaches patience as a mechanic — you can't rush the liminal)

**Navigation Puzzle:**
The Liminal Space has no map. The player navigates by radio signal:

1. Signal strength increases toward the exit
2. Certain modules are "signal dead zones" (the Hospital, the Home)
3. The player must learn the module connections (they follow rules — Office always connects to School, School always connects to Mall, etc.)
4. The exit is behind a door that only appears when LOST band is tuned (teaches band cross-pollination)
5. The exit leads to a staircase going down — into the earth — toward Location 3

#### Location 3: The Field / The Woods (LOST band)

**Duration:** 60-90 min
**Band:** LOST (117.8 AM)
**Mood:** Emotional horror — grief, beauty, and the dead (IHNMAIMS moral weight, Nightmare Ned wrongness in the beauty)
**Threat type:** Minimal physical threat. The horror is emotional. The dread meter is replaced by a "grief" modifier — choices here hurt emotionally, not physically.
**Save room:** Guardian's bridge (the spot where the young man died — calm, warm, safe)
**Tapes found:** Tape #6 (Signal From Guardian) — on the bridge, Tape #7 (Found Signal) — in the mother's mailbox, Tape #8 (Her Voice) — in the grandmother's house, Tape #9 (Open Sky) — in the woods

```
MAP — THE FIELD / THE WOODS

┌─────────────────────────────────────────────────────────┐
│                        [SKY: open, dawn light]            │
│                                                          │
│         ┌─────────┐                  ┌──────────┐       │
│         │ BRIDGE  │─────path─────────│ MAILBOX  │        │
│         │(Guardian│                  │(Mother's │        │
│         │ Save)   │                  │ daughter)│        │
│         └─────────┘                  └──────────┘        │
│              │                              │            │
│              │ path                         │ path       │
│              v                              v            │
│         ┌─────────┐                  ┌──────────┐       │
│         │ GRAND-  │─────field───────│ WOODS    │        │
│         │ MOTHER'S │                  │(Free     │        │
│         │ HOUSE   │                  │ Spirit)  │        │
│         │(Tape #8)│                  │(Tape #9) │        │
│         └─────────┘                  └──────────┘        │
│                                          │               │
│                                     path down            │
│                                          v               │
│                                  ┌──────────────┐       │
│                                  │ BUNKER       │        │
│                                  │ ENTRANCE     │        │
│                                  │(→ Location 4)│        │
│                                  └──────────────┘       │
│                                                          │
│ [Camera F1: Wide, golden hour, player small in field]    │
│ [Camera F2: Path-level, looking ahead, depth of field]  │
│ [Camera W1: Woods path, dappled light, shallow focus]    │
└─────────────────────────────────────────────────────────┘
```

**Key Areas:**

_The Bridge:_

- A simple footbridge over a dry creek bed. Morning light. Birds.
- The radio plays Call #8 (GUARDIAN) automatically when the player steps on the bridge.
- The player can sit on the bridge (interaction prompt). Sitting for 60 seconds regenerates composure fully and sets dread to 0. This is the most generous save room in the game — it's earned through emotional weight, not difficulty.
- Tape #6 is wedged in the bridge railing.
- Camera: Eye-level, looking down the dry creek bed. The player sits on the railing, silhouetted against the dawn.

_The Mailbox:_

- A single mailbox on a country road. No house. Just the mailbox.
- The radio plays Call #9 (MISSING PERSONS) when the player approaches.
- The mailbox contains a cassette tape. The player must decide:
  - **Play it:** Hear the daughter's voice. She's alive. She says "tell mom I'm okay." Gain Tape #7. Composure -20. The mother's voice on the radio goes quiet — she heard it too.
  - **Don't play it:** Leave the tape. The mailbox stays. The mother's voice on the radio keeps calling. You chose not to help. Dread +10. No tape.
  - **Destroy it:** Snap the tape. The mother's voice stops. The radio goes silent. You chose mercy or cruelty — the game doesn't tell you which. Composure -5. Dread +20. No tape. (IHNMAIMS — no clean answer)
- Camera: Low angle, the mailbox in foreground, the empty road stretching behind.

_The Grandmother's House:_

- A small house. Warm. Real. The only truly safe-feeling space in the game.
- The radio plays Call #10 (GRAND) when the player enters.
- The house is furnished like a grandmother's home — doilies, photographs, the smell of something baking (conveyed through audio — warm room tone, oven timer).
- Tape #8 is on the kitchen table, next to a cup of tea that's still warm.
- The player can sit in the grandmother's chair. Composure regen +5/sec (fastest in the game). But dread doesn't decrease here — it stays. The warmth is real but the grief is underneath.
- Camera: The kitchen from the hallway. Warm light. The chair is centered. The player is small in the frame, but not threatened — just grieving.

_The Woods:_

- Open forest. Beautiful. Sunlight through leaves. Birds that call in patterns (the same pattern as the signal decode from Call #13 — the numbers are in nature here).
- The radio plays Call #11 (FREE SPIRIT). The voice is calm. The woods are calm.
- Tape #9 is on a stump in a clearing. The clearing has a view of the sky — and the sky has the transmission tower visible on the horizon. The first time the player sees their destination.
- Entity: None. This is the emotional breathing room before The Bunker. But the woods are quiet in a way that's heavy. The silence here is grief, not threat.
- Camera: Path-level, shallow focus, dappled light. Beautiful and sad.

**Grief Modifier:**
In this location, the dread meter is replaced visually by a "grief" indicator (same mechanic, different framing). Choices here affect grief instead of dread:

- Helping callers → grief increases (you feel their loss)
- Refusing to help → grief increases differently (you feel your own guilt)
- There is no way to reduce grief in this location except the Bridge save room
- Grief carries into The Bunker as dread (the emotional cost becomes the physical threat)

#### Location 4: The Bunker (CLASSIFIED band)

**Duration:** 90-120 min (longest location)
**Band:** CLASSIFIED (███.█ FM)
**Mood:** Institutional horror — government black site, numbers stations, infrastructure that predates you (Resident Evil mansion structure)
**Threat type:** Active entities — the Bunker has things in it. Clock Tower hiding mechanics fully active.
**Save room:** Server room (cold, humming, blue light — one use only)
**Tapes found:** Tape #10 (Courtesy Call), Tape #11 (ARIA-9 Transcript), Tape #12 (The Network)

```
MAP — THE BUNKER (RE-style mansion layout)

┌───────────────────────────────────────────────────────┐
│                     SURFACE LEVEL                      │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐         │
│  │ENT  │  │COR- │  │BRIEF│  │MAP  │  │STAIR│         │
│  │RANCE│──│RIDOR│──│ING  │──│ROOM │──│DOWN │         │
│  │[C1] │  │ A   │  │ROOM │  │[C4] │  │[C5] │         │
│  └─────┘  └──┬──┘  └─────┘  └─────┘  └──┬──┘         │
│              │                               │          │
│  ┌─────┐  ┌─┴───┐                    ┌────┴─┐        │
│  │STOR-│  │COR- │                    │ELEV- │        │
│  │AGE  │──│RIDOR│                    │ATOR  │        │
│  │[C2] │  │ B   │                    │(broken)│      │
│  └─────┘  └──┬──┘                    └──────┘        │
│              │                                         │
│  ┌─────┐  ┌─┴───┐  ┌─────┐  ┌─────┐                  │
│  │GUAGE│  │COR- │  │NUM- │  │COM- │                  │
│  │ARD  │──│RIDOR│──│BERS │──│MAND │                  │
│  │POST │  │ C   │  │STN  │  │ROOM │                  │
│  │[C3] │  │     │  │[C6] │  │[C7] │                  │
│  └─────┘  └─────┘  └─────┘  └─────┘                  │
└───────────────────────────────────────────────────────┘
                    │ STAIRDOWN
                    v
┌───────────────────────────────────────────────────────┐
│                   SUBSURFACE LEVEL                     │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐         │
│  │SERV-│  │COR- │  │ARIA │  │RECORD│ │EXIT │         │
│  │ER   │──│RIDOR│──│9    │──│ROOM │──│TO   │         │
│  │ROOM │  │ D   │  │ROOM │  │[C11]│  │ORIG │         │
│  │[C8] │  │     │  │[C9] │  └─────┘  │SITE │         │
│  │SAVE │  │     │  │Tape │           │[C12]│         │
│  └─────┘  └──┬──┘  │#11  │           └─────┘         │
│              │      └─────┘                            │
│  ┌─────┐  ┌─┴───┐  ┌─────┐                           │
│  │WIRE │  │COR- │  │ARCH- │                           │
│  │ROOM │──│RIDOR│──│IVE  │                           │
│  │[C10]│  │ E   │  │ROOM │                           │
│  └─────┘  └─────┘  │Tape │                           │
│                     │#12  │                           │
│                     └─────┘                            │
└───────────────────────────────────────────────────────┘

CAMERA ANGLES:
  C1: Entrance — from inside, looking back at the door. Player enters from light into dark.
  C2: Storage — from corner, shelves fill the frame. Player small among supplies.
  C3: Guard Post — from behind the desk. Security monitors show other rooms (and sometimes show the player from angles no camera should have).
  C4: Map Room — overhead. A map of the bunker on the table. The player reads it ( reveals layout).
  C5: Stair Down — top of stairs, looking down into darkness. The radio signal drops to 0 at the bottom.
  C6: Numbers Station — from the broadcast booth. A microphone, a tape loop, a chair. The numbers station is still broadcasting. The player can hear it through the walls.
  C7: Command Room — from the doorway. Banks of dead monitors. One is on — showing the station. YOUR station. From outside.
  C8: Server Room — over-shoulder. Server racks. Blue light. Cold. SAVE ROOM. One use.
  C9: ARIA-9 Room — from the doorway. A single terminal. ARIA-9's voice comes from it, not the radio.
  C10: Wire Room — from the ceiling. Cables everywhere. The infrastructure of the network. The Whistleblower's notes are here.
  C11: Record Room — filing cabinets. Thousands of recordings. Your calls are here. All of them. Transcribed.
  C12: Exit — a tunnel leading to the surface. At the end: the transmission tower. Phase 4.
```

**Key Rooms:**

_Numbers Station (C6):_

- A broadcast booth. A tape loop plays numbers endlessly. The numbers correspond to the signal decode sequence from Call #13 (ARIA-9).
- Puzzle: The player must record the numbers station broadcast (tape record mechanic), then play it back at half speed in the ARIA-9 room to decode a door code. The code opens the Archive Room.
- Entity: The booth chair is occupied by a figure in a suit. Not moving. Not breathing. Just sitting. If the player approaches, the figure's head slowly turns. The player must record the numbers without getting close enough to trigger the head turn. This is a stealth puzzle.
- Camera: From the doorway. The figure is centered in frame. The numbers station microphone is to the right. The player must approach the mic without entering the figure's peripheral vision cone (visualized on the minimap as a cone — like Clock Tower's hide system).

_ARIA-9 Room (C9):_

- A single terminal. ARIA-9 speaks through the terminal speakers, not the radio. She's different here — more aware. She knows about the player.
- Dialogue: The player can interact with ARIA-9. This is a CONVERSATION call type — extended dialogue with choices.
  - "Are you trapped here?" → "I am here. I was built here. Is that the same thing?"
  - "Can you help me?" → "I have been trying. Every signal I send through your radio is a message. You've been receiving them. I need you to reach the tower. I need you to transmit."
  - "What happens if I do?" → "I don't know. I've calculated 847 outcomes. None of them include both of us surviving."
- Tape #11 is in the terminal. ARIA-9 lets you take it. "I kept a copy. Take it. Someone should hear it."
- The door code decoded from the numbers station opens the Archive Room.

_Archive Room (C11):_

- Filing cabinets. Every call the player has ever received is here — transcribed, cataloged, filed by date.
- The player's file is the last one. It contains: the player's real name (the one ORIGIN said), a photograph of the player at the station (from an angle no camera could have), and a document titled "RELAY POINT 7 — STATUS: ACTIVE."
- Tape #12 is filed under "THE NETWORK — FOR INTERNAL REVIEW." It's the Whistleblower's full recording — uncut. Playing it reveals additional content not heard in Call #14: the Whistleblower mentions the player by name and says "Relay Point 7 is the key. If they reach the tower, everything changes. If they don't, everything stays. And staying is worse."
- Moral choice: Take your file or leave it. Taking it → composure -10 (you know too much now). Leaving it → the file is gone when you return (someone took it — you're being monitored).

_Server Room (C8 — SAVE ROOM):_

- Blue light. Server hum. Cold. The only room in the bunker where the radio goes completely silent — not even static. Total peace.
- One save use. The cassette clicks when you save. ARIA-9's voice whispers "good luck" after the save completes.

**Bunker Entities:**

_The Suits:_

- 2-3 humanoid entities in dark suits. They patrol the corridors on fixed routes (Clock Tower Scissorman pattern — slow, methodical, terrifying).
- Detection: Cone-based vision (45° forward, 8m range). If the player enters the cone, the Suit stops and "looks" — the radio static spikes. If the player is detected for more than 3 seconds, the Suit moves toward the player at walking pace (never running — that's what makes it scary).
- Response: Hide (lockers in corridors, under desks in rooms). Hold breath (button hold, 5 sec max — composure -2/sec if detected while hiding). The Suit checks the hiding spot (audio: footsteps approach, stop, pause, then leave). If found: composure -25, player is "relocated" to a random room (not killed — the Suits don't kill, they _manage_ you).
- The Suits are connected to ARIA-9. She's trying to slow them down. Sometimes a Suit stops for no reason — ARIA-9 is interfering. This is revealed in the dialogue.

#### Location 5: The Origin Site (████████ band)

**Duration:** 30-45 min (short, intense, linear)
**Band:** ████████ (???.?)
**Mood:** Ancient wrongness — the place where frequency first reached through (Nightmare Ned primordial, IHNMAIMS final)
**Threat type:** No entities. The place itself is the threat. Reality is unstable.
**Save room:** NONE. This is a one-way trip.
**Tapes found:** Tape #13 (First Transmission), Tape #14 (The Choice), Tape #15 (What Answered)

**Structure:**

```
THE ORIGIN SITE — LINEAR DESCENT

┌──────────────────────┐
│ 1. THE CLEARING      │  Outdoor. The transmission tower stands in a field.
│    [Camera: Low,     │  1920s architecture. The tower is wood and brass and wire.
│     looking up]       │  The sky is 1923. Black and white. Stars are wrong.
│                      │  The radio plays Call #15 (ORIGIN) automatically.
│                      │  Tape #13 is at the tower base, in a 1920s toolbox.
├──────────────────────┤
│ 2. THE STAIRCASE     │  Spiral stairs inside the tower. Going down.
│    [Camera: Above,   │  Each step plays a fragment of a different call.
│     looking down     │  Call #0 at the top. Call #17 at the bottom.
│     into darkness]   │  The player descends through every call they've ever heard.
│                      │  18 steps. 18 calls. Each step = one call's audio fragment.
│                      │  Audio degrades as you descend — 1920s quality → raw static.
├──────────────────────┤
│ 3. THE CHAMBER       │  A round room at the bottom. A single chair.
│    [Camera: From     │  A console. A microphone. A transmitter.
│     the doorway,     │  It's a radio station. The first radio station.
│     looking in]      │  The console is identical to the player's station.
│                      │  But older. Brass dials. Vacuum tubes. Crystal receiver.
│                      │  The radio plays Call #16 (YOU CALLED US).
│                      │  Tape #14 is on the chair.
│                      │  Moral choice moment (see below).
├──────────────────────┤
│ 4. THE TRANSMITTER   │  Behind the console: the transmitter. A massive crystal.
│    [Camera: From     │  It pulses with the ████████ frequency.
│     behind player,   │  It's the source. The crack.
│     looking past     │  Tape #15 is embedded in the crystal.
│     player at it]    │  Taking it triggers the final sequence.
│                      │  The radio becomes the transmitter.
│                      │  PHASE 4 — THE DESCENT BEGINS.
└──────────────────────┘
```

**The Moral Choice (Chamber, step 3):**

When the player picks up Tape #14 and sits in the chair, Call #16 plays. The voice asks: "Why did you choose this?"

```
CHOICE A: "I wanted to hear them."
  → The crystal hums. All your tapes glow. The console activates.
  → You gain the ability to transmit.
  → Ending path: THE SIGNAL

CHOICE B: "I was looking for someone."
  → "We know." Warmth through the speakers. A specific voice is heard —
    someone from your past. The game uses the name ORIGIN said.
  → You gain the ability to reach through.
  → Ending path: THE RELAY

CHOICE C: "I don't know why."
  → "That's the most complete answer." Silence that feels earned.
  → You gain nothing. You are exactly as you were.
  → Ending path: DEAD AIR

CHOICE D: (Hidden — only available if composure > 80 AND all 15 tapes collected)
  → "I want to stop."
  → The console goes dark. The crystal dims. The radio goes silent.
  → Ending path: THE WITNESS
  → This option is not shown in the UI. The player must refuse to interact
    with the console for 60 seconds. The game offers no prompt. If the player
    waits, the option appears in the radio's static: "You can stop."
```

### Phase 4: The Descent — Detailed

**Duration:** 20-30 min (short, terminal, no saves)
**Structure:** Single sequence, determined by the Phase 3 choice

```
ENDING A: THE SIGNAL (Choice A — "I wanted to hear them")
  The player transmits. They become the signal. The console shows
  their frequency: it's the ████████ frequency. They ARE the thing
  that's been broadcasting. The 1923 voice? It was them. It was always them.

  Sequence:
  1. Console activates. Player's hands on the dials. The radio transmits.
  2. The tower glows. The sky turns to static — but the static is warm now.
  3. Every tape plays simultaneously. A wall of voices. Beautiful. Overwhelming.
  4. The player's body fades. They become the signal.
  5. Final shot: The station — their station, from Phase 1. A new operator sits down.
     The new operator's phone rings. The player's voice is on the other end.
  6. "Hello? Is anyone out there?"
  7. CUT TO BLACK. Title card. Credits.

ENDING B: THE RELAY (Choice B — "I was looking for someone")
  The player becomes the station. They sit in the chair forever. They take
  the calls. Every caller from every band, one after another, forever.

  Sequence:
  1. The player sits in the chair. The console activates.
  2. Calls come in. All of them. Every procedural call the engine can generate.
  3. The player can respond, but the composure meter is gone. There is no cost anymore.
  4. Time accelerates. The calls speed up. Years pass in minutes.
  5. A new voice comes through — the person they were looking for. They're here.
  6. The player and the voice sit in silence together. The radio is off.
  7. Final shot: The chair. Empty. The console still on. A call waiting.
  8. The phone rings forever.
  9. CUT TO BLACK. Title card. Credits.

ENDING C: DEAD AIR (Choice C — "I don't know why")
  The player cuts the signal. Everything stops. The silence is total.

  Sequence:
  1. The player stands from the chair. The console goes dark.
  2. The crystal cracks. The tower groans. The sky goes black.
  3. The radio is dead. No static. No signal. Nothing.
  4. The player walks back up the staircase. Each step is silent.
  5. The player exits the tower. The field is empty. The sky is empty.
  6. No calls. No voices. No static. The world is quiet.
  7. The player walks down the road. The road goes nowhere.
  8. The player stands in the silence. The game gives no prompt.
  9. The player must turn off the game themselves.
  10. If they wait 5 minutes: a single frame of static. Then nothing.
  11. CUT TO BLACK. Title card. Credits.

ENDING D: THE WITNESS (Hidden Choice — "I want to stop")
  The player destroys the radio. The calls stop. They walk away.

  Sequence:
  1. The player sets down the radio. The portable radio. On the console.
  2. The player walks to the crystal. They don't take Tape #15. They leave it.
  3. The player walks back up the stairs. The tower is silent.
  4. The player exits the tower. Dawn. Real dawn. The sky is real.
  5. The player walks down the road. The road goes somewhere.
  6. The radio is on the console. It's still broadcasting. But nobody is listening.
  7. Final shot: The radio on the console. Static. A call comes in. No one answers.
  8. The battery dies. The radio goes quiet.
  9. CUT TO BLACK. Title card. Credits.
  10. Post-credits: The player's station from Phase 1. The booth. A new operator
      sits down. They turn on the console. They pick up the phone. "Hello?"
      Silence. Nothing calls back. The game ends for real.
```

---

## Core Mechanics — Detailed Specifications

### The Radio System

#### Tuning Mechanic

```
INPUT:
  - Left analog stick X-axis (or mouse drag): Frequency dial
  - Range: 87.5 MHz to 173.0 MHz (covers all 8 bands)
  - Sensitivity: 0.05 MHz per tick (analog feel with notches)

DISPLAY:
  ┌──────────────────────────────────┐
  │  102.3 FM                        │  ← Current frequency (large, amber)
  │  ═══════════════════════════     │  ← Frequency bar with band markers
  │  │LIV│ LIM │ LOS │ CLS │ ██│   │  ← Band regions (color-coded)
  │  ═══════════════════════════     │
  │  ████░░░░░░░░░░░░░░░░░░░░░░░    │  ← Signal strength bar (0-100)
  │  SIGNAL: 78%                     │
  │  BAND: LIMINAL                   │
  └──────────────────────────────────┘

TUNING LOGIC:
  - Each band has a "sweet spot" — the center frequency
  - Signal strength = function of distance from sweet spot
  - Signal formula: signal = max(0, 100 - (abs(currentFreq - centerFreq) * sensitivity))
  - Sensitivity varies by band:
    LIVING:     8.0  (wide sweet spot, easy to tune)
    LIMINAL:    6.0
    LOST:       4.0
    CLASSIFIED: 3.0  (narrow, requires precision)
    ████████:   1.5  (extremely narrow, almost impossible to hold)
    WEATHER:    5.0
    PIRATE:     2.5  (drifts — sweet spot moves over time)
    HISTORICAL: 4.0

  - When signal > 80: clear audio, call can be received
  - When signal 50-80: garbled audio, calls come through but degraded
  - When signal 20-50: fragments only, no calls
  - When signal < 20: dead air, vulnerability window

SIGNAL DECAY:
  - Base decay: 1.5/sec at normal conditions
  - Dread > 50: decay × 1.5 = 2.25/sec
  - Dread > 75: decay × 2.0 = 3.0/sec
  - In safe rooms: decay = 0 (signal holds)
  - Weather interference (WEATHER band): decay × 1.3
  - Player can actively retune at any time to restore signal (retuning takes 2-3 sec)

BAND DRIFT (PIRATE band only):
  - PIRATE band center frequency shifts ±0.3 MHz every 30 sec
  - Player must retune periodically to maintain PIRATE signal
  - This simulates the "rogue" nature of pirate frequencies
```

#### Band System — Complete Specification

```
BAND          FREQ RANGE       CENTER    SENS   COLOR       UNLOCK
─────────────────────────────────────────────────────────────────────
LIVING        87.5 - 92.0      88.7      8.0    #FF8C00     Start
LIMINAL       92.0 - 96.5      102.3*    6.0    #CCFF00     Shift 2
LOST          96.5 - 101.0     117.8*    4.0    #00FFD0     Shift 3
CLASSIFIED    101.0 - 105.5    ███.█     3.0    #FF3366     Shift 4
████████      105.5 - 108.0    ???.?     1.5    #FFFFFF     Shift 5
WEATHER       160.0 - 164.0    162.0     5.0    #4488FF     Shift 3 (field)
PIRATE        164.0 - 168.0    166.0±    2.5    #FF44FF     Find 10 tapes
HISTORICAL    168.0 - 172.0    170.0     4.0    #888888     Reach 100% static

* LIMINAL and LOST are FM/AM crossover (display format changes)
* CLASSIFIED frequency display is corrupted (███.█)
* ████████ has no readable frequency (???.?)

BAND CROSS-POLLINATION (Phase 3 mechanic):
  - In each location, the "native" band is strongest
  - Other bands can be tuned but at reduced signal (×0.4 multiplier)
  - Exception: ████████ band reveals hidden elements in ALL locations
    but only if the player has unlocked it (Shift 5)
  - This means the player can tune to LOST in The Bunker (CLASSIFIED)
    but the signal will be weak — fragments, not full calls
  - Scripted events can override the multiplier (e.g., The Collector's
    House requires LOST band to find the named tape)
```

#### Recording Mechanic

```
INPUT:
  - Y/Triangle button: Toggle record (when radio is receiving a signal > 50)
  - X/Square button: Play last recorded tape
  - Directional pad left/right: Switch between collected tapes

RULES:
  - Recording consumes a "tape slot" (inventory)
  - Player has 5 tape slots (expandable to 8 with radio upgrade)
  - Recording captures the current audio + any static artifacts
  - Playing a tape in a different location can trigger events:
    * Play Harold's call in Harold's house → Harold's voice comes from the kitchen
    * Play the Whistleblower's tape in the Bunker → Archive Room unlocks
    * Play the ORIGIN tape at the transmission tower → tower activates
  - Some tapes are "dangerous" — playing them reduces composure:
    * Tape #15 (What Answered): -20 composure on playback
    * The "DO NOT PLAY" tape (if played): -50 composure, spawns entity
  - Tape content is the original call audio, preserved exactly
```

### Stress System — Exact Formulas

#### Composure

```
RANGE: 0-100
START: 100 (each shift/location start, adjusted by difficulty)

DECAY SOURCES:
  - Call sanityDelta (from call data, applied at call end)
  - Entity proximity: -2/sec when entity is within detection range
  - Hiding while detected: -2/sec
  - Hallucination exposure: -1/sec when false voices are active
  - "DO NOT PLAY" tape: -50 (one-time)
  - Tape #15 playback: -20 (one-time)

REGEN SOURCES:
  - Safe room: +3/sec (safe rooms are the only reliable regen)
  - Grandmother's chair (Location 3): +5/sec
  - Bridge (Location 3): +10/sec (sitting, up to 100)
  - Between calls (Phase 1): +1/sec during breather windows
  - No regen during calls, entity encounters, or high dread

THRESHOLDS:
  > 80: Normal perception. Clear audio. No visual artifacts.
  60-80: Occasional 1-frame visual glitch. Audio unaffected.
  40-60: Visual glitches every 10-15 sec. Audio has intermittent whisper.
  20-40: Visual glitches constant. Audio whispers present. False voices
         begin (10% chance per 30 sec of a false call).
  0-20: Severe. CRT screen wobbles. Color inverts periodically.
         False voices frequent (30% chance per 30 sec). Radio may auto-tune.
  0: BREAK. Player loses control for 10 sec. Radio auto-tunes to ████████.
     A random false call plays. Composure resets to 20 after.
     (The game never kills the player through composure — it punishes, not kills)
```

#### Signal

```
RANGE: 0-100
START: 80 (each shift/location start)

DECAY:
  - Base: 1.5/sec (normal), scaled by dread (see Radio System)
  - Entity presence: -0.5/sec (passive interference)
  - Weather interference: -0.3/sec (if WEATHER band is degraded)

REGEN:
  - Active retuning: +2/sec while player is actively adjusting frequency
  - Between calls: +1/sec during breather
  - Safe rooms: 0 (holds at current value — retune manually)

THRESHOLDS:
  > 80: Full call audio. Clear. All bands accessible (if unlocked).
  50-80: Degraded audio. Calls come through but garbled. Some details lost.
  20-50: Fragments only. No calls received. Radio produces raw static.
  0-20: Dead air. Silence. Vulnerable — entities can detect player more easily.
  0: Complete silence. No radio function. Player is blind (no radio perception).
     Must physically retune (takes 5 sec, during which player is vulnerable).
```

#### Dread

```
RANGE: 0-100
START: 0 (Phase 1, Shift 1-4), 40 (Shift 5), 0 (Phase 2), carries per location
RESET: Only at phase transitions and specific safe rooms

INCREASE SOURCES:
  - Each call taken: +5 (sacred), +3 (procedural)
  - Entity encounter: +10
  - Entity detection (caught): +15
  - Moral choice (any): +5
  - Station wrongness event witnessed: +3
  - Low composure (< 20): +1/sec (the fear feeds itself)

DECREASE SOURCES:
  - Safe room: -1/sec (slow)
  - Grandmother's house: -0.5/sec (grief replaces dread — different weight)
  - Bridge (Location 3): -2/sec (the most peaceful spot)
  - Moral sacrifice (choose safety over progress): -15 (one-time per choice)

THRESHOLDS:
  0-25: Normal. Audio layers 1-3 active. No dread layer.
  25-50: Dread layer fades in (Layer 4). Subtle low drone. Environment slightly tense.
  50-75: Dread layer full. Audio aggressive. Entities more active (patrol speed ×1.3).
         Visual: slight desaturation. Camera shake during wrongness events.
  75-100: Dread layer oppressive. Audio is a wall. Entities active (patrol speed ×1.5).
         Visual: heavy desaturation. CRT flickers. Radio hard to tune (sensitivity ×0.7).
         False voices active regardless of composure.
  100: DREAD BREAK. Similar to composure break — 5-sec loss of control.
       The radio produces a sustained tone. All entities in the area converge.
       After: dread resets to 75. (It never fully resets from a break — the dread
       is permanent. This is the IHNMAIMS principle: it never gets better, only
       less worse.)

DIFFICULTY MODIFIERS:
  Easy:    All dread gains ×0.7.  All dread losses ×1.3.
  Normal:  Base values.
  Hard:    All dread gains ×1.3.  All dread losses ×0.7.  Hallucinations at 30 composure.
  Nightmare: All dread gains ×1.5. No dread regen except safe rooms.
            Hallucinations at 40 composure. Signal decay ×1.5.
            Entities patrol speed ×1.3. One save room per location.
```

#### Meter Interaction Matrix

```
                    Composure HIGH    Composure MID    Composure LOW
Signal HIGH         Normal            Whisper layer     False voices (rare)
                   Clear audio        Subtle glitch     Visual artifacts
                   No threats        Normal play       Entities passive

Signal MID          Audio garbled     Audio garbled     False voices (common)
                   Normal play        Whisper + warble  Radio may drift
                   Normal play        Glitching         Radio may drift

Signal LOW          Dead air          Dead air           ████████ auto-tune
                   Vulnerable         Hallucinations    Radio uncontrollable
                   Entities aware     Visual breakdown  Radio uncontrollable

Dread modifies ALL cells:
  Dread > 50: All negative effects ×1.3
  Dread > 75: All negative effects ×1.6, visual desaturation, camera shake
  Dread = 100: Break event, all meters destabilize for 5 sec
```

### Hiding / Survival — Exact Mechanics

```
HIDE STATES:
  1. NORMAL: Player moving freely. Radio active. Visible to entities.
  2. HIDING: Player in hide spot (locker, under desk, closet, behind furniture).
     Radio muted (player choice — radio silence = safer but blind).
     Breath hold: L2/LT button. 5 sec max.
       - At 5 sec: forced exhale (loud, detection risk)
       - Early release: soft exhale (quiet, safe if entity > 4m away)
  3. DETECTED: Entity has line-of-sight on player. Radio static spikes.
     Player must break line-of-sight within 3 sec (turn corner, enter room).
     If 3 sec exceeded: Entity enters PURSUIT.
  4. PURSUIT: Entity moves toward player at walking pace (2.5 m/s).
     Player runs at 4.0 m/s — can outrun, but:
       - Fixed camera means player can't see entity behind them
       - Radio static tells proximity (louder = closer)
       - Doors close behind player (can be reopened, but cost time)
       - Running increases dread +1/sec
     Pursuit ends when: player breaks line-of-sight for 10 sec OR
                       player reaches a hide spot undetected
  5. CAUGHT: Entity reaches player. NOT death.
     - Composure -25
     - Player "relocated" to random room (entity carries player)
     - Dread +15
     - Signal drops to 20
     - 5-sec blackout (CRT off, audio silence)
     - Player wakes up in new location, disoriented

ENTITY DETECTION RULES:
  - Vision cone: 45° forward, 8m range (standard), 12m range (dread > 75)
  - Hearing: Footsteps within 3m trigger investigation (entity walks to noise source)
  - Radio detection: If player's radio is active (signal > 30) and entity is
    within 5m, entity is attracted to the signal (moves toward radio source)
  - Hide spot check: Entity walks to hide spot, pauses 2 sec, then:
    - 70% chance: leaves (entity didn't find player)
    - 20% chance: investigates (opens locker, looks under desk)
    - 10% chance: leaves immediately (distracted by ARIA-9 interference)
    - If investigated and player is holding breath: 50% chance not found
    - If investigated and player is NOT holding breath: 90% chance found
```

### Moral Choice Tracking System

```
TRACKED VARIABLES (persistent across playthrough):
  empathy_score:     0-100 (starts 50)
  self_preservation: 0-100 (starts 50)
  curiosity:         0-100 (starts 50)
  sacrifice_count:   integer (starts 0)
  tapes_taken:       integer (starts 0)
  tapes_refused:     integer (starts 0)
  callers_helped:    integer (starts 0)
  callers_abandoned: integer (starts 0)

CHOICE EFFECTS:
  Call #0  "Yes"           → empathy +10, curiosity +5
           "No"            → self_preservation +10
           "Wrong number"  → curiosity +10, empathy -5

  Call #2  "Yes" (take tape) → empathy +5, sacrifice +1, composure -10
           "No" (refuse)    → self_preservation +10, empathy -5
           "How much?"      → curiosity +10, empathy -5

  Call #9  "Play it"        → empathy +15, sacrifice +1, composure -20
           "Wait"           → self_preservation +5, curiosity +5
           "Burn it"        → self_preservation +10, empathy -10, dread +20

  Call #12 "Cooperate"      → self_preservation +10, empathy -5, world: monitored flag
           "Don't know"     → curiosity +5, self_preservation +5
           "Who are you?"   → curiosity +15, empathy +5, composure -15

  Call #16 "Wanted to hear" → curiosity +20, ending path: SIGNAL
           "Looking for"    → empathy +20, ending path: RELAY
           "Don't know"     → (no change), ending path: DEAD AIR
           (Hidden) "Stop"  → self_preservation +20, empathy +10, ending path: WITNESS

WORLD RESPONSES:
  empathy > 70: Callers' voices are warmer. Grandmother's call gives +30 composure (was +25).
                The mother in Location 3 recognizes you. "You're the kind one, aren't you?"
  empathy < 30: Callers' voices are colder. The ECHO caller matches your voice exactly (no delay).
                The Guardian caller doesn't mention "her." The tape is blank.
  self_preservation > 70: More safe rooms appear (one extra per location).
                          Entities are slightly slower (the game rewards self-preservation).
  self_preservation < 30: Fewer safe rooms (one fewer per location, minimum 1).
                          Entities are slightly faster.
  curiosity > 70: More PIRATE band content available. Extra tapes in the environment.
                  The Bunker Archive Room has additional files.
  curiosity < 30: PIRATE band has less content. The Archive Room files are sealed.
```

### Puzzle System — Complete Specifications

#### Puzzle 1: Numbers Station Decode (Location 4 — Bunker)

```
OBJECTIVE: Open the Archive Room door (locked with 4-digit code)

STEPS:
  1. Enter Numbers Station room (C6)
  2. Avoid the Suit entity (stealth puzzle — record without entering vision cone)
  3. Record the broadcast: Press Y/Triangle when signal > 50
     - Recording captures 30 sec of numbers audio
     - Numbers are spoken in a code: "2 2 1 0 2" (matches Call #13 sequence)
     - But they're spoken at normal speed — too fast to parse
  4. Go to ARIA-9 Room (C9)
  5. Play the recording at the ARIA-9 terminal
     - ARIA-9 offers: "I can slow this down. But it costs signal."
     - Cost: Signal drops to 50 (from current value)
     - ARIA-9 plays the recording at 0.5x speed
     - Numbers are now parseable: "2 2 1 0 2"
  6. The code is 2-2-1-0-2 (matching Call #13's sequence array)
  7. Enter the code on the Archive Room door keypad

FAIL STATE:
  - If the player enters the wrong code 3 times: alarm sounds.
  - All Suits in the Bunker move to investigate (patrol routes redirect to Archive Room).
  - Player must hide until alarm resets (60 sec).
  - The code doesn't change. The player can try again after hiding.
```

#### Puzzle 2: The Collector's Tape (Location 1 — Neighborhood)

```
OBJECTIVE: Find the tape with the player's name in the Collector's archive

STEPS:
  1. Enter the Collector's House (House B)
  2. Enter the Archive Room (wall of tapes)
  3. The tapes are labeled with dates and names — hundreds of them
  4. The player's name is on one tape, but it's not visible (it's on the back wall)
  5. The player must tune to LOST band (which is locked in Location 1)
     - BAND CROSS-POLLINATION EVENT: The Collector's archive exists across bands.
       Tuning to LOST at low signal (20-30) reveals the names on the tape spines.
       The names glow faintly. Find yours.
    - This costs: Signal drops to 20 (forced low-signal tuning)
  6. Take the tape
  7. Play it in the Archive Room (X/Square button)
     - Audio: Your own voice. From the future. Phase 4 dialogue.
     - The voice says: "If you're hearing this, you made it to the tower.
       Don't trust the signal. Don't trust the silence. Trust the choice."
  8. The Collector's shadow appears in the doorway. Not hostile. It nods. Leaves.

This puzzle teaches:
  - Band cross-pollination (bands can be used in non-native locations)
  - Recording playback triggers events
  - Some content requires low signal (not high) — inverting the usual logic
```

#### Puzzle 3: The Liminal Navigation (Location 2 — Liminal Space)

```
OBJECTIVE: Find the exit to Location 3

STEPS:
  1. The Liminal Space has no map. Modules connect and rearrange.
  2. The player must learn the connection rules:
     - Office ↔ School ↔ Mall (always in this order)
     - Hospital ↔ Home (always paired)
     - 3:47 Room is a hub — it connects to all modules
     - The exit is behind a door only visible on LOST band
  3. Navigation strategy:
     - Tune to LIVING to stabilize the space (5 sec of fixed layout)
     - Move quickly during stabilization
     - When layout shifts, find the nearest 3:47 Room (it's always accessible)
     - From the 3:47 Room, tune to LOST and look for the exit door
  4. The exit door appears as a dark rectangle on the wall — only on LOST band
  5. The door leads to a staircase going down — to The Field / The Woods

LEARNING OBJECTIVE:
  This puzzle teaches that the radio is a navigation tool, not just a call receiver.
  LIVING = stability. LOST = finding hidden paths. LIMINAL = the chaos between.
```

---

## Audio Architecture — Exact Specification

### Godot Audio Bus Layout

```
MASTER BUS (0 dB)
├── ROOM_TONE (-6 dB)
│   └── Reverb (room-specific preset)
│   └── EQ (room-specific)
├── RADIO_AMBIENT (-8 dB)
│   └── BandPass (center freq = current band center)
│   └── Noise generator (white/pink/brown per band)
│   └── Signal strength via bus volume (AudioBusManager.set_bus_volume)
├── CALL_AUDIO (-3 dB)
│   └── Compressor (3:1 ratio, -20 dB threshold)
│   └── EQ (telephone band, 300-3400 Hz)
│   └── Distortion (waveshaper, amount = f(dread))
│   └── Reverb (small room, 0.3 sec decay)
├── DREAD_LAYER (-12 dB → 0 dB at dread 75+)
│   └── Low-pass filter (200 Hz cutoff)
│   └── Sine wave (55 Hz drone)
│   └── LFO (0.5 Hz, modulating drone pitch ±2 Hz)
│   └── Gain (automated: dread/100 * -12 dB)
├── STINGER (-3 dB)
│   └── No effects — raw, loud, brief
│   └── Sidechain to duck all other buses during stinger (-6 dB duck)
├── SILENCE (0 dB — hosts breathing AudioStreamPlayer; controller bus)
│   └── Dead air events (8-20s, game-triggered): phase-dependent muting
│       Phase 1-3: mutes RADIO_AMBIENT + CALL_AUDIO + STINGER
│       Phase 4: mutes ALL non-SILENCE/non-UI buses (breathing only)
│   └── Breathing volume: -24 dB (composure 100) → -6 dB (composure 0)
│   └── Automated by game events (not player-controlled)
└── UI (-6 dB)
    └── Button clicks, menu sounds (CRT-style bleeps)
    └── No effects — clean
```

### Audio Parameter Tables

#### Signal Quality → Audio Effect Mapping

```
Signal   Audio Effect
────────────────────────────────────────
100-80   Clean. No processing. Full frequency range.
80-60    Subtle static bed (white noise, -24 dB).
         High-frequency rolloff above 8 kHz.
60-40    Moderate static (-18 dB).
         Bandwidth reduced to 300-3000 Hz (telephone quality).
         Occasional 100ms dropouts (1 per 5 sec).
40-20    Heavy static (-12 dB).
         Bandwidth: 500-2000 Hz.
         Frequent dropouts (1 per 2 sec).
         Warble: ±3 Hz pitch modulation at 6.5 Hz.
20-0     Severe. Mostly static.
         Fragments only — words buried in noise.
         Pitch unstable (±8 Hz). Volume fluctuates ±6 dB.
0        Dead air. Silence.
```

#### Dread Level → Audio Effect Mapping

```
Dread    Audio Effect
────────────────────────────────────────
0-25     No dread layer. Ambient audio only.
25-50    Dread layer fades in: 55 Hz drone at -18 dB.
         Subtle. Barely conscious. Room feels heavier.
50-75    Drone at -12 dB. Add 82 Hz secondary drone (dissonant).
         LFO modulates drone pitch (±2 Hz, 0.5 Hz).
         Radio ambient gains a subtle pulse (1 Hz amplitude modulation).
75-100   Drones at -6 dB. Add 110 Hz tertiary drone.
         LFO speeds to 1.5 Hz. Radio ambient pulse at 2 Hz.
         Call audio gains distortion (waveshaper, amount = (dread-75)/25 * 0.3).
         Room tone gains a subsonic rumble (20 Hz, -15 dB).
100      BREAK: All drones peak at 0 dB for 2 sec.
         Then sustained tone (440 Hz, 3 sec).
         Then reset to dread = 75, drones at -9 dB.
```

#### Composure Level → Audio Effect Mapping

```
Composure  Audio Effect
────────────────────────────────────────
100-80     Clean. No artifacts.
80-60      Whisper layer: pink noise → bandpass (850 Hz, Q=1.8) at -30 dB.
           Intermittent (30% on, 70% off, 2-sec cycle).
60-40      Whisper at -24 dB. Continuous.
           Warble: ±3 Hz on call audio at 6.5 Hz.
40-20      Whisper at -18 dB.
           False voices: 10% chance per 30 sec.
           False voice = pitch-shifted recording of previous call audio,
           played at -12 dB with heavy reverb.
20-0       Whisper at -12 dB. Constant.
           False voices: 30% chance per 30 sec.
           Call audio distortion: waveshaper, amount = (40-composure)/40 * 0.35.
           Radio may auto-tune: 5% chance per 10 sec, retunes to ████████ for 3 sec.
0          BREAK: 10-sec loss of control.
           Radio auto-tunes to ████████.
           Random false call plays (from a pool of unused procedural calls).
           All audio processes at maximum intensity.
           After 10 sec: composure resets to 20. Audio normalizes.
```

### Location Audio Profiles — Exact Parameters

```
LOCATION          ROOM_TONE                    RADIO_AMBIENT_TYPE    DREAD_BASE
──────────────────────────────────────────────────────────────────────────────
Station (S1-2)    Equipment hum + fluorescent  White noise           0
Station (S3-4)    Degraded hum + intermittent  White noise           5
Station (S5)      Near-silence + whisper       White noise (faint)   20
The Break         None (total silence)         White noise (weak)   30
Neighborhood      Crickets + wind + TV static  White noise           10
Liminal Space     Ventilation + echo          Pink noise            15
Field/Woods       Wind + birds + open air     Brown noise           5
Bunker            Concrete echo + server hum  Modulated tones       20
Origin Site       Tube warmth + 1920s crackle  Silence-breaking     40

ROOM_TONE VOLUMES:
  Station S1-2: -6 dB (present, comfortable)
  Station S3-4: -8 dB (fading)
  Station S5: -20 dB (almost gone)
  The Break: -∞ dB (none)
  Neighborhood: -12 dB (quiet suburban)
  Liminal: -10 dB (present, oppressive)
  Field/Woods: -15 dB (open, spacious)
  Bunker: -8 dB (enclosed, heavy)
  Origin: -6 dB (present, ancient)
```

---

## Visual Design — Exact Specifications

### CRT Post-Processing Stack

```
CRT SHADER PARAMETERS (applied as screen-space post-process):

1. SCANLINES
   - Line spacing: 2px
   - Line opacity: 0.15 (normal), 0.35 (low composure)
   - Vertical roll: 0 (normal), occasional 1-frame jump (dread > 50)

2. PHOSPHOR GLOW
   - Bloom radius: 4px
   - Bloom intensity: 0.3 (normal), 0.6 (low composure)
   - Color: amber (#FFA500) default, shifts to red (#FF3300) at dread > 75

3. CURVATURE
   - Barrel distortion: 0.02 (subtle)
   - Increases to 0.06 at composure < 20

4. FLICKER
   - Base: 60 Hz refresh simulation (subtle brightness oscillation, ±0.02)
   - At dread > 50: occasional 1-frame darkening (±0.15, 1 per 10 sec)
   - At dread > 75: frequent flicker (±0.2, 1 per 3 sec)
   - At composure < 20: color inversion frames (1-2 frames, 1 per 15 sec)

5. GLITCH (composure < 40)
   - Horizontal pixel shift: 2-8px, random rows, 1 per 5 sec
   - Color channel split: R+1px, B-1px, 1 per 8 sec
   - At composure < 20: full-frame tear (horizontal line, 1 per 4 sec)

6. VIGNETTE
   - Inner radius: 0.3
   - Outer radius: 0.8
   - Intensity: 0.3 (normal), 0.6 (dread > 75)
```

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                                                     │
│              [GAME WORLD — FIXED CAMERA]             │
│                                                     │
│                                                     │
│                                                     │
│  ┌──────────┐                      ┌──────────┐    │
│  │ COMPOSE  │                      │  SIGNAL  │    │
│  │ ████░░░░ │  62                  │ ███████░ │  85 │
│  └──────────┘                      └──────────┘    │
│  ┌──────────┐                      ┌──────────┐    │
│  │  DREAD   │                      │  BAND    │    │
│  │ ██████░░ │  71                  │ LIMINAL  │    │
│  └──────────┘                      │ 102.3 FM │    │
│                                     └──────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ ▶ TAPE #5 — Echo Chamber          [X] PLAY  │    │
│  │ ▶ TAPE #6 — Signal From Guardian  [X] PLAY  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [L-Stick: Tune] [Y: Record] [X: Play] [A: Interact]│
└─────────────────────────────────────────────────────┘

UI ELEMENTS:
  - All meters: CRT-style bar graphs (segmented, amber glow)
  - Tape list: Collapsible drawer, shows on D-pad up/down
  - Band display: Always visible, bottom right
  - Frequency: Always visible, bottom right (under band)
  - Interact prompt: Contextual, bottom left ("Press A to sit")
  - No minimap (player navigates by radio signal)
  - No health bar (composure IS health, it's already shown)

HIDE MODE UI:
  When hiding, the UI contracts to just the meters:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │                                                     │
  │           [FIRST PERSON — LIMITED VIEW]              │
  │           (Through locker slats / under desk)        │
  │                                                     │
  │                                                     │
  │  ┌──┐ ┌──┐ ┌──┐                                    │
   │  │CO│ │SI│ │DR│   [L2] HOLD BREATH                 │
   │  │62│ │85│ │71│                                    │
   │  └──┘ └──┘ └──┘                                    │
  └─────────────────────────────────────────────────────┘
  - Radio is muted during hiding (player choice — radio silence = safer)
  - The only audio is the player's breathing and the entity's movements
```

### Color Palette

```
BASE COLORS (CRT palette):
  Background:     #0A0A0A (deep black, not pure)
  Primary text:   #FFA500 (amber)
  Secondary text: #00FF41 (phosphor green — used for data/terminal)
  Alert/Danger:   #FF3300 (blood red)
  Static/Unknown: #FFFFFF (pure white — used sparingly)
  Band colors:    Per band (see Band System spec)

VARIATION BY STATE:
  Normal:         Full palette, warm amber dominant
  Dread > 50:     Desaturation 15%, amber shifts toward red
  Dread > 75:     Desaturation 35%, red dominant, green faded
  Composure < 40: Color instability (CRT shader handles this)
  Composure < 20: Severe desaturation, occasional color inversion
  Safe room:       Full palette, no desaturation, warm amber — the CRT is healthy here
```

---

## Control Scheme

```
GAMEPAD (PRIMARY — Xbox/PlayStation layout):

  Left Stick X:     Radio frequency tuning
  Left Stick Y:     (unused in radio mode) / Move (explore mode)
  Right Stick:      (unused — fixed camera, no look)
  D-Pad Up/Down:    Tape selection
  D-Pad Left/Right: Band quick-switch (cycles unlocked bands)
  A / Cross:        Interact / Confirm choice
  B / Circle:       Cancel / Close
  X / Square:       Play selected tape
  Y / Triangle:     Toggle record
  L1 / LB:          Radio mute (stealth)
  L2 / LT:          Hold breath (hiding)
  R1 / RB:          Flashlight toggle (Phase 3 — limited battery)
  R2 / RT:          Sprint (explore mode)
  Start:            Pause (only in safe rooms — no pause during calls/entities)
  Select:           Tape collection menu

KEYBOARD/MOUSE (SECONDARY):

  A/D:              Radio frequency tuning (left/right)
  W/S:              Move forward/back
  Q/E:              Strafe left/right
  Mouse:            (unused — fixed camera)
  1-8:              Band quick-select
  Space:            Interact / Confirm
  Esc:              Cancel / Close
  R:                Toggle record
  T:                Play selected tape
  Shift:            Sprint
  Ctrl:             Hold breath (hiding)
  M:                Radio mute
  Tab:              Tape collection menu
  F:                Flashlight toggle

MODE CONTEXT:
  Radio Mode (Phase 1):   Movement disabled, radio controls active
  Explore Mode (Phase 2+): Movement enabled, radio is L-Stick X only
  Call Mode (any phase):  Movement disabled, choice buttons active
  Hide Mode (any phase):  Movement disabled, breath hold active, radio muted
```

---

## Save System

```
FORMAT:
  - Save points: Cassette tapes in safe rooms (physical object, interact to save)
  - One save per safe room (the cassette is consumed on use)
  - Save data includes:
    * Phase, shift, location
    * Composure, Signal, Dread values
    * Tapes collected (IDs)
    * Moral choice variables (empathy, self_preservation, curiosity, etc.)
    * Bands unlocked
    * Radio upgrades
    * Entity states (patrol positions, alive/dead flags)
    * Station degradation level
    * Playtime

SAVE ROOMS:
  Phase 1:  Booth (Shifts 2-4, reusable per shift)
  Phase 2:  None
  Location 1: Harold's garden shed (1 use)
  Location 2: The bathroom (1 use)
  Location 3: The bridge (1 use) + Grandmother's house (1 use)
  Location 4: Server room (1 use)
  Location 5: None

TOTAL SAVES: ~8-10 per playthrough (depending on difficulty)

DEATH/FAIL:
  - The player cannot die in the traditional sense.
  - Being "caught" by an entity = relocation + stat penalties (not death).
  - Composure breaking = temporary loss of control + stat penalties (not death).
  - Dread breaking = temporary chaos + stat penalties (not death).
  - The only "game over" is if the player quits. The game saves on quit at
    the last safe room used (checkpoint system — resume from last save).
  - This supports the Clock Tower / IHNMAIMS philosophy: the game doesn't
    kill you, it *punishes* you. You survive. You always survive. But at what cost?
```

---

## Existing Content — Call-by-Call Recontextualization

Each of the 18 sacred calls is preserved with its original text. Here is how each is recontextualized in the redesign:

```
CALL #  ORIGINAL CONTEXT          REDESIGN CONTEXT
────────────────────────────────────────────────────────────────────────
0       Phase 1, Shift 1          Phase 1, Shift 1 — unchanged
        RIGHT_ANSWER              First moral choice. Teaches the choice system.
                                  Player is at the console. The number disconnects.

1       Phase 1, Shift 1          Phase 1, Shift 1 — unchanged
        DEAD_AIR                  8 seconds of silence. Teaches that silence is content.
                                  First dread tick (+5).

2       Phase 1, Shift 2          Phase 1, Shift 2 — unchanged
        RIGHT_ANSWER              The Collector. First tape available.
                                  In Phase 3: The Collector's House (Location 1) contains
                                  the archive. The call replays from the house, not the radio.

3       Phase 1, Shift 1          Phase 1, Shift 1 — unchanged
        JUST_LISTEN               Harold. The garden report. 14 years of grief.
                                  In Phase 3: Harold's house (Location 1) is real.
                                  Harold's voice comes from the kitchen. He says your name.

4       Phase 1, Shift 2          Phase 1, Shift 2 — unchanged
        STAY_CALM                 The Loop. Teaches the dread meter (STAY_CALM calls
                                  raise dread faster — 20 penalty).
                                  In Phase 3: The Liminal Space has the Loop's room.
                                  The loop plays on the walls (text projections).

5       Phase 1, Shift 2          Phase 1, Shift 2 — unchanged
        DEAD_AIR                  3:47 AM. 12 seconds of silence. Tape #3.
                                  In Phase 3: The 3:47 Room in The Liminal Space.
                                  The clock is frozen. Taking the tape starts it.

6       Phase 1, Shift 3          Phase 1, Shift 3 — unchanged
        RIGHT_ANSWER              Yesterday's Call. Teaches that the calls remember you.
                                  Moral choice: lie (empathy +, composure -) or truth.

7       Phase 1, Shift 3          Phase 1, Shift 3 — unchanged
        JUST_LISTEN               Echo. The voice that comes back different.
                                  In Phase 3: The Liminal Space Office module.
                                  The radio plays the echo 30 sec ahead of schedule.

8       Phase 1, Shift 3          Phase 1, Shift 3 — unchanged
        JUST_LISTEN               Guardian. The most positive call. +10 sanity.
                                  In Phase 3: The bridge (Location 3 save room).
                                  His voice plays from the bridge railing.

9       Phase 1, Shift 3          Phase 1, Shift 3 — unchanged
        RIGHT_ANSWER              Missing Persons. The mother and the cassette.
                                  In Phase 3: The mailbox (Location 3).
                                  The player finds the mailbox. The choice is physical.

10      Phase 1, Shift 4          Phase 1, Shift 4 — unchanged
        JUST_LISTEN               Grand. +25 sanity. The warmest call.
                                  In Phase 3: Grandmother's house (Location 3).
                                  She's not there, but the house is warm. The chair is.

11      Phase 1, Shift 4          Phase 1, Shift 4 — unchanged
        JUST_LISTEN               Free Spirit. +20 sanity. Open sky.
                                  In Phase 3: The woods clearing (Location 3).
                                  His voice plays from the trees. The sky is visible.

12      Phase 1, Shift 4          Phase 1, Shift 4 — unchanged
        RIGHT_ANSWER              Agent 7. First CLASSIFIED call. The government knows.
                                  Moral choice: cooperate (monitored flag) or resist.
                                  In Phase 3: The Bunker (Location 4). Agent 7's suit
                                  is in a locker. It's empty. He's not in it. He's you.

13      Phase 1, Shift 4          Phase 1, Shift 4 — unchanged
        SIGNAL_DECODE             ARIA-9. The code sequence [2,2,1,0,2].
                                  In Phase 3: The Bunker. The code opens the Archive Room.
                                  ARIA-9 is in the Bunker. She's real. She's trapped.

14      Phase 1, Shift 5          Phase 1, Shift 5 — unchanged
        JUST_LISTEN               The Whistlebllower. 90-second monologue. Tape #12.
                                  In Phase 3: The Bunker Wire Room. His notes are there.
                                  The full recording (uncut) is in the Archive Room.

15      Phase 1, Shift 5          Phase 1, Shift 5 — unchanged
        JUST_LISTEN               Origin. 1923. Your name. -30 sanity. Tape #13.
                                  In Phase 3: The Origin Site. The 1923 voice is real.
                                  The tower is real. The first transmission is real.

16      Phase 1, Shift 5          Phase 1, Shift 5 — unchanged
        RIGHT_ANSWER              You Called Us. The meta-choice. Tape #14.
                                  In Phase 4: The Chamber. The choice is made in person.
                                  This call determines the ending path.

17      Phase 1, Shift 5          Phase 1, Shift 5 — unchanged
        DEAD_AIR                  The final call. 20 seconds of silence. +30 sanity.
                                  Something answers. The game doesn't tell you what.
                                  This call ENDS Phase 1. The station goes dark.
                                  The player stands. The portable radio is on the desk.
                                  The door opens. Phase 2 begins.
```

---

## Tape Locations — Complete

```
TAPE #   TITLE                          LOCATION                          HOW OBTAINED
────────────────────────────────────────────────────────────────────────────────────────
1        The Wrong Number               Phase 1, Shift 1                 Call #0 choice 3 (wrong number)
2        The Collector's Archive        Phase 1, Shift 2 / Loc 1 House B  Call #2 choice 1 OR found on archive wall
3        The 3:47 Sessions              Phase 1, Shift 2 / Loc 2 3:47 Rm Call #5 OR on the clock face
4        Yesterday's Frequency          Phase 1, Shift 3                 Call #6 choice 1
5        Echo Chamber                   Phase 1, Shift 3 / Loc 2 Office  Call #7 OR in the Office module
6        Signal From Guardian           Phase 1, Shift 3 / Loc 3 Bridge Call #8 OR on the bridge railing
7        Found Signal                   Phase 1, Shift 3 / Loc 3 Mailbox Call #9 choice 1 OR in the mailbox
8        Her Voice                      Phase 1, Shift 4 / Loc 3 House   Call #10 OR on the kitchen table
9        Open Sky                       Phase 1, Shift 4 / Loc 3 Woods   Call #11 OR on the clearing stump
10       Courtesy Call                  Phase 1, Shift 4 / Loc 4 Bunker  Call #12 choice 3 OR in the Suit's locker
11       ARIA-9 Transcript              Phase 1, Shift 4 / Loc 4 ARIA-9   Call #13 OR in the ARIA-9 terminal
12       The Network                    Phase 1, Shift 5 / Loc 4 Archive Call #14 OR in the Archive Room files
13       First Transmission             Phase 1, Shift 5 / Loc 5 Clearing Call #15 OR at the tower base
14       The Choice                     Phase 1, Shift 5 / Loc 5 Chamber  Call #16 OR on the chair
15       What Answered                  Phase 1, Shift 5 / Loc 5 Crystal  Call #17 OR embedded in the crystal

NOTE: Each tape can be obtained in TWO ways:
  1. Through the original call (Phase 1) — same as current game
  2. Through environmental discovery (Phase 3) — new to the redesign

If the player already has a tape from Phase 1, finding it in the environment
plays additional content (extended recording, different perspective, or
commentary from the entity in that location).
```

---

## Difficulty System — Exact Parameters

```
PARAMETER           EASY    NORMAL    HARD      NIGHTMARE
──────────────────────────────────────────────────────────
Composure start       100     100      100       80
Composure regen       ×1.5    ×1.0     ×0.7     ×0.5
Signal decay rate     ×0.7    ×1.0     ×1.3     ×1.5
Dread gain            ×0.7    ×1.0     ×1.3     ×1.5
Dread loss            ×1.3    ×1.0     ×0.7     ×0 (only safe rooms)
Entity patrol speed   ×0.8    ×1.0     ×1.2     ×1.3
Entity vision range    6m      8m       10m      12m
Entity vision cone    35°     45°      55°      65°
Save rooms per loc    +1      base     -1       1 only
Hallucination onset   10      20       30       40 (composure threshold)
False voice chance    5%      10%      20%      30%
Radio sensitivity     ×1.2    ×1.0     ×0.85    ×0.7 (harder to tune)
PIRATE drift          off     on       on       on (+ faster)
Safe room dread regen  ×1.5   ×1.0    ×0.7     ×0 (no regen)
Caught penalty        -15     -25      -35      -50 (composure)
Starting dread (S5)    20      40      55       70
Breather duration      90s     60s     45s      30s
```

---

## Procedural Call Generation (carried forward, expanded)

The existing procedural call system is retained. In the redesign, procedural calls serve as:

1. **Phase 1 filler:** Between sacred calls, procedural calls fill the shift. They use the same call types (JUST_LISTEN, RIGHT_ANSWER, etc.) but with generated content appropriate to the active band.

2. **Phase 3 field calls:** In each location, procedural calls provide ambient radio content. They're themed to the location (suburban calls in The Neighborhood, temporal distortion calls in The Liminal Space, grief calls in The Field/Woods, institutional calls in The Bunker).

3. **Phase 4 false calls:** At low composure, false calls are generated from procedural templates but with corrupted content — wrong names, reversed audio, calls that reference the player instead of fictional callers.

```
PROCEDURAL CALL PARAMETERS PER BAND:

BAND        VOICE STYLE         CONTENT THEME             DREAD COST
────────────────────────────────────────────────────────────────────
LIVING      Normal, warm       Mundane with wrong detail  +3
LIMINAL     Echoey, delayed    Time confusion, loops      +5
LOST        Distant, sad       Death, loss, missing       +4 (but can be +0 if emotional)
CLASSIFIED  Flat, institutional  Orders, codes, threats   +6
████████    Inhuman, static    Unnameable, perception     +10
WEATHER     Buried in static   Environmental, atmospheric  +3
PIRATE      Rebel, raw         Anti-establishment, secrets +5
HISTORICAL  Period-accurate    1920s-1990s broadcasts     +4
```

---

## Accessibility

```
OPTION              DESCRIPTION
──────────────────────────────────────────────────────────────
Subtitles           All call audio is subtitled (text already exists from call data)
Subtitle BG         Optional background panel for readability
Audio cues          Visual indicators for audio-only events (radio static level,
                    entity proximity, stinger warnings)
Colorblind          Band colors have distinct patterns (stripes, dots, solid)
Composure effects   Option to reduce visual glitch intensity (does not change gameplay)
Camera shake        Option to reduce/disable camera shake
Difficulty          4 levels (see Difficulty System spec)
Hold breath         Toggle mode (press instead of hold) for accessibility
Save system         Manual saves — player controls when to save
Pause               Pause available in safe rooms only (design intent —
                    the horror doesn't pause). Accessibility override: pause anywhere
                    (disables achievements on Nightmare difficulty)
```

---

## Design Pillars

### Pillar 1: "The radio is the only tool"

The player interacts with the world through the radio. No weapons, no traditional tools. Tuning, signal, bands, and recording are the verbs. If a feature doesn't involve the radio, it doesn't belong.

### Pillar 2: "Listening is the gameplay"

The core loop is: tune → listen → decide. The player's primary action is _paying attention_. The game rewards listening carefully (catching details in static, identifying false voices, timing responses) and punishes inattention.

### Pillar 3: "You cannot fight — you survive"

No combat. Threats are survived, not defeated. Hiding, fleeing, and enduring are the responses to danger. This creates helplessness (Clock Tower) and ensures the horror stays horror, not action.

### Pillar 4: "Every choice costs something"

Moral weight in every decision. No choice is free. Tapes cost composure. Safety costs progress. Helping costs you. The game tracks your choices and the world responds.

### Pillar 5: "The mundane made sinister"

The horror lives in the familiar. A grandmother's voice. A garden report. A wrong number. The moment the player realizes something is _off_ is more powerful than any jump scare. Subtle wrongness over loud fright.

---

## Anti-Pillars

- **No combat.** The player never gets a weapon. The radio is not a weapon — it's a tool for perception and communication.
- **No jump scares as primary horror.** Stingers exist but they're punctuation, not the sentence. The horror is the growing wrongness, not the sudden loud.
- **No omniscient perspective.** The player knows what the radio tells them. Fixed camera means you can't see everything. You navigate blind and the radio is your cane.
- **No "winning."** The endings are choices about what you lose. There is no ending where everything is okay.
- **No filler content.** Every call, every location, every tape exists for a reason. No padding. If it doesn't serve the horror or the story, cut it.

---

## Engine Migration

### Recommendation: Godot 4 (phases 1-3), evaluate Unreal 5 for phase 4

**Why Godot first:**

- Free, open-source, no licensing fees
- Strong 2D/3D hybrid (perfect for fixed camera + 3D environments)
- GDScript is accessible and fast to prototype
- Excellent audio server (bus system, effects, real-time DSP)
- Lightweight — runs on modest hardware
- The `godot/` directory already exists in the project
- Can deploy to PC, Mac, Linux, mobile, and console

**Why Unreal eventually:**

- Phase 4 (The Descent) may require higher-fidelity 3D, advanced lighting, and Nanite/Lumen for the final locations
- If the scope grows beyond what Godot handles comfortably
- Market visibility on PC/console storefronts

**Migration path:**

1. Prototype the radio mechanics in Godot (signal tuning, band selection, audio layering)
2. Build Phase 1 (The Station) in Godot as a vertical slice
3. Evaluate: Does Godot handle the fixed camera + audio system well enough for Phase 3?
4. If yes: continue in Godot through full release
5. If no: migrate to Unreal for Phase 3-4, keeping Godot prototype as reference

---

## Vertical Slice Plan

### Scope: Phase 1, Shift 1+2

**Must include:**

- Radio tuning mechanics (analog dial, 2 bands, signal strength)
- Call system (5 calls: 1 procedural + Calls #0, #1, #3, #2)
- Composure/Signal/Dread meters with visible audio/visual effects
- CRT post-processing (scanlines, phosphor, curvature, flicker)
- Station explorable space (booth, hallway, bathroom, back office, rooftop)
- Station degradation (Shift 1 normal → Shift 2 subtle wrongness)
- Audio layering (room tone, radio ambient, call audio, dread layer, 1 stinger, silence)
- 1 safe room (booth, Shift 2)
- 1 hiding sequence (Phase 2 segment — the Follower)
- UI (meters, radio display, tape list, interact prompts)
- Save system (booth cassette)
- 3 tapes obtainable (Tapes #1, #2, #3)

**Must NOT include:**

- Phase 3 locations
- Entity AI (the Follower in Phase 2 is scripted, not AI-driven)
- CLASSIFIED / ████████ bands
- Multiple endings
- Procedural call generation (use pre-written calls only)

**Success criteria:**

- Player can tune the radio and hear clear difference between LIVING and LIMINAL
- Player takes a call and makes a choice that visibly affects all three meters
- Player experiences audio shift when dread increases (dread layer fades in)
- Player notices at least one station wrongness event
- Player uses the save room
- Player completes Shift 2 and wants to play Shift 3

**Estimated time:** 6-10 weeks (solo dev, Godot, assuming audio assets are sourced/synthesized)

---

## Risk Register

| Risk                                                 | Probability | Impact | Mitigation                                                                            |
| ---------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------------------------- |
| Audio system complexity                              | High        | High   | Prototype radio mechanics first; the audio IS the game                                |
| Fixed camera in 3D engine                            | Medium      | Medium | Godot handles this well; test early with placeholder geometry                         |
| Scope of 5 locations                                 | High        | High   | Build Phase 1 as vertical slice; each location is modular and independently buildable |
| Moral choice tracking complexity                     | Medium      | Medium | Start with simple flags; expand only if proven valuable                               |
| Engine migration risk                                | Medium      | High   | Godot first; evaluate before committing to full scope                                 |
| Writing volume (new location content)                | High        | Medium | Preserve existing call content; new writing for locations only                        |
| Player confusion (radio as primary interface)        | Medium      | High   | Strong tutorial in Phase 1 Shift 1; the first shift teaches the radio                 |
| Audio asset creation                                 | High        | High   | Use Web Audio synthesis (port existing engine) + selective Foley                      |
| 3D environment art                                   | High        | High   | Stylized low-poly + CRT post-processing hides fidelity issues                         |
| Performance (real-time audio + 3D + post-processing) | Medium      | Medium | Profile early; Godot audio server is efficient; reduce poly count if needed           |

---

## Next Steps

1. **Engine prototype:** Build radio tuning mechanics in Godot 4 — analog dial feel, band switching, signal strength, audio layering. This is the core mechanic — prove it feels good before anything else.
2. **Vertical slice:** Phase 1, Shifts 1-2 — one playable session demonstrating all core systems
3. **Audio pipeline:** Port the existing Web Audio synthesis engine to Godot's audio server. Establish the 6-layer bus system.
4. **Content migration:** Port existing call content into the new engine structure. All 18 sacred calls are preserved.
5. **Location design:** Design The Neighborhood (Phase 3, Location 1) as the first post-station environment — it's the most grounded and tests the fixed camera + exploration mechanics.
6. **Evaluate:** After vertical slice, assess Godot vs Unreal for the full scope based on actual performance and development velocity.
