/**
 * DEA-95 Phase 1 — device registration and profile handlers.
 */

import { deviceProfileSchema, deviceRegistrationSchema } from '../../../lib/community/schema';
import { authenticate, createDeviceToken, hashDeviceToken } from '../auth';
import { jsonResponse, parseJsonBody } from '../http';
import type { RequestContext } from '../types';

const DEFAULT_CALLSIGN_PREFIXES = ['STATIC', 'NIGHT', 'GHOST', 'ECHO', 'DRIFT', 'SIGNAL'];

function defaultDisplayName(deviceId: string): string {
  const seed = deviceId.replace(/[^0-9a-f]/gi, '');
  const index =
    seed.length > 0 ? parseInt(seed.slice(0, 2), 16) % DEFAULT_CALLSIGN_PREFIXES.length : 0;
  const prefix = DEFAULT_CALLSIGN_PREFIXES[index] ?? 'SIGNAL';
  return `${prefix}-${deviceId.slice(0, 4).toUpperCase()}`;
}

/** POST /community/auth/device — issue a device token. */
export async function registerDevice(ctx: RequestContext): Promise<Response> {
  const parsed = await parseJsonBody(ctx.request, deviceRegistrationSchema, { allowEmpty: true });
  if (!parsed.ok) return parsed.response;

  const token = createDeviceToken();
  const tokenHash = await hashDeviceToken(token);
  const now = ctx.now();
  const deviceId = ctx.newId();
  const displayName = parsed.value.displayName ?? defaultDisplayName(deviceId);

  const device = await ctx.store.createDevice({
    id: deviceId,
    tokenHash,
    displayName,
    createdAt: now,
  });

  return jsonResponse({ deviceId: device.id, token, displayName: device.displayName }, 201);
}

/** GET /community/auth/device — return the calling device's profile. */
export async function getDeviceProfile(ctx: RequestContext): Promise<Response> {
  const auth = await authenticate(ctx.request, ctx.store, ctx.now);
  if (!auth.ok) return auth.response;

  const presetCount = await ctx.store.countPresetsByAuthor(auth.device.id);
  const body = deviceProfileSchema.parse({
    deviceId: auth.device.id,
    displayName: auth.device.displayName,
    createdAt: new Date(auth.device.createdAt).toISOString(),
    presetCount,
  });
  return jsonResponse(body);
}
