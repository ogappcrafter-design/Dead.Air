// __tests__/hooks/useArgTrail.test.ts
// DEA-91: the hook hands the hidden call to the call manager exactly once,
// only when the resolved trail is tuned to the carrier, and never while
// another call is in progress.

import { act, renderHook, waitFor } from '@testing-library/react-native';

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
  useGameStore.setState({ shiftsCompleted: 9, static: 90, receivedCalls: [12, 13, 14] });
  useArgTrailStore.setState(
    overrides.resolved === false
      ? { decodedTraceIds: [], heardFragmentIds: [], hiddenCallPlayed: false }
      : { ...RESOLVED, hiddenCallPlayed: false },
  );
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

describe('useArgTrail — hidden call arming', () => {
  it('registers and starts the hidden call when the trail is resolved on the carrier', async () => {
    setWorld();
    await renderHook(() => useArgTrail());

    await waitFor(() => expect(mockStartCall).toHaveBeenCalledWith(ARG_HIDDEN_CALL_ID));
    expect(registerArgHiddenCall).toHaveBeenCalled();
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(true);
  });

  it('does nothing while the trail is unresolved', async () => {
    setWorld({ resolved: false });
    await renderHook(() => useArgTrail());

    expect(mockStartCall).not.toHaveBeenCalled();
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(false);
  });

  it('does nothing when the console is tuned elsewhere', async () => {
    setWorld({ frequency: 101.9 });
    await renderHook(() => useArgTrail());

    expect(mockStartCall).not.toHaveBeenCalled();
  });

  it('waits for the console to be idle instead of stealing a call', async () => {
    setWorld();
    mockGetCallState.mockReturnValue('active');
    await renderHook(() => useArgTrail());

    expect(mockStartCall).not.toHaveBeenCalled();
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(false);
  });
});

describe('useArgTrail — visible pieces', () => {
  it('exposes the first trace and its matrix on the CLASSIFIED band', async () => {
    useRadioStore.setState({ currentBand: 'CLASSIFIED', frequency: 103.0 });
    useGameStore.setState({ shiftsCompleted: 3, static: 35, receivedCalls: [12] });
    useArgTrailStore.setState({
      decodedTraceIds: [],
      heardFragmentIds: [],
      hiddenCallPlayed: false,
    });

    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.activeTrace?.id).toBe('trace-row-23');
    expect(view.result.current.traceGrid).toHaveLength(13);
    // Bleeds start one shift later than the first trace.
    expect(view.result.current.activeFragment).toBeNull();
  });

  it('decodes a trace into its registry row and records it', async () => {
    useRadioStore.setState({ currentBand: 'CLASSIFIED', frequency: 103.0 });
    useGameStore.setState({ shiftsCompleted: 3, static: 35, receivedCalls: [12] });
    useArgTrailStore.setState({
      decodedTraceIds: [],
      heardFragmentIds: [],
      hiddenCallPlayed: false,
    });

    const view = await renderHook(() => useArgTrail());
    let artifactRow: number | undefined;
    await act(async () => {
      artifactRow = view.result.current.decodeTrace()?.row.row;
    });

    expect(artifactRow).toBe(23);
    expect(useArgTrailStore.getState().decodedTraceIds).toContain('trace-row-23');
  });

  it('stays silent on other bands', async () => {
    useRadioStore.setState({ currentBand: 'LIVING', frequency: 88.0 });
    useGameStore.setState({ shiftsCompleted: 9, static: 90, receivedCalls: [12, 13, 14] });
    useArgTrailStore.setState({
      decodedTraceIds: [],
      heardFragmentIds: [],
      hiddenCallPlayed: false,
    });

    const view = await renderHook(() => useArgTrail());

    expect(view.result.current.activeTrace).toBeNull();
    expect(view.result.current.activeFragment).toBeNull();
    expect(view.result.current.traceGrid).toBeNull();
  });
});
