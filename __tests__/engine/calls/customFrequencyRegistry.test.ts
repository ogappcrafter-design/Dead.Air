// __tests__/engine/calls/customFrequencyRegistry.test.ts
// DEA-89 — live registry and ownership gate for player-authored calls.

import {
  CUSTOM_FREQUENCY_CALL_ID_BASE,
  callManager,
  clearCustomFrequencyCalls,
  getCustomFrequencyCallIds,
  refreshExpansionCalls,
  registerCustomFrequencyCall,
} from '@/engine/calls/callManagerInstance';
import { createCustomFrequencyDraft } from '@/engine/calls/CustomFrequency';
import { useGameStore } from '@/store/useGameStore';
import { useStoreStore } from '@/store/useStoreStore';
import type { Band } from '@/lib/constants';

const INFINITE_SIGNAL_PRODUCT_ID = 'com.deadair.infinite_signal';

function grantInfiniteSignal(): void {
  const store = useStoreStore.getState();
  store.addPurchase({
    productId: INFINITE_SIGNAL_PRODUCT_ID,
    orderId: 'test-custom-frequency-order',
    purchaseTime: 1,
    transactionReceipt: 'test-receipt',
  });
  store.setInfiniteSignal(true);
}

function frequency(band = 0) {
  const value = createCustomFrequencyDraft(band, {
    id: `local:registry-${band}`,
    name: 'Registry Frequency',
    createdAt: 1,
  });
  if (value === null) throw new Error('No draft');
  return value;
}

describe('custom frequency call registry', () => {
  beforeEach(() => {
    callManager.reset();
    clearCustomFrequencyCalls();
    useStoreStore.setState({ hasInfiniteSignal: false, purchases: [], ownedTapePacks: [] });
    useGameStore.setState({ unlockedBands: ['LIVING'] as Band[] });
  });

  afterEach(() => {
    callManager.reset();
    clearCustomFrequencyCalls();
    useStoreStore.setState({ hasInfiniteSignal: false, purchases: [], ownedTapePacks: [] });
    useGameStore.setState({ unlockedBands: ['LIVING'] as Band[] });
  });

  it('does not register custom calls for a non-owner', () => {
    const call = registerCustomFrequencyCall(frequency(), 0);
    expect(call).toBeNull();
    expect(getCustomFrequencyCallIds()).toHaveLength(0);
    expect(callManager.startCall(CUSTOM_FREQUENCY_CALL_ID_BASE)).toBe(false);
  });

  it('registers and starts a custom call for an owner on an unlocked band', () => {
    grantInfiniteSignal();
    const call = registerCustomFrequencyCall(frequency(), 0);

    expect(call).not.toBeNull();
    expect(call?.id).toBe(CUSTOM_FREQUENCY_CALL_ID_BASE);
    expect(call?.sourceCustomFrequencyId).toBe('local:registry-0');
    expect(getCustomFrequencyCallIds()).toEqual([CUSTOM_FREQUENCY_CALL_ID_BASE]);
    expect(callManager.startCall(CUSTOM_FREQUENCY_CALL_ID_BASE)).toBe(true);
  });

  it('refuses playback on a band the player has not unlocked', () => {
    grantInfiniteSignal();
    const call = registerCustomFrequencyCall(frequency(2), 1);
    expect(call).not.toBeNull();
    expect(callManager.startCall(call!.id)).toBe(false);

    useGameStore.setState({ unlockedBands: ['LIVING', 'LOST'] as Band[] });
    expect(callManager.startCall(call!.id)).toBe(true);
  });

  it('removes custom calls when the entitlement is revoked', () => {
    grantInfiniteSignal();
    const call = registerCustomFrequencyCall(frequency(), 0);
    expect(callManager.startCall(call!.id)).toBe(true);
    callManager.reset();

    useStoreStore.getState().setInfiniteSignal(false);
    refreshExpansionCalls(false, []);

    expect(getCustomFrequencyCallIds()).toHaveLength(0);
    expect(callManager.startCall(call!.id)).toBe(false);
  });

  it('rejects out-of-range slots', () => {
    grantInfiniteSignal();
    expect(registerCustomFrequencyCall(frequency(), -1)).toBeNull();
    expect(registerCustomFrequencyCall(frequency(), 50)).toBeNull();
  });

  it('clears every registered custom call', () => {
    grantInfiniteSignal();
    registerCustomFrequencyCall(frequency(), 0);
    registerCustomFrequencyCall(frequency(), 1);
    expect(getCustomFrequencyCallIds()).toHaveLength(2);
    clearCustomFrequencyCalls();
    expect(getCustomFrequencyCallIds()).toHaveLength(0);
  });
});
