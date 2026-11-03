/**
 * DEA-95 Phase 1 — D1-backed community store.
 *
 * All SQL lives here so handlers stay storage-agnostic and can run against the
 * in-memory store in tests. Queries use keyset pagination and bound parameters
 * throughout.
 */

import {
  PRESET_CREATE_LIMIT_PER_HOUR,
  PRESET_CREATE_WINDOW_MS,
  presetPayloadSchema,
  presetTagsSchema,
} from '../../lib/community/schema';
import { decodeCursor, encodeCursor } from './cursor';
import type {
  CommunityDeviceRecord,
  CommunityPreset,
  CommunityReport,
  CommunityStore,
  D1DatabaseLike,
  PresetPage,
  PresetPatch,
  PresetQuery,
  PresetStatus,
  ReportStatus,
} from './types';

const PRESET_COLUMNS = [
  'id',
  'author_id',
  'author_name',
  'name',
  'description',
  'band',
  'frequency',
  'payload',
  'tags',
  'friend_code',
  'schema_version',
  'status',
  'report_count',
  'created_at',
  'updated_at',
].join(', ');

interface DeviceRow {
  id: string;
  token_hash: string;
  display_name: string;
  banned: number;
  created_at: number;
  last_seen_at: number;
}

interface PresetRow {
  id: string;
  author_id: string;
  author_name: string;
  name: string;
  description: string;
  band: string;
  frequency: number;
  payload: string;
  tags: string;
  friend_code: string | null;
  schema_version: number;
  status: string;
  report_count: number;
  created_at: number;
  updated_at: number;
}

interface ReportRow {
  id: string;
  preset_id: string;
  preset_name: string | null;
  reporter_device_id: string;
  reason: string;
  details: string;
  status: string;
  created_at: number;
}

function rowToDevice(row: DeviceRow): CommunityDeviceRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    displayName: row.display_name,
    banned: row.banned === 1,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

function rowToPreset(row: PresetRow): CommunityPreset {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    name: row.name,
    description: row.description,
    band: row.band,
    frequency: row.frequency,
    payload: presetPayloadSchema.parse(JSON.parse(row.payload)),
    tags: presetTagsSchema.parse(JSON.parse(row.tags)),
    friendCode: row.friend_code ?? null,
    schemaVersion: row.schema_version,
    status: row.status as PresetStatus,
    reportCount: row.report_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReport(row: ReportRow): CommunityReport {
  const report: CommunityReport = {
    id: row.id,
    presetId: row.preset_id,
    reporterDeviceId: row.reporter_device_id,
    reason: row.reason as CommunityReport['reason'],
    details: row.details,
    status: row.status as ReportStatus,
    createdAt: row.created_at,
  };
  if (row.preset_name) report.presetName = row.preset_name;
  return report;
}

export function createD1Store(db: D1DatabaseLike): CommunityStore {
  const store: CommunityStore = {
    async bindEntitlement(input) {
      const row = await db
        .prepare(
          `INSERT INTO community_entitlements (purchase_hash, device_id, platform, active, verified_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(purchase_hash) DO UPDATE SET active = excluded.active, verified_at = excluded.verified_at
         WHERE device_id = excluded.device_id
         RETURNING purchase_hash`,
        )
        .bind(
          input.purchaseHash,
          input.deviceId,
          input.platform,
          input.active ? 1 : 0,
          input.verifiedAt,
        )
        .first();
      return row !== null;
    },
    async createDevice(input) {
      await db
        .prepare(
          `INSERT INTO community_devices (id, token_hash, display_name, banned, created_at, last_seen_at)
           VALUES (?, ?, ?, 0, ?, ?)`,
        )
        .bind(input.id, input.tokenHash, input.displayName, input.createdAt, input.createdAt)
        .run();

      return {
        id: input.id,
        tokenHash: input.tokenHash,
        displayName: input.displayName,
        banned: false,
        createdAt: input.createdAt,
        lastSeenAt: input.createdAt,
      };
    },

    async getDeviceById(id) {
      const row = await db
        .prepare('SELECT * FROM community_devices WHERE id = ?')
        .bind(id)
        .first<DeviceRow>();
      return row ? rowToDevice(row) : null;
    },

    async getDeviceByTokenHash(tokenHash) {
      const row = await db
        .prepare('SELECT * FROM community_devices WHERE token_hash = ?')
        .bind(tokenHash)
        .first<DeviceRow>();
      return row ? rowToDevice(row) : null;
    },

    async touchDevice(id, at) {
      await db
        .prepare('UPDATE community_devices SET last_seen_at = ? WHERE id = ?')
        .bind(at, id)
        .run();
    },

    async countPresetsByAuthor(authorId) {
      const row = await db
        .prepare('SELECT COUNT(*) AS count FROM community_presets WHERE author_id = ?')
        .bind(authorId)
        .first<{ count: number }>();
      return row?.count ?? 0;
    },

    async createPreset(preset) {
      const row = await db
        .prepare(
          `INSERT INTO community_presets
             (id, author_id, author_name, name, description, band, frequency, payload, tags,
              friend_code, schema_version, status, report_count, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
           WHERE (SELECT COUNT(*) FROM community_preset_creations
                  WHERE author_id = ? AND created_at >= ?) < ?
           RETURNING id`,
        )
        .bind(
          preset.id,
          preset.authorId,
          preset.authorName,
          preset.name,
          preset.description,
          preset.band,
          preset.frequency,
          JSON.stringify(preset.payload),
          JSON.stringify(preset.tags),
          preset.friendCode,
          preset.schemaVersion,
          preset.status,
          preset.reportCount,
          preset.createdAt,
          preset.updatedAt,
          preset.authorId,
          preset.createdAt - PRESET_CREATE_WINDOW_MS,
          PRESET_CREATE_LIMIT_PER_HOUR,
        )
        .first<{ id: string }>();
      return row ? preset : null;
    },

    async getPreset(id) {
      const row = await db
        .prepare(`SELECT ${PRESET_COLUMNS} FROM community_presets WHERE id = ?`)
        .bind(id)
        .first<PresetRow>();
      return row ? rowToPreset(row) : null;
    },

    async listPresets(query: PresetQuery): Promise<PresetPage> {
      const conditions: string[] = ["status = 'published'"];
      const params: unknown[] = [];

      if (query.band) {
        conditions.push('band = ?');
        params.push(query.band);
      }

      if (query.friendCode) {
        conditions.push('friend_code = ?');
        params.push(query.friendCode);
      }

      const term = (query.q ?? '').trim();
      if (term) {
        conditions.push(`(instr(lower(name), lower(?)) > 0 OR instr(lower(description), lower(?)) > 0
          OR EXISTS (SELECT 1 FROM json_each(tags) WHERE instr(lower(value), lower(?)) > 0))`);
        params.push(term, term, term);
      }

      if (query.cursor) {
        const cursor = decodeCursor(query.cursor);
        if (cursor) {
          conditions.push('(created_at < ? OR (created_at = ? AND id < ?))');
          params.push(cursor.createdAt, cursor.createdAt, cursor.id);
        }
      }

      params.push(query.limit + 1);

      const result = await db
        .prepare(
          `SELECT ${PRESET_COLUMNS} FROM community_presets
           WHERE ${conditions.join(' AND ')}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
        )
        .bind(...params)
        .all<PresetRow>();

      const rows = result.results ?? [];
      const pageRows = rows.slice(0, query.limit);
      const last = pageRows[pageRows.length - 1];
      const nextCursor =
        rows.length > query.limit && last
          ? encodeCursor({ createdAt: last.created_at, id: last.id })
          : null;

      return { items: pageRows.map(rowToPreset), nextCursor };
    },

    async updatePreset(id, patch: PresetPatch, updatedAt) {
      const assignments: string[] = ['updated_at = ?'];
      const params: unknown[] = [updatedAt];

      if (patch.name !== undefined) {
        assignments.push('name = ?');
        params.push(patch.name);
      }
      if (patch.description !== undefined) {
        assignments.push('description = ?');
        params.push(patch.description);
      }
      if (patch.tags !== undefined) {
        assignments.push('tags = ?');
        params.push(JSON.stringify(patch.tags));
      }
      if (patch.friendCode !== undefined) {
        assignments.push('friend_code = ?');
        params.push(patch.friendCode);
      }
      if (patch.payload !== undefined) {
        assignments.push('payload = ?', 'band = ?', 'frequency = ?');
        params.push(JSON.stringify(patch.payload), patch.payload.band, patch.payload.frequency);
      }

      params.push(id);
      await db
        .prepare(`UPDATE community_presets SET ${assignments.join(', ')} WHERE id = ?`)
        .bind(...params)
        .run();

      return this.getPreset(id);
    },

    async deletePreset(id) {
      const result = await db.prepare('DELETE FROM community_presets WHERE id = ?').bind(id).run();
      return (result.meta?.changes ?? 0) > 0;
    },

    async setPresetStatus(id, status, updatedAt) {
      await db
        .prepare('UPDATE community_presets SET status = ?, updated_at = ? WHERE id = ?')
        .bind(status, updatedAt, id)
        .run();
      return this.getPreset(id);
    },

    async createReport(report) {
      const results = await db.batch<{ id: string; report_count: number }>([
        db
          .prepare(
            `INSERT INTO community_reports
             (id, preset_id, reporter_device_id, reason, details, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (preset_id, reporter_device_id) DO NOTHING`,
          )
          .bind(
            report.id,
            report.presetId,
            report.reporterDeviceId,
            report.reason,
            report.details,
            report.status,
            report.createdAt,
          ),
        db
          .prepare(
            `UPDATE community_presets SET report_count =
             (SELECT COUNT(*) FROM community_reports WHERE preset_id = ?)
           WHERE id = ?`,
          )
          .bind(report.presetId, report.presetId),
        db
          .prepare(
            `SELECT r.id, p.report_count FROM community_reports r
           JOIN community_presets p ON p.id = r.preset_id
           WHERE r.preset_id = ? AND r.reporter_device_id = ?`,
          )
          .bind(report.presetId, report.reporterDeviceId),
      ]);
      const persisted = results[2]?.results?.[0];
      if (!persisted) throw new Error('Report was not persisted.');
      return {
        created: (results[0]?.meta?.changes ?? 0) > 0,
        reportId: persisted.id,
        reportCount: persisted.report_count,
      };
    },

    async listReports(status, limit = 50) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (status) {
        conditions.push('r.status = ?');
        params.push(status);
      }
      params.push(limit);

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await db
        .prepare(
          `SELECT r.id, r.preset_id, p.name AS preset_name, r.reporter_device_id, r.reason,
                  r.details, r.status, r.created_at
           FROM community_reports r
           LEFT JOIN community_presets p ON p.id = r.preset_id
           ${where}
           ORDER BY r.created_at DESC, r.id DESC
           LIMIT ?`,
        )
        .bind(...params)
        .all<ReportRow>();

      return (result.results ?? []).map(rowToReport);
    },

    async resolveReport(id, status) {
      const result = await db
        .prepare('UPDATE community_reports SET status = ? WHERE id = ?')
        .bind(status, id)
        .run();
      return (result.meta?.changes ?? 0) > 0;
    },
  };

  return store;
}
