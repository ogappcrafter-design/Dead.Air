const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const { BANDS } = require('./bands');
const { CALL_SCHEMA, SYSTEM_PROMPT, buildUserPrompt } = require('./prompt');

/**
 * Infinite Signal proxy.
 *
 * This is deliberately NOT a passthrough for /v1/messages. It exposes one
 * narrow endpoint that takes a band id and returns a generated call, so a
 * leaked proxy URL buys an attacker some horror fiction rather than an
 * unmetered Claude account. The prompt is built server-side and the client's
 * input never reaches the model.
 */

const MODEL = 'claude-opus-5';
const PORT = process.env.PORT || 8080;

// Simple per-IP token bucket. Enough to stop a scraper; put a real rate
// limiter or an authenticated gateway in front of this for production volume.
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN || 10);
const buckets = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const bucket = buckets.get(ip) || { tokens: RATE_LIMIT, refilledAt: now };
  const elapsed = now - bucket.refilledAt;
  if (elapsed > 60_000) {
    bucket.tokens = RATE_LIMIT;
    bucket.refilledAt = now;
  }
  if (bucket.tokens <= 0) {
    buckets.set(ip, bucket);
    return true;
  }
  bucket.tokens -= 1;
  buckets.set(ip, bucket);
  return false;
}

// Keep the bucket map from growing without bound on a long-lived instance.
setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [ip, bucket] of buckets) {
    if (bucket.refilledAt < cutoff) buckets.delete(ip);
  }
}, 120_000).unref();

const client = new Anthropic();
const app = express();
app.use(express.json({ limit: '4kb' }));
app.set('trust proxy', true);

app.get('/health', (_req, res) => res.json({ ok: true, model: MODEL }));

app.post('/v1/signal', async (req, res) => {
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  const bandId = Number(req.body?.bandId);
  const band = BANDS[bandId];
  if (!band) {
    return res.status(400).json({ error: 'unknown_band' });
  }

  // Caller names are echoed back into the prompt, so bound and sanitise them.
  const recentNames = Array.isArray(req.body?.recentNames)
    ? req.body.recentNames
        .filter((n) => typeof n === 'string')
        .slice(0, 8)
        .map((n) => n.replace(/[\r\n]+/g, ' ').slice(0, 60))
    : [];

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: CALL_SCHEMA },
      },
      messages: [{ role: 'user', content: buildUserPrompt(band, recentNames) }],
    });

    // Safety classifiers can decline a request; content is empty or partial.
    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'refused' });
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'unparseable' });
    }

    // The app clamps every field again on receipt — this is the happy path,
    // not the trust boundary.
    return res.json({ call: payload });
  } catch (err) {
    const status = err?.status === 429 ? 429 : 502;
    console.error('generation failed:', err?.message || err);
    return res.status(status).json({ error: 'upstream' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`dead-air-proxy listening on ${PORT}`));
}

module.exports = app;
