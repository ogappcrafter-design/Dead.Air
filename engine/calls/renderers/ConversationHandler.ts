import type { CallData, CallOutcome } from '../types';

export function computeConversationOutcome(call: CallData, path: number[]): CallOutcome {
  const tree = call.dialogueTree ?? [];
  if (tree.length === 0 || path.length === 0) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  let totalSanityDelta = 0;
  let totalStaticMult = 0;
  let allValid = true;

  for (let i = 0; i < path.length; i++) {
    const node = tree[i];
    const responseIndex = path[i]!;
    if (!node || responseIndex < 0 || responseIndex >= node.responses.length) {
      allValid = false;
      break;
    }
    const response = node.responses[responseIndex]!;
    totalSanityDelta += response.sanityDelta;
    totalStaticMult += response.staticMult;
  }

  if (!allValid) {
    return {
      sanityDelta: 0,
      staticReward: 0,
      staticMultiplier: 0,
      tapeUnlocked: undefined,
      bandUnlocked: undefined,
    };
  }

  const avgStaticMult = totalStaticMult / path.length;
  const tapeUnlocked = call.tape ? call.tapeName : undefined;

  return {
    sanityDelta: totalSanityDelta,
    staticReward: call.staticReward,
    staticMultiplier: avgStaticMult,
    tapeUnlocked,
    bandUnlocked: undefined,
  };
}

export const CONVERSATION_RENDERER = { computeOutcome: computeConversationOutcome } as const;
