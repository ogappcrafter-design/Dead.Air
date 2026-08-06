// engine/calls/ProceduralCallGenerator.ts
// Generates procedural calls for Infinite Signal IAP owners.
// Produces CallData objects matching data/calls.js structure.

import type { Band, CallType } from '../../lib/constants';
import type { CallData } from './types';
import { LIVING_FRAGMENTS } from '../../data/fragments/LIVING';
import { LIMINAL_FRAGMENTS } from '../../data/fragments/LIMINAL';
import { LOST_FRAGMENTS } from '../../data/fragments/LOST';
import { CLASSIFIED_FRAGMENTS } from '../../data/fragments/CLASSIFIED';
import { VOID_FRAGMENTS } from '../../data/fragments/████████';

// Fragment library shape
interface FragmentLibrary {
  opening: string[];
  middle: string[];
  closing: string[];
  response: string[];
}

// Map band names to fragment libraries
const BAND_FRAGMENTS: Map<Band, FragmentLibrary> = new Map([
  ['LIVING', LIVING_FRAGMENTS],
  ['LIMINAL', LIMINAL_FRAGMENTS],
  ['LOST', LOST_FRAGMENTS],
  ['CLASSIFIED', CLASSIFIED_FRAGMENTS],
  ['████████', VOID_FRAGMENTS],
]);

// Map band names to numeric indices (matching lib/constants.ts BANDS order)
const BAND_INDEX: Record<Band, number> = {
  LIVING: 0,
  LIMINAL: 1,
  LOST: 2,
  CLASSIFIED: 3,
  '████████': 4,
};

// Band-specific config for call generation
const BAND_CONFIGS: Record<Band, {
  sanityDelta: { min: number; max: number };
  staticReward: { min: number; max: number };
  callType: CallType;
  weight: number;
}> = {
  LIVING: { sanityDelta: { min: -2, max: 3 }, staticReward: { min: 1, max: 5 }, callType: 'JUST_LISTEN', weight: 0.3 },
  LIMINAL: { sanityDelta: { min: -3, max: 2 }, staticReward: { min: 2, max: 6 }, callType: 'JUST_LISTEN', weight: 0.25 },
  LOST: { sanityDelta: { min: -4, max: 1 }, staticReward: { min: 3, max: 7 }, callType: 'DEAD_AIR', weight: 0.2 },
  CLASSIFIED: { sanityDelta: { min: -5, max: 0 }, staticReward: { min: 4, max: 8 }, callType: 'SIGNAL_DECODE', weight: 0.15 },
  '████████': { sanityDelta: { min: -5, max: -1 }, staticReward: { min: 5, max: 10 }, callType: 'STAY_CALM', weight: 0.1 },
};

// Procedural call IDs start at 1000 to distinguish from sacred calls (0-17)
let proceduralIdCounter = 1000;

// Caller name fragments
const CALLER_NAME_PREFIXES = ['VOID', 'DEAD', 'STATIC', 'GHOST', 'ECHO', 'NULL', 'LOST', 'FADE', 'ZERO', 'WIRE'];
const CALLER_NAME_SUFFIXES = ['CALLER', 'SIGNAL', 'BROADCAST', 'OPERATOR', 'VOICE', 'CHANNEL', 'FREQUENCY', 'STATION'];

export class ProceduralCallGenerator {
  private usedCallerIds: Set<string> = new Set();

  /**
   * Generates a random caller ID string.
   */
  private generateCallerId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  }

  /**
   * Generates a random caller name.
   */
  private generateCallerName(): string {
    const prefix = CALLER_NAME_PREFIXES[Math.floor(Math.random() * CALLER_NAME_PREFIXES.length)];
    const suffix = CALLER_NAME_SUFFIXES[Math.floor(Math.random() * CALLER_NAME_SUFFIXES.length)];
    return `${prefix}_${suffix}`;
  }

  /**
   * Gets a random fragment from the specified band and type.
   */
  private getRandomFragment(band: Band, type: keyof FragmentLibrary): string {
    const fragments = BAND_FRAGMENTS.get(band);
    if (!fragments) {
      throw new Error(`Invalid band: ${band}`);
    }
    const arr = fragments[type];
    if (!arr || arr.length === 0) {
      throw new Error(`No ${type} fragments for band ${band}`);
    }
    const fragment = arr[Math.floor(Math.random() * arr.length)];
    if (!fragment) {
      throw new Error(`Failed to select fragment for ${band}.${type}`);
    }
    return fragment;
  }

  /**
   * Generates a unique procedural call for the specified band.
   */
  generateCall(band: Band): CallData {
    if (!BAND_FRAGMENTS.has(band)) {
      throw new Error(`Invalid band: ${band}. Valid bands: ${Array.from(BAND_FRAGMENTS.keys()).join(', ')}`);
    }

    const config = BAND_CONFIGS[band];

    // Generate unique caller ID (retry on collision, max 10 attempts)
    let callerId: string;
    let attempts = 0;
    do {
      callerId = this.generateCallerId();
      attempts++;
      if (attempts >= 10) {
        this.usedCallerIds.clear();
        attempts = 0;
      }
    } while (this.usedCallerIds.has(callerId));
    this.usedCallerIds.add(callerId);

    // Prevent memory bloat
    if (this.usedCallerIds.size > 1000) {
      const keep = Array.from(this.usedCallerIds).slice(-500);
      this.usedCallerIds = new Set(keep);
    }

    // Random sanity delta within band range
    const sanityDelta = Math.floor(Math.random() * (config.sanityDelta.max - config.sanityDelta.min + 1)) + config.sanityDelta.min;
    const staticReward = Math.floor(Math.random() * (config.staticReward.max - config.staticReward.min + 1)) + config.staticReward.min;
    const signal = Math.floor(Math.random() * 6); // 0-5
    const callerName = this.generateCallerName();

    // Assemble call from fragments
    const opening = this.getRandomFragment(band, 'opening');
    const middle = this.getRandomFragment(band, 'middle');
    const closing = this.getRandomFragment(band, 'closing');

    const call: CallData = {
      id: proceduralIdCounter++,
      band: BAND_INDEX[band],
      callerId,
      callerName,
      signal,
      type: config.callType,
      staticReward,
      lines: [opening, middle, closing],
      sanityDelta,
    };

    // STAY_CALM calls need duration + sanityPenalty
    if (config.callType === 'STAY_CALM') {
      call.duration = Math.floor(Math.random() * 10) + 5; // 5-15 seconds
      call.sanityPenalty = -Math.abs(sanityDelta);
    }

    return call;
  }

  /**
   * Generates multiple unique calls across all bands.
   * @param count Number of calls per band (default 5)
   * @returns Array of CallData objects
   */
  generateCalls(countPerBand: number = 5): CallData[] {
    const calls: CallData[] = [];
    const bands = Array.from(BAND_FRAGMENTS.keys());

    for (const band of bands) {
      for (let i = 0; i < countPerBand; i++) {
        let attempts = 0;
        let call: CallData;
        do {
          call = this.generateCall(band);
          attempts++;
          if (attempts >= 10) break;
        } while (calls.some(c => c.callerId === call.callerId));
        calls.push(call);
      }
    }

    return calls;
  }

  /**
   * Clears the used caller IDs cache.
   */
  clearCache(): void {
    this.usedCallerIds.clear();
  }
}
