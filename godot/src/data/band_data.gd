# band_data.gd — Individual band resource for Godot
# DEA-149: React Native → Godot asset migration
# DEA-97: Extended with radio tuning fields
# Source: data/calls.js BANDS + BAND_VIBES + GDD radio tuning spec
class_name BandData
extends Resource

## Band index (0-7 for all bands: 5 sacred + 3 extended)
@export var id: int

## Band display name (LIVING, LIMINAL, LOST, CLASSIFIED, ████████, WEATHER, PIRATE, HISTORICAL)
@export var name: String

## Frequency string (preserves FM/AM suffix from calls.js, for display)
@export var freq: String

## Band color (CRT palette)
@export var color: Color

## Unlock requirement (call count threshold)
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
