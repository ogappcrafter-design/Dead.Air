// __tests__/lib/iap.purchaseRouting.test.ts
// DEA-93 glue test: proves the purchase → entitlement → content chain is
// wired together end-to-end. Every product sold in the store screen must
// (a) be routable by applyPurchase to the correct entitlement store, and
// (b) resolve to real content downstream (atmos profile + fragments, tape
// pack tapes + calls, skin definition). A product ID that routes nowhere,
// or content that resolves to nothing, means the pieces are not together.

import { applyPurchase, PRODUCT_IDS, ALL_PRODUCT_IDS } from '@/lib/iap';
import { useStoreStore } from '@/store/useStoreStore';
import { useSkinStore } from '@/store/useSkinStore';
import { getAtmosphericPack } from '@/data/atmosphericPacks';
import { TAPE_PACKS, getTapePackByProductId } from '@/data/tapePacks';
import { PURCHASABLE_SKIN_IDS, getSkin } from '@/lib/skins';
import { callManager } from '@/engine/calls/callManagerInstance';
import type * as IAPTypes from 'expo-in-app-purchases';

function makePurchase(
  productId: string,
  overrides: Partial<IAPTypes.InAppPurchase> = {},
): IAPTypes.InAppPurchase {
  return {
    productId,
    orderId: `order-${productId}`,
    purchaseTime: 1_700_000_000_000,
    // InAppPurchaseState.PURCHASED (literal 1 — the IAP module is
    // native-only and must not be imported at runtime in tests).
    purchaseState: 1,
    transactionReceipt: 'receipt',
    ...overrides,
  } as IAPTypes.InAppPurchase;
}

function resetStores(): void {
  useStoreStore.setState({
    hasInfiniteSignal: false,
    hasBase: false,
    ownedAtmosphericPacks: [],
    purchases: [],
    ownedTapePacks: [],
    lastError: null,
    lastMessage: null,
  });
  useSkinStore.setState({
    activeSkin: 'default',
    ownedSkins: ['default'],
  });
}

describe('iap purchase routing (DEA-93 glue)', () => {
  beforeEach(() => {
    resetStores();
  });

  it('routes each DEA-93 atmospheric pack product to real pack content', () => {
    const cases = [
      { product: PRODUCT_IDS.ATMOS_TRAIN_STATION, packId: 'train_station' },
      { product: PRODUCT_IDS.ATMOS_ABANDONED_HOSPITAL, packId: 'abandoned_hospital' },
    ];
    for (const { product, packId } of cases) {
      resetStores();
      // The product id the store screen sells must be a purchasable product.
      expect(ALL_PRODUCT_IDS).toContain(product);
      expect(applyPurchase(product, makePurchase(product))).toBe(true);

      const store = useStoreStore.getState();
      expect(store.ownedAtmosphericPacks).toContain(packId);

      // The entitlement must resolve to real content downstream.
      const pack = getAtmosphericPack(packId);
      expect(pack).toBeDefined();
      expect(pack?.productId).toBe(product);
      expect(pack?.ambientProfile).toBeDefined();
      expect(Object.keys(pack?.ambientProfile?.bandParams ?? {})).toHaveLength(8);
      expect(pack?.fragments).toBeDefined();
      expect(pack?.fragments.callTypes.length).toBeGreaterThan(0);
      expect(pack?.fragments.openings.length).toBeGreaterThan(0);
    }
  });

  it('routes pre-existing atmospheric pack products (regression)', () => {
    const cases = [
      { product: PRODUCT_IDS.ATMOS_RAIN_NIGHT, packId: 'rain_night' },
      { product: PRODUCT_IDS.ATMOS_WINTER_STATIC, packId: 'winter_static' },
      { product: PRODUCT_IDS.ATMOS_DEEP_SPACE, packId: 'deep_space' },
    ];
    for (const { product, packId } of cases) {
      resetStores();
      expect(applyPurchase(product, makePurchase(product))).toBe(true);
      expect(useStoreStore.getState().ownedAtmosphericPacks).toContain(packId);
      expect(getAtmosphericPack(packId)?.productId).toBe(product);
    }
  });

  it('routes the Mercy General tape pack product to real tape pack content', () => {
    expect(ALL_PRODUCT_IDS).toContain(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL);
    expect(
      applyPurchase(
        PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL,
        makePurchase(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL),
      ),
    ).toBe(true);
    expect(useStoreStore.getState().ownedTapePacks).toContain(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL);

    const pack = getTapePackByProductId(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL);
    expect(pack).toBeDefined();
    expect(pack?.tapes).toHaveLength(5);
    expect(pack?.calls).toHaveLength(3);
    // Every tape in the pack must exist in the combined tape registry.
    for (const tape of pack?.tapes ?? []) {
      expect(tape.id).toMatch(/^tape-03[1-5]$/);
    }
    // Every hand-authored call must carry the pack product id for gating.
    for (const call of pack?.calls ?? []) {
      expect(call.sourcePackId).toBe(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL);
    }
  });

  it('routes every registered tape pack product to its pack (regression + new)', () => {
    for (const pack of TAPE_PACKS) {
      resetStores();
      expect(ALL_PRODUCT_IDS).toContain(pack.productId);
      expect(applyPurchase(pack.productId, makePurchase(pack.productId))).toBe(true);
      expect(useStoreStore.getState().ownedTapePacks).toContain(pack.productId);
      expect(getTapePackByProductId(pack.productId)?.packId).toBe(pack.packId);
    }
  });

  it('routes each purchasable skin product to a real skin definition', () => {
    for (const skinId of PURCHASABLE_SKIN_IDS) {
      resetStores();
      const product = `com.deadair.skin.${skinId}`;
      expect(ALL_PRODUCT_IDS).toContain(product);
      expect(applyPurchase(product, makePurchase(product))).toBe(true);

      const skinStore = useSkinStore.getState();
      expect(skinStore.ownedSkins).toContain(skinId);
      // Owned skins must be selectable.
      skinStore.setActiveSkin(skinId);
      expect(useSkinStore.getState().activeSkin).toBe(skinId);
      expect(getSkin(skinId).id).toBe(skinId);
    }
  });

  it('routes the two new skins specifically (DEA-93)', () => {
    for (const skinId of ['pirate_radio', 'hospital_intercom'] as const) {
      resetStores();
      const product = `com.deadair.skin.${skinId}`;
      expect(applyPurchase(product, makePurchase(product))).toBe(true);
      expect(useSkinStore.getState().ownedSkins).toContain(skinId);
    }
  });

  it('rejects a purchase without a transaction receipt', () => {
    expect(
      applyPurchase(
        PRODUCT_IDS.ATMOS_TRAIN_STATION,
        makePurchase(PRODUCT_IDS.ATMOS_TRAIN_STATION, { transactionReceipt: undefined }),
      ),
    ).toBe(false);
    const store = useStoreStore.getState();
    expect(store.ownedAtmosphericPacks).toHaveLength(0);
    expect(store.purchases).toHaveLength(0);
    expect(store.lastError?.kind).toBe('declined');
  });

  it('does not leak tape pack entitlements into atmospheric packs or skins', () => {
    expect(
      applyPurchase(
        PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL,
        makePurchase(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL),
      ),
    ).toBe(true);
    const store = useStoreStore.getState();
    expect(store.ownedAtmosphericPacks).toHaveLength(0);
    expect(useSkinStore.getState().ownedSkins).toEqual(['default']);
  });
});

describe('DEA-93 live registry gating (purchase unlocks real calls)', () => {
  // The live registry (engine/calls/callManagerInstance.ts) generates 5
  // procedural calls per atmospheric pack at module load:
  // ATMOSPHERIC_FRAGMENTS[i] zips ATMOSPHERIC_PACKS[i] with _atmosIdBases[i],
  // so Last Train owns 5000-5004 and Mercy General (atmos) owns 7000-7004.
  const ATTEMPT: Array<{ packId: string; product: string; callId: number }> = [
    { packId: 'train_station', product: PRODUCT_IDS.ATMOS_TRAIN_STATION, callId: 5000 },
    { packId: 'abandoned_hospital', product: PRODUCT_IDS.ATMOS_ABANDONED_HOSPITAL, callId: 7000 },
  ];

  beforeEach(() => {
    callManager.reset();
    useStoreStore.setState({ ownedAtmosphericPacks: [], ownedTapePacks: [] });
  });

  afterEach(() => {
    callManager.reset();
    useStoreStore.setState({ ownedAtmosphericPacks: [], ownedTapePacks: [] });
  });

  it('blocks each new atmospheric pack call until the pack is purchased', () => {
    for (const { packId, product, callId } of ATTEMPT) {
      // Not owned: the call exists in the registry but must not start.
      expect(callManager.startCall(callId)).toBe(false);

      // Purchase grants the entitlement and immediately unlocks the call.
      expect(applyPurchase(product, makePurchase(product))).toBe(true);
      expect(useStoreStore.getState().ownedAtmosphericPacks).toContain(packId);
      expect(callManager.startCall(callId)).toBe(true);
      callManager.reset();
    }
  });

  it('blocks Mercy General hand-authored calls until the tape pack is purchased', () => {
    for (const callId of [500, 501, 502]) {
      expect(callManager.startCall(callId)).toBe(false);
    }
    expect(
      applyPurchase(
        PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL,
        makePurchase(PRODUCT_IDS.TAPE_PACK_MERCY_GENERAL),
      ),
    ).toBe(true);
    for (const callId of [500, 501, 502]) {
      expect(callManager.startCall(callId)).toBe(true);
      callManager.reset();
    }
  });
});
