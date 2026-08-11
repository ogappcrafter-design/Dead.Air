# tape_data.gd — Individual tape resource for Godot
# DEA-149: React Native → Godot asset migration
# Source: data/calls.js ALL_TAPES (display names) + data/tapes.ts TAPES (metadata)
class_name TapeData
extends Resource

## Tape ID from tapes.ts (e.g. "tape-001")
@export var tape_id: String

## Display name from ALL_TAPES in calls.js (e.g. "Tape #1 — The Wrong Number")
@export var display_name: String

## Title from tapes.ts (e.g. "First Night")
@export var title: String

## Description from tapes.ts
@export var description: String

## Band name from tapes.ts (LIVING, LIMINAL, LOST, CLASSIFIED, ████████)
@export var band: String

## Duration string from tapes.ts (e.g. "4:32")
@export var duration: String

## Rarity tier from tapes.ts (common, uncommon, rare, legendary)
@export var rarity: String

## Call ID that grants this tape (from CALLS where tape=true), -1 if not linked
@export var linked_call_id: int
