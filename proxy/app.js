const express = require('express');

const { BANDS } = require('./bands');
const { CALL_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } = require('./prompt');

/**
 * Infinite Signal proxy.
 *
 * Deliberately NOT a passthrough for /v1/messages. One narrow route takes a
 * band id and returns a generated call, so a leaked proxy URL buys an attacker
 * some horror fiction rather than an unmetered Claude account. The prompt is
 * assembled here; nothing the client sends is used as prompt text except a
 * bounded, sanitised list of caller names to avoid repeating.
 *
 * `createApp` takes its dependencies so the route can be driven in tests
 * against a stub client instead of the live API.
 */

const MODEL = 'claude-opus-5';
const MAX_RECENT_NAMES = 8;
const MAX_NAME_LENGTH = 60;

/** Bound and de-fang the only client-supplied text that reaches the prompt. */
function sanitiseNames(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n) => typeof n === 'string')
    .slice(0, MAX_RECENT_NAMES)
    .map((n) => n.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_NAME_LENGTH))
    .filter((n) => n.length > 0);
}

/** Per-IP token bucket. Stops casual scraping; not a substitute for a gateway. */
function createRateLimiter({ perMinute, now = Date.now }) {
  const buckets = new Map();

  const check = (key) => {
    if (perMinute <= 0) return false;
    const t = now();
    const bucket = buckets.get(key) || { tokens: perMinute, refilledAt: t };
    if (t - bucket.refilledAt > 60_000) {
      bucket.tokens = perMinute;
      bucket.refilledAt = t;
    }
    if (bucket.tokens <= 0) {
      buckets.set(key, bucket);
      return true;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    return false;
  };

  // Keep the map from growing without bound on a long-lived instance.
  const sweep = () => {
    const cutoff = now() - 120_000;
    for (const [key, bucket] of buckets) {
      if (bucket.refilledAt < cutoff) buckets.delete(key);
    }
  };

  return { check, sweep };
}

function createApp({ client, rateLimitPerMinute = 10, logger = console } = {}) {
  const limiter = createRateLimiter({ perMinute: rateLimitPerMinute });
  const sweeper = setInterval(limiter.sweep, 120_000);
  sweeper.unref?.();

  const app = express();
  app.use(express.json({ limit: '4kb' }));
  app.set('trust proxy', true);

  app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL }));

  app.post('/v1/signal', async (req, res) => {
    if (limiter.check(req.ip)) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    const band = BANDS[Number(req.body?.bandId)];
    if (!band) {
      return res.status(400).json({ error: 'unknown_band' });
    }

    try {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        betas: ['server-side-fallback-2026-07-01'],
        // Horror fiction sits near enough to the safety classifiers that a
        // refusal is worth routing around rather than surfacing to a player.
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        system: SYSTEM_PROMPT,
        output_config: {
          // Short creative generations: low effort keeps latency inside what
          // someone will wait for with a spinner on screen.
          effort: 'low',
          format: { type: 'json_schema', schema: CALL_SCHEMA },
        },
        messages: [
          { role: 'user', content: buildUserPrompt(band, sanitiseNames(req.body?.recentNames)) },
        ],
      });

      // Classifiers can decline; content is then empty or partial.
      if (response.stop_reason === 'refusal') {
        return res.status(422).json({ error: 'refused' });
      }

      const text = (response.content || [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        logger.error('unparseable generation');
        return res.status(502).json({ error: 'unparseable' });
      }

      // The app clamps every field again on receipt — this is the happy path,
      // not the trust boundary.
      return res.json({ call: payload });
    } catch (err) {
      logger.error('generation failed:', err?.message || err);
      return res.status(err?.status === 429 ? 429 : 502).json({ error: 'upstream' });
    }
  });

  // Lets a test (or a graceful shutdown) drop the sweeper timer.
  app.stopBackgroundWork = () => clearInterval(sweeper);
  return app;
}

module.exports = { createApp, sanitiseNames, createRateLimiter, MODEL };
