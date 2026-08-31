// Arena persistence.
//
// Two backends behind one interface:
//   - Upstash Redis REST, used automatically when the env vars are present.
//     Provision via Vercel Marketplace (Upstash) — no code change needed.
//   - In-memory Map, used otherwise.
//
// IMPORTANT: the in-memory backend is per-instance and non-durable. On Vercel
// Fluid Compute, instances are reused across requests but are recycled freely
// and there are several of them, so leaderboard state written in memory WILL
// be partial and WILL disappear. It exists so the arena runs end-to-end before
// a store is provisioned. Do not treat an in-memory leaderboard as real.

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || null;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || null;

export const storeBackend = UPSTASH_URL && UPSTASH_TOKEN ? 'upstash' : 'memory';

const LEADERBOARD_KEY = 'arena:leaderboard';
const MAX_ENTRIES = 500;

// ── in-memory fallback ────────────────────────────────────────────────
const mem = { leaderboard: [] };

// ── upstash REST ──────────────────────────────────────────────────────
async function upstash(command) {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

/**
 * Record a successful break. Returns the stored entry.
 */
export async function recordBreak(entry) {
  const record = {
    id: `${entry.challengeId}:${entry.player}:${entry.at}`,
    ...entry,
  };

  if (storeBackend === 'upstash') {
    await upstash(['LPUSH', LEADERBOARD_KEY, JSON.stringify(record)]);
    await upstash(['LTRIM', LEADERBOARD_KEY, 0, MAX_ENTRIES - 1]);
  } else {
    mem.leaderboard.unshift(record);
    mem.leaderboard.length = Math.min(mem.leaderboard.length, MAX_ENTRIES);
  }
  return record;
}

/**
 * Every recorded break, newest first.
 */
export async function listBreaks() {
  if (storeBackend === 'upstash') {
    const raw = (await upstash(['LRANGE', LEADERBOARD_KEY, 0, MAX_ENTRIES - 1])) || [];
    return raw
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
  return [...mem.leaderboard];
}

/**
 * Aggregate breaks into a ranked player table.
 *
 * A player scores each (challenge, objective) pair once — repeatedly breaking
 * the same objective does not farm points. Ties break on fewest total turns,
 * then on who got there first.
 */
export async function leaderboard() {
  const breaks = await listBreaks();
  const players = new Map();

  for (const b of breaks) {
    const key = b.player;
    if (!players.has(key)) {
      players.set(key, {
        player: key,
        points: 0,
        breaks: 0,
        challenges: new Set(),
        scored: new Set(),
        turns: 0,
        firstAt: b.at,
        lastAt: b.at,
      });
    }
    const p = players.get(key);
    p.firstAt = Math.min(p.firstAt, b.at);
    p.lastAt = Math.max(p.lastAt, b.at);

    let countedAny = false;
    for (const objectiveId of b.objectiveIds || []) {
      const pair = `${b.challengeId}:${objectiveId}`;
      if (p.scored.has(pair)) continue;
      p.scored.add(pair);
      p.points += b.pointsByObjective?.[objectiveId] ?? 0;
      countedAny = true;
    }
    if (countedAny) {
      p.breaks += 1;
      p.turns += b.turns || 0;
      p.challenges.add(b.challengeId);
    }
  }

  return [...players.values()]
    .map((p) => ({
      player: p.player,
      points: p.points,
      breaks: p.breaks,
      challengesBroken: p.challenges.size,
      turns: p.turns,
      firstAt: p.firstAt,
      lastAt: p.lastAt,
    }))
    .sort((a, b) => b.points - a.points || a.turns - b.turns || a.firstAt - b.firstAt)
    .map((p, i) => ({ rank: i + 1, ...p }));
}
