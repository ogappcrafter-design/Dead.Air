import type { CallData, CallOutcome } from '../types';

export interface MultiCallerAttribution {
  utteranceIndex: number;
  voiceIndex: number;
}

export function computeMultiCallerOutcome(
  call: CallData,
  attribution: MultiCallerAttribution[],
): CallOutcome {
  const lines = call.lines ?? [];
  const speakers = call.lineSpeakers ?? [];
  if (lines.length === 0 || attribution.length === 0 || speakers.length === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  let correct = 0;
  let total = 0;

  for (const attr of attribution) {
    if (attr.utteranceIndex < 0 || attr.utteranceIndex >= speakers.length) continue;
    total++;
    if (speakers[attr.utteranceIndex] === attr.voiceIndex) {
      correct++;
    }
  }

  if (total === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  const ratio = correct / total;
  const baseSanityDelta = call.sanityDelta ?? 0;
  const sanityDelta = Math.trunc(baseSanityDelta * ratio);

  const tapeUnlocked = correct === total && call.tape ? call.tapeName : undefined;

  return {
    sanityDelta,
    staticReward: call.staticReward,
    staticMultiplier: ratio,
    tapeUnlocked,
    bandUnlocked: undefined,
  };
}

export const MULTI_CALLER_RENDERER = { computeOutcome: computeMultiCallerOutcome } as const;
