// __tests__/store/argTrailStore.test.ts
// DEA-91: the discovery log dedupes, persists nothing it was not told, and
// resets cleanly.

import { useArgTrailStore } from '../../store/argTrailStore';

describe('useArgTrailStore', () => {
  beforeEach(() => {
    useArgTrailStore.setState({
      decodedTraceIds: [],
      heardFragmentIds: [],
      hiddenCallPlayed: false,
    });
  });

  it('starts empty', () => {
    const state = useArgTrailStore.getState();
    expect(state.decodedTraceIds).toEqual([]);
    expect(state.heardFragmentIds).toEqual([]);
    expect(state.hiddenCallPlayed).toBe(false);
  });

  it('records a decoded trace once', () => {
    const { markTraceDecoded } = useArgTrailStore.getState();
    markTraceDecoded('trace-row-23');
    markTraceDecoded('trace-row-23');
    expect(useArgTrailStore.getState().decodedTraceIds).toEqual(['trace-row-23']);
  });

  it('records a filed bleed once', () => {
    const { markFragmentHeard } = useArgTrailStore.getState();
    markFragmentHeard('frag-count-47');
    markFragmentHeard('frag-count-47');
    expect(useArgTrailStore.getState().heardFragmentIds).toEqual(['frag-count-47']);
  });

  it('marks the hidden call played', () => {
    useArgTrailStore.getState().markHiddenCallPlayed();
    expect(useArgTrailStore.getState().hiddenCallPlayed).toBe(true);
  });

  it('resets the log', () => {
    const state = useArgTrailStore.getState();
    state.markTraceDecoded('trace-row-46');
    state.markFragmentHeard('frag-carrier');
    state.markHiddenCallPlayed();
    state.reset();
    const after = useArgTrailStore.getState();
    expect(after.decodedTraceIds).toEqual([]);
    expect(after.heardFragmentIds).toEqual([]);
    expect(after.hiddenCallPlayed).toBe(false);
  });
});
