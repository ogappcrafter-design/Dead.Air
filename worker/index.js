/**
 * Dead Air PWA — Cloudflare Worker entry point.
 * Serves the Expo web export (static assets in ./dist) with SPA routing.
 */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
