// __tests__/store/useStoreStore.test.ts
import { useStoreStore } from '../../store/useStoreStore';
import { hasInfiniteSignal, getCallPool } from '@/engine/progression/InfiniteSignal';
import { CALLS } from '@/data/calls';
import type { CallData } from '@/engine/calls/types';

describe('useStoreStore', () => {
  beforeEach(() => {
    useStoreStore.setState({
      hasInfiniteSignal: false,
      isLoading: false,
    });
  });

  it('has initial state (false/false)', () => {
    const state = useStoreStore.getState();
    expect(state.hasInfiniteSignal).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it('purchaseInfiniteSignal sets isLoading=true, then resets to false', async () => {
    const { purchaseInfiniteSignal } = useStoreStore.getState();
    const promise = purchaseInfiniteSignal();

    // Synchronously after invocation, isLoading should be true.
    expect(useStoreStore.getState().isLoading).toBe(true);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);

    await promise;

    // Purchase flow completes; isLoading resets (result depends on IAP mock).
    expect(useStoreStore.getState().isLoading).toBe(false);
  });

  it('purchaseInfiniteSignal is a no-op when already owned', async () => {
    useStoreStore.setState({ hasInfiniteSignal: true, isLoading: false });
    const { purchaseInfiniteSignal } = useStoreStore.getState();
    await purchaseInfiniteSignal();
    // No purchase cycle started; state unchanged.
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(true);
    expect(useStoreStore.getState().isLoading).toBe(false);
  });

  it('restorePurchases is a no-op when nothing purchased (does not flip hasInfiniteSignal)', async () => {
    const { restorePurchases } = useStoreStore.getState();
    await restorePurchases();
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
    expect(useStoreStore.getState().isLoading).toBe(false);
  });
});

describe('hasInfiniteSignal helper', () => {
  it('returns false when not owned', () => {
    expect(hasInfiniteSignal({ hasInfiniteSignal: false })).toBe(false);
  });

  it('returns true when owned', () => {
    expect(hasInfiniteSignal({ hasInfiniteSignal: true })).toBe(true);
  });
});

describe('getCallPool', () => {
  const sacredCalls = CALLS as CallData[];

  it('returns all 18 sacred calls when expansion is NOT owned', () => {
    const pool = getCallPool(sacredCalls, false);
    expect(pool.length).toBe(18);
  });

  it('returns sacred calls + procedural calls when expansion IS owned', () => {
    const pool = getCallPool(sacredCalls, true);
    expect(pool.length).toBeGreaterThan(18);
    // First 18 are sacred calls.
    expect(pool.slice(0, 18)).toEqual(sacredCalls);
  });

  it('returns a new array instance (does not mutate input)', () => {
    const input: CallData[] = [...sacredCalls];
    const pool = getCallPool(input, false);
    expect(pool).not.toBe(input);
    expect(input.length).toBe(18);
  });
});
