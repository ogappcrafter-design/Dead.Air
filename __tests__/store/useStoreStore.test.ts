// __tests__/store/useStoreStore.test.ts
import { useStoreStore, PurchaseRecord } from '../../store/useStoreStore';
import { hasInfiniteSignal, getCallPool } from '@/engine/progression/InfiniteSignal';
import { CALLS } from '@/data/calls';
import type { CallData } from '@/engine/calls/types';

describe('useStoreStore', () => {
  beforeEach(() => {
    useStoreStore.setState({
      hasInfiniteSignal: false,
      hasBase: false,
      purchases: [],
      isConnected: false,
      purchasing: false,
      lastError: null,
      lastMessage: null,
    });
  });

  it('has correct initial state', () => {
    const state = useStoreStore.getState();
    expect(state.hasInfiniteSignal).toBe(false);
    expect(state.hasBase).toBe(false);
    expect(state.purchases).toEqual([]);
    expect(state.isConnected).toBe(false);
    expect(state.purchasing).toBe(false);
    expect(state.lastError).toBeNull();
    expect(state.lastMessage).toBeNull();
  });

  it('setInfiniteSignal sets hasInfiniteSignal', () => {
    useStoreStore.getState().setInfiniteSignal(true);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(true);
    useStoreStore.getState().setInfiniteSignal(false);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
  });

  it('setBase sets hasBase', () => {
    useStoreStore.getState().setBase(true);
    expect(useStoreStore.getState().hasBase).toBe(true);
    useStoreStore.getState().setBase(false);
    expect(useStoreStore.getState().hasBase).toBe(false);
  });

  it('addPurchase appends a record', () => {
    const record: PurchaseRecord = {
      productId: 'com.deadair.infinite_signal',
      orderId: 'order-1',
      purchaseTime: 1000,
      transactionReceipt: 'receipt-1',
    };
    useStoreStore.getState().addPurchase(record);
    expect(useStoreStore.getState().purchases).toHaveLength(1);
    expect(useStoreStore.getState().purchases[0]).toEqual(record);
  });

  it('addPurchase deduplicates by orderId', () => {
    const record: PurchaseRecord = {
      productId: 'com.deadair.base',
      orderId: 'order-dup',
      purchaseTime: 1000,
      transactionReceipt: 'receipt-dup',
    };
    useStoreStore.getState().addPurchase(record);
    useStoreStore.getState().addPurchase(record);
    expect(useStoreStore.getState().purchases).toHaveLength(1);
  });

  it('addPurchase allows different orderIds', () => {
    const r1: PurchaseRecord = {
      productId: 'com.deadair.base',
      orderId: 'order-1',
      purchaseTime: 1000,
      transactionReceipt: null,
    };
    const r2: PurchaseRecord = {
      productId: 'com.deadair.infinite_signal',
      orderId: 'order-2',
      purchaseTime: 2000,
      transactionReceipt: null,
    };
    useStoreStore.getState().addPurchase(r1);
    useStoreStore.getState().addPurchase(r2);
    expect(useStoreStore.getState().purchases).toHaveLength(2);
  });

  it('setConnected sets isConnected', () => {
    useStoreStore.getState().setConnected(true);
    expect(useStoreStore.getState().isConnected).toBe(true);
    useStoreStore.getState().setConnected(false);
    expect(useStoreStore.getState().isConnected).toBe(false);
  });

  it('setPurchasing sets purchasing', () => {
    useStoreStore.getState().setPurchasing(true);
    expect(useStoreStore.getState().purchasing).toBe(true);
    useStoreStore.getState().setPurchasing(false);
    expect(useStoreStore.getState().purchasing).toBe(false);
  });

  it('setError sets lastError', () => {
    const err = { kind: 'network' as const, message: 'Connection failed' };
    useStoreStore.getState().setError(err);
    expect(useStoreStore.getState().lastError).toEqual(err);
    useStoreStore.getState().setError(null);
    expect(useStoreStore.getState().lastError).toBeNull();
  });

  it('setMessage sets lastMessage', () => {
    useStoreStore.getState().setMessage('Purchase complete.');
    expect(useStoreStore.getState().lastMessage).toBe('Purchase complete.');
    useStoreStore.getState().setMessage(null);
    expect(useStoreStore.getState().lastMessage).toBeNull();
  });

  it('resetPurchases clears all entitlements and records', () => {
    useStoreStore.setState({
      hasInfiniteSignal: true,
      hasBase: true,
      purchases: [
        {
          productId: 'com.deadair.base',
          orderId: 'o1',
          purchaseTime: 1,
          transactionReceipt: null,
        },
      ],
      lastError: { kind: 'unknown', message: 'err' },
      lastMessage: 'msg',
    });
    useStoreStore.getState().resetPurchases();
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
    expect(useStoreStore.getState().hasBase).toBe(false);
    expect(useStoreStore.getState().purchases).toEqual([]);
    expect(useStoreStore.getState().lastError).toBeNull();
    expect(useStoreStore.getState().lastMessage).toBeNull();
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

  // Procedural generation is wired: owning the expansion adds procedural calls.
  it('returns sacred + procedural calls when expansion IS owned', () => {
    const pool = getCallPool(sacredCalls, true);
    expect(pool.length).toBeGreaterThan(18);
    expect(pool.length).toBe(48);
  });

  it('returns a new array instance (does not mutate input)', () => {
    const input: CallData[] = [...sacredCalls];
    const pool = getCallPool(input, false);
    expect(pool).not.toBe(input);
    expect(input.length).toBe(18);
  });
});
