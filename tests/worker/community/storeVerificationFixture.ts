import { generateKeyPairSync, verify } from 'node:crypto';
import { ENTITLEMENT_PRODUCT_IDS } from '@/lib/constants';
import type { CommunityEnv } from '@/worker/community/types';

const appleKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const googleKey = generateKeyPairSync('rsa', { modulusLength: 2048 });

export const verificationConfig: Partial<CommunityEnv> = {
  APPLE_BUNDLE_ID: 'com.daggerstuff.deadair',
  APPLE_ISSUER_ID: 'test-issuer',
  APPLE_KEY_ID: 'test-key',
  APPLE_PRIVATE_KEY: appleKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  GOOGLE_PACKAGE_NAME: 'com.daggerstuff.deadair',
  GOOGLE_CLIENT_EMAIL: 'test@example.invalid',
  GOOGLE_PRIVATE_KEY: googleKey.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
};

export function appleResponse(overrides: Record<string, unknown> = {}): Response {
  const transaction = {
    bundleId: verificationConfig.APPLE_BUNDLE_ID,
    productId: ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL,
    transactionId: '1001',
    originalTransactionId: '1001',
    environment: 'Production',
    type: 'Non-Consumable',
    inAppOwnershipType: 'PURCHASED',
    purchaseDate: Date.now() - 1000,
    ...overrides,
  };
  return Response.json({
    signedTransactionInfo: `header.${Buffer.from(JSON.stringify(transaction)).toString('base64url')}.signature`,
  });
}

export function googleResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json({
    purchaseStateContext: { purchaseState: 'PURCHASED' },
    productLineItem: [
      {
        productId: ENTITLEMENT_PRODUCT_IDS.INFINITE_SIGNAL,
        productOfferDetails: {
          refundableQuantity: 1,
          consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
        },
      },
    ],
    ...overrides,
  });
}

export function mockStoreVerification() {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      expect(init?.method).toBe('POST');
      const assertion = new URLSearchParams(String(init?.body)).get('assertion')!;
      const [header, payload, signature] = assertion.split('.');
      expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toMatchObject({
        alg: 'RS256',
      });
      expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toMatchObject({
        iss: verificationConfig.GOOGLE_CLIENT_EMAIL,
        aud: 'https://oauth2.googleapis.com/token',
        scope: 'https://www.googleapis.com/auth/androidpublisher',
      });
      expect(
        verify(
          'sha256',
          Buffer.from(`${header}.${payload}`),
          googleKey.publicKey,
          Buffer.from(signature!, 'base64url'),
        ),
      ).toBe(true);
      return Response.json({ access_token: 'test-access-token' });
    }
    expect(new Headers(init?.headers).get('Authorization')).toMatch(/^Bearer /);
    if (url === 'https://api.storekit.apple.com/inApps/v1/transactions/1001') {
      const [header, payload, signature] = new Headers(init?.headers)
        .get('Authorization')!
        .slice(7)
        .split('.');
      expect(JSON.parse(Buffer.from(header!, 'base64url').toString())).toMatchObject({
        alg: 'ES256',
        kid: verificationConfig.APPLE_KEY_ID,
      });
      expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toMatchObject({
        iss: verificationConfig.APPLE_ISSUER_ID,
        bid: verificationConfig.APPLE_BUNDLE_ID,
        aud: 'appstoreconnect-v1',
      });
      expect(
        verify(
          'sha256',
          Buffer.from(`${header}.${payload}`),
          { key: appleKey.publicKey, dsaEncoding: 'ieee-p1363' },
          Buffer.from(signature!, 'base64url'),
        ),
      ).toBe(true);
      return appleResponse();
    }
    if (
      url ===
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.daggerstuff.deadair/purchases/productsv2/tokens/google-proof'
    )
      return googleResponse();
    throw new Error('Unexpected store endpoint');
  });
}
