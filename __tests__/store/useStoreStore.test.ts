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
      ownedTapePacks: [],
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

  it('setInfiniteSignal grants entitlement only with a valid purchase record', () => {
    // Without a purchase record, the setter is a no-op (security gate)
    useStoreStore.getState().setInfiniteSignal(true);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);

    // Add a matching purchase record with a receipt
    useStoreStore.getState().addPurchase({
      productId: 'com.deadair.infinite_signal',
      orderId: 'order-signal',
      purchaseTime: 1000,
      transactionReceipt: 'receipt-signal',
    });

    // Now the setter grants the entitlement
    useStoreStore.getState().setInfiniteSignal(true);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(true);

    // Revocation always works (no purchase record needed)
    useStoreStore.getState().setInfiniteSignal(false);
    expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
  });

  it('setBase grants entitlement only with a valid purchase record', () => {
    // Without a purchase record, the setter is a no-op (security gate)
    useStoreStore.getState().setBase(true);
    expect(useStoreStore.getState().hasBase).toBe(false);

    // Add a matching purchase record with a receipt
    useStoreStore.getState().addPurchase({
      productId: 'com.deadair.base',
      orderId: 'order-base',
      purchaseTime: 1000,
      transactionReceipt: 'receipt-base',
    });

    // Now the setter grants the entitlement
    useStoreStore.getState().setBase(true);
    expect(useStoreStore.getState().hasBase).toBe(true);

    // Revocation always works
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

  it('initializes with empty ownedTapePacks', () => {
    expect(useStoreStore.getState().ownedTapePacks).toEqual([]);
  });

  it('addOwnedTapePack adds a pack id', () => {
    useStoreStore.getState().addOwnedTapePack('com.deadair.tape_pack_holiday');
    expect(useStoreStore.getState().ownedTapePacks).toEqual(['com.deadair.tape_pack_holiday']);
  });

  it('addOwnedTapePack deduplicates', () => {
    const packId = 'com.deadair.tape_pack_numbers_station';
    useStoreStore.getState().addOwnedTapePack(packId);
    useStoreStore.getState().addOwnedTapePack(packId);
    expect(useStoreStore.getState().ownedTapePacks).toEqual([packId]);
  });

  it('addOwnedTapePack allows multiple different packs', () => {
    useStoreStore.getState().addOwnedTapePack('com.deadair.tape_pack_holiday');
    useStoreStore.getState().addOwnedTapePack('com.deadair.tape_pack_numbers_station');
    useStoreStore.getState().addOwnedTapePack('com.deadair.tape_pack_voices_beyond');
    expect(useStoreStore.getState().ownedTapePacks).toHaveLength(3);
  });

  it('resetPurchases clears ownedTapePacks', () => {
    useStoreStore.setState({ ownedTapePacks: ['com.deadair.tape_pack_holiday'] });
    useStoreStore.getState().resetPurchases();
    expect(useStoreStore.getState().ownedTapePacks).toEqual([]);
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
    const pool = getCallPool(sacredCalls, true, undefined, { now: new Date(2026, 5, 15) });
    expect(pool.length).toBeGreaterThan(18);
    expect(pool.length).toBe(66);
  });

  it('returns a new array instance (does not mutate input)', () => {
    const input: CallData[] = [...sacredCalls];
    const pool = getCallPool(input, false);
    expect(pool).not.toBe(input);
    expect(input.length).toBe(18);
  });

  it('includes DLC calls when ownedTapePacks is passed', () => {
    const pool = getCallPool(sacredCalls, true, undefined, {
      now: new Date(2026, 5, 15),
      ownedTapePacks: ['com.deadair.tape_pack_holiday'],
    });
    const dlcIds = pool.filter((c) => c.sourcePackId !== undefined).map((c) => c.id);
    expect(dlcIds).toContain(200);
    expect(dlcIds).toContain(201);
    expect(dlcIds).toContain(202);
  });

  it('excludes DLC calls when ownedTapePacks is empty', () => {
    const pool = getCallPool(sacredCalls, true, undefined, {
      now: new Date(2026, 5, 15),
      ownedTapePacks: [],
    });
    const dlcCalls = pool.filter((c) => c.sourcePackId !== undefined);
    expect(dlcCalls).toHaveLength(0);
  });

  it('includes DLC calls for all three packs when all owned', () => {
    const pool = getCallPool(sacredCalls, true, undefined, {
      now: new Date(2026, 5, 15),
      ownedTapePacks: [
        'com.deadair.tape_pack_holiday',
        'com.deadair.tape_pack_numbers_station',
        'com.deadair.tape_pack_voices_beyond',
      ],
    });
    const dlcIds = pool.filter((c) => c.sourcePackId !== undefined).map((c) => c.id);
    expect(dlcIds).toContain(200);
    expect(dlcIds).toContain(300);
    expect(dlcIds).toContain(400);
  });
});
