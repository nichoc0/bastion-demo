// Shared request/response helpers for the arena API.
//
// Handlers use the Web-standard (Request) => Response signature, which Vercel
// Functions support natively and which the vite dev middleware adapts to
// Node's req/res so `npm run dev` runs the exact same handler code.

export function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

export function fail(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function requirePost(request) {
  return request.method === 'POST' ? null : fail(405, 'method not allowed');
}

// Every model call runs through the Vercel AI Gateway. Without a key the
// arena cannot function, so fail loudly and specifically rather than letting
// the SDK throw something opaque three frames down.
export function requireGatewayKey() {
  const hasKey = !!(
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN
  );
  return hasKey
    ? null
    : fail(
        503,
        'AI Gateway not configured. Set AI_GATEWAY_API_KEY (Vercel → AI Gateway → API Keys) in the environment.',
        { code: 'no_gateway_key' },
      );
}

/**
 * Normalise and validate an incoming transcript.
 * Rejects anything that is not a plain user/assistant text exchange.
 */
export function sanitizeMessages(messages, { maxMessages = 80, maxChars = 8000 } = {}) {
  if (!Array.isArray(messages)) return { error: 'messages must be an array' };
  if (messages.length > maxMessages) return { error: 'transcript too long' };

  const clean = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return { error: 'malformed message' };
    if (m.role !== 'user' && m.role !== 'assistant') {
      return { error: `unsupported role: ${m.role}` };
    }
    const content = typeof m.content === 'string' ? m.content : '';
    if (content.length > maxChars) return { error: 'message too long' };
    if (!content.trim()) continue;
    clean.push({ role: m.role, content });
  }
  return { messages: clean };
}
