import * as IAP from 'expo-in-app-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Platform-specific product IDs (iOS uses bundle ID convention, Android uses package name)
export const PRODUCT_IDS = {
  INFINITE_SIGNAL: Platform.select({
    ios: 'com.daggerstuff.deadair.infinitesignal.ios',
    android: 'com.daggerstuff.deadair.infinitesignal.android',
  }),
};

// Storage keys
export const STORAGE_KEYS = {
  RECEIPTS: 'DAR_IAP_RECEIPTS',
};

// Receipt interface for storage
export interface StoredReceipt {
  productId: string;
  transactionId: string;
  transactionDate: number;
  originalJson: string;
}

// Purchase result interface
export interface PurchaseResult {
  success: boolean;
  error?: string;
  transactionId?: string;
}

// Product info interface
export interface ProductInfo {
  productId: string;
  price: string;
  title: string;
  description: string;
}

// Singleton IAP service
class IAPService {
  private static instance: IAPService;
  private isInitialized = false;
  private products: ProductInfo[] = [];

  private constructor() {}

  public static getInstance(): IAPService {
    if (!IAPService.instance) {
      IAPService.instance = new IAPService();
    }
    return IAPService.instance;
  }

  // Initialize IAP service
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Connect to IAP service
      await IAP.connectAsync();

      // Get product info
      const productSkus = PRODUCT_IDS.INFINITE_SIGNAL ? [PRODUCT_IDS.INFINITE_SIGNAL] : [];
      const products = await IAP.getProductsAsync(productSkus);
      this.products = (products.results || []).map((p) => ({
        productId: p.productId,
        price: p.price,
        title: p.title,
        description: p.description,
      }));

      // Set up purchase listener
      IAP.setPurchaseListener(this.handlePurchaseUpdate.bind(this));

      // Initialize receipts from storage
      await this.loadReceipts();

      this.isInitialized = true;
    } catch (error) {
      console.error('IAP initialization failed:', error);
      throw new Error('Failed to initialize IAP service');
    }
  }

  // Cleanup purchase listener
  public dispose(): void {
    // v14 API: no explicit listener removal; just mark uninitialized
    this.isInitialized = false;
  }

  // Get product info
  public getProductInfo(productId: string): ProductInfo | undefined {
    return this.products.find((p) => p.productId === productId);
  }

  // Purchase Infinite Signal
  public async purchaseInfiniteSignal(): Promise<PurchaseResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'IAP not initialized' };
    }

    try {
      const productId = PRODUCT_IDS.INFINITE_SIGNAL;
      if (!productId) {
        return { success: false, error: 'Product ID not configured for this platform' };
      }

      // Request purchase
      await IAP.purchaseItemAsync(productId);

      // Return pending - actual result comes via purchase listener
      return { success: true };
    } catch (error) {
      const err = error as Error;
      if (err.message.includes('user cancelled')) {
        return { success: false, error: 'Purchase cancelled by user' };
      }
      if (err.message.includes('not available')) {
        return { success: false, error: 'IAP not available on this device' };
      }
      console.error('Purchase failed:', error);
      return { success: false, error: 'Purchase failed. Please try again.' };
    }
  }

  // Restore purchases
  public async restorePurchases(): Promise<PurchaseResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'IAP not initialized' };
    }

    try {
      const response = await IAP.getPurchaseHistoryAsync();
      const purchases = response.results || [];

      if (purchases.length === 0) {
        return { success: true, error: 'No purchases to restore' };
      }

      let hasNewPurchases = false;
      for (const purchase of purchases) {
        if (purchase.productId === PRODUCT_IDS.INFINITE_SIGNAL) {
          const result = await this.processPurchase(purchase);
          if (result) hasNewPurchases = true;
        }
      }

      if (!hasNewPurchases) {
        return { success: true, error: 'No new purchases found' };
      }

      return { success: true };
    } catch (error) {
      console.error('Restore purchases failed:', error);
      return { success: false, error: 'Restore failed. Please try again.' };
    }
  }

  // Handle purchase updates from listener
  private async handlePurchaseUpdate(response: IAP.IAPQueryResponse<IAP.InAppPurchase>): Promise<void> {
    if (response.responseCode !== IAP.IAPResponseCode.OK) {
      return;
    }
    for (const purchase of response.results || []) {
      try {
        if (purchase.productId !== PRODUCT_IDS.INFINITE_SIGNAL) continue;

        switch (purchase.purchaseState) {
          case IAP.InAppPurchaseState.PURCHASED:
            await this.processPurchase(purchase);
            break;
          case IAP.InAppPurchaseState.RESTORED:
            await this.processPurchase(purchase);
            break;
          default:
            console.log('Unhandled purchase state:', purchase.purchaseState);
        }
      } catch (error) {
        console.error('Error processing purchase update:', error);
      }
    }
  }

  // Process a successful purchase
  private async processPurchase(purchase: IAP.InAppPurchase): Promise<boolean> {
    // WARNING: Client-side validation only. Not secure against spoofing.
    // For production, implement server-side receipt validation (Phase 2)
    const isValid = this.validateReceipt(purchase);
    if (!isValid) {
      console.warn('Invalid receipt received');
      return false;
    }

    // Check for cross-device conflicts
    const storedReceipt = await this.getStoredReceipt(purchase.productId);
    if (storedReceipt && purchase.purchaseTime <= storedReceipt.transactionDate) {
      console.log('Older receipt detected, skipping');
      return false;
    }

    // Store the new receipt
    await this.storeReceipt({
      productId: purchase.productId,
      transactionId: purchase.orderId,
      transactionDate: purchase.purchaseTime,
      originalJson: JSON.stringify(purchase),
    });

    return true;
  }

  // Validate receipt (client-side only - WARNING: not secure for production)
  private validateReceipt(purchase: IAP.InAppPurchase): boolean {
    // Basic format validation
    if (!purchase.productId || !purchase.orderId || !purchase.purchaseTime) {
      return false;
    }

    // Verify product ID matches our expected ID
    if (purchase.productId !== PRODUCT_IDS.INFINITE_SIGNAL) {
      return false;
    }

    // WARNING: Client-side only validation. This does NOT verify authenticity.
    // For production, implement server-side validation with Apple/Google APIs.
    return true;
  }

  // Store receipt in AsyncStorage
  private async storeReceipt(receipt: StoredReceipt): Promise<void> {
    try {
      const receipts = await this.getAllReceipts();
      receipts[receipt.productId] = receipt;
      await AsyncStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    } catch (error) {
      console.error('Failed to store receipt:', error);
      throw error;
    }
  }

  // Remove receipt from storage
  private async removeReceipt(productId: string): Promise<void> {
    try {
      const receipts = await this.getAllReceipts();
      delete receipts[productId];
      await AsyncStorage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(receipts));
    } catch (error) {
      console.error('Failed to remove receipt:', error);
      throw error;
    }
  }

  // Get all receipts from storage
  private async getAllReceipts(): Promise<Record<string, StoredReceipt>> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.RECEIPTS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get receipts:', error);
      return {};
    }
  }

  // Get specific receipt from storage
  private async getStoredReceipt(productId: string): Promise<StoredReceipt | null> {
    const receipts = await this.getAllReceipts();
    return receipts[productId] || null;
  }

  // Load receipts on initialization
  private async loadReceipts(): Promise<void> {
    try {
      const receipts = await this.getAllReceipts();
      // Re-validate all stored receipts on startup
      for (const [productId, receipt] of Object.entries(receipts)) {
        if (productId === PRODUCT_IDS.INFINITE_SIGNAL) {
          // For Phase 1, we trust stored receipts. Phase 2 should re-validate with server
          console.log('Loaded receipt for:', productId);
        }
      }
    } catch (error) {
      console.error('Failed to load receipts:', error);
    }
  }

  // Check if user has Infinite Signal
  public async hasInfiniteSignal(): Promise<boolean> {
    const productId = PRODUCT_IDS.INFINITE_SIGNAL;
    if (!productId) return false;
    const receipt = await this.getStoredReceipt(productId);
    return receipt !== null;
  }
}

// Export singleton instance
export const iapService = IAPService.getInstance();
