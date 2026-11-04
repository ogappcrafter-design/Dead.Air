// __tests__/components/StayCalmCall.test.tsx
// DEA-90 — a spoken word must flinch the player through the exact same path
// as a tap: same UI phase, same outcome object, same completion timing.

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import StayCalmCall from '@/components/calls/StayCalmCall';
import type { CallData } from '@/engine/calls/types';

let mockVoiceCallback: (() => void) | null = null;
let mockVoiceActive: boolean | null = null;

jest.mock('@/hooks/useVoiceFlinch', () => ({
  useVoiceFlinch: ({
    active,
    onVoiceDetected,
  }: {
    active: boolean;
    onVoiceDetected: () => void;
  }) => {
    mockVoiceCallback = onVoiceDetected;
    mockVoiceActive = active;
  },
}));

const CALL: CallData = {
  id: 4,
  band: 1,
  callerId: '???-????',
  callerName: 'THE LOOP',
  signal: 3,
  type: 'STAY_CALM',
  staticReward: 55,
  duration: 12,
  sanityPenalty: 20,
  lines: [
    '"I\'ve called before. I know I have."',
    '"I\'ve called before. Something is different."',
  ],
};

const FLINCH_DISPLAY_MS = 2000;

const speak = async (): Promise<void> => {
  await act(async () => {
    mockVoiceCallback?.();
  });
};

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  mockVoiceCallback = null;
  mockVoiceActive = null;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('StayCalmCall — voice flinch (DEA-90)', () => {
  it('arms the microphone only during the countdown', async () => {
    const view = await render(<StayCalmCall call={CALL} onComplete={jest.fn()} />);
    expect(mockVoiceActive).toBe(true);
    await view.unmount();
  });

  it('flinches on detected speech with the tap UI phase', async () => {
    const onComplete = jest.fn();
    const view = await render(<StayCalmCall call={CALL} onComplete={onComplete} />);

    await speak();

    expect(view.getByText('YOU FLINCHED')).toBeTruthy();
    expect(mockVoiceActive).toBe(false);

    await advance(FLINCH_DISPLAY_MS);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ sanityDelta: -20, staticReward: 55, staticMultiplier: 0.5 }),
    );
    await view.unmount();
  });

  it('produces the same outcome as a tap flinch', async () => {
    const tapComplete = jest.fn();
    const tapped = await render(<StayCalmCall call={CALL} onComplete={tapComplete} />);
    await fireEvent(tapped.getByLabelText('Stay calm — do not tap'), 'pressIn');
    await advance(FLINCH_DISPLAY_MS);
    expect(tapComplete).toHaveBeenCalledTimes(1);
    const tapOutcome = tapComplete.mock.calls[0]?.[0];
    await tapped.unmount();

    const voiceComplete = jest.fn();
    const spoken = await render(<StayCalmCall call={CALL} onComplete={voiceComplete} />);
    await speak();
    await advance(FLINCH_DISPLAY_MS);
    expect(voiceComplete).toHaveBeenCalledTimes(1);
    const voiceOutcome = voiceComplete.mock.calls[0]?.[0];
    await spoken.unmount();

    expect(voiceOutcome).toEqual(tapOutcome);
  });

  it('still survives when no voice is detected', async () => {
    const onComplete = jest.fn();
    const view = await render(<StayCalmCall call={CALL} onComplete={onComplete} />);

    await advance((CALL.duration ?? 12) * 1000);
    // The countdown defers `finish` off the state updater; one more tick lets
    // that deferred call run before the survive display is asserted.
    await advance(100);

    expect(view.getByText('...')).toBeTruthy();
    await advance(FLINCH_DISPLAY_MS + 100);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ sanityDelta: 0 }));
    await view.unmount();
  });

  it('ignores a late voice report after the countdown already ended', async () => {
    const onComplete = jest.fn();
    const view = await render(<StayCalmCall call={CALL} onComplete={onComplete} />);

    await advance((CALL.duration ?? 12) * 1000);
    await advance(100);
    await speak();
    await advance(FLINCH_DISPLAY_MS + 100);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ sanityDelta: 0 }));
    await view.unmount();
  });
});
