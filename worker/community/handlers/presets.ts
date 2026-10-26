/**
 * DEA-95 Phase 1 — preset handlers (create, read, update, delete, list/search).
 *
 * Phase 1 exposes frequency presets only: no free-form call scripts and no
 * custom-call fields. Ownership is per device token; there are no accounts.
 */

import { BANDS } from '../../../data/bands';
import {
  COMMUNITY_SCHEMA_VERSION,
  createPresetInputSchema,
  presetQuerySchema,
  updatePresetInputSchema,
  type PresetPayload,
} from '../../../lib/community/schema';
import { authenticate, optionalDevice } from '../auth';
import { decodeCursor } from '../cursor';
import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  searchParamsToObject,
  validationDetails,
} from '../http';
import { toPublicPreset } from '../serialize';
import type { CommunityPreset, PresetQuery, RequestContext } from '../types';

function isFrequencyInBand(payload: PresetPayload): boolean {
  const range = BANDS[payload.band].frequencyRange;
  return payload.frequency >= range[0] && payload.frequency <= range[1];
}

function parseQuery(ctx: RequestContext): PresetQuery | Response {
  const parsed = presetQuerySchema.safeParse(searchParamsToObject(ctx.url.searchParams));
  if (!parsed.success) {
    return errorResponse(
      'validation_failed',
      'Query parameters failed validation.',
      400,
      validationDetails(parsed.error),
    );
  }
  if (parsed.data.cursor && !decodeCursor(parsed.data.cursor)) {
    return errorResponse('invalid_cursor', 'Cursor is not valid.', 400);
  }

  const query: PresetQuery = { limit: parsed.data.limit };
  if (parsed.data.q) query.q = parsed.data.q;
  if (parsed.data.band) query.band = parsed.data.band;
  if (parsed.data.cursor) query.cursor = parsed.data.cursor;
  return query;
}

/** GET /community/presets — public list and search. */
export async function listPresets(ctx: RequestContext): Promise<Response> {
  const query = parseQuery(ctx);
  if (query instanceof Response) return query;

  const page = await ctx.store.listPresets(query);
  return jsonResponse({
    items: page.items.map(toPublicPreset),
    nextCursor: page.nextCursor,
  });
}

/** GET /community/presets/:id — public read; hidden presets stay owner-only. */
export async function getPreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const preset = await ctx.store.getPreset(presetId);
  if (!preset) return errorResponse('not_found', 'Preset not found.', 404);

  if (preset.status !== 'published') {
    const device = await optionalDevice(ctx.request, ctx.store);
    if (!device || device.id !== preset.authorId) {
      return errorResponse('not_found', 'Preset not found.', 404);
    }
  }

  return jsonResponse(toPublicPreset(preset));
}

/** POST /community/presets — create a preset for the calling device. */
export async function createPreset(ctx: RequestContext): Promise<Response> {
  const auth = await authenticate(ctx.request, ctx.store, ctx.now);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(ctx.request, createPresetInputSchema);
  if (!parsed.ok) return parsed.response;

  const input = parsed.value;
  if (!isFrequencyInBand(input.payload)) {
    return errorResponse('band_mismatch', 'Frequency does not fall inside the declared band.', 400);
  }

  const now = ctx.now();
  const preset: CommunityPreset = {
    id: ctx.newId(),
    authorId: auth.device.id,
    authorName: auth.device.displayName,
    name: input.name,
    description: input.description ?? '',
    band: input.payload.band,
    frequency: input.payload.frequency,
    payload: input.payload,
    tags: input.tags ?? [],
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    status: 'published',
    reportCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const created = await ctx.store.createPreset(preset);
  if (!created) {
    return errorResponse(
      'rate_limited',
      'Too many presets created recently. Try again later.',
      429,
    );
  }
  return jsonResponse(toPublicPreset(preset), 201);
}

/** PATCH /community/presets/:id — owner-only update. */
export async function updatePreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const auth = await authenticate(ctx.request, ctx.store, ctx.now);
  if (!auth.ok) return auth.response;

  const existing = await ctx.store.getPreset(presetId);
  if (!existing) return errorResponse('not_found', 'Preset not found.', 404);
  if (existing.authorId !== auth.device.id) {
    return errorResponse('forbidden', 'Only the preset author can edit it.', 403);
  }

  const parsed = await parseJsonBody(ctx.request, updatePresetInputSchema);
  if (!parsed.ok) return parsed.response;

  const patch = parsed.value;
  if (patch.payload && !isFrequencyInBand(patch.payload)) {
    return errorResponse('band_mismatch', 'Frequency does not fall inside the declared band.', 400);
  }

  const updated = await ctx.store.updatePreset(presetId, patch, ctx.now());
  if (!updated) return errorResponse('not_found', 'Preset not found.', 404);
  return jsonResponse(toPublicPreset(updated));
}

/** DELETE /community/presets/:id — owner-only delete. */
export async function deletePreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const auth = await authenticate(ctx.request, ctx.store, ctx.now);
  if (!auth.ok) return auth.response;

  const existing = await ctx.store.getPreset(presetId);
  if (!existing) return errorResponse('not_found', 'Preset not found.', 404);
  if (existing.authorId !== auth.device.id) {
    return errorResponse('forbidden', 'Only the preset author can delete it.', 403);
  }

  const deleted = await ctx.store.deletePreset(presetId);
  return jsonResponse({ deleted });
}
