// __tests__/store/useStoreStore.test.ts
import { useStoreStore } from '../../store/useStoreStore';
import { hasInfiniteSignal, getCallPool } from '@/engine/progression/InfiniteSignal';
import { CALLS } from '@/data/calls';
import type { CallData } from '@/engine/calls/types';

describe('useStoreStore', () => {
  beforeEach(() => {
    useStoreStore.setState({
      hasInfiniteSignal: false,
      purchasing: false,
    });
  });

  it('has initial state (false/false)', () => {
    const state = useStoreStore.getState();
    expect(state.hasInfiniteSignal).toBe(false);
    expect(state.purchasing).toBe(false);
  });

  it('purchaseInfiniteSignal sets purchasing=true, then hasInfiniteSignal=true, then purchasing=false', async () => {
    const { purchaseInfiniteSignal } = useStoreStore.getState();
    const promise = purchaseInfiniteSignal();

    // Synchronously after invocation, purchasing should be true.
    expect(useStoreStore.getState().purchasing).toBe(true);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);

    await promise;

    expect(useStoreStore.getState().hasInfiniteSignal).toBe(true);
    expect(useStoreStore.getState().purchasing).toBe(false);
  });

  it('purchaseInfiniteSignal is a no-op when already owned', async () => {
    useStoreStore.setState({ hasInfiniteSignal: true, purchasing: false });
    const { purchaseInfiniteSignal } = useStoreStore.getState();
    await purchaseInfiniteSignal();
    // No purchase cycle started; state unchanged.
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(true);
    expect(useStoreStore.getState().purchasing).toBe(false);
  });

  it('restorePurchases is a no-op when nothing purchased (does not flip hasInfiniteSignal)', async () => {
    const { restorePurchases } = useStoreStore.getState();
    await restorePurchases();
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
    expect(useStoreStore.getState().purchasing).toBe(false);
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

  // TODO(phase-6): once procedural generation is wired, this should exceed 18.
  it('returns 18 sacred calls even when expansion IS owned (Phase 5-4 placeholder)', () => {
    const pool = getCallPool(sacredCalls, true);
    expect(pool.length).toBe(18);
  });

  it('returns a new array instance (does not mutate input)', () => {
    const input: CallData[] = [...sacredCalls];
    const pool = getCallPool(input, false);
    expect(pool).not.toBe(input);
    expect(input.length).toBe(18);
  });
});
