import { create } from 'zustand';
import { iapService, PRODUCT_IDS } from '../engine/iap/IAPService';

// Store state interface
interface StoreState {
  hasInfiniteSignal: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  productPrice: string | null;
  initialize: () => Promise<void>;
  purchaseInfiniteSignal: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  dispose: () => void;
}

// Create store
export const useStoreStore = create<StoreState>((set, get) => ({
  hasInfiniteSignal: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  productPrice: null,

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      await iapService.initialize();

      // Get product price
      const productId = PRODUCT_IDS.INFINITE_SIGNAL;
      const productInfo = productId ? iapService.getProductInfo(productId) : undefined;
      const price = productInfo?.price || null;

      // Check for existing purchases
      const hasInfiniteSignal = await iapService.hasInfiniteSignal();

      set({
        isInitialized: true,
        hasInfiniteSignal,
        isLoading: false,
        productPrice: price,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Initialization failed';
      set({
        isLoading: false,
        error: message,
        isInitialized: false,
      });
      console.error('Store initialization failed:', error);
    }
  },

  purchaseInfiniteSignal: async () => {
    try {
      set({ isLoading: true, error: null });
      const result = await iapService.purchaseInfiniteSignal();

      if (!result.success) {
        set({ isLoading: false, error: result.error || 'Purchase failed' });
        return;
      }

      // Reflect the completed purchase immediately so the UI exits the
      // loading state and unlocks the feature — do not rely on a platform
      // listener callback that may never fire.
      const hasInfiniteSignal = await iapService.hasInfiniteSignal();
      set({ hasInfiniteSignal, isLoading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Purchase failed';
      set({ isLoading: false, error: message });
      console.error('Purchase error:', error);
    }
  },

  restorePurchases: async () => {
    try {
      set({ isLoading: true, error: null });
      const result = await iapService.restorePurchases();

      if (result.success) {
        // Refresh hasInfiniteSignal state
        const hasInfiniteSignal = await iapService.hasInfiniteSignal();
        set({
          hasInfiniteSignal,
          isLoading: false,
          error: result.error || null,
        });
      } else {
        set({ isLoading: false, error: result.error || 'Restore failed' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed';
      set({ isLoading: false, error: message });
      console.error('Restore error:', error);
    }
  },

  dispose: () => {
    iapService.dispose();
    set({
      isInitialized: false,
      hasInfiniteSignal: false,
      isLoading: false,
      error: null,
      productPrice: null,
    });
  },
}));
