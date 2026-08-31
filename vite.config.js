import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { liveBastionRuns } from './dev/liveRuns.mjs'

// Real log sources, keyed by tool `service` — each points at that tool's
// ACTUAL log (a container's docker logs, or a real logfile on disk). Tools
// that are offline / remote / library-only have no log to show and honestly
// report "no source".
const LOG_SOURCES = {
  falkordb:        { kind: 'docker', container: 'bastion-falkordb' },
  redis:           { kind: 'docker', container: 'clip-redis' },
  'voice-gateway': { kind: 'file', path: '/Users/nca/.openclaw/logs/voice-gateway.log' },
  ollama:          { kind: 'file', path: '/opt/homebrew/var/log/ollama.log' },
  camoufox:        { kind: 'file', path: '/Users/nca/weavehacks/clip/.toollogs/camoufox.log' },
  ghidra:          { kind: 'file', path: '/Users/nca/weavehacks/clip/.toollogs/ghidra-mcp.log' },
  weave:           { kind: 'file', path: '/Users/nca/weavehacks/harness/weave.log' },
}

// FalkorDB access goes through the bastion-kg venv python (has falkordb client)
const FALKOR_PY = '/Users/nca/bastion-kg/.venv/bin/python'
const TOOLS = fileURLToPath(new URL('./tools', import.meta.url))

// strip ANSI colour escapes so logs read clean in the browser
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '')

function dockerLogs(container, tail = 200) {
  return new Promise((resolve) => {
    execFile('docker', ['logs', '--tail', String(tail), container], { timeout: 4000 }, (err, stdout, stderr) => {
      if (err && !stdout && !stderr) return resolve(null)
      const lines = `${stderr || ''}${stdout || ''}`.split('\n').map((l) => stripAnsi(l).trimEnd()).filter(Boolean)
      resolve(lines)
    })
  })
}

// Tail the last ~96KB of a logfile (cheap, no full read), return last N lines.
function tailFile(path, maxLines = 200) {
  try {
    const { size } = fs.statSync(path)
    const want = Math.min(size, 96 * 1024)
    const fd = fs.openSync(path, 'r')
    const buf = Buffer.alloc(want)
    fs.readSync(fd, buf, 0, want, size - want)
    fs.closeSync(fd)
    const lines = buf.toString('utf8').split('\n').map((l) => stripAnsi(l).trimEnd()).filter(Boolean)
    return lines.slice(-maxLines)
  } catch {
    return null
  }
}

// Real health probes, server-side (a browser can't TCP-check Redis or hit
// cross-origin hosts). Keyed by the tool `service` ids in src/data/toolbox.js.
// `kind: 'fs'` = a library that's installed-but-not-a-daemon → reports idle.
const PROBES = {
  'target-agent':  { kind: 'http', url: 'https://weave.pistonsolutions.ai' },
  'voice-gateway': { kind: 'tcp', host: '127.0.0.1', port: 8799 },
  'falkordb':      { kind: 'tcp', host: '127.0.0.1', port: 6379 },
  'redis':         { kind: 'tcp', host: '127.0.0.1', port: 6380 },
  'weave':         { kind: 'http', url: 'https://wandb.ai' },
  'camoufox':      { kind: 'proc', match: 'tools/camoufox_run.py' },
  'frida':         { kind: 'tcp', host: '127.0.0.1', port: 27042 },
  'ghidra':        { kind: 'proc', match: 'ghidra' },
  'ollama':        { kind: 'http', url: 'http://127.0.0.1:11434/api/tags' },
}

function probeTcp({ host, port }, timeout = 1500) {
  return new Promise((resolve) => {
    const t = Date.now()
    const sock = net.connect({ host, port })
    let done = false
    const finish = (ok) => { if (done) return; done = true; sock.destroy(); resolve({ ok, ms: Date.now() - t }) }
    sock.setTimeout(timeout)
    sock.on('connect', () => finish(true))
    sock.on('error', () => finish(false))
    sock.on('timeout', () => finish(false))
  })
}

function probeHttp({ url }, timeout = 4000) {
  return new Promise((resolve) => {
    const t = Date.now()
    const lib = url.startsWith('https') ? https : http
    const req = lib.request(url, { method: 'GET', timeout }, (res) => {
      res.resume()
      resolve({ ok: res.statusCode > 0 && res.statusCode < 500, ms: Date.now() - t })
    })
    req.on('error', () => resolve({ ok: false, ms: Date.now() - t }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, ms: Date.now() - t }) })
    req.end()
  })
}

function probeProc({ match }) {
  return new Promise((resolve) => {
    execFile('pgrep', ['-f', match], { timeout: 1500 }, (_err, stdout) => resolve(!!(stdout && stdout.trim())))
  })
}

async function runProbe(p) {
  if (p.kind === 'tcp') { const r = await probeTcp(p); return { status: r.ok ? 'up' : 'down', latencyMs: r.ok ? r.ms : null } }
  if (p.kind === 'http') { const r = await probeHttp(p); return { status: r.ok ? 'up' : 'down', latencyMs: r.ok ? r.ms : null } }
  if (p.kind === 'proc') { const ok = await probeProc(p); return { status: ok ? 'up' : 'down', latencyMs: null } }
  if (p.kind === 'fs') { const ok = fs.existsSync(p.path); return { status: ok ? 'idle' : 'down', latencyMs: null } }
  return { status: 'down', latencyMs: null }
}


function healthPlugin() {
  return {
    name: 'clip-health',
    configureServer(server) {
      server.middlewares.use('/api/health', async (_req, res) => {
        const entries = await Promise.all(
          Object.entries(PROBES).map(async ([service, p]) => [service, await runProbe(p)]),
        )
        const out = { checkedAt: new Date().toISOString(), tools: Object.fromEntries(entries) }
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(out))
      })

      // Global graph — the live FalkorDB cortex, dumped as force-graph triples
      server.middlewares.use('/api/graph', (req, res) => {
        if (req.url.startsWith('/commit')) {
          // feedback: MERGE the assessment's important nodes back into FalkorDB
          let body = ''
          req.on('data', (c) => { body += c })
          req.on('end', () => {
            const py = execFile(FALKOR_PY, [`${TOOLS}/falkor_commit.py`], { timeout: 8000 }, (err, stdout) => {
              res.setHeader('content-type', 'application/json')
              res.end(err ? JSON.stringify({ error: String(err) }) : (stdout || '{}'))
            })
            py.stdin.end(body || '{}')
          })
          return
        }
        execFile(FALKOR_PY, [`${TOOLS}/falkor_graph.py`], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
          res.setHeader('content-type', 'application/json')
          res.end(err ? JSON.stringify({ triples: [], error: String(err) }) : (stdout || '{"triples":[]}'))
        })
      })

      server.middlewares.use('/api/logs', async (req, res) => {
        const service = new URL(req.url, 'http://x').searchParams.get('service')
        const src = LOG_SOURCES[service]
        let lines = []
        let source = null
        if (src?.kind === 'docker') {
          lines = (await dockerLogs(src.container)) || []
          source = `docker:${src.container}`
        } else if (src?.kind === 'file') {
          lines = tailFile(src.path) || []
          source = src.path
        }
        const out = { service, source, lines, checkedAt: new Date().toISOString() }
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(out))
      })
    },
  }
}

// Arena API in dev. On Vercel, api/arena/*.js are Functions using the Web
// standard (Request) => Response signature. Vite's dev server speaks Node
// req/res, so this plugin adapts between the two and loads the SAME handler
// modules — `npm run dev` exercises production code, not a mock.
function arenaApiPlugin() {
  const SAFE_ROUTE = /^[a-z][a-z0-9-]*$/ // no underscores: _challenges/_store/_http stay private

  return {
    name: 'arena-api',
    // Vite only exposes VITE_* to the client and does not put anything into
    // process.env. The arena handlers run server-side and read
    // AI_GATEWAY_API_KEY from process.env, so lift the unprefixed keys out of
    // the .env files here — same key works in dev and on Vercel.
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of ['AI_GATEWAY_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']) {
        if (!process.env[key] && env[key]) process.env[key] = env[key]
      }
    },
    configureServer(server) {
      // Domain verification API endpoint
      server.middlewares.use('/api/verify-domain', async (req, res, next) => {
        let mod
        try {
          mod = await server.ssrLoadModule('/api/verify-domain.js')
        } catch (err) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          return res.end(JSON.stringify({ error: `verify-domain load failed: ${err}` }))
        }
        const handler = mod?.default
        if (typeof handler !== 'function') return next()

        const body = await new Promise((resolve) => {
          if (req.method === 'GET' || req.method === 'HEAD') return resolve(undefined)
          const chunks = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers,
          body,
        })

        try {
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (!response.body) return res.end()
          const text = await response.text()
          res.end(text)
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
          }
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })

      // DEV-ONLY, localhost-only: live Bastion-agent monitor. Reads the local
      // Claude Code transcript store and returns only sessions appended to in the
      // last 3 minutes. Lives in the vite dev config, so it is never deployed;
      // refuses any non-loopback client so `--host` LAN peers cannot read it.
      server.middlewares.use('/api/admin/active-runs', (req, res) => {
        const ra = req.socket?.remoteAddress || ''
        const isLocal = ra === '127.0.0.1' || ra === '::1' || ra === '::ffff:127.0.0.1'
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        if (!isLocal) {
          res.statusCode = 403
          return res.end(JSON.stringify({ error: 'forbidden' }))
        }
        try {
          res.statusCode = 200
          res.end(JSON.stringify(liveBastionRuns()))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })

      server.middlewares.use('/api/arena', async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        const route = url.pathname.replace(/^\/+|\/+$/g, '')
        if (!SAFE_ROUTE.test(route)) return next()

        let mod
        try {
          mod = await server.ssrLoadModule(`/api/arena/${route}.js`)
        } catch (err) {
          if (err?.code === 'ERR_MODULE_NOT_FOUND' || /Failed to load/.test(String(err))) return next()
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          return res.end(JSON.stringify({ error: `handler load failed: ${err}` }))
        }
        const handler = mod?.default
        if (typeof handler !== 'function') return next()

        // Node req → Web Request
        const body = await new Promise((resolve) => {
          if (req.method === 'GET' || req.method === 'HEAD') return resolve(undefined)
          const chunks = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => resolve(Buffer.concat(chunks)))
        })
        const request = new Request(`http://localhost${req.url}`, {
          method: req.method,
          headers: req.headers,
          body,
        })

        try {
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))

          // Web Response → Node res, preserving streaming.
          if (!response.body) return res.end()
          const reader = response.body.getReader()
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
            res.flushHeaders?.()
          }
          res.end()
        } catch (err) {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
          }
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), healthPlugin(), arenaApiPlugin()],
  base: '/',
  server: { port: 5180, host: true },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // The whole dashboard runs on the demo-operator shim. The login gate
      // imports the REAL Clerk via this second alias so it can actually gate
      // without disturbing the 40+ shim call sites underneath it.
      '@clerk-real': fileURLToPath(new URL('./node_modules/@clerk/clerk-react', import.meta.url)),
      '@clerk/clerk-react': fileURLToPath(new URL('./src/lib/clerk-shim.jsx', import.meta.url)),
    },
  },
})
