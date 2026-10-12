/**
 * Dead Air PWA — Cloudflare Worker entry point.
 * Serves the Expo web export (static assets in ./dist) with SPA routing.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return new Response(JSON.stringify({ status: 'ok', service: 'deadair-pwa' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
