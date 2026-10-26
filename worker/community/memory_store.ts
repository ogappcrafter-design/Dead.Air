/**
 * DEA-95 Phase 1 — in-memory community store.
 *
 * Mirrors the D1 store's semantics (keyset pagination, published-only lists,
 * one report per device per preset) so handlers and clients can be exercised
 * end-to-end in Jest and local development without a D1 instance.
 */

import { PRESET_CREATE_LIMIT_PER_HOUR, PRESET_CREATE_WINDOW_MS } from '../../lib/community/schema';
import { decodeCursor, encodeCursor } from './cursor';
import type {
  CommunityDeviceRecord,
  CommunityPreset,
  CommunityReport,
  CommunityStore,
  PresetQuery,
  PresetStatus,
  ReportStatus,
} from './types';

function compareDescending(a: CommunityPreset, b: CommunityPreset): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

function searchText(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function createMemoryStore(): CommunityStore {
  const devices = new Map<string, CommunityDeviceRecord>();
  const presets = new Map<string, CommunityPreset>();
  const reports = new Map<string, CommunityReport>();
  const creations: Array<{ authorId: string; createdAt: number }> = [];

  const store: CommunityStore = {
    async createDevice(input) {
      const record: CommunityDeviceRecord = {
        id: input.id,
        tokenHash: input.tokenHash,
        displayName: input.displayName,
        banned: false,
        createdAt: input.createdAt,
        lastSeenAt: input.createdAt,
      };
      devices.set(record.id, record);
      return record;
    },

    async getDeviceById(id) {
      return devices.get(id) ?? null;
    },

    async getDeviceByTokenHash(tokenHash) {
      for (const device of devices.values()) {
        if (device.tokenHash === tokenHash) return device;
      }
      return null;
    },

    async touchDevice(id, at) {
      const device = devices.get(id);
      if (device) devices.set(id, { ...device, lastSeenAt: at });
    },

    async countPresetsByAuthor(authorId) {
      let count = 0;
      for (const preset of presets.values()) {
        if (preset.authorId === authorId) count += 1;
      }
      return count;
    },

    async createPreset(preset) {
      const recent = creations.filter(
        (creation) =>
          creation.authorId === preset.authorId &&
          creation.createdAt >= preset.createdAt - PRESET_CREATE_WINDOW_MS,
      ).length;
      if (recent >= PRESET_CREATE_LIMIT_PER_HOUR) return null;
      const stored: CommunityPreset = { ...preset, payload: { ...preset.payload } };
      presets.set(stored.id, stored);
      creations.push({ authorId: stored.authorId, createdAt: stored.createdAt });
      return stored;
    },

    async getPreset(id) {
      const preset = presets.get(id);
      return preset ? { ...preset, payload: { ...preset.payload } } : null;
    },

    async listPresets(query: PresetQuery) {
      const term = searchText((query.q ?? '').trim());
      const cursor = query.cursor ? decodeCursor(query.cursor) : null;

      const filtered = Array.from(presets.values())
        .filter((preset) => preset.status === 'published')
        .filter((preset) => (query.band ? preset.band === query.band : true))
        .filter((preset) => {
          if (!term) return true;
          return [preset.name, preset.description, ...preset.tags].some((value) =>
            searchText(value).includes(term),
          );
        })
        .filter((preset) => {
          if (!cursor) return true;
          if (preset.createdAt < cursor.createdAt) return true;
          return preset.createdAt === cursor.createdAt && preset.id < cursor.id;
        })
        .sort(compareDescending);

      const page = filtered.slice(0, query.limit);
      const hasMore = filtered.length > query.limit;
      const last = page[page.length - 1];

      return {
        items: page.map((preset) => ({ ...preset, payload: { ...preset.payload } })),
        nextCursor: hasMore && last ? encodeCursor(last) : null,
      };
    },

    async updatePreset(id, patch, updatedAt) {
      const existing = presets.get(id);
      if (!existing) return null;
      const updated: CommunityPreset = {
        ...existing,
        ...patch,
        payload: patch.payload ? { ...patch.payload } : existing.payload,
        band: patch.payload?.band ?? existing.band,
        frequency: patch.payload?.frequency ?? existing.frequency,
        updatedAt,
      };
      presets.set(id, updated);
      return { ...updated, payload: { ...updated.payload } };
    },

    async deletePreset(id) {
      const deleted = presets.delete(id);
      for (const [reportId, report] of reports) {
        if (report.presetId === id) reports.delete(reportId);
      }
      return deleted;
    },

    async setPresetStatus(id, status: PresetStatus, updatedAt) {
      const existing = presets.get(id);
      if (!existing) return null;
      const updated: CommunityPreset = { ...existing, status, updatedAt };
      presets.set(id, updated);
      return { ...updated, payload: { ...updated.payload } };
    },

    async createReport(report) {
      const preset = presets.get(report.presetId);
      if (!preset) throw new Error('Preset not found.');
      for (const existing of reports.values()) {
        if (
          existing.presetId === report.presetId &&
          existing.reporterDeviceId === report.reporterDeviceId
        ) {
          return { created: false, reportId: existing.id, reportCount: preset.reportCount };
        }
      }
      reports.set(report.id, { ...report });
      const reportCount = preset.reportCount + 1;
      presets.set(preset.id, { ...preset, reportCount });
      return { created: true, reportId: report.id, reportCount };
    },

    async listReports(status?: ReportStatus, limit = 50) {
      return Array.from(reports.values())
        .filter((report) => (status ? report.status === status : true))
        .sort((a, b) => {
          if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        })
        .slice(0, limit)
        .map((report) => ({ ...report, presetName: presets.get(report.presetId)?.name }));
    },

    async resolveReport(id, status) {
      const existing = reports.get(id);
      if (!existing) return false;
      reports.set(id, { ...existing, status });
      return true;
    },
  };

  return store;
}
