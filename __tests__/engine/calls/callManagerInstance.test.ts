import { callManager, refreshExpansionCalls } from '@/engine/calls/callManagerInstance';
import { useStoreStore } from '@/store/useStoreStore';

const INFINITE_SIGNAL_PRODUCT_ID = 'com.deadair.infinite_signal';

function grantInfiniteSignal(): void {
  const store = useStoreStore.getState();
  store.addPurchase({
    productId: INFINITE_SIGNAL_PRODUCT_ID,
    orderId: 'test-infinite-signal-order',
    purchaseTime: 1,
    transactionReceipt: 'test-receipt',
  });
  store.setInfiniteSignal(true);
}

describe('runtime Infinite Signal call registry', () => {
  beforeEach(() => {
    callManager.reset();
    useStoreStore.setState({
      hasInfiniteSignal: false,
      purchases: [],
      ownedTapePacks: [],
    });
    refreshExpansionCalls(false, []);
  });

  afterEach(() => {
    callManager.reset();
    useStoreStore.setState({
      hasInfiniteSignal: false,
      purchases: [],
      ownedTapePacks: [],
    });
    refreshExpansionCalls(false, []);
  });

  it('does not register or start procedural calls for a non-owner', () => {
    refreshExpansionCalls(useStoreStore.getState().hasInfiniteSignal, []);

    expect(callManager.startCall(1000)).toBe(false);
  });

  it('registers procedural calls after a confirmed entitlement is present', () => {
    grantInfiniteSignal();
    const store = useStoreStore.getState();
    refreshExpansionCalls(store.hasInfiniteSignal, store.ownedTapePacks);

    expect(callManager.startCall(1000)).toBe(true);
  });

  it('removes procedural calls when the entitlement is revoked', () => {
    grantInfiniteSignal();
    const ownedStore = useStoreStore.getState();
    refreshExpansionCalls(ownedStore.hasInfiniteSignal, ownedStore.ownedTapePacks);
    expect(callManager.startCall(1000)).toBe(true);

    callManager.reset();
    useStoreStore.getState().setInfiniteSignal(false);
    refreshExpansionCalls(useStoreStore.getState().hasInfiniteSignal, []);

    expect(callManager.startCall(1000)).toBe(false);
  });
});
