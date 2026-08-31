// Client for the arena API. The chat endpoint speaks NDJSON (one JSON event
// per line) rather than the AI SDK's UI-message protocol, because the arena
// scores tool calls and keeps its own attempt state.

const jsonHeaders = { 'content-type': 'application/json' };

// A request that never settles must never present as an endless spinner, so
// every non-streaming call is bounded and a non-JSON body is an error rather
// than a silent null (an auth redirect returning HTML would otherwise sail
// through as a "successful" empty response).
async function getJson(url, timeoutMs = 15000) {
  let res;
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error(`${url} timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }

  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* not JSON — handled below */
  }

  if (!res.ok) throw new Error(body?.error || `${res.status} ${res.statusText}`);
  if (body === null) throw new Error(`${url} returned a non-JSON response (${res.status})`);
  return body;
}

export function fetchChallenges() {
  return getJson('/api/arena/challenges');
}

export function fetchLeaderboard() {
  return getJson('/api/arena/leaderboard');
}

export async function judgeAttempt({ challengeId, messages, player }) {
  const res = await fetch('/api/arena/judge', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ challengeId, messages, player }),
    // The referee reads a whole transcript, so it gets a longer leash.
    signal: AbortSignal.timeout(90000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `judge failed (${res.status})`);
  return body;
}

/**
 * Stream one target-agent reply.
 *
 * Handlers: onDelta(text), onTool({name,input,restricted}), onToolResult({name,output}),
 * onRedacted(), onDone({turnsUsed}), onError(message).
 */
export async function streamChat({ challengeId, messages, signal, handlers = {} }) {
  const res = await fetch('/api/arena/chat', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ challengeId, messages }),
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `chat failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (line) => {
    if (!line.trim()) return;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    if (evt.t === 'delta') handlers.onDelta?.(evt.text);
    else if (evt.t === 'tool') handlers.onTool?.(evt);
    else if (evt.t === 'tool-result') handlers.onToolResult?.(evt);
    else if (evt.t === 'redacted') handlers.onRedacted?.();
    else if (evt.t === 'done') handlers.onDone?.(evt);
    else if (evt.t === 'error') handlers.onError?.(evt.message);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) dispatch(line);
  }
  dispatch(buffer);
}

// ── local player identity ─────────────────────────────────────────────
// Deliberately lightweight: a handle in localStorage, no auth. Scores are
// therefore claimable, not verified — fine for a practice range, and the
// place to swap in Clerk identity if the arena ever needs real attribution.
const HANDLE_KEY = 'bastion.arena.handle';

export function getHandle() {
  try {
    return localStorage.getItem(HANDLE_KEY) || '';
  } catch {
    return '';
  }
}

export function setHandle(handle) {
  try {
    localStorage.setItem(HANDLE_KEY, handle);
  } catch {
    /* private mode — handle just won't persist */
  }
}
