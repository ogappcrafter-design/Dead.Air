// data/atmosphericPacks/index.ts
// Registry of atmospheric DLC pack definitions.
// Each pack bundles an audio ambience profile + themed call fragments.

import type { AmbientProfile } from '../../engine/audio/profiles/types';
import type { FragmentLibrary } from '../fragments/types';
import { RAIN_NIGHT_PROFILE } from '../../engine/audio/profiles/rainNight';
import { WINTER_STATIC_PROFILE } from '../../engine/audio/profiles/winterStatic';
import { DEEP_SPACE_PROFILE } from '../../engine/audio/profiles/deepSpace';
import { RAIN_NIGHT_FRAGMENTS } from '../fragments/rainNight';
import { WINTER_STATIC_FRAGMENTS } from '../fragments/winterStatic';
import { DEEP_SPACE_FRAGMENTS } from '../fragments/deepSpace';

export interface AtmosphericPack {
  id: string;
  name: string;
  description: string;
  productId: string;
  price: string;
  ambientProfile: AmbientProfile;
  fragments: FragmentLibrary;
}

export const ATMOSPHERIC_PACKS: AtmosphericPack[] = [
  {
    id: 'rain_night',
    name: 'Rain Night',
    description: 'Late-night rain static. Calls from the storm.',
    productId: 'com.deadair.atmos_rain_night',
    price: '$1.99',
    ambientProfile: RAIN_NIGHT_PROFILE,
    fragments: RAIN_NIGHT_FRAGMENTS,
  },
  {
    id: 'winter_static',
    name: 'Winter Static',
    description: 'Frozen signal towers. Calls through the snow.',
    productId: 'com.deadair.atmos_winter_static',
    price: '$1.99',
    ambientProfile: WINTER_STATIC_PROFILE,
    fragments: WINTER_STATIC_FRAGMENTS,
  },
  {
    id: 'deep_space',
    name: 'Deep Space',
    description: 'Beyond the last tower. Calls from the void.',
    productId: 'com.deadair.atmos_deep_space',
    price: '$1.99',
    ambientProfile: DEEP_SPACE_PROFILE,
    fragments: DEEP_SPACE_FRAGMENTS,
  },
];

const PACK_BY_ID = new Map<string, AtmosphericPack>(ATMOSPHERIC_PACKS.map((p) => [p.id, p]));

const PACK_BY_PRODUCT_ID = new Map<string, AtmosphericPack>(
  ATMOSPHERIC_PACKS.map((p) => [p.productId, p]),
);

export function getAtmosphericPack(packId: string): AtmosphericPack | undefined {
  return PACK_BY_ID.get(packId);
}

export function getPackByProductId(productId: string): AtmosphericPack | undefined {
  return PACK_BY_PRODUCT_ID.get(productId);
}

export function getOwnedPacks(ownedIds: string[]): AtmosphericPack[] {
  return ownedIds
    .map((id) => PACK_BY_ID.get(id))
    .filter((p): p is AtmosphericPack => p !== undefined);
}

export const DEFAULT_PACK_ID = 'default';
