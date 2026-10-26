/**
 * DEA-95 Phase 1 — device token auth.
 *
 * Phase 1 has no user accounts: a device registers once, receives an opaque
 * random token, and sends it as `Authorization: Bearer <token>`. Only the
 * SHA-256 hash of the token is stored, so a D1 leak does not expose usable
 * credentials.
 */

import { errorResponse } from './http';
import type { CommunityDeviceRecord, CommunityEnv, CommunityStore } from './types';

const TOKEN_PREFIX = 'd1_';
const TOKEN_BYTE_LENGTH = 32;

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/** Generate a new device token. Callers must persist the hash, never the token. */
export function createDeviceToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return TOKEN_PREFIX + toHex(bytes);
}

export async function hashDeviceToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

/** Length-independent comparison so admin token checks do not leak timing. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export type AuthResult =
  { ok: true; device: CommunityDeviceRecord } | { ok: false; response: Response };

/** Resolve the caller's device, or return the 401/403 response to send back. */
export async function authenticate(
  request: Request,
  store: CommunityStore,
  now: () => number,
): Promise<AuthResult> {
  const token = readBearerToken(request);
  if (!token || !token.startsWith(TOKEN_PREFIX)) {
    return {
      ok: false,
      response: errorResponse('unauthorized', 'A device token is required.', 401),
    };
  }

  const tokenHash = await hashDeviceToken(token);
  const device = await store.getDeviceByTokenHash(tokenHash);
  if (!device) {
    return {
      ok: false,
      response: errorResponse('unauthorized', 'Device token is not valid.', 401),
    };
  }
  if (device.banned) {
    return {
      ok: false,
      response: errorResponse('device_banned', 'This device has been banned.', 403),
    };
  }

  await store.touchDevice(device.id, now());
  return { ok: true, device };
}

/** Resolve an optional token without failing the request when it is absent. */
export async function optionalDevice(
  request: Request,
  store: CommunityStore,
): Promise<CommunityDeviceRecord | null> {
  const token = readBearerToken(request);
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const tokenHash = await hashDeviceToken(token);
  return store.getDeviceByTokenHash(tokenHash);
}

/** Returns a response when the admin caller is not authorized, otherwise null. */
export function requireAdmin(request: Request, env: CommunityEnv): Response | null {
  if (!env.ADMIN_TOKEN) {
    return errorResponse('admin_not_configured', 'Admin API is not configured.', 503);
  }
  const provided = request.headers.get('x-admin-token');
  if (!provided || !constantTimeEqual(provided, env.ADMIN_TOKEN)) {
    return errorResponse('unauthorized', 'Admin token is not valid.', 401);
  }
  return null;
}
