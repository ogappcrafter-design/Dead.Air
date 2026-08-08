import type { CallData, CallOutcome } from '../types';

export function computePuzzleOutcome(call: CallData, layerSubmissions: string[]): CallOutcome {
  const layers = call.cipherLayers ?? [];
  if (layers.length === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  let correct = 0;
  for (let i = 0; i < layers.length; i++) {
    const submission = layerSubmissions[i];
    if (
      submission !== undefined &&
      submission.trim().toLowerCase() === layers[i]!.solution.trim().toLowerCase()
    ) {
      correct++;
    }
  }

  const ratio = correct / layers.length;
  const baseSanityDelta = call.sanityDelta ?? 0;

  if (correct === layers.length) {
    return {
      sanityDelta: baseSanityDelta,
      staticReward: call.staticReward,
      staticMultiplier: 1,
      tapeUnlocked: call.tape ? call.tapeName : undefined,
      bandUnlocked: undefined,
    };
  }

  return {
    sanityDelta: Math.trunc(baseSanityDelta * ratio),
    staticReward: call.staticReward,
    staticMultiplier: ratio,
    tapeUnlocked: undefined,
    bandUnlocked: undefined,
  };
}

export const PUZZLE_RENDERER = { computeOutcome: computePuzzleOutcome } as const;
