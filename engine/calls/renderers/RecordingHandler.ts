import type { CallData, CallOutcome } from '../types';

export interface RecordingInput {
  seekPosition: number;
  revealedMetadata: boolean[];
}

export function computeRecordingOutcome(call: CallData, input: RecordingInput): CallOutcome {
  const clips = call.recordingClips ?? [];
  if (clips.length === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  const clip = clips[0]!;
  const distance = Math.abs(input.seekPosition - clip.targetSeekPosition);
  const accuracy = Math.max(0, 1 - distance);

  const baseSanityDelta = call.sanityDelta ?? 0;
  const sanityDelta = Math.trunc(baseSanityDelta * accuracy);

  const revealedCount = (input.revealedMetadata ?? []).filter(Boolean).length;
  const staticMultiplier = 1 + revealedCount * 0.1;

  const tapeUnlocked = distance < 0.05 && call.tape ? call.tapeName : undefined;

  return {
    sanityDelta,
    staticReward: call.staticReward,
    staticMultiplier,
    tapeUnlocked,
    bandUnlocked: undefined,
  };
}

export const RECORDING_RENDERER = { computeOutcome: computeRecordingOutcome } as const;
