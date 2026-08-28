// __tests__/engine/calls/renderers/RecordingHandler.test.ts
// Unit tests for the RECORDING call type outcome computer.
// New types are not in the sacred 18, so we use synthetic fixtures
// (mirroring StayCalmHandler.test.ts pattern).

import {
  computeRecordingOutcome,
  RECORDING_RENDERER,
} from '@/engine/calls/renderers/RecordingHandler';
import type { CallData } from '@/engine/calls/types';

// --- Fixtures ---

const RECORDING_CALL: CallData = {
  id: 1001,
  band: 0,
  callerId: 'REC-001',
  callerName: 'BROADCAST INTERCEPT',
  signal: 3,
  type: 'RECORDING',
  staticReward: 40,
  sanityDelta: -10,
  tape: true,
  tapeName: 'Tape #R1 — Lost Broadcast',
  recordingClips: [
    {
      audioLabel: 'Static-laced number station',
      duration: 30,
      metadata: ['Timestamp: 03:00 AM', 'Origin: Eastern bloc', 'Frequency: 7.83 MHz'],
      targetSeekPosition: 0.75,
    },
  ],
  lines: ['"…listening? You shouldn\'t be hearing this…"'],
};

// --- Tests ---

describe('RECORDING renderer — exact seek position', () => {
  it('returns full sanityDelta when seekPosition matches target', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [],
    });
    expect(outcome.sanityDelta).toBe(-10);
  });

  it('returns full staticReward', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [],
    });
    expect(outcome.staticReward).toBe(40);
  });

  it('returns staticMultiplier 1 with no metadata revealed', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [],
    });
    expect(outcome.staticMultiplier).toBe(1);
  });

  it('unlocks tape when distance < 0.05', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.74,
      revealedMetadata: [],
    });
    expect(outcome.tapeUnlocked).toBe('Tape #R1 — Lost Broadcast');
  });
});

describe('RECORDING renderer — off-seek (partial accuracy)', () => {
  it('reduces sanityDelta proportionally to distance', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.5,
      revealedMetadata: [],
    });
    // distance = 0.25, accuracy = 0.75, sanityDelta = trunc(-10 * 0.75) = -7
    expect(outcome.sanityDelta).toBe(-7);
  });

  it('returns reduced sanityDelta when far off target', () => {
    const farOutcome = computeRecordingOutcome(
      {
        ...RECORDING_CALL,
        recordingClips: [{ ...RECORDING_CALL.recordingClips![0]!, targetSeekPosition: 0.1 }],
      },
      { seekPosition: 0.9, revealedMetadata: [] },
    );
    // distance = 0.8, accuracy = max(0, 1 - 0.8) = 0.2, sanityDelta = trunc(-10 * 0.2)
    // floating point: 1 - 0.8 = 0.1999... so trunc(-10 * 0.1999...) = -1
    expect(farOutcome.sanityDelta).toBe(-1);
  });

  it('does not unlock tape when distance >= 0.05', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.5,
      revealedMetadata: [],
    });
    expect(outcome.tapeUnlocked).toBeUndefined();
  });
});

describe('RECORDING renderer — metadata revealed', () => {
  it('increases staticMultiplier by 0.1 per revealed metadata', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [true, true, true],
    });
    expect(outcome.staticMultiplier).toBe(1.3); // 1 + 3 * 0.1
  });

  it('partial metadata reveal gives partial bonus', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [true, false, true],
    });
    expect(outcome.staticMultiplier).toBe(1.2); // 1 + 2 * 0.1
  });
});

describe('RECORDING renderer — edge cases', () => {
  it('returns zero outcome when recordingClips is empty', () => {
    const noClipsCall: CallData = { ...RECORDING_CALL, recordingClips: [] };
    const outcome = computeRecordingOutcome(noClipsCall, {
      seekPosition: 0.5,
      revealedMetadata: [],
    });
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
    expect(outcome.staticMultiplier).toBe(0);
    expect(outcome.tapeUnlocked).toBeUndefined();
  });

  it('returns zero outcome when recordingClips is undefined', () => {
    const noClipsCall: CallData = { ...RECORDING_CALL, recordingClips: undefined };
    const outcome = computeRecordingOutcome(noClipsCall, {
      seekPosition: 0.5,
      revealedMetadata: [],
    });
    expect(outcome.sanityDelta).toBe(0);
    expect(outcome.staticReward).toBe(0);
  });

  it('returns bandUnlocked undefined always', () => {
    const outcome = computeRecordingOutcome(RECORDING_CALL, {
      seekPosition: 0.75,
      revealedMetadata: [],
    });
    expect(outcome.bandUnlocked).toBeUndefined();
  });

  it('RECORDING_RENDERER exports computeOutcome', () => {
    expect(RECORDING_RENDERER.computeOutcome).toBe(computeRecordingOutcome);
  });
});
