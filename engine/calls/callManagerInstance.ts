import { initCallManager } from "./CallManager";
import { CALLS } from "@/data/calls";
import { useGameStore } from "@/store/useGameStore";
import { useRadioStore } from "@/store/useRadioStore";
import type { CallData } from "./types";

const registry = new Map<number, CallData>(
  (CALLS as unknown as CallData[]).map((c) => [c.id, c]),
);

export const callManager = initCallManager({
  registry,
  stores: {
    setCurrentCall: (id) => useGameStore.getState().setCurrentCall(id),
    decreaseSanity: (n) => useGameStore.getState().decreaseSanity(n),
    increaseSanity: (n) => useGameStore.getState().increaseSanity(n),
    addStatic: (n) => useGameStore.getState().addStatic(n),
    addTape: (id) => useGameStore.getState().addTape(id),
    unlockBand: (band) => useGameStore.getState().unlockBand(band),
  },
  radio: {
    getCurrentBand: () => useRadioStore.getState().currentBand,
  },
  audio: null,
});
