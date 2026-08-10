/**
 * Billing boundary.
 *
 * The store UI talks only to this module, so wiring real Google Play Billing
 * is a change to one file.
 *
 * ── NOT YET WIRED ────────────────────────────────────────────────────────────
 * There is no billing library in this project. In development the purchase
 * path resolves locally so the paid content can be exercised; in a release
 * build it refuses, because a store that silently grants paid content for free
 * is worse than a store that admits it is not open yet.
 *
 * To go live:
 *   1. Install a billing library (RevenueCat's react-native-purchases, or
 *      react-native-iap) and configure it with the Play products below.
 *   2. Replace the two marked bodies. Nothing else in the UI changes.
 *   3. Delete BILLING_WIRED and the guard.
 *
 *      import Purchases from 'react-native-purchases';
 *      purchase: await Purchases.purchaseProduct(PRODUCTS[id].sku)
 *      restore:  await Purchases.restorePurchases()  → map entitlements to ids
 */

/** Flip to true in the same commit that lands a real billing implementation. */
export const BILLING_WIRED = false;

export const PRODUCTS = Object.freeze({
  base: {
    id: 'base',
    sku: 'dead_air_base',
    name: 'BASE TRANSMISSION',
    price: '$1.99',
    symbol: '◇',
    color: '#FF8C00',
    entitlement: 'baseUnlocked',
    lines: [
      'Unlock all five broadcast bands.',
      'Access LIMINAL, LOST, CLASSIFIED,',
      'and ████████ frequencies.',
      '14 additional hand-authored calls.',
      'The full story. Every signal.',
    ],
  },
  infinite: {
    id: 'infinite',
    sku: 'dead_air_infinite',
    name: 'INFINITE SIGNAL',
    price: '$0.99',
    symbol: '◉',
    color: '#CCFF00',
    entitlement: 'infiniteUnlocked',
    lines: [
      'Unlimited AI-generated calls.',
      'Each one unique. Each one real.',
      'Powered by Claude.',
      'The frequency never goes quiet.',
    ],
  },
});

export const PRODUCT_LIST = Object.values(PRODUCTS);

export const isOwned = (purchases, productId) => {
  const product = PRODUCTS[productId];
  return !!(product && purchases?.[product.entitlement]);
};

/** True when the store can actually take money. Drives the UI's copy. */
export const isStoreOpen = () => BILLING_WIRED || __DEV__;

const notWired = () =>
  new Error('STORE NOT OPEN YET');

/** Resolves to the entitlement keys to grant, or throws with a user-safe message. */
export async function purchase(productId) {
  const product = PRODUCTS[productId];
  if (!product) throw new Error('Unknown product.');
  if (!isStoreOpen()) throw notWired();

  // ── Replace this body with the real billing call ──
  return { granted: [product.entitlement] };
}

/** Resolves to every entitlement the account already owns. */
export async function restore() {
  if (!isStoreOpen()) throw notWired();

  // ── Replace this body with the real restore call ──
  return { granted: [] };
}

/** Fold a billing result into the purchases object. */
export function applyEntitlements(purchases, granted = []) {
  const next = { ...purchases };
  granted.forEach((key) => {
    next[key] = true;
  });
  return next;
}
