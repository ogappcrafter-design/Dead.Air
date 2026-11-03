// tests/worker/community/customFrequencyPreset.test.ts
// DEA-89 — the community API accepts composed custom frequencies and can
// filter them by friend code, while rejecting invalid recipes.

import { createCustomFrequencyDraft } from '@/engine/calls/CustomFrequency';
import { customFrequencyToPresetInput } from '@/lib/community/frequencyPreset';
import { handleCommunityRequest } from '@/worker/community/index';
import { createMemoryStore } from '@/worker/community/memory_store';
import type { CommunityEnv } from '@/worker/community/types';
import {
  appleResponse,
  googleResponse,
  mockStoreVerification,
  verificationConfig,
} from './storeVerificationFixture';

function createEnv(): CommunityEnv {
  return {
    ...verificationConfig,
    COMMUNITY_ENABLED: 'on',
    COMMUNITY_STORE: createMemoryStore(),
    ADMIN_TOKEN: 'test-admin-token',
  };
}

function communityRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.deadair.test/community${path}`, init);
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function register(env: CommunityEnv): Promise<{ token: string }> {
  const response = await handleCommunityRequest(
    communityRequest('/auth/device', { method: 'POST', body: JSON.stringify({}) }),
    env,
  );
  expect(response.status).toBe(201);
  return readJson(response);
}

function composedInput(name = 'The Long Wave') {
  const frequency = createCustomFrequencyDraft(2, {
    id: 'local:worker',
    name,
    description: 'A slow sweep across the lost band.',
    createdAt: 1,
  });
  if (frequency === null) throw new Error('No draft');
  return {
    ...customFrequencyToPresetInput(frequency, 'DA-ABCDE'),
    entitlementProof: { platform: 'apple' as const, transactionId: '1001' },
  };
}

async function createPreset(env: CommunityEnv, token: string, body: unknown): Promise<Response> {
  return handleCommunityRequest(
    communityRequest('/presets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env,
  );
}

async function convertPreset(env: CommunityEnv, token: string, input: unknown): Promise<Response> {
  const legacy = await createPreset(env, token, {
    name: 'Legacy tuning',
    payload: { frequency: 99.5, band: 'LOST' },
  });
  const { id } = await readJson<{ id: string }>(legacy);
  return handleCommunityRequest(
    communityRequest(`/presets/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
    env,
  );
}

describe('composed custom frequency presets', () => {
  beforeEach(() => {
    mockStoreVerification();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['apple', 'google'] as const)(
    'requires current %s verification on create and PATCH',
    async (platform) => {
      const env = createEnv();
      const { token } = await register(env);
      const entitlementProof =
        platform === 'apple'
          ? { platform, transactionId: '1001' }
          : { platform, purchaseToken: 'google-proof' };
      const input = { ...composedInput(), entitlementProof };
      const created = await createPreset(env, token, input);
      expect(created.status).toBe(201);
      const preset = await readJson<{ id: string }>(created);
      const patch = (body: unknown) =>
        handleCommunityRequest(
          communityRequest(`/presets/${preset.id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify(body),
          }),
          env,
        );
      expect((await patch({ name: 'New name' })).status).toBe(403);
      expect((await patch({ name: 'New name', entitlementProof })).status).toBe(200);
      jest
        .mocked(fetch)
        .mockImplementation(async (url) =>
          String(url).includes('oauth2')
            ? Response.json({ access_token: 'token' })
            : platform === 'apple'
              ? appleResponse({ revocationDate: Date.now() })
              : googleResponse({ purchaseStateContext: { purchaseState: 'CANCELLED' } }),
        );
      expect((await createPreset(env, token, input)).status).toBe(403);
      expect((await patch({ name: 'Revoked name', entitlementProof })).status).toBe(403);
      expect((await env.COMMUNITY_STORE!.getPreset(preset.id))?.name).toBe('New name');
    },
  );

  it('rejects missing proof and unconfigured stores, including preset conversion', async () => {
    const env = createEnv();
    const { token } = await register(env);
    const { entitlementProof, ...input } = composedInput();
    expect((await createPreset(env, token, input)).status).toBe(403);
    const legacy = await createPreset(env, token, {
      name: 'Legacy tuning',
      payload: { frequency: 99.5, band: 'LOST' },
    });
    const { id } = await readJson<{ id: string }>(legacy);
    const patch = (proof?: unknown) =>
      handleCommunityRequest(
        communityRequest(`/presets/${id}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            payload: input.payload,
            ...(proof ? { entitlementProof: proof } : {}),
          }),
        }),
        env,
      );
    expect((await patch()).status).toBe(403);
    delete env.APPLE_PRIVATE_KEY;
    const missing = await createPreset(env, token, { ...input, entitlementProof });
    expect(missing.status).toBe(503);
    expect(await missing.json()).toMatchObject({ error: { code: 'verification_not_configured' } });
    expect((await patch(entitlementProof)).status).toBe(503);
    expect((await env.COMMUNITY_STORE!.getPreset(id))?.payload.composition).toBeUndefined();
    env.APPLE_PRIVATE_KEY = verificationConfig.APPLE_PRIVATE_KEY;
    expect((await patch(entitlementProof)).status).toBe(200);
    delete env.GOOGLE_PRIVATE_KEY;
    const googleInput = {
      ...input,
      entitlementProof: { platform: 'google', purchaseToken: 'google-proof' },
    };
    expect((await createPreset(env, token, googleInput)).status).toBe(503);
    expect((await convertPreset(env, token, googleInput)).status).toBe(503);
  });

  it.each([
    { productId: 'another-product' },
    { bundleId: 'another-app' },
    { environment: 'Sandbox' },
    { transactionId: '2002', originalTransactionId: '2002' },
    { revocationReason: 1 },
  ])('rejects invalid Apple purchase attributes %j', async (overrides) => {
    const env = createEnv();
    const { token } = await register(env);
    jest.mocked(fetch).mockImplementation(async () => appleResponse(overrides));
    expect((await createPreset(env, token, composedInput())).status).toBe(403);
    expect((await convertPreset(env, token, composedInput())).status).toBe(403);
  });

  it.each([
    { productLineItem: [] },
    { purchaseStateContext: { purchaseState: 'PENDING' } },
    { testPurchaseContext: { fopType: 'TEST' } },
    {
      productLineItem: [
        {
          productId: 'another-product',
          productOfferDetails: {
            refundableQuantity: 1,
            consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
          },
        },
      ],
    },
    {
      productLineItem: [
        {
          productId: 'com.deadair.infinite_signal',
          productOfferDetails: {
            refundableQuantity: 0,
            consumptionState: 'CONSUMPTION_STATE_YET_TO_BE_CONSUMED',
          },
        },
      ],
    },
  ])('rejects invalid Google purchase attributes %j', async (overrides) => {
    const env = createEnv();
    const { token } = await register(env);
    jest
      .mocked(fetch)
      .mockImplementation(async (url) =>
        String(url).includes('oauth2')
          ? Response.json({ access_token: 'token' })
          : googleResponse(overrides),
      );
    const input = {
      ...composedInput(),
      entitlementProof: { platform: 'google', purchaseToken: 'google-proof' },
    };
    expect((await createPreset(env, token, input)).status).toBe(403);
    expect((await convertPreset(env, token, input)).status).toBe(403);
  });

  it('fails closed for store rejection, malformed output and network failure', async () => {
    const env = createEnv();
    const { token } = await register(env);
    jest.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    expect((await createPreset(env, token, composedInput())).status).toBe(403);
    jest.mocked(fetch).mockResolvedValue(Response.json({ signedTransactionInfo: 'invalid' }));
    expect((await createPreset(env, token, composedInput())).status).toBe(503);
    jest.mocked(fetch).mockRejectedValue(new Error('network unavailable'));
    expect((await createPreset(env, token, composedInput())).status).toBe(503);
  });

  it('binds the verified purchase to one device without exposing proof publicly', async () => {
    const env = createEnv();
    const first = await register(env);
    const second = await register(env);
    const result = await createPreset(env, first.token, composedInput());
    expect(result.status).toBe(201);
    const body = await result.json();
    expect(body).not.toHaveProperty('entitlementProof');
    const denied = await createPreset(env, second.token, composedInput());
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ error: { code: 'purchase_bound' } });
    const publicRead = await handleCommunityRequest(communityRequest(`/presets/${body.id}`), env);
    expect(publicRead.status).toBe(200);
  });

  it('stores a composed preset and returns its friend code', async () => {
    const env = createEnv();
    const { token } = await register(env);
    const response = await createPreset(env, token, composedInput());
    expect(response.status).toBe(201);

    const preset = await readJson<{
      friendCode: string;
      schemaVersion: number;
      payload: { composition: { band: number }; difficulty: { signal: number } };
    }>(response);
    expect(preset.friendCode).toBe('DA-ABCDE');
    expect(preset.schemaVersion).toBe(2);
    expect(preset.payload.composition.band).toBe(2);
    expect(preset.payload.difficulty.signal).toBeGreaterThanOrEqual(0);
  });

  it('filters the feed by friend code', async () => {
    const env = createEnv();
    const { token } = await register(env);
    await createPreset(env, token, composedInput('Ada Wave'));
    await createPreset(env, token, {
      ...composedInput('Bo Wave'),
      friendCode: 'DA-ZYXWV',
    });

    const mine = await handleCommunityRequest(
      communityRequest('/presets?friendCode=DA-ABCDE'),
      env,
    );
    expect(mine.status).toBe(200);
    const mineBody = await readJson<{ items: Array<{ name: string }> }>(mine);
    expect(mineBody.items.map((item) => item.name)).toEqual(['Ada Wave']);

    const none = await handleCommunityRequest(
      communityRequest('/presets?friendCode=DA-AAAAA'),
      env,
    );
    expect((await readJson<{ items: unknown[] }>(none)).items).toHaveLength(0);
  });

  it('rejects an invalid fragment reference', async () => {
    const env = createEnv();
    const { token } = await register(env);
    const input = composedInput();
    const response = await createPreset(env, token, {
      ...input,
      payload: {
        ...input.payload,
        composition: { ...input.payload.composition!, openingIndex: 999 },
      },
    });
    expect(response.status).toBe(400);
    const body = await readJson<{ error: { code: string } }>(response);
    expect(body.error.code).toBe('validation_failed');
  });

  it('rejects a difficulty value outside the band range', async () => {
    const env = createEnv();
    const { token } = await register(env);
    const input = composedInput();
    const response = await createPreset(env, token, {
      ...input,
      payload: {
        ...input.payload,
        difficulty: { ...input.payload.difficulty!, staticReward: 9999 },
      },
    });
    expect(response.status).toBe(400);
  });

  it('keeps legacy tuning-only presets readable', async () => {
    const env = createEnv();
    const { token } = await register(env);
    const response = await createPreset(env, token, {
      name: 'Legacy Tuning',
      payload: { frequency: 99.5, band: 'LOST', volume: 0.6 },
    });
    expect(response.status).toBe(201);
    const preset = await readJson<{ payload: { composition?: unknown }; friendCode: unknown }>(
      response,
    );
    expect(preset.payload.composition).toBeUndefined();
    expect(preset.friendCode).toBeNull();
  });
});
