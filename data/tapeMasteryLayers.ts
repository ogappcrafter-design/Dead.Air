// data/tapeMasteryLayers.ts
// DEA-5: Hidden audio layer data for the Tape Mastery system.
//
// Each tape has up to three layers: Surface, Depth, Abyss. The Surface
// layer is the base audio (always available on first listen). Depth and
// Abyss layers contain hidden content unlocked at 5th and 10th listens.
//
// This file is SEPARATE from data/calls.js (sacred, never modified).
// Layer content is flavor text + optional audio cue descriptions used by
// the playback UI to show the player what hidden content they've unlocked.

import type { TapeMasteryLayer } from '../engine/progression/TapeMastery';
import { MASTERY_THRESHOLDS } from '../engine/progression/TapeMastery';

// --- Base game tapes (tape-001..015) mastery layers ---

const baseTapeLayers: TapeMasteryLayer[] = [
  // tape-001: First Night
  {
    tapeId: 'tape-001',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Your first shift. Everything seems normal.',
  },
  {
    tapeId: 'tape-001',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'Beneath the static, a second voice can be heard counting down.',
    audioCue: 'Faint counting behind the primary audio',
  },
  {
    tapeId: 'tape-001',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The countdown reaches zero. The recording changes. It is no longer your first night.',
    audioCue: 'Complete tonal shift, reversed vocals',
  },
  // tape-002: Static Lullaby
  {
    tapeId: 'tape-002',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'A child hums through the interference.',
  },
  {
    tapeId: 'tape-002',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The humming stops. The child whispers a name. It is yours.',
    audioCue: 'Whispered name at 2:14',
  },
  {
    tapeId: 'tape-002',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The child is no longer humming. The child is no longer a child.',
    audioCue: 'Deep drone replacing the vocal track',
  },
  // tape-003: The Last Broadcast
  {
    tapeId: 'tape-003',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: "They signed off. They didn't come back.",
  },
  {
    tapeId: 'tape-003',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content:
      'After the sign-off, the carrier wave continues. Someone forgot to turn off the transmitter.',
    audioCue: 'Silent carrier wave, 30 seconds after sign-off',
  },
  {
    tapeId: 'tape-003',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The transmitter was never turned on. The broadcast came from inside the station.',
    audioCue: 'Room tone bleedthrough at maximum volume',
  },
  // tape-004: Numbers
  {
    tapeId: 'tape-004',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Seven. Seven. Seven. Seven.',
  },
  {
    tapeId: 'tape-004',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The numbers are not random. They are coordinates. They point to the station.',
    audioCue: 'Morse code overlay encoding lat/long',
  },
  {
    tapeId: 'tape-004',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You have been to those coordinates. You are there now. You have always been there.',
    audioCue: 'Subsonic drone at 0.5 Hz',
  },
  // tape-005: Dead Air
  {
    tapeId: 'tape-005',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'The silence between stations.',
  },
  {
    tapeId: 'tape-005',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The silence is not empty. Something is breathing in it.',
    audioCue: 'Faint respiratory sound, 12 breaths per minute',
  },
  {
    tapeId: 'tape-005',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The breathing matches yours. It stops when you stop.',
    audioCue: 'Biometric sync with listener pulse',
  },
  // tape-006: Emergency
  {
    tapeId: 'tape-006',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'This is not a test.',
  },
  {
    tapeId: 'tape-006',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'It was never a test. The emergency is real. It has been real for some time.',
    audioCue: 'Emergency broadcast tone, continuous',
  },
  {
    tapeId: 'tape-006',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You are the emergency.',
    audioCue: 'Complete audio drop, then heartbeat',
  },
  // tape-007: Lullaby
  {
    tapeId: 'tape-007',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Go to sleep. Go to sleep. Go to sleep.',
  },
  {
    tapeId: 'tape-007',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The lullaby is not for you. It is for the thing in the next room.',
    audioCue: 'Secondary vocal track, panned hard right',
  },
  {
    tapeId: 'tape-007',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You are the thing in the next room. You have been singing to yourself.',
    audioCue: 'Phase-reversed mono collapse',
  },
  // tape-008: The Signal
  {
    tapeId: 'tape-008',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'You found it. Now it found you.',
  },
  {
    tapeId: 'tape-008',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content:
      'The signal predates the station. The signal predates radio. The signal predates sound.',
    audioCue: 'Pre-recorded artifact, analog degradation',
  },
  {
    tapeId: 'tape-008',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You are the signal. You have been transmitting since before you were born.',
    audioCue: 'Full spectrum harmonic resonance',
  },
  // tape-009: Frequencies
  {
    tapeId: 'tape-009',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Every number has a name.',
  },
  {
    tapeId: 'tape-009',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'Your name is among them. It is number 7.',
    audioCue: 'Named tone sequence at 7th position',
  },
  {
    tapeId: 'tape-009',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'All the names are yours. You are everyone who has ever listened.',
    audioCue: 'Overlapping voice synthesis, all same pitch',
  },
  // tape-010: Whispers
  {
    tapeId: 'tape-010',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: "They're talking about you.",
  },
  {
    tapeId: 'tape-010',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'They are talking TO you. You have been refusing to listen.',
    audioCue: 'Whispered direct address, reversed',
  },
  {
    tapeId: 'tape-010',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You are the one whispering. The recording is your own voice.',
    audioCue: 'Self-referential audio loop',
  },
  // tape-011: The Void
  {
    tapeId: 'tape-011',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Listen too long and it listens back.',
  },
  {
    tapeId: 'tape-011',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'It has been listening back since the second time you pressed play.',
    audioCue: 'Microphone bleed, impossible on analog tape',
  },
  {
    tapeId: 'tape-011',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The void is not empty. You are inside it. The tape is the walls.',
    audioCue: 'Spatial audio inversion, 360 degree',
  },
  // tape-012: Broadcast
  {
    tapeId: 'tape-012',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'One final transmission.',
  },
  {
    tapeId: 'tape-012',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The transmission is still being sent. No one is sending it.',
    audioCue: 'Dead carrier wave with modulation',
  },
  {
    tapeId: 'tape-012',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You are the transmission. You have been broadcasting since the beginning.',
    audioCue: 'Self-modulating carrier wave',
  },
  // tape-013: Static
  {
    tapeId: 'tape-013',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'White noise. Pure. Perfect.',
  },
  {
    tapeId: 'tape-013',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The static is not random. It is a pattern. It has been repeating for 73 years.',
    audioCue: 'Crystalline pattern, 73-year loop',
  },
  {
    tapeId: 'tape-013',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The pattern is your life. Every moment, encoded in noise.',
    audioCue: 'Binaural encoding of biometric data',
  },
  // tape-014: Protocol
  {
    tapeId: 'tape-014',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Follow instructions. Do not deviate.',
  },
  {
    tapeId: 'tape-014',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The instructions are for you. They have always been for you.',
    audioCue: 'Direct address command sequence',
  },
  {
    tapeId: 'tape-014',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'You wrote the protocol. You are both the sender and the recipient.',
    audioCue: 'Dual-channel self-referential audio',
  },
  // tape-015: ███████
  {
    tapeId: 'tape-015',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: '[CORRUPTED]',
  },
  {
    tapeId: 'tape-015',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: '[CORRUPTED] The corruption is intentional. It is a message.',
    audioCue: 'Intentional data degradation pattern',
  },
  {
    tapeId: 'tape-015',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: '[CORRUPTED] [CORRUPTED] You are the corruption. [CORRUPTED]',
    audioCue: 'Complete signal breakdown, then silence',
  },
];

// --- NG+ tape mastery layers ---

const ngPlusTapeLayers: TapeMasteryLayer[] = [
  // tape-ngp-001: Echo of the First Broadcast
  {
    tapeId: 'tape-ngp-001',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'The original signal, reborn. It remembers you.',
  },
  {
    tapeId: 'tape-ngp-001',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: 'The signal does not remember you. It IS you, from before.',
    audioCue: "Pre-recording of listener's own voice",
  },
  {
    tapeId: 'tape-ngp-001',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'There was no before. There is only the signal. You are the signal.',
    audioCue: 'Total harmonic convergence',
  },
  // tape-ngp-002: The Inverted Frequency
  {
    tapeId: 'tape-ngp-002',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: 'Everything plays backwards. The message was always meant for the reverse.',
  },
  {
    tapeId: 'tape-ngp-002',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: "Played forward, the message is your name. Played backward, it is someone else's.",
    audioCue: 'Bidirectional audio, both directions intelligible',
  },
  {
    tapeId: 'tape-ngp-002',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content: 'The other name is yours too. You have always had two names.',
    audioCue: 'Dual-track simultaneous playback',
  },
  // tape-ngp-003: ██████████ ████
  {
    tapeId: 'tape-ngp-003',
    layer: 'surface',
    requiredListens: MASTERY_THRESHOLDS.surface,
    content: '[CORRUPTED] [CORRUPTED] [CORRUPTED] You have been here before.',
  },
  {
    tapeId: 'tape-ngp-003',
    layer: 'depth',
    requiredListens: MASTERY_THRESHOLDS.depth,
    content: '[CORRUPTED] The corruption is the message. You are the corruption.',
    audioCue: 'Self-referential corruption pattern',
  },
  {
    tapeId: 'tape-ngp-003',
    layer: 'abyss',
    requiredListens: MASTERY_THRESHOLDS.abyss,
    content:
      '[CORRUPTED] [CORRUPTED] [CORRUPTED] There is no layer beneath this. You are the bottom. [CORRUPTED]',
    audioCue: 'Complete signal cessation, then heartbeat',
  },
];

/** All mastery layers for all tapes (base + NG+). */
export const ALL_MASTERY_LAYERS: TapeMasteryLayer[] = [...baseTapeLayers, ...ngPlusTapeLayers];

/**
 * Get all mastery layers for a specific tape.
 */
export function getMasteryLayersForTape(tapeId: string): TapeMasteryLayer[] {
  return ALL_MASTERY_LAYERS.filter((l) => l.tapeId === tapeId);
}

/**
 * Get a specific layer for a specific tape.
 */
export function getMasteryLayer(
  tapeId: string,
  layer: 'surface' | 'depth' | 'abyss',
): TapeMasteryLayer | undefined {
  return ALL_MASTERY_LAYERS.find((l) => l.tapeId === tapeId && l.layer === layer);
}
