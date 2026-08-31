import { useEffect, useState } from 'react';

// Polls the real /api/health probe (vite.config.js). `live` keeps it polling;
// otherwise it checks once. Returns { tools: {service: {status, latencyMs}},
// checkedAt, loading, error }.
export function useHealth({ live = true, intervalMs = 5000 } = {}) {
  const [state, setState] = useState({ tools: {}, checkedAt: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setState({ tools: data.tools || {}, checkedAt: data.checkedAt, loading: false, error: null });
      } catch (e) {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: e.message }));
      }
    };

    tick();
    if (live) timer = setInterval(tick, intervalMs);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [live, intervalMs]);

  return state;
}

// Polls /api/logs for one tool. service=null → idle (nothing selected).
export function useLogs(service, { live = true, intervalMs = 4000 } = {}) {
  const [state, setState] = useState({ lines: [], source: null, loading: false, error: null });

  useEffect(() => {
    if (!service) { setState({ lines: [], source: null, loading: false, error: null }); return; }
    let cancelled = false;
    let timer = null;
    setState((s) => ({ ...s, loading: true }));

    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
    const loadSnapshot = () =>
      fetch(`${base}/static-api/logs/${encodeURIComponent(service)}.json`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('no snapshot'))))
        .then((d) => { if (!cancelled) setState({ lines: d.lines || [], source: d.source || null, loading: false, error: null }); })
        // No live backend AND no bundled snapshot (e.g. redis/frida on the
        // static demo). Degrade to a clean no-source state, not an HTTP error.
        .catch(() => { if (!cancelled) setState({ lines: [], source: null, loading: false, error: null }); });

    const tick = async () => {
      try {
        const res = await fetch(`/api/logs?service=${encodeURIComponent(service)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const lines = data.lines || [];
        if (!data.source || lines.length === 0) { await loadSnapshot(); return; }
        if (!cancelled) setState({ lines, source: data.source, loading: false, error: null });
      } catch {
        await loadSnapshot();
      }
    };

    tick();
    if (live) timer = setInterval(tick, intervalMs);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [service, live, intervalMs]);

  return state;
}
