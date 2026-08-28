// lib/iap.ts
// IAP orchestration for Dead Air Radio.
// Connects to expo-in-app-purchases, manages purchase lifecycle, and updates useStoreStore.
// State lives in useStoreStore; this module is the service layer.

import { Platform } from 'react-native';
import { useStoreStore, IAPErrorState, PurchaseRecord } from '../store/useStoreStore';
import { useSkinStore, skinIdFromProductId } from '../store/useSkinStore';
import { PURCHASABLE_SKIN_IDS } from './skins';
import { ENTITLEMENT_PRODUCT_IDS } from './constants';

// Type-only import: erased at compile time, never crashes on web.
import type * as IAPTypes from 'expo-in-app-purchases';

// expo-in-app-purchases is a native-only module. On web it throws
// "Cannot find native module 'ExpoInAppPurchases'" at import time, which
// crashes the whole bundle. Lazy-load it only on native platforms.
let iap: typeof import('expo-in-app-purchases') | null = null;
function getIAP(): typeof import('expo-in-app-purchases') | null {
  if (iap) return iap;
  if (Platform.OS === 'web') return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  iap = require('expo-in-app-purchases');
  return iap;
}

export const PRODUCT_IDS = {
  BASE: ENTITLEMENT_PRODUCT_IDS.BASE,
  INFINITE_SIGNAL: ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL,
  ATMOS_RAIN_NIGHT: 'com.deadair.atmos_rain_night',
  ATMOS_WINTER_STATIC: 'com.deadair.atmos_winter_static',
  ATMOS_DEEP_SPACE: 'com.deadair.atmos_deep_space',
  SKIN_VINTAGE_WOOD: 'com.deadair.skin.vintage_wood',
  SKIN_MILITARY_GREEN: 'com.deadair.skin.military_green',
  SKIN_SPACE_AGE_BLUE: 'com.deadair.skin.space_age_blue',
  SKIN_DIGITAL_PIXEL: 'com.deadair.skin.digital_pixel',
  TAPE_PACK_HOLIDAY: 'com.deadair.tape_pack_holiday',
  TAPE_PACK_NUMBERS_STATION: 'com.deadair.tape_pack_numbers_station',
  TAPE_PACK_VOICES_BEYOND: 'com.deadair.tape_pack_voices_beyond',
} as const;

export const SKIN_PRODUCT_IDS = PURCHASABLE_SKIN_IDS.map((skinId) => `com.deadair.skin.${skinId}`);

export const TAPE_PACK_IDS = [
  PRODUCT_IDS.TAPE_PACK_HOLIDAY,
  PRODUCT_IDS.TAPE_PACK_NUMBERS_STATION,
  PRODUCT_IDS.TAPE_PACK_VOICES_BEYOND,
] as const;

export const ALL_PRODUCT_IDS = [
  PRODUCT_IDS.BASE,
  PRODUCT_IDS.INFINITE_SIGNAL,
  PRODUCT_IDS.ATMOS_RAIN_NIGHT,
  PRODUCT_IDS.ATMOS_WINTER_STATIC,
  PRODUCT_IDS.ATMOS_DEEP_SPACE,
  ...SKIN_PRODUCT_IDS,
  ...TAPE_PACK_IDS,
];

/** Map atmospheric product ID → pack ID for store.addOwnedAtmosphericPack. */
const ATMOS_PACK_IDS: Record<string, string> = {
  [PRODUCT_IDS.ATMOS_RAIN_NIGHT]: 'rain_night',
  [PRODUCT_IDS.ATMOS_WINTER_STATIC]: 'winter_static',
  [PRODUCT_IDS.ATMOS_DEEP_SPACE]: 'deep_space',
};

// ---- Module-level state (not exported) ----

let purchaseListener: ((result: IAPTypes.IAPQueryResponse<IAPTypes.InAppPurchase>) => void) | null =
  null;
// Resolvers for in-flight purchaseItemAsync calls, keyed by product id so concurrent
// purchases each get their own promise resolved by the matching purchase event.
const pendingResolvers = new Map<
  string,
  (result: IAPTypes.IAPQueryResponse<IAPTypes.InAppPurchase>) => void
>();
let initialized = false;

// ---- Helpers ----

function applyPurchase(productId: string, purchase: IAPTypes.InAppPurchase): boolean {
  const store = useStoreStore.getState();

  // Only treat a purchase as valid when the store returned a transaction receipt.
  // A PURCHASED/RESTORED event without a receipt is not proof of entitlement, so we
  // must not persist it or unlock the product.
  if (!purchase.transactionReceipt || !purchase.orderId) {
    store.setError({
      kind: 'declined',
      message: 'Purchase could not be verified. No transaction receipt was provided.',
    });
    return false;
  }

  const record: PurchaseRecord = {
    productId,
    orderId: purchase.orderId,
    purchaseTime: purchase.purchaseTime,
    transactionReceipt: purchase.transactionReceipt,
  };
  store.addPurchase(record);

  if (productId === PRODUCT_IDS.INFINITE_SIGNAL) {
    store.setInfiniteSignal(true);
  } else if (productId === PRODUCT_IDS.BASE) {
    store.setBase(true);
  } else if (TAPE_PACK_IDS.includes(productId as (typeof TAPE_PACK_IDS)[number])) {
    store.addOwnedTapePack(productId);
  } else {
    const packId = ATMOS_PACK_IDS[productId];
    if (packId !== undefined) {
      store.addOwnedAtmosphericPack(packId);
    } else {
      const skinId = skinIdFromProductId(productId);
      if (skinId) {
        useSkinStore.getState().addOwnedSkin(skinId);
      }
    }
  }
  return true;
}

function classifyError(errorCode?: IAPTypes.IAPErrorCode): IAPErrorState {
  const IAP = getIAP();
  if (!IAP) return { kind: 'unknown', message: 'IAP not available on web.' };
  switch (errorCode) {
    case IAP.IAPErrorCode.SERVICE_DISCONNECTED:
    case IAP.IAPErrorCode.SERVICE_UNAVAILABLE:
    case IAP.IAPErrorCode.SERVICE_TIMEOUT:
    case IAP.IAPErrorCode.CLOUD_SERVICE:
      return {
        kind: 'service_unavailable',
        message: 'Store service unavailable. Check your connection and try again.',
      };
    case IAP.IAPErrorCode.ITEM_ALREADY_OWNED:
      return { kind: 'already_owned', message: 'You already own this item.' };
    case IAP.IAPErrorCode.ITEM_UNAVAILABLE:
    case IAP.IAPErrorCode.INVALID_IDENTIFIER:
      return {
        kind: 'unknown',
        message: 'This item is not available for purchase.',
      };
    case IAP.IAPErrorCode.BILLING_UNAVAILABLE:
      return {
        kind: 'service_unavailable',
        message: 'Billing is not available on this device.',
      };
    case IAP.IAPErrorCode.PAYMENT_INVALID:
      return { kind: 'declined', message: 'Payment was declined.' };
    default:
      return { kind: 'unknown', message: 'An unexpected error occurred.' };
  }
}

// ---- Public API ----

export async function initIAP(): Promise<void> {
  if (initialized) return;
  const IAP = getIAP();
  if (!IAP) return; // web: skip native IAP init

  purchaseListener = (result: IAPTypes.IAPQueryResponse<IAPTypes.InAppPurchase>): void => {
    const store = useStoreStore.getState();
    const purchase = result.results?.[0];

    switch (result.responseCode) {
      case IAP.IAPResponseCode.OK: {
        if (
          purchase &&
          (purchase.purchaseState === IAP.InAppPurchaseState.PURCHASED ||
            purchase.purchaseState === IAP.InAppPurchaseState.RESTORED)
        ) {
          applyPurchase(purchase.productId, purchase);
          IAP.finishTransactionAsync(purchase, false).catch(() => {
            // Best-effort finish; the purchase is already recorded.
          });
          store.setMessage(
            purchase.purchaseState === IAP.InAppPurchaseState.RESTORED
              ? 'Purchase restored.'
              : 'Purchase complete.',
          );
        }
        break;
      }
      case IAP.IAPResponseCode.USER_CANCELED: {
        store.setError({ kind: 'declined', message: 'Purchase canceled.' });
        break;
      }
      case IAP.IAPResponseCode.DEFERRED: {
        store.setError({
          kind: 'interrupted',
          message: 'Purchase deferred (e.g. Ask to Buy). It will complete later.',
        });
        break;
      }
      case IAP.IAPResponseCode.ERROR: {
        store.setError(classifyError(result.errorCode));
        break;
      }
    }

    // Resolve the pending purchaseProduct promise for the purchase that produced this
    // event. If the event carries no purchase (cancel/error), resolve every pending
    // request: those states are terminal and no later event will complete them.
    if (purchase) {
      const resolver = pendingResolvers.get(purchase.productId);
      if (resolver) {
        pendingResolvers.delete(purchase.productId);
        resolver(result);
      }
    } else {
      for (const resolver of pendingResolvers.values()) {
        resolver(result);
      }
      pendingResolvers.clear();
    }
    store.setPurchasing(false);
    store.setPurchasingProductId(null);
  };

  IAP.setPurchaseListener(purchaseListener);

  try {
    await IAP.connectAsync();
    // Mark initialized only after the connection succeeds so a failed first
    // attempt can be retried on a later initIAP() call.
    initialized = true;
    useStoreStore.getState().setConnected(true);
  } catch {
    // Leave initialized=false so initIAP() can retry next time.
    initialized = false;
    useStoreStore.getState().setConnected(false);
    useStoreStore.getState().setError({
      kind: 'service_unavailable',
      message: 'Could not connect to the store.',
    });
  }
}

export async function purchaseProduct(
  productId: string,
): Promise<IAPTypes.IAPQueryResponse<IAPTypes.InAppPurchase> | null> {
  const store = useStoreStore.getState();
  const IAP = getIAP();

  if (!IAP) {
    store.setError({ kind: 'unknown', message: 'Purchases are not available on web.' });
    return null;
  }

  if (!store.isConnected) {
    store.setError({
      kind: 'service_unavailable',
      message: 'Store is not connected. Try again later.',
    });
    return null;
  }

  // Refuse to start a second purchase for the same product while one is in flight;
  // the store listener can only complete one pending request per product.
  if (pendingResolvers.has(productId)) {
    store.setError({
      kind: 'already_owned',
      message: 'A purchase for this item is already in progress.',
    });
    return null;
  }

  store.setPurchasing(true);
  store.setPurchasingProductId(productId);
  store.setError(null);
  store.setMessage(null);

  return new Promise<IAPTypes.IAPQueryResponse<IAPTypes.InAppPurchase> | null>((resolve) => {
    pendingResolvers.set(productId, resolve);
    IAP.purchaseItemAsync(productId).catch(() => {
      pendingResolvers.delete(productId);
      store.setPurchasing(false);
      store.setPurchasingProductId(null);
      store.setError({
        kind: 'unknown',
        message: 'Purchase failed to start.',
      });
      resolve(null);
    });
  });
}

export async function restorePurchases(): Promise<void> {
  const store = useStoreStore.getState();
  const IAP = getIAP();

  if (!IAP) {
    store.setError({ kind: 'unknown', message: 'Purchases are not available on web.' });
    return;
  }

  if (!store.isConnected) {
    store.setError({
      kind: 'service_unavailable',
      message: 'Store is not connected.',
    });
    return;
  }

  store.setError(null);
  store.setMessage(null);

  try {
    const result = await IAP.getPurchaseHistoryAsync();
    if (result.responseCode === IAP.IAPResponseCode.OK && result.results) {
      if (result.results.length === 0) {
        store.setMessage('No purchases to restore.');
        return;
      }
      let restoredCount = 0;
      for (const purchase of result.results) {
        if (
          purchase.purchaseState === IAP.InAppPurchaseState.PURCHASED ||
          purchase.purchaseState === IAP.InAppPurchaseState.RESTORED
        ) {
          if (applyPurchase(purchase.productId, purchase)) {
            restoredCount++;
          }
        }
      }
      store.setMessage(
        restoredCount > 0
          ? `Restored ${restoredCount} purchase(s).`
          : 'No new purchases to restore.',
      );
    } else if (result.responseCode === IAP.IAPResponseCode.ERROR) {
      store.setError(classifyError(result.errorCode));
    }
  } catch {
    store.setError({ kind: 'unknown', message: 'Restore failed.' });
  }
}

/**
 * Re-validate entitlements against the store's purchase history on app launch.
 * Revokes entitlements for purchases that were refunded or cancelled.
 * Best-effort: silently skips if IAP is unavailable or not connected.
 */
export async function revalidateEntitlements(): Promise<void> {
  const store = useStoreStore.getState();
  const IAP = getIAP();

  if (!IAP || !store.isConnected) return;

  try {
    const result = await IAP.getPurchaseHistoryAsync();
    if (result.responseCode !== IAP.IAPResponseCode.OK || !result.results) return;

    const validProductIds = new Set(
      result.results
        .filter(
          (p) =>
            p.purchaseState === IAP.InAppPurchaseState.PURCHASED ||
            p.purchaseState === IAP.InAppPurchaseState.RESTORED,
        )
        .map((p) => p.productId),
    );

    const current = useStoreStore.getState();
    if (
      current.hasInfiniteSignal &&
      !validProductIds.has(ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL)
    ) {
      current.setInfiniteSignal(false);
    }
    if (current.hasBase && !validProductIds.has(ENTITLEMENT_PRODUCT_IDS.BASE)) {
      current.setBase(false);
    }
  } catch {
    // Best-effort: don't block app launch on revalidation failure
  }
}

export async function disconnectIAP(): Promise<void> {
  const IAP = getIAP();
  try {
    if (IAP) await IAP.disconnectAsync();
  } catch {
    // Best-effort disconnect
  }
  useStoreStore.getState().setConnected(false);
  initialized = false;
  purchaseListener = null;
}
