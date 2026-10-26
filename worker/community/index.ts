/**
 * DEA-95 Phase 1 — community Worker router.
 *
 * Routes live under `/community`. The whole surface is dark unless
 * `COMMUNITY_ENABLED` is an enabling value; `/community/health` stays reachable
 * so clients can confirm the switch before showing community UI.
 */

import { isCommunityEnabled } from './feature_flag';
import { applyCors, corsHeaders, errorResponse, jsonResponse } from './http';
import { createD1Store } from './store';
import { getDeviceProfile, registerDevice } from './handlers/device';
import { hidePreset, listReports, resolveReport, restorePreset } from './handlers/admin';
import {
  createPreset,
  deletePreset,
  getPreset,
  listPresets,
  updatePreset,
} from './handlers/presets';
import { reportPreset } from './handlers/report';
import type { CommunityEnv, CommunityStore, RequestContext } from './types';

export const COMMUNITY_BASE_PATH = '/community';

function notFound(): Response {
  return errorResponse('not_found', 'Route not found.', 404);
}

function methodNotAllowed(allow: string): Response {
  return jsonResponse(
    { error: { code: 'method_not_allowed', message: 'Method not allowed.' } },
    405,
    { Allow: allow },
  );
}

function splitPath(pathname: string): string[] | null {
  const trimmed = pathname.replace(/\/+$/, '');
  if (trimmed !== COMMUNITY_BASE_PATH && !trimmed.startsWith(`${COMMUNITY_BASE_PATH}/`)) {
    return null;
  }
  const rest = trimmed.slice(COMMUNITY_BASE_PATH.length);
  try {
    return rest
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
}

function resolveStore(env: CommunityEnv): CommunityStore | null {
  if (env.COMMUNITY_STORE) return env.COMMUNITY_STORE;
  if (env.COMMUNITY_DB) return createD1Store(env.COMMUNITY_DB);
  return null;
}

async function route(request: Request, env: CommunityEnv): Promise<Response> {
  const url = new URL(request.url);
  const segments = splitPath(url.pathname);
  if (segments === null) return notFound();

  const method = request.method.toUpperCase();
  const [first, second, third, fourth] = segments;

  if (first === 'health' && segments.length === 1) {
    if (method !== 'GET') return methodNotAllowed('GET');
    return jsonResponse({
      service: 'deadair-community',
      phase: 1,
      enabled: isCommunityEnabled(env),
    });
  }

  if (!isCommunityEnabled(env)) {
    return errorResponse('community_disabled', 'Community features are disabled.', 404);
  }

  const store = resolveStore(env);
  if (!store) {
    return errorResponse('storage_not_configured', 'Community storage is not configured.', 503);
  }

  const ctx: RequestContext = {
    request,
    env,
    store,
    url,
    now: () => Date.now(),
    newId: () => crypto.randomUUID(),
  };

  if (first === 'auth' && second === 'device' && segments.length === 2) {
    if (method === 'POST') return registerDevice(ctx);
    if (method === 'GET') return getDeviceProfile(ctx);
    return methodNotAllowed('GET, POST');
  }

  if (first === 'presets') {
    if (segments.length === 1) {
      if (method === 'GET') return listPresets(ctx);
      if (method === 'POST') return createPreset(ctx);
      return methodNotAllowed('GET, POST');
    }
    if (segments.length === 2 && second) {
      if (method === 'GET') return getPreset(ctx, second);
      if (method === 'PATCH') return updatePreset(ctx, second);
      if (method === 'DELETE') return deletePreset(ctx, second);
      return methodNotAllowed('GET, PATCH, DELETE');
    }
    if (segments.length === 3 && second && third === 'report') {
      if (method === 'POST') return reportPreset(ctx, second);
      return methodNotAllowed('POST');
    }
    return notFound();
  }

  if (first === 'admin') {
    if (second === 'reports') {
      if (segments.length === 2) {
        if (method === 'GET') return listReports(ctx);
        return methodNotAllowed('GET');
      }
      if (segments.length === 4 && third && fourth === 'resolve') {
        if (method === 'POST') return resolveReport(ctx, third);
        return methodNotAllowed('POST');
      }
    }
    if (second === 'presets' && segments.length === 4 && third) {
      if (fourth === 'hide') {
        if (method === 'POST') return hidePreset(ctx, third);
        return methodNotAllowed('POST');
      }
      if (fourth === 'restore') {
        if (method === 'POST') return restorePreset(ctx, third);
        return methodNotAllowed('POST');
      }
    }
    return notFound();
  }

  return notFound();
}

/** Entry point wired from worker/index.js for `/community/*` requests. */
export async function handleCommunityRequest(
  request: Request,
  env: CommunityEnv,
): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const response = await route(request, env);
    return applyCors(response, cors);
  } catch (error) {
    console.error('[community] unhandled error', error);
    return applyCors(errorResponse('internal_error', 'Community request failed.', 500), cors);
  }
}
