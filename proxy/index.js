const Anthropic = require('@anthropic-ai/sdk');

const { createApp } = require('./app');

/** Entry point. The app itself lives in app.js so tests can inject a client. */
const PORT = process.env.PORT || 8080;

const app = createApp({
  client: new Anthropic(),
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MIN || 10),
});

if (require.main === module) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — every generation will fail.');
  }
  app.listen(PORT, () => console.log(`dead-air-proxy listening on ${PORT}`));
}

module.exports = app;
