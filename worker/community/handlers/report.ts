/**
 * DEA-95 Phase 1 — preset reporting.
 *
 * Reporting is authenticated so one device cannot inflate a preset's report
 * count, and repeat reports from the same device are idempotent. Reports never
 * auto-hide content; an admin decides (see handlers/admin.ts).
 */

import { reportInputSchema } from '../../../lib/community/schema';
import { authenticate } from '../auth';
import { errorResponse, jsonResponse, parseJsonBody } from '../http';
import type { CommunityReport, RequestContext } from '../types';

/** POST /community/presets/:id/report */
export async function reportPreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const auth = await authenticate(ctx.request, ctx.store, ctx.now);
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody(ctx.request, reportInputSchema);
  if (!parsed.ok) return parsed.response;

  const preset = await ctx.store.getPreset(presetId);
  if (!preset || preset.status !== 'published') {
    return errorResponse('not_found', 'Preset not found.', 404);
  }

  const now = ctx.now();
  const report: CommunityReport = {
    id: ctx.newId(),
    presetId,
    reporterDeviceId: auth.device.id,
    reason: parsed.value.reason,
    details: parsed.value.details ?? '',
    status: 'open',
    createdAt: now,
  };

  const { created, reportId, reportCount } = await ctx.store.createReport(report);

  return jsonResponse({ reportId, alreadyReported: !created, reportCount }, created ? 201 : 200);
}
