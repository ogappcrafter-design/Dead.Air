// data/tapePacks/index.ts
// Tape Pack DLC registry — defines 3 purchasable packs (Holiday, Numbers Station, Voices From Beyond).
// Each pack: 5 tapes + 3 hand-authored calls + themed fragment library.
// Product IDs match lib/iap.ts. Call IDs use dedicated ranges (200s, 300s, 400s).

import type { TapeInfo } from '../tapes';
import { getTapeById } from '../tapes';
import type { FragmentLibrary } from '../fragments/types';
import type { CallData } from '../../engine/calls/types';

import { HOLIDAY_DLC_CALLS } from './holidayCalls';
import { NUMBERS_STATION_DLC_CALLS } from './numbersStationCalls';
import { VOICES_BEYOND_DLC_CALLS } from './voicesBeyondCalls';

import { HOLIDAY_DLC_FRAGMENTS } from '../fragments/holidayDLC';
import { NUMBERS_STATION_DLC_FRAGMENTS } from '../fragments/numbersStationDLC';
import { VOICES_BEYOND_DLC_FRAGMENTS } from '../fragments/voicesBeyondDLC';

/** A purchasable tape pack DLC. */
export interface TapePackDefinition {
  /** Short identifier, e.g. 'tape_pack_holiday'. */
  packId: string;
  /** IAP product ID, e.g. 'com.deadair.tape_pack_holiday'. */
  productId: string;
  /** Display title. */
  title: string;
  /** Store description. */
  description: string;
  /** Display price. */
  price: string;
  /** Tapes unlocked by this pack (5). */
  tapes: TapeInfo[];
  /** Fragment libraries that extend the procedural call generator (1 per pack). */
  fragmentLibraries: FragmentLibrary[];
  /** Hand-authored calls unique to this pack (3). */
  calls: CallData[];
}

// Helper: collect tape TapeInfo objects by ID.
function tapesForPack(ids: string[]): TapeInfo[] {
  return ids.map((id) => {
    const tape = getTapeById(id);
    if (tape === undefined) {
      throw new Error(`TapePack registry: tape ${id} not found in ALL_TAPES`);
    }
    return tape;
  });
}

export const TAPE_PACKS: TapePackDefinition[] = [
  {
    packId: 'tape_pack_holiday',
    productId: 'com.deadair.tape_pack_holiday',
    title: 'Holiday Tapes',
    description:
      'Seasonal broadcasts from the edge of the dial. Christmas Eve, New Year, Halloween, Valentine\u2019s, Thanksgiving \u2014 5 tapes and 3 calls。',
    price: '$1.99',
    tapes: tapesForPack(['tape-016', 'tape-017', 'tape-018', 'tape-019', 'tape-020']),
    fragmentLibraries: [HOLIDAY_DLC_FRAGMENTS],
    calls: HOLIDAY_DLC_CALLS,
  },
  {
    packId: 'tape_pack_numbers_station',
    productId: 'com.deadair.tape_pack_numbers_station',
    title: 'Numbers Station',
    description:
      'Encrypted transmissions from Station X-7. Counting, coded messages, the buzzer \u2014 5 tapes and 3 calls.',
    price: '$1.99',
    tapes: tapesForPack(['tape-021', 'tape-022', 'tape-023', 'tape-024', 'tape-025']),
    fragmentLibraries: [NUMBERS_STATION_DLC_FRAGMENTS],
    calls: NUMBERS_STATION_DLC_CALLS,
  },
  {
    packId: 'tape_pack_voices_beyond',
    productId: 'com.deadair.tape_pack_voices_beyond',
    title: 'Voices From Beyond',
    description:
      'S\u00e9ances, spirit boxes, messages from the other side \u2014 5 tapes and 3 calls from the static.',
    price: '$1.99',
    tapes: tapesForPack(['tape-026', 'tape-027', 'tape-028', 'tape-029', 'tape-030']),
    fragmentLibraries: [VOICES_BEYOND_DLC_FRAGMENTS],
    calls: VOICES_BEYOND_DLC_CALLS,
  },
];

/** Product ID \u2192 pack definition lookup. */
const TAPE_PACK_BY_PRODUCT_ID: Record<string, TapePackDefinition> = Object.fromEntries(
  TAPE_PACKS.map((pack) => [pack.productId, pack]),
);

/** Look up a tape pack by its IAP product ID. */
export function getTapePackByProductId(productId: string): TapePackDefinition | undefined {
  return TAPE_PACK_BY_PRODUCT_ID[productId];
}

/** Look up a tape pack by its short pack ID. */
export function getTapePackByPackId(packId: string): TapePackDefinition | undefined {
  return TAPE_PACKS.find((pack) => pack.packId === packId);
}

/** All DLC calls across all packs (flattened). */
export const ALL_DLC_CALLS: CallData[] = TAPE_PACKS.flatMap((pack) => pack.calls);

/** All DLC fragment libraries across all packs (flattened). */
export const ALL_DLC_FRAGMENTS: FragmentLibrary[] = TAPE_PACKS.flatMap(
  (pack) => pack.fragmentLibraries,
);

/** Get DLC calls for a set of owned product IDs. */
export function getDlcCallsForOwnedPacks(ownedProductIds: string[]): CallData[] {
  return TAPE_PACKS.filter((pack) => ownedProductIds.includes(pack.productId)).flatMap(
    (pack) => pack.calls,
  );
}

/** Get DLC fragment libraries for a set of owned product IDs. */
export function getDlcFragmentsForOwnedPacks(ownedProductIds: string[]): FragmentLibrary[] {
  return TAPE_PACKS.filter((pack) => ownedProductIds.includes(pack.productId)).flatMap(
    (pack) => pack.fragmentLibraries,
  );
}
