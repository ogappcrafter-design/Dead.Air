// tests/worker/community/sqlite_store.test.ts
// DEA-95 Phase 1 — runs the real D1 store SQL against SQLite via node:sqlite,
// applying migrations/0001_community.sql first. This proves the migration and
// the store's queries work together on the engine D1 is built on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { createD1Store } from '@/worker/community/store';
import { createMemoryStore } from '@/worker/community/memory_store';
import { PRESET_CREATE_LIMIT_PER_HOUR, PRESET_CREATE_WINDOW_MS } from '@/lib/community/schema';
import { handleCommunityRequest } from '@/worker/community/index';
import type {
  CommunityEnv,
  CommunityPreset,
  CommunityStore,
  D1Result,
  D1DatabaseLike,
  D1PreparedStatement,
} from '@/worker/community/types';

type SqliteParam = string | number | bigint | null;

class SqliteStatement implements D1PreparedStatement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: SqliteParam[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new SqliteStatement(this.db, this.sql, values as SqliteParam[]);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  execute<T>(): D1Result<T> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    const { changes } = this.db.prepare('SELECT changes() AS changes').get() as { changes: number };
    return { success: true, results, meta: { changes } };
  }

  async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return this.execute<T>();
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const info = this.db.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(info.changes) } };
  }
}

class SqliteD1 implements D1DatabaseLike {
  constructor(readonly db: DatabaseSync) {}

  prepare(sql: string): D1PreparedStatement {
    return new SqliteStatement(this.db, sql);
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    this.db.exec('BEGIN');
    try {
      const results = statements.map((statement) => {
        if (!(statement instanceof SqliteStatement)) throw new Error('Unexpected statement.');
        return statement.execute<T>();
      });
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}

function createDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const migrationPath = join(__dirname, '..', '..', '..', 'migrations', '0001_community.sql');
  db.exec(readFileSync(migrationPath, 'utf8'));
  return db;
}

function preset(id: string, overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  return {
    id,
    authorId: 'device-ada',
    authorName: 'Ada',
    name: `Preset ${id}`,
    description: 'A slow sweep.',
    band: 'LOST',
    frequency: 99.5,
    payload: { frequency: 99.5, band: 'LOST', volume: 0.6 },
    tags: ['night'],
    schemaVersion: 1,
    status: 'published',
    reportCount: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('D1 store against the real migration', () => {
  it('stores and reads back a preset created by one device for another', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));

    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'hash-ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
    await store.createDevice({
      id: 'device-bo',
      tokenHash: 'hash-bo',
      displayName: 'Bo',
      createdAt: 1000,
    });

    await store.createPreset(preset('preset-1'));

    const page = await store.listPresets({ limit: 20 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      id: 'preset-1',
      authorName: 'Ada',
      band: 'LOST',
      tags: ['night'],
    });
    expect(page.items[0]?.payload).toEqual({ frequency: 99.5, band: 'LOST', volume: 0.6 });

    const byId = await store.getPreset('preset-1');
    expect(byId?.name).toBe('Preset preset-1');

    await expect(store.countPresetsByAuthor('device-ada')).resolves.toBe(1);
  });

  it('applies search, band filters, and keyset pagination in SQL', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'hash-ada',
      displayName: 'Ada',
      createdAt: 1000,
    });

    await store.createPreset(preset('a', { name: 'Static Bloom', createdAt: 3000 }));
    await store.createPreset(
      preset('b', {
        name: 'Cold Harbour',
        description: 'Weather rolling in.',
        tags: ['weather'],
        createdAt: 2000,
      }),
    );
    await store.createPreset(
      preset('c', {
        name: 'Liminal Drift',
        band: 'LIMINAL',
        frequency: 94.5,
        payload: { frequency: 94.5, band: 'LIMINAL', volume: 0.5 },
        createdAt: 1000,
      }),
    );

    await expect(store.listPresets({ q: 'static', limit: 10 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'a' })],
    });
    await expect(store.listPresets({ q: 'weather', limit: 10 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'b' })],
    });
    await expect(store.listPresets({ band: 'LIMINAL', limit: 10 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'c' })],
    });

    const first = await store.listPresets({ limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(first.nextCursor).toBe('2000.b');

    const second = await store.listPresets({ limit: 2, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((item) => item.id)).toEqual(['c']);
    expect(second.nextCursor).toBeNull();
  });

  it('updates, hides, and deletes presets through SQL', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'hash-ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
    await store.createPreset(preset('preset-1'));

    const updated = await store.updatePreset(
      'preset-1',
      { name: 'Renamed Wave', payload: { frequency: 100, band: 'LOST', volume: 0.4 } },
      2000,
    );
    expect(updated?.name).toBe('Renamed Wave');
    expect(updated?.frequency).toBe(100);
    expect(updated?.updatedAt).toBe(2000);

    const hidden = await store.setPresetStatus('preset-1', 'hidden', 3000);
    expect(hidden?.status).toBe('hidden');
    await expect(store.listPresets({ limit: 10 })).resolves.toMatchObject({ items: [] });

    await expect(store.deletePreset('preset-1')).resolves.toBe(true);
    await expect(store.getPreset('preset-1')).resolves.toBeNull();
  });

  it('enforces one report per device per preset in the schema', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'hash-ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
    await store.createDevice({
      id: 'device-bo',
      tokenHash: 'hash-bo',
      displayName: 'Bo',
      createdAt: 1000,
    });
    await store.createPreset(preset('preset-1'));

    const report = {
      id: 'report-1',
      presetId: 'preset-1',
      reporterDeviceId: 'device-bo',
      reason: 'spam' as const,
      details: '',
      status: 'open' as const,
      createdAt: 1000,
    };

    await expect(store.createReport(report)).resolves.toEqual({
      created: true,
      reportId: 'report-1',
      reportCount: 1,
    });
    await expect(store.createReport({ ...report, id: 'report-2' })).resolves.toEqual({
      created: false,
      reportId: 'report-1',
      reportCount: 1,
    });

    await expect(store.getPreset('preset-1')).resolves.toMatchObject({ reportCount: 1 });

    const reports = await store.listReports('open');
    expect(reports).toHaveLength(1);
    expect(reports[0]?.presetName).toBe('Preset preset-1');

    await expect(store.resolveReport('report-1', 'resolved')).resolves.toBe(true);
    await expect(store.listReports('open')).resolves.toHaveLength(0);
    await expect(store.listReports('resolved')).resolves.toHaveLength(1);
  });

  it('rejects duplicate device token hashes', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'same-hash',
      displayName: 'Ada',
      createdAt: 1000,
    });

    await expect(
      store.createDevice({
        id: 'device-bo',
        tokenHash: 'same-hash',
        displayName: 'Bo',
        createdAt: 1000,
      }),
    ).rejects.toThrow(/UNIQUE/i);
  });

  it('serves two devices through the Worker API backed by D1 SQL', async () => {
    const env: CommunityEnv = {
      COMMUNITY_ENABLED: 'on',
      COMMUNITY_DB: new SqliteD1(createDatabase()),
    };

    const call = (path: string, init: RequestInit = {}): Promise<Response> =>
      handleCommunityRequest(new Request(`https://api.deadair.test/community${path}`, init), env);

    const register = async (displayName: string): Promise<{ token: string }> => {
      const response = await call('/auth/device', {
        method: 'POST',
        body: JSON.stringify({ displayName }),
      });
      expect(response.status).toBe(201);
      return (await response.json()) as { token: string };
    };

    const ada = await register('Ada');
    const bo = await register('Bo');

    const created = await call('/presets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ada.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'The Long Wave',
        payload: { frequency: 99.5, band: 'LOST', volume: 0.6 },
        tags: ['night'],
      }),
    });
    expect(created.status).toBe(201);
    const preset = (await created.json()) as { id: string };

    const listed = await call('/presets?q=long', {
      headers: { Authorization: `Bearer ${bo.token}` },
    });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual([preset.id]);
  });
});

describe('D1 persisted preset behavior', () => {
  let db: DatabaseSync;
  let store: CommunityStore;

  beforeEach(async () => {
    db = createDatabase();
    store = createD1Store(new SqliteD1(db));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
  });

  afterEach(() => db.close());

  it('combines search, visibility, band, and tied-date pagination', async () => {
    await store.createPreset(preset('a', { name: 'Night Owl', tags: [], createdAt: 1000 }));
    await store.createPreset(
      preset('b', { description: 'A night sweep.', tags: [], createdAt: 2000 }),
    );
    await store.createPreset(preset('c', { tags: ['night'], createdAt: 2000 }));
    await store.createPreset(preset('d', { name: 'Night Waves', tags: [], createdAt: 3000 }));
    await store.createPreset(preset('unrelated', { tags: ['day'], createdAt: 1500 }));
    await store.createPreset(
      preset('wrong-band', {
        band: 'LIMINAL',
        frequency: 94.5,
        payload: { band: 'LIMINAL', frequency: 94.5, volume: 0.6 },
        createdAt: 1500,
      }),
    );
    await store.createPreset(preset('hidden', { status: 'hidden', createdAt: 1500 }));

    let cursor: string | undefined;
    for (const id of ['d', 'c', 'b', 'a']) {
      const page = await store.listPresets({ q: 'NIGHT', band: 'LOST', limit: 1, cursor });
      expect(page.items.map((item) => item.id)).toEqual([id]);
      if (id === 'a') expect(page.nextCursor).toBeNull();
      else expect(page.nextCursor).not.toBeNull();
      cursor = page.nextCursor ?? undefined;
    }
  });

  it('persists every preset field through detail and list reads', async () => {
    const original = preset('preset-1', {
      description: 'A quiet sweep.',
      payload: { band: 'LOST', frequency: 99.5, volume: 0.4, tone: 'warm', notes: 'Écho' },
      tags: ['night_%', 'écho'],
    });
    await expect(store.createPreset(original)).resolves.toEqual(original);
    await expect(store.getPreset(original.id)).resolves.toEqual(original);
    await expect(store.listPresets({ limit: 20 })).resolves.toEqual({
      items: [original],
      nextCursor: null,
    });
  });

  it('preserves omitted fields while updating every patch field', async () => {
    const original = preset('preset-1');
    await store.createPreset(original);
    const payload = { frequency: 94.5, band: 'LIMINAL' as const, volume: 0.4 };
    const tuned = { ...original, payload, band: 'LIMINAL', frequency: 94.5, updatedAt: 5000 };
    await expect(store.updatePreset(original.id, { payload }, 5000)).resolves.toEqual(tuned);
    const patch = { name: 'Renamed Wave', description: 'New description.', tags: ['calm'] };
    await expect(store.updatePreset(original.id, patch, 6000)).resolves.toEqual({
      ...tuned,
      ...patch,
      updatedAt: 6000,
    });
  });

  it('reports deletion according to persisted state', async () => {
    await store.createPreset(preset('preset-1'));
    await expect(store.deletePreset('preset-1')).resolves.toBe(true);
    await expect(store.getPreset('preset-1')).resolves.toBeNull();
    await expect(store.deletePreset('preset-1')).resolves.toBe(false);
    await expect(store.deletePreset('missing')).resolves.toBe(false);
  });

  it.each([
    ['{not-json', '["night"]'],
    ['{"frequency":1,"band":"LOST"}', '["night"]'],
    ['{"frequency":99.5,"band":"LOST","volume":0.6}', '{not-json'],
    ['{"frequency":99.5,"band":"LOST","volume":0.6}', '["night",42]'],
  ])(
    'rejects corrupt persisted payload %p and tags %p on both read paths',
    async (payload, tags) => {
      await store.createPreset(preset('preset-1'));
      db.prepare('UPDATE community_presets SET payload = ?, tags = ? WHERE id = ?').run(
        payload,
        tags,
        'preset-1',
      );
      await expect(store.getPreset('preset-1')).rejects.toThrow();
      await expect(store.listPresets({ limit: 20 })).rejects.toThrow();
    },
  );

  it('rejects expanded tags on HTTP writes while keeping accepted tags readable', async () => {
    const env: CommunityEnv = { COMMUNITY_ENABLED: 'on', COMMUNITY_STORE: store };
    const call = (path: string, init: RequestInit = {}): Promise<Response> =>
      handleCommunityRequest(new Request(`https://api.deadair.test/community${path}`, init), env);
    const registration = await call('/auth/device', { method: 'POST', body: '{}' });
    expect(registration.status).toBe(201);
    const { deviceId, token } = (await registration.json()) as { deviceId: string; token: string };
    const headers = { Authorization: `Bearer ${token}` };
    const input = {
      name: 'Unicode Tags',
      payload: { frequency: 99.5, band: 'LOST' },
      tags: ['İ'.repeat(13)],
    };
    const rejected = await call('/presets', {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    expect(rejected.status).toBe(400);
    await expect(store.countPresetsByAuthor(deviceId)).resolves.toBe(0);

    const accepted = await call('/presets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, tags: ['İ'.repeat(12)] }),
    });
    expect(accepted.status).toBe(201);
    const created = (await accepted.json()) as { id: string; tags: string[] };
    expect(created.tags).toEqual(['i\u0307'.repeat(12)]);
    const invalidUpdate = await call(`/presets/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tags: input.tags }),
    });
    expect(invalidUpdate.status).toBe(400);
    const updated = await call(`/presets/${created.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tags: ['İ'.repeat(11)] }),
    });
    expect(updated.status).toBe(200);
    const detail = await call(`/presets/${created.id}`);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toMatchObject({ tags: ['i\u0307'.repeat(11)] });
    const listed = await call('/presets');
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      items: [expect.objectContaining({ id: created.id, tags: ['i\u0307'.repeat(11)] })],
    });
  });
});

describe.each([
  ['D1', (): CommunityStore => createD1Store(new SqliteD1(createDatabase()))],
  ['memory', createMemoryStore],
] as const)('%s store invariants', (_name, createStore) => {
  let store: CommunityStore;

  beforeEach(async () => {
    store = createStore();
    for (const name of ['ada', 'bo']) {
      await store.createDevice({
        id: `device-${name}`,
        tokenHash: name,
        displayName: name,
        createdAt: 1000,
      });
    }
  });

  it('retains creation quota after deletion and releases it after the hour', async () => {
    for (let index = 0; index < PRESET_CREATE_LIMIT_PER_HOUR; index += 1) {
      const id = `preset-${index}`;
      await expect(store.createPreset(preset(id))).resolves.toMatchObject({ id });
      await expect(store.deletePreset(id)).resolves.toBe(true);
    }
    await expect(store.createPreset(preset('blocked'))).resolves.toBeNull();
    await expect(store.countPresetsByAuthor('device-ada')).resolves.toBe(0);
    await expect(
      store.createPreset(preset('boundary', { createdAt: 1000 + PRESET_CREATE_WINDOW_MS })),
    ).resolves.toBeNull();
    await expect(
      store.createPreset(preset('later', { createdAt: 1001 + PRESET_CREATE_WINDOW_MS })),
    ).resolves.toMatchObject({ id: 'later' });
    await expect(
      store.createPreset(preset('other', { authorId: 'device-bo' })),
    ).resolves.toMatchObject({ id: 'other' });
  });

  it('allows only one concurrent creation when nine quota slots are used', async () => {
    for (let index = 0; index < PRESET_CREATE_LIMIT_PER_HOUR - 1; index += 1) {
      await store.createPreset(preset(`preset-${index}`));
    }
    const results = await Promise.all([
      store.createPreset(preset('concurrent-a')),
      store.createPreset(preset('concurrent-b')),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(store.countPresetsByAuthor('device-ada')).resolves.toBe(10);
  });

  it('returns persisted report identities and counts for concurrent repeats', async () => {
    await store.createPreset(preset('preset-1'));
    const report = {
      id: 'report-1',
      presetId: 'preset-1',
      reporterDeviceId: 'device-bo',
      reason: 'spam' as const,
      details: '',
      status: 'open' as const,
      createdAt: 1000,
    };
    const results = await Promise.all([
      store.createReport(report),
      store.createReport({ ...report, id: 'repeat-1' }),
      store.createReport({ ...report, id: 'report-2', reporterDeviceId: 'device-ada' }),
      store.createReport({ ...report, id: 'repeat-2' }),
    ]);
    expect(results).toEqual([
      { created: true, reportId: 'report-1', reportCount: 1 },
      { created: false, reportId: 'report-1', reportCount: 1 },
      { created: true, reportId: 'report-2', reportCount: 2 },
      { created: false, reportId: 'report-1', reportCount: 2 },
    ]);
    await expect(store.getPreset('preset-1')).resolves.toMatchObject({ reportCount: 2 });
    await store.resolveReport('report-1', 'resolved');
    await expect(store.createReport({ ...report, id: 'repeat-3' })).resolves.toEqual({
      created: false,
      reportId: 'report-1',
      reportCount: 2,
    });
    await expect(store.listReports('resolved')).resolves.toHaveLength(1);
  });

  it('keeps payload columns, moderation names, and report deletion consistent', async () => {
    await store.createPreset(preset('preset-1'));
    await store.createReport({
      id: 'report-1',
      presetId: 'preset-1',
      reporterDeviceId: 'device-bo',
      reason: 'spam',
      details: '',
      status: 'open',
      createdAt: 1000,
    });
    const payload = { frequency: 94.5, band: 'LIMINAL' as const, volume: 0.5 };
    await expect(
      store.updatePreset('preset-1', { name: 'New Name', payload }, 2000),
    ).resolves.toMatchObject({ band: 'LIMINAL', frequency: 94.5, payload });
    await expect(store.listPresets({ band: 'LOST', limit: 20 })).resolves.toMatchObject({
      items: [],
    });
    await expect(store.listPresets({ band: 'LIMINAL', limit: 20 })).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'preset-1', payload })],
    });
    await expect(store.listReports()).resolves.toMatchObject([
      expect.objectContaining({ presetName: 'New Name' }),
    ]);
    await store.deletePreset('preset-1');
    await expect(store.listReports()).resolves.toEqual([]);
    await expect(store.resolveReport('report-1', 'resolved')).resolves.toBe(false);
  });

  it.each(['_', '%', String.fromCharCode(92)])(
    'searches for literal %p in every searchable field',
    async (term) => {
      await store.createPreset(preset('name', { name: `night${term}owl` }));
      await store.createPreset(preset('description', { description: `night${term}owl` }));
      await store.createPreset(preset('tags', { tags: [`night${term}owl`] }));
      await store.createPreset(preset('unrelated', { name: 'night owl' }));
      const result = await store.listPresets({ q: term, limit: 20 });
      expect(result.items.map((item) => item.id).sort()).toEqual(['description', 'name', 'tags']);
      expect((await store.listPresets({ q: `night${term}owl`, limit: 20 })).items).toHaveLength(3);
    },
  );

  it.each(['Écho', 'écho', 'Σήμα', 'σήμα', 'İzmir'])(
    'preserves exact Unicode search %p across all fields',
    async (term) => {
      await store.createPreset(preset('name', { name: `${term} waves`, tags: [] }));
      await store.createPreset(preset('description', { description: `${term} waves`, tags: [] }));
      const tag = term.toLowerCase();
      await store.createPreset(preset('tags', { tags: [`${tag} waves`] }));
      await store.createPreset(preset('unrelated', { tags: [] }));
      const result = await store.listPresets({ q: term, limit: 20 });
      expect(result.items.map((item) => item.id).sort()).toEqual(
        term === tag ? ['description', 'name', 'tags'] : ['description', 'name'],
      );
      const byTag = await store.listPresets({ q: tag, limit: 20 });
      expect(byTag.items.map((item) => item.id)).toContain('tags');
    },
  );
});

describe('D1 transaction failure handling', () => {
  it('rolls back a report if its count update fails and allows a full retry', async () => {
    const db = createDatabase();
    const store = createD1Store(new SqliteD1(db));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
    await store.createPreset(preset('preset-1'));
    db.exec(
      "CREATE TRIGGER fail_report_count BEFORE UPDATE OF report_count ON community_presets BEGIN SELECT RAISE(ABORT, 'count failure'); END",
    );
    const report = {
      id: 'report-1',
      presetId: 'preset-1',
      reporterDeviceId: 'device-ada',
      reason: 'spam' as const,
      details: '',
      status: 'open' as const,
      createdAt: 1000,
    };
    await expect(store.createReport(report)).rejects.toThrow('count failure');
    await expect(store.listReports()).resolves.toEqual([]);
    await expect(store.getPreset('preset-1')).resolves.toMatchObject({ reportCount: 0 });
    db.exec('DROP TRIGGER fail_report_count');
    await expect(store.createReport(report)).resolves.toEqual({
      created: true,
      reportId: 'report-1',
      reportCount: 1,
    });
  });

  it('does not consume quota when a creation fails', async () => {
    const store = createD1Store(new SqliteD1(createDatabase()));
    await store.createDevice({
      id: 'device-ada',
      tokenHash: 'ada',
      displayName: 'Ada',
      createdAt: 1000,
    });
    await expect(store.createPreset(preset('invalid', { name: 'ab' }))).rejects.toThrow();
    for (let index = 0; index < PRESET_CREATE_LIMIT_PER_HOUR; index += 1) {
      await expect(store.createPreset(preset(`valid-${index}`))).resolves.not.toBeNull();
    }
    await expect(store.createPreset(preset('blocked'))).resolves.toBeNull();
  });
});
