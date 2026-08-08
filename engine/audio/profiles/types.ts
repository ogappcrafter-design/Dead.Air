// engine/audio/profiles/types.ts
// Type definitions for atmospheric ambient audio profiles.

import type { Band } from '../../../lib/constants';
import type { AmbientBandParams } from '../AmbientLayer';
import type { StaticCharacter } from '../PlatformBridge';

export interface AmbientProfile {
  id: string;
  name: string;
  staticCharacter: StaticCharacter;
  bandParams: Record<Band, AmbientBandParams>;
}
