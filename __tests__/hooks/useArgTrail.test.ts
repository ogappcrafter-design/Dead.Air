// __tests__/hooks/useArgTrail.test.ts
// DEA-91: the hook hands the hidden call to the call manager exactly once,
// only when the resolved trail is tuned to the carrier, and never while
// another call is in progress. Visible pieces must also respect the dwell
// gate — the carrier has to be held, not visited.

import { act, renderHook } from '@testing-library/react-native';

jest.mock('../../engine/calls/CallManager', () => ({
  getCallManager: jest.fn(),
}));

jest.mock('../../engine/calls/callManagerInstance', () => ({
  registerArgHiddenCall: jest.fn(),
}));

import { getCallManager } from '../../engine/calls/CallManager';
import { registerArgHiddenCall } from '../../engine/calls/callManagerInstance';
import { useArgTrail } from '../../hooks/useArgTrail';
import { ARG_FRAGMENTS, ARG_HIDDEN_CALL_ID, ARG_TRACES } from '../../data/arg';
import { useRadioStore } from '../../store/useRadioStore';
import { useGameStore } from '../../store/useGameStore';
import { useArgTrailStore } from '../../store/argTrailStore';

const mockStartCall = jest.fn();
const mockGetCallState = jest.fn();

const RESOLVED = {
  decodedTraceIds: ARG_TRACES.map((trace) => trace.id),
  heardFragmentIds: ARG_FRAGMENTS.map((fragment) => fragment.id),
};

const setWorld = (overrides: { frequency?: number; resolved?: boolean } = {}): void => {
  useRadioStore.setState({ currentBand: 'CLASSIFIED', frequency: overrides.frequency ?? 104.7 });
  useGameStore.setState({ static: 90, receivedCalls: [12, 13, 14] });
  useArgTrailStore.setState(
    overrides.resolved === false
      ? { decodedTraceIds: [], heardFragmentIds: [], hiddenCallPlayed: false }
      : { ...RESOLVED, hiddenCallPlayed: false },
  );
};

const setEarlyWorld = (): void => {
  useRadioStore.setState({ currentBand: 'CLASSIFIED', frequency: 103.0 });
  useGameStore.setState({ static: 35, receivedCalls: [12] });
  useArgTrailStore.setState({ decodedTraceIds: [], heardFragmentIds: [], hiddenCallPlayed: false });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStartCall.mockReturnValue(true);
  mockGetCallState.mockReturnValue('idle');
  (getCallManager as jest.Mock).mockReturnValue({
    startCall: mockStartCall,
    getCallState: mockGetCallState,
  });
});

describe('useArgTrail — hidden call', () => {
  it('arms the carrier when the resolved trail is tuned to 104.7', async () => {
    setWorld();
    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.hiddenCallArmed).toBe(true);
    // Never auto-start: the payoff is one-shot and must be a deliberate answer.
    expect(mockStartCall).not.toHaveBeenCalled();
  });

  it('answers the carrier once and records it', async () => {
    setWorld();
    const view = await renderHook(() => useArgTrail());

    let started = false;
    await act(async () => {
      started = view.result.current.answerHiddenCall();
    });

    expect(started).toBe(true);
    expect(registerArgHiddenCall).toHaveBeenCalled();
    expect(mockStartCall).toHaveBeenCalledWith(ARG_HIDDEN_CALL_ID);
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(true);
  });

  it('does not arm while the trail is unresolved', async () => {
    setWorld({ resolved: false });
    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.hiddenCallArmed).toBe(false);
    let started = true;
    await act(async () => {
      started = view.result.current.answerHiddenCall();
    });
    expect(started).toBe(false);
    expect(mockStartCall).not.toHaveBeenCalled();
  });

  it('does not arm when the console is tuned elsewhere', async () => {
    setWorld({ frequency: 101.9 });
    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.hiddenCallArmed).toBe(false);
  });

  it('refuses to answer while another call is in progress', async () => {
    setWorld();
    mockGetCallState.mockReturnValue('active');
    const view = await renderHook(() => useArgTrail());

    let started = true;
    await act(async () => {
      started = view.result.current.answerHiddenCall();
    });

    expect(started).toBe(false);
    expect(mockStartCall).not.toHaveBeenCalled();
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(false);
  });
});

describe('useArgTrail — visible pieces', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('withholds the first trace until the carrier has been held', async () => {
    setEarlyWorld();
    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.activeTrace).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    expect(view.result.current.activeTrace?.id).toBe('trace-row-23');
    expect(view.result.current.traceGrid).toHaveLength(13);
    // Bleeds start one dwell step later than the first trace.
    expect(view.result.current.activeFragment).toBeNull();
  });

  it('resets the dwell clock when the player tunes away', async () => {
    setEarlyWorld();
    const view = await renderHook(() => useArgTrail());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(view.result.current.activeTrace?.id).toBe('trace-row-23');

    await act(async () => {
      useRadioStore.setState({ currentBand: 'LIVING', frequency: 88.0 });
    });
    expect(view.result.current.activeTrace).toBeNull();

    await act(async () => {
      useRadioStore.setState({ currentBand: 'CLASSIFIED', frequency: 103.0 });
    });
    expect(view.result.current.activeTrace).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(view.result.current.activeTrace?.id).toBe('trace-row-23');
  });

  it('decodes a trace into its registry row and records it', async () => {
    setEarlyWorld();
    const view = await renderHook(() => useArgTrail());

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });

    let artifactRow: number | undefined;
    await act(async () => {
      artifactRow = view.result.current.decodeTrace()?.row.row;
    });

    expect(artifactRow).toBe(23);
    expect(useArgTrailStore.getState().decodedTraceIds).toContain('trace-row-23');
  });

  it('stays silent on other bands', async () => {
    useRadioStore.setState({ currentBand: 'LIVING', frequency: 88.0 });
    useGameStore.setState({ static: 90, receivedCalls: [12, 13, 14] });
    useArgTrailStore.setState({
      decodedTraceIds: [],
      heardFragmentIds: [],
      hiddenCallPlayed: false,
    });

    const view = await renderHook(() => useArgTrail());

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });

    expect(view.result.current.activeTrace).toBeNull();
    expect(view.result.current.activeFragment).toBeNull();
    expect(view.result.current.traceGrid).toBeNull();
  });
});
