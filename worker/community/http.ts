/**
 * DEA-95 Phase 1 — community Worker HTTP helpers.
 */

import { z } from 'zod';
import type { CommunityEnv } from './types';

export const MAX_BODY_BYTES = 16 * 1024;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return jsonResponse(body, status);
}

/** Flatten a Zod error into a compact, client-safe detail payload. */
export function validationDetails(error: z.ZodError): unknown {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    if (value !== '') result[key] = value;
  });
  return result;
}

export type BodyResult<T> = { ok: true; value: T } | { ok: false; response: Response };

/**
 * Read and validate a JSON body. `allowEmpty` treats a missing body as `{}` so
 * optional-payload endpoints (device registration) stay ergonomic.
 */
export async function parseJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  options: { allowEmpty?: boolean } = {},
): Promise<BodyResult<z.output<S>>> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    await request.body?.cancel();
    return {
      ok: false,
      response: errorResponse('payload_too_large', 'Request body is too large.', 413),
    };
  }

  let raw = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY_BYTES) {
          await reader.cancel();
          return {
            ok: false,
            response: errorResponse('payload_too_large', 'Request body is too large.', 413),
          };
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }
  if (raw.length === 0) {
    if (options.allowEmpty) {
      const empty = schema.safeParse({});
      if (empty.success) return { ok: true, value: empty.data };
    }
    return {
      ok: false,
      response: errorResponse('invalid_json', 'A JSON body is required.', 400),
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      response: errorResponse('invalid_json', 'Request body must be valid JSON.', 400),
    };
  }

  const parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(
        'validation_failed',
        'Request body failed validation.',
        400,
        validationDetails(parsed.error),
      ),
    };
  }

  return { ok: true, value: parsed.data };
}

export function corsHeaders(request: Request, env: CommunityEnv): Record<string, string> {
  const allowed = env.COMMUNITY_ALLOWED_ORIGIN?.trim();
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (!allowed || allowed === '*') {
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && origin === allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

export function applyCors(response: Response, headers: Record<string, string>): Response {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, headers: merged });
}
