// GET /api/arena/challenges — the public challenge catalog.
//
// Goes through publicChallenge() so system prompts, secrets, and judge rubrics
// stay server-side. This is the only path by which challenge data reaches the
// browser.

import { publicCatalog } from './_challenges.js';
import { json, fail } from './_http.js';
import { storeBackend } from './_store.js';
import { webHandler } from './_adapter.js';

const handler = async function handler(request) {
  if (request.method !== 'GET') return fail(405, 'method not allowed');

  return json({
    challenges: publicCatalog(),
    // Surfaced so the UI can warn when the leaderboard is not durable.
    storeBackend,
    gatewayConfigured: !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
  });
}

export default webHandler(handler);
