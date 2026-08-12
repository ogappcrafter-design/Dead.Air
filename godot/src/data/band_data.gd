# band_data.gd — Individual band resource for Godot
# DEA-149: React Native → Godot asset migration
# DEA-97: Extended with radio tuning fields
# DEA-99: Extended with band unlock logic fields
# Source: data/calls.js BANDS + BAND_VIBES + GDD radio tuning spec
class_name BandData
extends Resource

## How a band is unlocked.
enum UnlockType {
	START,       ## Available from start (LIVING, WEATHER)
	SHIFT,       ## Unlocked at a specific shift number (LIMINAL=2, PIRATE=3)
	TIME_TUNING, ## Unlocked by tuning a specific band for X seconds (LOST: tune LIMINAL 30s)
	EVENT,       ## Unlocked by a specific game event (CLASSIFIED, ████████, HISTORICAL)
}

## Band index (0-7 for all bands: 5 sacred + 3 extended)
@export var id: int

## Band display name (LIVING, LIMINAL, LOST, CLASSIFIED, ████████, WEATHER, PIRATE, HISTORICAL)
@export var name: String

## Frequency string (preserves FM/AM suffix from calls.js, for display)
@export var freq: String

## Band color (CRT palette)
@export var color: Color

## Unlock requirement (call count threshold) — legacy field, superseded by unlock_type
@export var unlock_at: int

## Band vibe / atmosphere description
@export var vibe: String

## --- DEA-97 Radio Tuning Fields ---

## Center frequency (sweet spot) in MHz. For PIRATE this is the base center; drift is applied at runtime.
@export var center_frequency: float = 0.0

## Sensitivity: higher = wider sweet spot. Signal drops faster with lower sensitivity.
@export var sensitivity: float = 1.0

## Minimum frequency in the band's range (MHz)
@export var freq_range_min: float = 0.0

## Maximum frequency in the band's range (MHz)
@export var freq_range_max: float = 0.0

## Whether this band's center frequency drifts over time (PIRATE band only)
@export var drifts: bool = false

## Drift amount in MHz (± this value every drift_interval seconds)
@export var drift_amount: float = 0.3

## Drift interval in seconds
@export var drift_interval: float = 30.0

## --- DEA-99 Band Unlock Fields ---

## How this band is unlocked
@export var unlock_type: UnlockType = UnlockType.START

## For SHIFT type: minimum shift number to unlock (LIMINAL=2, PIRATE=3)
@export var unlock_shift: int = 0

## For TIME_TUNING type: which band id the player must tune (LOST → LIMINAL=1)
@export var unlock_time_tuning_band: int = -1

## For TIME_TUNING type: how many seconds the player must tune the band (LOST → 30.0)
@export var unlock_time_seconds: float = 0.0

## For EVENT type: event identifier that triggers unlock
## CLASSIFIED → "frequency_clue", ████████ → "classified_event", HISTORICAL → "antique_radio"
@export var unlock_event_id: String = ""
