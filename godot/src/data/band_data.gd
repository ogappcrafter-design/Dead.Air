# band_data.gd — Individual band resource for Godot
# DEA-149: React Native → Godot asset migration
# Source: data/calls.js BANDS + BAND_VIBES
class_name BandData
extends Resource

## Band index (0-4 for sacred bands)
@export var id: int

## Band display name (LIVING, LIMINAL, LOST, CLASSIFIED, ████████)
@export var name: String

## Frequency string (preserves FM/AM suffix from calls.js)
@export var freq: String

## Band color (CRT palette)
@export var color: Color

## Unlock requirement (call count threshold)
@export var unlock_at: int

## Band vibe / atmosphere description
@export var vibe: String
