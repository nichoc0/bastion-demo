// Handler adapter.
//
// The arena handlers are written against the Web standard —
// `(Request) => Response` — because streaming is far cleaner to express that
// way. Vercel's Node runtime, however, invokes a function's default export as
// `(req, res)` and ignores whatever it returns. A handler that only returns a
// Response therefore never calls `res.end()`, and the request hangs until the
// gateway times it out. (Symptom: the client fetch never settles and the UI
// sits on a loading state forever.)
//
// `webHandler` accepts both call shapes:
//   - `(request)`        → passes straight through (vite dev middleware)
//   - `(req, res)`       → adapts Node → Request, then Response → Node,
//                          preserving streaming for the NDJSON chat route.

function toWebHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders || {})) {
    if (value == null) continue;
    if (key.startsWith(':')) continue; // HTTP/2 pseudo-headers are not valid here
    for (const v of Array.isArray(value) ? value : [value]) {
      try {
        headers.append(key, v);
      } catch {
        /* skip anything Headers rejects rather than failing the request */
      }
    }
  }
  return headers;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function bodyOf(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  // Vercel may have already parsed and consumed the stream into req.body. If
  // so, reading the stream again would hang forever — re-serialise instead.
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body;
    try {
      return JSON.stringify(req.body);
    } catch {
      return undefined;
    }
  }

  const raw = await readRawBody(req);
  return raw.length ? raw : undefined;
}

export function webHandler(handler) {
  return async function adapted(reqOrRequest, maybeRes) {
    // Web-standard invocation — nothing to adapt.
    if (!maybeRes || typeof maybeRes.setHeader !== 'function') {
      return handler(reqOrRequest);
    }

    const req = reqOrRequest;
    const res = maybeRes;

    try {
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `${proto}://${host}`);

      const request = new Request(url, {
        method: req.method,
        headers: toWebHeaders(req.headers),
        body: await bodyOf(req),
        duplex: 'half',
      });

      const response = await handler(request);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        // content-length would be wrong once we stream it out ourselves
        if (key.toLowerCase() === 'content-length') return;
        res.setHeader(key, value);
      });

      if (!response.body) {
        res.end();
        return undefined;
      }

      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
        res.flush?.(); // keep NDJSON chunks moving rather than buffering
      }
      res.end();
      return undefined;
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
      }
      res.end(JSON.stringify({ error: String(err?.message || err) }));
      return undefined;
    }
  };
}
