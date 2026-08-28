// engine/audio/profiles/types.ts
// Type definitions for atmospheric ambient audio profiles.

import type { Band } from '../../../lib/constants';
import type { StaticCharacter } from '../PlatformBridge';

/** Map band → ambient character params (filter + base gain). */
export interface AmbientBandParams {
  /** Center frequency of the band-pass coloration (Hz). */
  centerFreq: number;
  /** Base gain (0..1) — how present this band is. */
  baseGain: number;
  /** Detune of the source buffer playback (cents). 0 = original pitch. */
  detuneCents: number;
}

export interface AmbientProfile {
  id: string;
  name: string;
  staticCharacter: StaticCharacter;
  bandParams: Record<Band, AmbientBandParams>;
}
