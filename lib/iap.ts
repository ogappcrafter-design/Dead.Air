// lib/iap.ts
// IAP orchestration for Dead Air Radio.
// Connects to expo-in-app-purchases, manages purchase lifecycle, and updates useStoreStore.
// State lives in useStoreStore; this module is the service layer.

import * as InAppPurchases from "expo-in-app-purchases";
import {
  useStoreStore,
  IAPErrorKind,
  IAPErrorState,
  PurchaseRecord,
} from "../store/useStoreStore";

export const PRODUCT_IDS = {
  BASE: "com.deadair.base",
  INFINITE_SIGNAL: "com.deadair.infinite_signal",
} as const;

export const ALL_PRODUCT_IDS = [PRODUCT_IDS.BASE, PRODUCT_IDS.INFINITE_SIGNAL];

// ---- Module-level state (not exported) ----

let purchaseListener:
  | ((
      result: InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase>,
    ) => void)
  | null = null;
// Resolvers for in-flight purchaseItemAsync calls, keyed by product id so concurrent
// purchases each get their own promise resolved by the matching purchase event.
const pendingResolvers = new Map<
  string,
  (
    result: InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase>,
  ) => void
>();
let initialized = false;

// ---- Helpers ----

function applyPurchase(
  productId: string,
  purchase: InAppPurchases.InAppPurchase,
): boolean {
  const store = useStoreStore.getState();

  // Only treat a purchase as valid when the store returned a transaction receipt.
  // A PURCHASED/RESTORED event without a receipt is not proof of entitlement, so we
  // must not persist it or unlock the product.
  if (!purchase.transactionReceipt || !purchase.orderId) {
    store.setError({
      kind: "declined",
      message:
        "Purchase could not be verified. No transaction receipt was provided.",
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
  }
  return true;
}

function classifyError(errorCode?: InAppPurchases.IAPErrorCode): IAPErrorState {
  switch (errorCode) {
    case InAppPurchases.IAPErrorCode.SERVICE_DISCONNECTED:
    case InAppPurchases.IAPErrorCode.SERVICE_UNAVAILABLE:
    case InAppPurchases.IAPErrorCode.SERVICE_TIMEOUT:
    case InAppPurchases.IAPErrorCode.CLOUD_SERVICE:
      return {
        kind: "service_unavailable",
        message:
          "Store service unavailable. Check your connection and try again.",
      };
    case InAppPurchases.IAPErrorCode.ITEM_ALREADY_OWNED:
      return { kind: "already_owned", message: "You already own this item." };
    case InAppPurchases.IAPErrorCode.ITEM_UNAVAILABLE:
    case InAppPurchases.IAPErrorCode.INVALID_IDENTIFIER:
      return {
        kind: "unknown",
        message: "This item is not available for purchase.",
      };
    case InAppPurchases.IAPErrorCode.BILLING_UNAVAILABLE:
      return {
        kind: "service_unavailable",
        message: "Billing is not available on this device.",
      };
    case InAppPurchases.IAPErrorCode.PAYMENT_INVALID:
      return { kind: "declined", message: "Payment was declined." };
    default:
      return { kind: "unknown", message: "An unexpected error occurred." };
  }
}

// ---- Public API ----

export async function initIAP(): Promise<void> {
  if (initialized) return;

  purchaseListener = (
    result: InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase>,
  ) => {
    const store = useStoreStore.getState();
    const purchase = result.results?.[0];

    switch (result.responseCode) {
      case InAppPurchases.IAPResponseCode.OK: {
        if (
          purchase &&
          (purchase.purchaseState ===
            InAppPurchases.InAppPurchaseState.PURCHASED ||
            purchase.purchaseState ===
              InAppPurchases.InAppPurchaseState.RESTORED)
        ) {
          applyPurchase(purchase.productId, purchase);
          InAppPurchases.finishTransactionAsync(purchase, false).catch(() => {
            // Best-effort finish; the purchase is already recorded.
          });
          store.setMessage(
            purchase.purchaseState ===
              InAppPurchases.InAppPurchaseState.RESTORED
              ? "Purchase restored."
              : "Purchase complete.",
          );
        }
        break;
      }
      case InAppPurchases.IAPResponseCode.USER_CANCELED: {
        store.setError({ kind: "declined", message: "Purchase canceled." });
        break;
      }
      case InAppPurchases.IAPResponseCode.DEFERRED: {
        store.setError({
          kind: "interrupted",
          message:
            "Purchase deferred (e.g. Ask to Buy). It will complete later.",
        });
        break;
      }
      case InAppPurchases.IAPResponseCode.ERROR: {
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
  };

  InAppPurchases.setPurchaseListener(purchaseListener);

  try {
    await InAppPurchases.connectAsync();
    // Mark initialized only after the connection succeeds so a failed first
    // attempt can be retried on a later initIAP() call.
    initialized = true;
    useStoreStore.getState().setConnected(true);
  } catch {
    // Leave initialized=false so initIAP() can retry next time.
    initialized = false;
    useStoreStore.getState().setConnected(false);
    useStoreStore
      .getState()
      .setError({
        kind: "service_unavailable",
        message: "Could not connect to the store.",
      });
  }
}

export async function purchaseProduct(
  productId: string,
): Promise<InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase> | null> {
  const store = useStoreStore.getState();

  if (!store.isConnected) {
    store.setError({
      kind: "service_unavailable",
      message: "Store is not connected. Try again later.",
    });
    return null;
  }

  // Refuse to start a second purchase for the same product while one is in flight;
  // the store listener can only complete one pending request per product.
  if (pendingResolvers.has(productId)) {
    store.setError({
      kind: "already_owned",
      message: "A purchase for this item is already in progress.",
    });
    return null;
  }

  store.setPurchasing(true);
  store.setError(null);
  store.setMessage(null);

  return new Promise<InAppPurchases.IAPQueryResponse<InAppPurchases.InAppPurchase> | null>(
    (resolve) => {
      pendingResolvers.set(productId, resolve);
      InAppPurchases.purchaseItemAsync(productId).catch((err: unknown) => {
        pendingResolvers.delete(productId);
        store.setPurchasing(false);
        store.setError({
          kind: "unknown",
          message: "Purchase failed to start.",
        });
        resolve(null);
      });
    },
  );
}

export async function restorePurchases(): Promise<void> {
  const store = useStoreStore.getState();

  if (!store.isConnected) {
    store.setError({
      kind: "service_unavailable",
      message: "Store is not connected.",
    });
    return;
  }

  store.setError(null);
  store.setMessage(null);

  try {
    const result = await InAppPurchases.getPurchaseHistoryAsync();
    if (
      result.responseCode === InAppPurchases.IAPResponseCode.OK &&
      result.results
    ) {
      if (result.results.length === 0) {
        store.setMessage("No purchases to restore.");
        return;
      }
      let restoredCount = 0;
      for (const purchase of result.results) {
        if (
          purchase.purchaseState ===
            InAppPurchases.InAppPurchaseState.PURCHASED ||
          purchase.purchaseState === InAppPurchases.InAppPurchaseState.RESTORED
        ) {
          if (applyPurchase(purchase.productId, purchase)) {
            restoredCount++;
          }
        }
      }
      store.setMessage(
        restoredCount > 0
          ? `Restored ${restoredCount} purchase(s).`
          : "No new purchases to restore.",
      );
    } else if (result.responseCode === InAppPurchases.IAPResponseCode.ERROR) {
      store.setError(classifyError(result.errorCode));
    }
  } catch {
    store.setError({ kind: "unknown", message: "Restore failed." });
  }
}

export async function disconnectIAP(): Promise<void> {
  try {
    await InAppPurchases.disconnectAsync();
  } catch {
    // Best-effort disconnect
  }
  useStoreStore.getState().setConnected(false);
  initialized = false;
  purchaseListener = null;
  pendingResolvers.clear();
}

// Test helper: reset module state between tests
export function __resetIAPModule(): void {
  initialized = false;
  purchaseListener = null;
  pendingResolvers.clear();
}
