/**
 * Dead Air PWA — Cloudflare Worker entry point.
 * Serves the Expo web export (static assets in ./dist) with SPA routing, and
 * routes `/community/*` to the DEA-95 Phase 1 community preset API.
 */
import { handleCommunityRequest } from './community/index';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/community' || url.pathname.startsWith('/community/')) {
      return handleCommunityRequest(request, env);
    }
    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return new Response(JSON.stringify({ status: 'ok', service: 'deadair-pwa' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
