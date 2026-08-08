import type { CallData, CallOutcome } from '../types';

export interface TimingTap {
  timestampMs: number;
  isHold: boolean;
}

export function computeTimingOutcome(call: CallData, taps: TimingTap[]): CallOutcome {
  const beatMap = call.beatMap ?? [];
  if (beatMap.length === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  if (taps.length === 0) {
    return {
      sanityDelta: -(call.sanityPenalty ?? 0),
      staticReward: call.staticReward,
      staticMultiplier: 0.5,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  let totalDeviation = 0;
  let matched = 0;

  for (let i = 0; i < beatMap.length; i++) {
    const beat = beatMap[i]!;
    const tap = taps[i];
    if (tap === undefined) {
      totalDeviation += 500;
      continue;
    }
    const beatIsHold = beat.type === 'HOLD';
    if (tap.isHold !== beatIsHold) {
      totalDeviation += 500;
      continue;
    }
    matched++;
    totalDeviation += Math.abs(tap.timestampMs - beat.timestampMs);
  }

  const avgDeviation = totalDeviation / beatMap.length;
  const accuracy = Math.max(0, 1 - avgDeviation / 1000);

  const baseSanityDelta = call.sanityDelta ?? 0;
  const sanityDelta = Math.trunc(baseSanityDelta * accuracy);
  const staticMultiplier = 0.5 + accuracy * 0.5;

  const tapeUnlocked =
    avgDeviation < 100 && matched === beatMap.length && call.tape ? call.tapeName : undefined;

  return {
    sanityDelta,
    staticReward: call.staticReward,
    staticMultiplier,
    tapeUnlocked,
    bandUnlocked: undefined,
  };
}

export const TIMING_RENDERER = { computeOutcome: computeTimingOutcome } as const;
