// store/useStoreStore.ts
// In-app purchase state for the Dead Air Radio store.
// Phase 5-4: mock IAP only (no real billing). Persists hasInfiniteSignal only.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PURCHASES_KEY } from '../lib/constants';

interface StoreState {
  // Owned entitlements
  hasInfiniteSignal: boolean;
  // Purchasing UI state
  purchasing: boolean;

  // Actions
  purchaseInfiniteSignal: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  setPurchasing: (purchasing: boolean) => void;
}

const initialState = {
  hasInfiniteSignal: false,
  purchasing: false,
};

/**
 * Mock IAP latency in milliseconds. Real billing SDKs round-trip a network
 * request; we simulate the same delay so UI/purchase flow exercise the
 * purchasing/loading state rather than resolving synchronously.
 */
const MOCK_IAP_LATENCY_MS = 1000;

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      purchaseInfiniteSignal: async () => {
        // Already owned — no-op.
        if (get().hasInfiniteSignal) {
          return;
        }
        set({ purchasing: true });
        await new Promise<void>((resolve) => setTimeout(resolve, MOCK_IAP_LATENCY_MS));
        set({ hasInfiniteSignal: true, purchasing: false });
      },

      restorePurchases: async () => {
        // Mock restore: treat as a successful purchase check.
        // Real billing SDKs would query the store for prior entitlements here.
        await new Promise<void>((resolve) => setTimeout(resolve, MOCK_IAP_LATENCY_MS));
        // Nothing to restore in mock mode — hasInfiniteSignal persists already.
        set({ purchasing: false });
      },

      setPurchasing: (purchasing) => set({ purchasing }),
    }),
    {
      name: PURCHASES_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ hasInfiniteSignal: state.hasInfiniteSignal }),
    },
  ),
);
