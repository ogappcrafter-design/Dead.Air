// store/useStoreStore.ts
// Authoritative in-app purchase state for Dead Air Radio.
// Zustand + persist + AsyncStorage. Persists entitlements + purchase records.
// IAP orchestration lives in lib/iap.ts; this store is the state holder.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PURCHASES_KEY, ENTITLEMENT_PRODUCT_IDS } from '../lib/constants';

export interface PurchaseRecord {
  productId: string;
  orderId: string;
  purchaseTime: number;
  transactionReceipt: string | null;
}

export type IAPErrorKind =
  'network' | 'declined' | 'already_owned' | 'interrupted' | 'service_unavailable' | 'unknown';

export interface IAPErrorState {
  kind: IAPErrorKind;
  message: string;
}

interface StoreState {
  hasInfiniteSignal: boolean;
  hasBase: boolean;
  // Owned atmospheric DLC pack IDs (deduped)
  ownedAtmosphericPacks: string[];
  // Purchase records (audit trail, dedup by orderId)
  purchases: PurchaseRecord[];
  ownedTapePacks: string[];
  isConnected: boolean;
  purchasing: boolean;
  purchasingProductId: string | null;
  // Non-blocking error state
  lastError: IAPErrorState | null;
  lastMessage: string | null;

  setInfiniteSignal: (owned: boolean) => void;
  setBase: (owned: boolean) => void;
  addOwnedAtmosphericPack: (packId: string) => void;
  addPurchase: (record: PurchaseRecord) => void;
  addOwnedTapePack: (packId: string) => void;
  setConnected: (connected: boolean) => void;
  setPurchasing: (purchasing: boolean) => void;
  setPurchasingProductId: (productId: string | null) => void;
  setError: (error: IAPErrorState | null) => void;
  setMessage: (message: string | null) => void;
  resetPurchases: () => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      hasInfiniteSignal: false,
      hasBase: false,
      ownedAtmosphericPacks: [],
      purchases: [],
      ownedTapePacks: [],
      isConnected: false,
      purchasing: false,
      purchasingProductId: null,
      lastError: null,
      lastMessage: null,

      setInfiniteSignal: (owned) => {
        if (owned) {
          // Grant only if a matching purchase record with a receipt exists.
          // applyPurchase adds the record before calling this setter.
          const hasValidPurchase = get().purchases.some(
            (p) => p.productId === ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL && p.transactionReceipt,
          );
          if (!hasValidPurchase) return;
        }
        set({ hasInfiniteSignal: owned });
      },

      setBase: (owned) => {
        if (owned) {
          const hasValidPurchase = get().purchases.some(
            (p) => p.productId === ENTITLEMENT_PRODUCT_IDS.BASE && p.transactionReceipt,
          );
          if (!hasValidPurchase) return;
        }
        set({ hasBase: owned });
      },

      addOwnedAtmosphericPack: (packId) => {
        const existing = get().ownedAtmosphericPacks;
        if (existing.includes(packId)) {
          return;
        }
        set({ ownedAtmosphericPacks: [...existing, packId] });
      },

      addPurchase: (record) => {
        const existing = get().purchases;
        if (existing.some((p) => p.orderId === record.orderId)) {
          return;
        }
        set({ purchases: [...existing, record] });
      },

      addOwnedTapePack: (packId) => {
        const existing = get().ownedTapePacks;
        if (existing.includes(packId)) return;
        set({ ownedTapePacks: [...existing, packId] });
      },

      setConnected: (connected) => set({ isConnected: connected }),

      setPurchasing: (purchasing) => set({ purchasing }),

      setPurchasingProductId: (productId) => set({ purchasingProductId: productId }),

      setError: (error) => set({ lastError: error }),

      setMessage: (message) => set({ lastMessage: message }),

      resetPurchases: () =>
        set({
          hasInfiniteSignal: false,
          hasBase: false,
          ownedAtmosphericPacks: [],
          purchases: [],
          ownedTapePacks: [],
          lastError: null,
          lastMessage: null,
        }),
    }),
    {
      name: PURCHASES_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        hasInfiniteSignal: state.hasInfiniteSignal,
        hasBase: state.hasBase,
        ownedAtmosphericPacks: state.ownedAtmosphericPacks,
        purchases: state.purchases,
        ownedTapePacks: state.ownedTapePacks,
      }),
    },
  ),
);
