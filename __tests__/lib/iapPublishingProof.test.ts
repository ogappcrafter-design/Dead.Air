import { Platform } from 'react-native';
import { getInfiniteSignalPublishingProof, PRODUCT_IDS } from '@/lib/iap';
import { useStoreStore } from '@/store/useStoreStore';
import type * as IAP from 'expo-in-app-purchases';

type NativeHistoryPurchase = Pick<IAP.InAppPurchase, 'productId' | 'purchaseTime'> &
  Partial<IAP.InAppPurchase>;
const mockPurchaseHistory = jest.fn<Promise<IAP.IAPQueryResponse<NativeHistoryPurchase>>, []>();

jest.mock('expo-in-app-purchases', () => ({
  connectAsync: jest.fn(async () => {}),
  setPurchaseListener: jest.fn(),
  getPurchaseHistoryAsync: () => mockPurchaseHistory(),
  IAPResponseCode: { OK: 0, ERROR: 2 },
  InAppPurchaseState: { PURCHASED: 1, RESTORED: 3 },
}));

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  useStoreStore.setState({ purchases: [], hasInfiniteSignal: false });
  mockPurchaseHistory.mockReset();
});
afterEach(() => {
  jest.restoreAllMocks();
});

it('submits the original Apple transaction ID from native store history', async () => {
  mockPurchaseHistory.mockResolvedValue({
    responseCode: 0,
    results: [
      {
        productId: PRODUCT_IDS.INFINITE_SIGNAL,
        orderId: '2002',
        originalOrderId: '1001',
        acknowledged: true,
        purchaseTime: 1,
        purchaseState: 3,
      },
    ],
  });
  expect(await getInfiniteSignalPublishingProof()).toEqual({
    platform: 'apple',
    transactionId: '1001',
  });
});

it('submits the Google token from native Android history without purchase state', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const purchase = {
    productId: PRODUCT_IDS.INFINITE_SIGNAL,
    purchaseToken: 'google-proof',
    purchaseTime: 1,
  };
  mockPurchaseHistory.mockResolvedValue({ responseCode: 0, results: [purchase] });
  expect(await getInfiniteSignalPublishingProof()).toEqual({
    platform: 'google',
    purchaseToken: 'google-proof',
  });
  expect(useStoreStore.getState().hasInfiniteSignal).toBe(false);
});

it.each(['ios', 'android'] as const)(
  'does not treat a local ownership flag as publishing proof on %s',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    useStoreStore.setState({ hasInfiniteSignal: true });
    mockPurchaseHistory.mockResolvedValue({ responseCode: 0, results: [] });
    await expect(getInfiniteSignalPublishingProof()).rejects.toThrow('purchase proof is missing');
  },
);

it.each(['ios', 'android'] as const)(
  'rejects history for another product on %s',
  async (platform) => {
    jest.replaceProperty(Platform, 'OS', platform);
    mockPurchaseHistory.mockResolvedValue({
      responseCode: 0,
      results: [
        {
          productId: PRODUCT_IDS.BASE,
          purchaseTime: 1,
          purchaseToken: 'other-product-token',
          orderId: 'other-product-order',
          purchaseState: 1,
        },
      ],
    });
    await expect(getInfiniteSignalPublishingProof()).rejects.toThrow('purchase proof is missing');
  },
);

it('reports unavailable native store verification', async () => {
  mockPurchaseHistory.mockResolvedValue({ responseCode: 2 });
  await expect(getInfiniteSignalPublishingProof()).rejects.toThrow('Could not read purchase proof');
  jest.replaceProperty(Platform, 'OS', 'web');
  await expect(getInfiniteSignalPublishingProof()).rejects.toThrow('native Apple or Google');
});

it('declares the same Infinite Signal product that the native purchase flow requests', () => {
  const config = require('../../app.json');
  expect(config.expo.ios.inAppPurchases).toContain(PRODUCT_IDS.INFINITE_SIGNAL);
  expect(config.expo.android.inAppPurchases).toContain(PRODUCT_IDS.INFINITE_SIGNAL);
});
