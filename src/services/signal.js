import appConfig from '../../app.json';

import { normalizeGeneratedCall } from '../engine/generation';
import { recentCallerNames } from '../engine/progression';

/**
 * Client half of Infinite Signal.
 *
 * The proxy holds the API key and builds the prompt (see proxy/README.md).
 * This module only knows the endpoint, and treats everything it returns as
 * untrusted input to be clamped by the engine.
 */

const TIMEOUT_MS = 45_000;

// Read straight from app.json rather than expo-constants: same value, and it
// keeps the app's runtime dependency list unchanged from v1.
export const proxyUrl = () => {
  const configured = appConfig?.expo?.extra?.signalProxyUrl;
  return typeof configured === 'string' && configured.length ? configured.replace(/\/$/, '') : null;
};

export const isConfigured = () => proxyUrl() !== null;

export class SignalError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SignalError';
    this.code = code;
  }
}

export async function generateCall(band) {
  const base = proxyUrl();
  if (!base) {
    throw new SignalError('INFINITE SIGNAL NOT CONFIGURED', 'unconfigured');
  }

  // AbortController rather than Promise.race: a stalled request should be torn
  // down, not merely ignored while it holds the connection open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${base}/v1/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bandId: band.id,
        recentNames: recentCallerNames(band.id),
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new SignalError(
      err?.name === 'AbortError' ? 'SIGNAL TIMED OUT' : 'NO CARRIER',
      'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    throw new SignalError('TOO MANY TRANSMISSIONS. WAIT.', 'rate_limited');
  }
  if (!response.ok) {
    throw new SignalError('SIGNAL LOST', 'upstream');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new SignalError('SIGNAL LOST', 'unparseable');
  }

  return normalizeGeneratedCall(body?.call, band);
}
