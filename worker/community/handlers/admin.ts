/**
 * DEA-95 Phase 1 — moderation endpoints.
 *
 * Admin calls are authenticated with a shared `ADMIN_TOKEN` Worker secret
 * (never shipped to the app). Hiding is reversible; removal is not exposed in
 * Phase 1 so a mistaken action stays recoverable.
 */

import { z } from 'zod';
import { REPORT_STATUSES } from '../../../lib/community/schema';
import { requireAdmin } from '../auth';
import {
  errorResponse,
  jsonResponse,
  parseJsonBody,
  searchParamsToObject,
  validationDetails,
} from '../http';
import type { ReportStatus, RequestContext } from '../types';

const reportQuerySchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

const resolveReportSchema = z
  .object({
    status: z.enum(['resolved', 'dismissed']),
  })
  .strict();

/** GET /community/admin/reports */
export async function listReports(ctx: RequestContext): Promise<Response> {
  const denied = requireAdmin(ctx.request, ctx.env);
  if (denied) return denied;

  const parsed = reportQuerySchema.safeParse(searchParamsToObject(ctx.url.searchParams));
  if (!parsed.success) {
    return errorResponse(
      'validation_failed',
      'Query parameters failed validation.',
      400,
      validationDetails(parsed.error),
    );
  }

  const reports = await ctx.store.listReports(
    parsed.data.status as ReportStatus | undefined,
    parsed.data.limit,
  );
  return jsonResponse({
    items: reports.map((report) => ({
      id: report.id,
      presetId: report.presetId,
      presetName: report.presetName ?? null,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: new Date(report.createdAt).toISOString(),
    })),
  });
}

/** POST /community/admin/reports/:id/resolve */
export async function resolveReport(ctx: RequestContext, reportId: string): Promise<Response> {
  const denied = requireAdmin(ctx.request, ctx.env);
  if (denied) return denied;

  const parsed = await parseJsonBody(ctx.request, resolveReportSchema);
  if (!parsed.ok) return parsed.response;

  const resolved = await ctx.store.resolveReport(reportId, parsed.value.status);
  if (!resolved) return errorResponse('not_found', 'Report not found.', 404);
  return jsonResponse({ resolved: true, status: parsed.value.status });
}

/** POST /community/admin/presets/:id/hide */
export async function hidePreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const denied = requireAdmin(ctx.request, ctx.env);
  if (denied) return denied;

  const updated = await ctx.store.setPresetStatus(presetId, 'hidden', ctx.now());
  if (!updated) return errorResponse('not_found', 'Preset not found.', 404);
  return jsonResponse({ id: updated.id, status: updated.status });
}

/** POST /community/admin/presets/:id/restore */
export async function restorePreset(ctx: RequestContext, presetId: string): Promise<Response> {
  const denied = requireAdmin(ctx.request, ctx.env);
  if (denied) return denied;

  const updated = await ctx.store.setPresetStatus(presetId, 'published', ctx.now());
  if (!updated) return errorResponse('not_found', 'Preset not found.', 404);
  return jsonResponse({ id: updated.id, status: updated.status });
}
