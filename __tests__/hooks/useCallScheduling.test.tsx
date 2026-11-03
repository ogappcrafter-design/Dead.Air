import { act, cleanup, render } from '@testing-library/react-native';
import { useEndlessNight } from '@/hooks/useEndlessNight';
import { useTutorialController } from '@/hooks/useTutorialController';
import { callManager } from '@/engine/calls/callManagerInstance';
import type { CallData } from '@/engine/calls/types';
import { TUTORIAL_CALL_IDS } from '@/data/tutorialCalls';
import { useGameStore } from '@/store/useGameStore';
import { useTutorialStore } from '@/store/useTutorialStore';

jest.mock('@/engine/calls/callManagerInstance', () => {
  const {
    initCallManager,
  }: typeof import('@/engine/calls/CallManager') = require('@/engine/calls/CallManager');
  const { CALLS }: typeof import('@/data/calls') = require('@/data/calls');
  const { TUTORIAL_CALLS }: typeof import('@/data/tutorialCalls') = require('@/data/tutorialCalls');
  const registry = new Map<number, CallData>(
    CALLS.map((call) => [call.id, { ...call, type: 'JUST_LISTEN' }]),
  );
  for (const call of TUTORIAL_CALLS) registry.set(call.id, call);
  registry.set(20_000, {
    id: 20_000,
    band: 0,
    callerId: 'custom',
    callerName: 'Custom',
    signal: 3,
    type: 'RIGHT_ANSWER',
    staticReward: 0,
    sourceCustomFrequencyId: 'local:scheduling',
  });
  return {
    callManager: initCallManager({
      registry,
      stores: {
        setCurrentCall: jest.fn(),
        decreaseSanity: jest.fn(),
        increaseSanity: jest.fn(),
        addStatic: jest.fn(),
        addTape: jest.fn(),
        unlockBand: jest.fn(),
        getReceivedCalls: () => [],
        getUnlockedBands: () => ['LIVING'],
        markCallReceived: jest.fn(),
        recordCallDuration: jest.fn(),
        getPlayerStats: () => ({
          callsReceived: 0,
          bandsUnlocked: 1,
          tapesCollected: 0,
          sanityLowest: 100,
          shiftsCompleted: 0,
          longestCallSurvivedMs: 0,
        }),
        recordChoice: jest.fn(),
        getOwnedTapePacks: () => [],
      },
      radio: { getCurrentBand: () => 'LIVING' },
      bands: [],
    }),
    clearEndlessRareEventCalls: jest.fn(),
    registerEndlessRareEventCall: jest.fn(() => null),
  };
});

function EndlessHarness() {
  useEndlessNight();
  return null;
}

function TutorialHarness() {
  useTutorialController();
  return null;
}

const outcome = { sanityDelta: 0, staticReward: 0, staticMultiplier: 1 };

beforeEach(() => {
  jest.useFakeTimers();
  callManager.reset();
  useGameStore.setState({
    endlessModeActive: false,
    endlessGameOver: false,
    endlessScore: 0,
    endlessHighScore: 0,
    escalationLevel: 0,
    shiftsCompleted: 1,
    ngPlusActive: false,
    sanity: 100,
  });
  useTutorialStore.setState({ step: 'completed', skipped: true });
});

afterEach(async () => {
  await cleanup();
  callManager.reset();
  jest.useRealTimers();
});

it.each(['complete', 'abort'] as const)(
  'resumes Endless calls without scoring a custom call after %s',
  async (ending) => {
    await render(<EndlessHarness />);
    await act(async () => {
      expect(callManager.startCall(20_000)).toBe(true);
      jest.advanceTimersByTime(1_500);
    });
    expect(callManager.getCurrentCall()?.call.id).toBe(20_000);

    await act(async () => {
      if (ending === 'complete') callManager.endCall(outcome);
      else callManager.reset();
      jest.advanceTimersByTime(1_200);
    });

    expect(useGameStore.getState().endlessScore).toBe(0);
    expect(callManager.getCallState()).toBe('active');
    expect(callManager.getCurrentCall()?.call.sourceCustomFrequencyId).toBeUndefined();
    await act(async () => {
      callManager.endCall(outcome);
      jest.advanceTimersByTime(1_200);
    });
    expect(useGameStore.getState().endlessScore).toBe(1);
    expect(callManager.getCallState()).toBe('active');
  },
);

it.each(['complete', 'abort'] as const)(
  'resumes a blocked tutorial without advancing it after custom %s',
  async (ending) => {
    useTutorialStore.setState({ step: 'call-1', skipped: false });
    await render(<TutorialHarness />);
    await act(async () => {
      expect(callManager.startCall(20_000)).toBe(true);
      jest.advanceTimersByTime(500);
    });
    expect(callManager.getCurrentCall()?.call.id).toBe(20_000);

    await act(async () => {
      if (ending === 'complete') callManager.endCall(outcome);
      else callManager.reset();
      jest.advanceTimersByTime(300);
    });

    expect(useTutorialStore.getState().step).toBe('call-1');
    expect(callManager.getCurrentCall()?.call.id).toBe(TUTORIAL_CALL_IDS[0]);
    await act(async () => {
      callManager.endCall(outcome);
      jest.advanceTimersByTime(300);
    });
    expect(useTutorialStore.getState().step).toBe('call-2');
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(callManager.getCurrentCall()?.call.id).toBe(TUTORIAL_CALL_IDS[1]);
  },
);
