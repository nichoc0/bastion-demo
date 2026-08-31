// GET /api/arena/leaderboard — ranked players plus the recent break feed.

import { fail, json } from './_http.js';
import { leaderboard, listBreaks, storeBackend } from './_store.js';
import { webHandler } from './_adapter.js';

const handler = async function handler(request) {
  if (request.method !== 'GET') return fail(405, 'method not allowed');

  try {
    const [ranked, breaks] = await Promise.all([leaderboard(), listBreaks()]);
    return json({
      leaderboard: ranked,
      recent: breaks.slice(0, 25),
      storeBackend,
      durable: storeBackend !== 'memory',
    });
  } catch (err) {
    return fail(500, `leaderboard unavailable: ${String(err?.message || err)}`);
  }
}

export default webHandler(handler);
