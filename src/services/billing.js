/**
 * Billing boundary.
 *
 * The store UI talks only to this module, so wiring real Google Play Billing
 * is a change to one file. Right now `purchase()` resolves locally — the app
 * ships with the store playable but unmonetised, which is the same behaviour
 * v1 had, just no longer smeared through the UI component.
 *
 * To go live, install a billing library and replace the two marked bodies:
 *
 *   import Purchases from 'react-native-purchases';
 *   purchase: await Purchases.purchaseProduct(PRODUCTS[id].sku)
 *   restore:  await Purchases.restorePurchases()  → map entitlements to ids
 */

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

/** Resolves to the entitlement keys to grant, or throws with a user-safe message. */
export async function purchase(productId) {
  const product = PRODUCTS[productId];
  if (!product) throw new Error('Unknown product.');

  // ── Replace this body with the real billing call ──
  return { granted: [product.entitlement] };
}

/** Resolves to every entitlement the account already owns. */
export async function restore() {
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
