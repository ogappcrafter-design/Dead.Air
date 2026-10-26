// tests/worker/community/router.test.ts
// DEA-95 Phase 1 — community Worker routes, auth, preset CRUD, report,
// moderation. Runs against the in-memory store, which mirrors the D1 store.

import { handleCommunityRequest } from '@/worker/community/index';
import { createMemoryStore } from '@/worker/community/memory_store';
import type { CommunityEnv } from '@/worker/community/types';

const ADMIN_TOKEN = 'test-admin-token';

function createEnv(overrides: Partial<CommunityEnv> = {}): CommunityEnv {
  return {
    COMMUNITY_ENABLED: 'on',
    COMMUNITY_STORE: createMemoryStore(),
    ADMIN_TOKEN,
    ...overrides,
  };
}

function communityRequest(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.deadair.test/community${path}`, init);
}

async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function errorCode(response: Response): Promise<string> {
  const body = await readJson<{ error: { code: string } }>(response);
  return body.error.code;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function register(
  env: CommunityEnv,
  displayName?: string,
): Promise<{ deviceId: string; token: string; displayName: string }> {
  const response = await handleCommunityRequest(
    communityRequest('/auth/device', {
      method: 'POST',
      body: JSON.stringify(displayName ? { displayName } : {}),
    }),
    env,
  );
  expect(response.status).toBe(201);
  return readJson(response);
}

async function createPreset(
  env: CommunityEnv,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  const body = {
    name: 'The Long Wave',
    description: 'A slow sweep across the lost band.',
    payload: { frequency: 99.5, band: 'LOST', volume: 0.6 },
    tags: ['night'],
    ...overrides,
  };
  return handleCommunityRequest(
    communityRequest('/presets', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
    env,
  );
}

describe('community routing and the feature flag', () => {
  it('reports the flag state on /health without requiring the flag', async () => {
    const env = createEnv({ COMMUNITY_ENABLED: 'off' });
    const response = await handleCommunityRequest(communityRequest('/health'), env);
    expect(response.status).toBe(200);
    const body = await readJson<{ enabled: boolean; phase: number }>(response);
    expect(body.enabled).toBe(false);
    expect(body.phase).toBe(1);
  });

  it('returns 404 community_disabled for every data route while the flag is off', async () => {
    const env = createEnv({ COMMUNITY_ENABLED: 'off' });
    for (const path of ['/presets', '/auth/device']) {
      const response = await handleCommunityRequest(communityRequest(path), env);
      expect(response.status).toBe(404);
      expect(await errorCode(response)).toBe('community_disabled');
    }
  });

  it('returns 503 when no store or D1 binding is configured', async () => {
    const env: CommunityEnv = { COMMUNITY_ENABLED: 'on' };
    const response = await handleCommunityRequest(communityRequest('/presets'), env);
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe('storage_not_configured');
  });

  it.each(['/nope', '/feed'])('returns 404 for unknown route %s', async (path) => {
    const response = await handleCommunityRequest(communityRequest(path), createEnv());
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe('not_found');
  });

  it('returns 405 with an Allow header for a known path with the wrong method', async () => {
    const response = await handleCommunityRequest(
      communityRequest('/presets', { method: 'DELETE' }),
      createEnv(),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, POST');
  });

  it('answers CORS preflight requests', async () => {
    const response = await handleCommunityRequest(
      communityRequest('/presets', {
        method: 'OPTIONS',
        headers: { Origin: 'https://deadair.test' },
      }),
      createEnv(),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
  });
});

describe('device auth', () => {
  it('registers a device and returns an opaque token', async () => {
    const env = createEnv();
    const session = await register(env, 'Ada');
    expect(session.token.startsWith('d1_')).toBe(true);
    expect(session.displayName).toBe('Ada');
    expect(session.deviceId).toBeTruthy();
  });

  it('generates a callsign when no display name is given', async () => {
    const env = createEnv();
    const session = await register(env);
    expect(session.displayName).toMatch(/^[A-Z]+-[0-9A-F]{4}$/);
  });

  it('returns the device profile for a valid token', async () => {
    const env = createEnv();
    const session = await register(env, 'Ada');
    const response = await handleCommunityRequest(
      communityRequest('/auth/device', { headers: authHeaders(session.token) }),
      env,
    );
    expect(response.status).toBe(200);
    const profile = await readJson<{ deviceId: string; presetCount: number }>(response);
    expect(profile.deviceId).toBe(session.deviceId);
    expect(profile.presetCount).toBe(0);
  });

  it('rejects missing and invalid tokens', async () => {
    const env = createEnv();
    const missing = await handleCommunityRequest(communityRequest('/auth/device'), env);
    expect(missing.status).toBe(401);

    const invalid = await handleCommunityRequest(
      communityRequest('/auth/device', { headers: authHeaders('d1_deadbeef') }),
      env,
    );
    expect(invalid.status).toBe(401);
    expect(await errorCode(invalid)).toBe('unauthorized');
  });

  it('requires auth to create a preset', async () => {
    const env = createEnv();
    const response = await handleCommunityRequest(
      communityRequest('/presets', { method: 'POST', body: JSON.stringify({}) }),
      env,
    );
    expect(response.status).toBe(401);
  });
});

describe('presets', () => {
  it('lets two devices share one preset end to end', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const bo = await register(env, 'Bo');

    const created = await createPreset(env, ada.token);
    expect(created.status).toBe(201);
    const preset = await readJson<{ id: string; authorName: string; payload: { volume: number } }>(
      created,
    );
    expect(preset.authorName).toBe('Ada');
    expect(preset.payload.volume).toBe(0.6);

    const listed = await handleCommunityRequest(
      communityRequest('/presets', { headers: authHeaders(bo.token) }),
      env,
    );
    expect(listed.status).toBe(200);
    const listBody = await readJson<{ items: Array<{ id: string; authorName: string }> }>(listed);
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0]?.id).toBe(preset.id);

    const fetched = await handleCommunityRequest(communityRequest(`/presets/${preset.id}`), env);
    expect(fetched.status).toBe(200);
  });

  it('searches by name, description, and tag', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    await createPreset(env, ada.token, { name: 'Static Bloom', tags: ['drone'] });
    await createPreset(env, ada.token, {
      name: 'Cold Harbour',
      description: 'A slow sweep across the lost band.',
      tags: ['weather'],
    });

    const byName = await handleCommunityRequest(communityRequest('/presets?q=static'), env);
    expect((await readJson<{ items: unknown[] }>(byName)).items).toHaveLength(1);

    const byTag = await handleCommunityRequest(communityRequest('/presets?q=weather'), env);
    expect((await readJson<{ items: unknown[] }>(byTag)).items).toHaveLength(1);

    const byDescription = await handleCommunityRequest(communityRequest('/presets?q=harbour'), env);
    expect((await readJson<{ items: unknown[] }>(byDescription)).items).toHaveLength(1);
  });

  it('filters by band', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    await createPreset(env, ada.token, {
      name: 'Living Room',
      payload: { frequency: 89.5, band: 'LIVING' },
    });
    await createPreset(env, ada.token, {
      name: 'Liminal Drift',
      payload: { frequency: 94.5, band: 'LIMINAL' },
    });

    const response = await handleCommunityRequest(communityRequest('/presets?band=LIMINAL'), env);
    const body = await readJson<{ items: Array<{ name: string }> }>(response);
    expect(body.items.map((item) => item.name)).toEqual(['Liminal Drift']);
  });

  it('paginates with a keyset cursor without duplicates', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    for (const name of ['Alpha Wave', 'Beta Wave', 'Gamma Wave']) {
      expect((await createPreset(env, ada.token, { name })).status).toBe(201);
    }

    const first = await handleCommunityRequest(communityRequest('/presets?limit=2'), env);
    const firstBody = await readJson<{ items: Array<{ id: string }>; nextCursor: string | null }>(
      first,
    );
    expect(firstBody.items).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const second = await handleCommunityRequest(
      communityRequest(`/presets?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor ?? '')}`),
      env,
    );
    const secondBody = await readJson<{ items: Array<{ id: string }>; nextCursor: string | null }>(
      second,
    );
    expect(secondBody.items).toHaveLength(1);
    expect(secondBody.nextCursor).toBeNull();

    const ids = [...firstBody.items, ...secondBody.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects a malformed cursor', async () => {
    const response = await handleCommunityRequest(
      communityRequest('/presets?cursor=not-a-cursor'),
      createEnv(),
    );
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('invalid_cursor');
  });

  it('validates the body and rejects unknown fields', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');

    const shortName = await createPreset(env, ada.token, { name: 'ab' });
    expect(shortName.status).toBe(400);
    expect(await errorCode(shortName)).toBe('validation_failed');

    const extraField = await createPreset(env, ada.token, { callScript: 'do not ship this' });
    expect(extraField.status).toBe(400);

    const tooLarge = await createPreset(env, ada.token, { name: 'x'.repeat(20000) });
    expect(tooLarge.status).toBe(413);
  });

  it('rejects a frequency that does not belong to the declared band', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const response = await createPreset(env, ada.token, {
      payload: { frequency: 99.5, band: 'LIVING' },
    });
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe('band_mismatch');
  });

  it('limits how many presets one device can create per hour', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    for (let index = 0; index < 10; index += 1) {
      const response = await createPreset(env, ada.token, { name: `Wave ${index}` });
      expect(response.status).toBe(201);
    }
    const blocked = await createPreset(env, ada.token, { name: 'One Too Many' });
    expect(blocked.status).toBe(429);
    expect(await errorCode(blocked)).toBe('rate_limited');
  });

  it('enforces quota after deletion and across concurrent creates', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    for (let index = 0; index < 9; index += 1) {
      const created = await createPreset(env, ada.token);
      const { id } = await readJson<{ id: string }>(created);
      const deleted = await handleCommunityRequest(
        communityRequest(`/presets/${id}`, { method: 'DELETE', headers: authHeaders(ada.token) }),
        env,
      );
      expect(deleted.status).toBe(200);
    }
    const responses = await Promise.all([
      createPreset(env, ada.token),
      createPreset(env, ada.token),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 429]);
    const blocked = responses.find((response) => response.status === 429);
    expect(blocked).toBeDefined();
    if (blocked) expect(await errorCode(blocked)).toBe('rate_limited');
  });

  it('validates Unicode names before storage on create and update', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const invalid = await createPreset(env, ada.token, { name: '🎵🎶' });
    expect(invalid.status).toBe(400);
    expect(await errorCode(invalid)).toBe('validation_failed');
    const created = await createPreset(env, ada.token, { name: '🎵'.repeat(60) });
    expect(created.status).toBe(201);
    const { id } = await readJson<{ id: string }>(created);
    const updated = await handleCommunityRequest(
      communityRequest(`/presets/${id}`, {
        method: 'PATCH',
        headers: authHeaders(ada.token),
        body: JSON.stringify({ name: '🎵🎶' }),
      }),
      env,
    );
    expect(updated.status).toBe(400);
    expect(await errorCode(updated)).toBe('validation_failed');
  });

  it('keeps edits and deletes owner-only', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const bo = await register(env, 'Bo');
    const created = await createPreset(env, ada.token);
    const preset = await readJson<{ id: string }>(created);

    const foreignUpdate = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, {
        method: 'PATCH',
        headers: authHeaders(bo.token),
        body: JSON.stringify({ name: 'Hijacked' }),
      }),
      env,
    );
    expect(foreignUpdate.status).toBe(403);

    const foreignDelete = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, {
        method: 'DELETE',
        headers: authHeaders(bo.token),
      }),
      env,
    );
    expect(foreignDelete.status).toBe(403);

    const ownerUpdate = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, {
        method: 'PATCH',
        headers: authHeaders(ada.token),
        body: JSON.stringify({ name: 'Renamed Wave', tags: ['Drone'] }),
      }),
      env,
    );
    expect(ownerUpdate.status).toBe(200);
    const updated = await readJson<{ name: string; tags: string[] }>(ownerUpdate);
    expect(updated.name).toBe('Renamed Wave');
    expect(updated.tags).toEqual(['drone']);

    const ownerDelete = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, {
        method: 'DELETE',
        headers: authHeaders(ada.token),
      }),
      env,
    );
    expect(ownerDelete.status).toBe(200);
    expect(await readJson<{ deleted: boolean }>(ownerDelete)).toEqual({ deleted: true });

    const gone = await handleCommunityRequest(communityRequest(`/presets/${preset.id}`), env);
    expect(gone.status).toBe(404);
  });

  it('rejects an empty update', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const created = await createPreset(env, ada.token);
    const preset = await readJson<{ id: string }>(created);

    const response = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, {
        method: 'PATCH',
        headers: authHeaders(ada.token),
        body: JSON.stringify({}),
      }),
      env,
    );
    expect(response.status).toBe(400);
  });
});

describe('reporting and moderation', () => {
  it('records one report per device and exposes it to admins', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const bo = await register(env, 'Bo');
    const created = await createPreset(env, ada.token);
    const preset = await readJson<{ id: string }>(created);

    const first = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}/report`, {
        method: 'POST',
        headers: authHeaders(bo.token),
        body: JSON.stringify({ reason: 'spam', details: 'Looks automated.' }),
      }),
      env,
    );
    expect(first.status).toBe(201);
    const firstReport = await readJson<{ reportId: string }>(first);
    expect(firstReport).toMatchObject({ alreadyReported: false, reportCount: 1 });

    const repeat = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}/report`, {
        method: 'POST',
        headers: authHeaders(bo.token),
        body: JSON.stringify({ reason: 'spam' }),
      }),
      env,
    );
    expect(repeat.status).toBe(200);
    expect(await readJson(repeat)).toMatchObject({
      reportId: firstReport.reportId,
      alreadyReported: true,
      reportCount: 1,
    });

    const unauthAdmin = await handleCommunityRequest(communityRequest('/admin/reports'), env);
    expect(unauthAdmin.status).toBe(401);

    const adminList = await handleCommunityRequest(
      communityRequest('/admin/reports?status=open', {
        headers: { 'X-Admin-Token': ADMIN_TOKEN },
      }),
      env,
    );
    expect(adminList.status).toBe(200);
    const reports = await readJson<{ items: Array<{ id: string; presetId: string }> }>(adminList);
    expect(reports.items).toHaveLength(1);
    expect(reports.items[0]?.presetId).toBe(preset.id);
    expect(reports.items[0]?.id).toBe(firstReport.reportId);

    const resolved = await handleCommunityRequest(
      communityRequest(`/admin/reports/${reports.items[0]?.id}/resolve`, {
        method: 'POST',
        headers: { 'X-Admin-Token': ADMIN_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      }),
      env,
    );
    expect(resolved.status).toBe(200);
  });

  it('returns 503 for admin routes when no admin token is configured', async () => {
    const env = createEnv({ ADMIN_TOKEN: undefined });
    const response = await handleCommunityRequest(
      communityRequest('/admin/reports', { headers: { 'X-Admin-Token': 'anything' } }),
      env,
    );
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe('admin_not_configured');
  });

  it('hides and restores a reported preset', async () => {
    const env = createEnv();
    const ada = await register(env, 'Ada');
    const bo = await register(env, 'Bo');
    const created = await createPreset(env, ada.token);
    const preset = await readJson<{ id: string }>(created);

    const hidden = await handleCommunityRequest(
      communityRequest(`/admin/presets/${preset.id}/hide`, {
        method: 'POST',
        headers: { 'X-Admin-Token': ADMIN_TOKEN },
      }),
      env,
    );
    expect(hidden.status).toBe(200);
    expect(await readJson(hidden)).toEqual({ id: preset.id, status: 'hidden' });

    const publicList = await handleCommunityRequest(communityRequest('/presets'), env);
    expect((await readJson<{ items: unknown[] }>(publicList)).items).toHaveLength(0);

    const foreignRead = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, { headers: authHeaders(bo.token) }),
      env,
    );
    expect(foreignRead.status).toBe(404);

    const ownerRead = await handleCommunityRequest(
      communityRequest(`/presets/${preset.id}`, { headers: authHeaders(ada.token) }),
      env,
    );
    expect(ownerRead.status).toBe(200);

    const restored = await handleCommunityRequest(
      communityRequest(`/admin/presets/${preset.id}/restore`, {
        method: 'POST',
        headers: { 'X-Admin-Token': ADMIN_TOKEN },
      }),
      env,
    );
    expect(restored.status).toBe(200);

    const publicAfterRestore = await handleCommunityRequest(communityRequest('/presets'), env);
    expect((await readJson<{ items: unknown[] }>(publicAfterRestore)).items).toHaveLength(1);
  });

  it('refuses to report an unknown preset', async () => {
    const env = createEnv();
    const bo = await register(env, 'Bo');
    const response = await handleCommunityRequest(
      communityRequest('/presets/missing/report', {
        method: 'POST',
        headers: authHeaders(bo.token),
        body: JSON.stringify({ reason: 'broken' }),
      }),
      env,
    );
    expect(response.status).toBe(404);
  });
});
