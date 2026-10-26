/**
 * DEA-95 Phase 1 — keyset pagination cursors.
 *
 * A cursor is `<createdAt>.<id>`, matching the `ORDER BY created_at DESC,
 * id DESC` keyset so pages stay stable while new presets arrive. Both parts are
 * URL-safe, so no encoding layer is needed.
 */

export interface DecodedCursor {
  createdAt: number;
  id: string;
}

const MAX_ID_LENGTH = 64;

export function encodeCursor(item: { createdAt: number; id: string }): string {
  return `${item.createdAt}.${item.id}`;
}

export function decodeCursor(raw: string): DecodedCursor | null {
  const separator = raw.indexOf('.');
  if (separator <= 0 || separator === raw.length - 1) return null;

  const timestamp = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (!/^\d{1,16}$/.test(timestamp) || id.length === 0 || id.length > MAX_ID_LENGTH) {
    return null;
  }

  return { createdAt: Number(timestamp), id };
}
