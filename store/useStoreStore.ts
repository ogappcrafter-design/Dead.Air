// store/useStoreStore.ts
// Authoritative in-app purchase state for Dead Air Radio.
// Zustand + persist + AsyncStorage. Persists entitlements + purchase records.
// IAP orchestration lives in lib/iap.ts; this store is the state holder.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PURCHASES_KEY } from '../lib/constants';

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
  // Owned entitlements
  hasInfiniteSignal: boolean;
  hasBase: boolean;
  // Owned atmospheric DLC pack IDs (deduped)
  ownedAtmosphericPacks: string[];
  // Purchase records (audit trail, dedup by orderId)
  purchases: PurchaseRecord[];
  // Connection state
  isConnected: boolean;
  // Purchasing UI state
  purchasing: boolean;
  purchasingProductId: string | null;
  // Non-blocking error state
  lastError: IAPErrorState | null;
  // Info message (e.g. "Nothing to restore", "Already owned")
  lastMessage: string | null;

  // Actions
  setInfiniteSignal: (owned: boolean) => void;
  setBase: (owned: boolean) => void;
  addOwnedAtmosphericPack: (packId: string) => void;
  addPurchase: (record: PurchaseRecord) => void;
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
      isConnected: false,
      purchasing: false,
      purchasingProductId: null,
      lastError: null,
      lastMessage: null,

      setInfiniteSignal: (owned) => set({ hasInfiniteSignal: owned }),

      setBase: (owned) => set({ hasBase: owned }),

      addOwnedAtmosphericPack: (packId) => {
        const existing = get().ownedAtmosphericPacks;
        if (existing.includes(packId)) {
          return;
        }
        set({ ownedAtmosphericPacks: [...existing, packId] });
      },

      addPurchase: (record) => {
        const existing = get().purchases;
        // Dedup by orderId — restore can replay the same purchase.
        if (existing.some((p) => p.orderId === record.orderId)) {
          return;
        }
        set({ purchases: [...existing, record] });
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
      }),
    },
  ),
);
