import { z } from 'zod';
import { ENTITLEMENT_PRODUCT_IDS } from '../../lib/constants';
import type { EntitlementProof } from '../../lib/community/schema';
import { hashDeviceToken } from './auth';
import { errorResponse } from './http';
import type { CommunityEnv, RequestContext } from './types';

class VerificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function invalid(): never {
  throw new VerificationError(
    'purchase_invalid',
    'Infinite Signal purchase is invalid or revoked.',
    403,
  );
}

function unavailable(): never {
  throw new VerificationError(
    'verification_unavailable',
    'Purchase verification is unavailable. Try again later.',
    503,
  );
}

function configured(...values: (string | undefined)[]): void {
  if (values.some((value) => !value?.trim())) {
    throw new VerificationError(
      'verification_not_configured',
      'Store verification is not configured. Custom-call publishing is disabled.',
      503,
    );
  }
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function signJWT(
  algorithm: 'ES256' | 'RS256',
  pem: string,
  header: Record<string, string>,
  claims: Record<string, string | number>,
): Promise<string> {
  const encode = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));
  const unsigned = `${encode({ alg: algorithm, typ: 'JWT', ...header })}.${encode(claims)}`;
  const keyBytes = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), (char) =>
    char.charCodeAt(0),
  );
  const keyAlgorithm =
    algorithm === 'ES256'
      ? { name: 'ECDSA', namedCurve: 'P-256' }
      : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const key = await crypto.subtle.importKey('pkcs8', keyBytes, keyAlgorithm, false, ['sign']);
  const signature = await crypto.subtle.sign(
    algorithm === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

async function storeRequest(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 400 || response.status === 404 || response.status === 410) invalid();
  if (!response.ok) unavailable();
  return response.json();
}

const appleTransaction = z.object({
  bundleId: z.string(),
  productId: z.string(),
  environment: z.string(),
  transactionId: z.string(),
  originalTransactionId: z.string(),
  type: z.string(),
  purchaseDate: z.number(),
  revocationDate: z.number().optional(),
  revocationReason: z.number().optional(),
  expiresDate: z.number().optional(),
  inAppOwnershipType: z.string(),
});

async function verifyApple(transactionId: string, env: CommunityEnv, now: number) {
  configured(env.APPLE_BUNDLE_ID, env.APPLE_ISSUER_ID, env.APPLE_KEY_ID, env.APPLE_PRIVATE_KEY);
  const jwt = await signJWT(
    'ES256',
    env.APPLE_PRIVATE_KEY!,
    { kid: env.APPLE_KEY_ID! },
    {
      iss: env.APPLE_ISSUER_ID!,
      bid: env.APPLE_BUNDLE_ID!,
      aud: 'appstoreconnect-v1',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 300,
    },
  );
  const response = z
    .object({ signedTransactionInfo: z.string() })
    .parse(
      await storeRequest(
        `https://api.storekit.apple.com/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
        { headers: { Authorization: `Bearer ${jwt}` } },
      ),
    );
  const parts = response.signedTransactionInfo.split('.');
  if (parts.length !== 3) unavailable();
  const payload = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
  const transaction = appleTransaction.parse(
    JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))),
    ),
  );
  if (
    transaction.bundleId !== env.APPLE_BUNDLE_ID ||
    transaction.productId !== ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL ||
    transaction.environment !== 'Production' ||
    transaction.type !== 'Non-Consumable' ||
    transaction.inAppOwnershipType !== 'PURCHASED' ||
    transaction.purchaseDate > now ||
    (transaction.transactionId !== transactionId &&
      transaction.originalTransactionId !== transactionId) ||
    transaction.expiresDate !== undefined
  )
    invalid();
  return {
    purchaseId: transaction.originalTransactionId,
    active: transaction.revocationDate === undefined && transaction.revocationReason === undefined,
  };
}

const googlePurchase = z.object({
  purchaseStateContext: z.object({ purchaseState: z.string() }),
  productLineItem: z.array(
    z.object({
      productId: z.string(),
      productOfferDetails: z.object({
        refundableQuantity: z.number().int(),
        consumptionState: z.string(),
        rentOfferDetails: z.unknown().optional(),
      }),
    }),
  ),
  testPurchaseContext: z.unknown().optional(),
});

async function verifyGoogle(purchaseToken: string, env: CommunityEnv, now: number) {
  configured(env.GOOGLE_PACKAGE_NAME, env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);
  const assertion = await signJWT(
    'RS256',
    env.GOOGLE_PRIVATE_KEY!,
    {},
    {
      iss: env.GOOGLE_CLIENT_EMAIL!,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 300,
    },
  );
  const token = z.object({ access_token: z.string().min(1) }).parse(
    await storeRequest('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    }),
  );
  const purchase = googlePurchase.parse(
    await storeRequest(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(env.GOOGLE_PACKAGE_NAME!)}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`,
      { headers: { Authorization: `Bearer ${token.access_token}` } },
    ),
  );
  const item = purchase.productLineItem.find(
    (entry) => entry.productId === ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL,
  );
  if (
    !item ||
    purchase.testPurchaseContext !== undefined ||
    item.productOfferDetails.rentOfferDetails !== undefined
  )
    invalid();
  return {
    purchaseId: purchaseToken,
    active:
      purchase.purchaseStateContext.purchaseState === 'PURCHASED' &&
      item.productOfferDetails.refundableQuantity > 0 &&
      item.productOfferDetails.consumptionState === 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
  };
}

export async function requirePublishingEntitlement(
  ctx: RequestContext,
  deviceId: string,
  proof: EntitlementProof | undefined,
): Promise<Response | null> {
  if (!proof)
    return errorResponse(
      'purchase_required',
      'A verified Infinite Signal purchase is required to publish custom calls.',
      403,
    );
  try {
    const verifiedAt = ctx.now();
    const result =
      proof.platform === 'apple'
        ? await verifyApple(proof.transactionId, ctx.env, verifiedAt)
        : await verifyGoogle(proof.purchaseToken, ctx.env, verifiedAt);
    const purchaseHash = await hashDeviceToken(`${proof.platform}:${result.purchaseId}`);
    const bound = await ctx.store.bindEntitlement({
      purchaseHash,
      deviceId,
      platform: proof.platform,
      active: result.active,
      verifiedAt,
    });
    if (!bound)
      return errorResponse(
        'purchase_bound',
        'This purchase is already linked to another community device.',
        403,
      );
    if (!result.active) invalid();
    return null;
  } catch (error) {
    if (error instanceof VerificationError)
      return errorResponse(error.code, error.message, error.status);
    return errorResponse(
      'verification_unavailable',
      'Purchase verification failed. Check store configuration or try again later.',
      503,
    );
  }
}
