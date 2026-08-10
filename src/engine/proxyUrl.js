/**
 * Resolving and vetting the Infinite Signal proxy URL.
 *
 * Pure, so the rules can be tested without a device. Deliberately hand-parsed
 * rather than using `URL`: React Native's implementation has historically been
 * partial, and this is small enough not to need it.
 */

// scheme :// host [:port] [path]
const URL_SHAPE = /^(https?):\/\/([^/:?#\s]+)(?::(\d+))?([^?#\s]*)$/i;

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '10.0.2.2']);

/** Dev machines and emulators — the only places plaintext is tolerated. */
function isLocalHost(host) {
  const h = host.toLowerCase();
  if (LOOPBACK.has(h)) return true;
  if (h.endsWith('.local')) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  return false;
}

export const PROXY_REASONS = Object.freeze({
  ok: null,
  unset: 'NOT CONFIGURED',
  malformed: 'BAD PROXY URL',
  insecure: 'PROXY MUST USE HTTPS',
});

/**
 * Returns `{ url, reason }`. `url` is normalised (no trailing slash) when
 * usable, otherwise null with a reason fit to show the player.
 *
 * Plaintext http is refused anywhere but a local dev host: the proxy is not
 * secret, but a shipped build talking to it over http would leak the traffic
 * and invite a trivially hijacked endpoint.
 */
export function resolveProxyUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { url: null, reason: PROXY_REASONS.unset };
  }

  const match = URL_SHAPE.exec(raw.trim());
  if (!match) return { url: null, reason: PROXY_REASONS.malformed };

  const [, scheme, host, port, path] = match;
  if (scheme.toLowerCase() === 'http' && !isLocalHost(host)) {
    return { url: null, reason: PROXY_REASONS.insecure };
  }

  const authority = port ? `${host}:${port}` : host;
  const trimmedPath = (path || '').replace(/\/+$/, '');
  return { url: `${scheme.toLowerCase()}://${authority}${trimmedPath}`, reason: null };
}
