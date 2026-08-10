import Constants from 'expo-constants';

import { normalizeGeneratedCall } from '../engine/generation';
import { recentCallerNames } from '../engine/progression';
import { resolveProxyUrl } from '../engine/proxyUrl';

/**
 * Client half of Infinite Signal.
 *
 * The proxy holds the API key and builds the prompt (see proxy/README.md).
 * This module knows the endpoint and nothing else, and treats everything that
 * comes back as untrusted input for the engine to clamp.
 */

const TIMEOUT_MS = 45_000;

/** Resolved from app.config.js, which reads SIGNAL_PROXY_URL at build time. */
const configured = () => Constants.expoConfig?.extra?.signalProxyUrl ?? null;

export const proxyStatus = () => resolveProxyUrl(configured());
export const proxyUrl = () => proxyStatus().url;
export const isConfigured = () => proxyStatus().url !== null;

export class SignalError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SignalError';
    this.code = code;
  }
}

/** Server-side failures, phrased for a player rather than an operator. */
const HTTP_MESSAGES = {
  429: ['TOO MANY TRANSMISSIONS. WAIT.', 'rate_limited'],
  422: ['THE FREQUENCY REFUSED. TRY AGAIN.', 'refused'],
  400: ['SIGNAL LOST', 'bad_request'],
};

export async function generateCall(band) {
  const { url, reason } = proxyStatus();
  if (!url) throw new SignalError(reason, 'unconfigured');

  // AbortController rather than a raced timer: a stalled request should be torn
  // down, not merely ignored while it holds the connection open.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${url}/v1/signal`, {
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
      err?.name === 'AbortError' ? 'timeout' : 'network',
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const [message, code] = HTTP_MESSAGES[response.status] || ['SIGNAL LOST', 'upstream'];
    throw new SignalError(message, code);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new SignalError('SIGNAL LOST', 'unparseable');
  }

  return normalizeGeneratedCall(body?.call, band);
}
