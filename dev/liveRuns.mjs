// DEV-ONLY mapper. Not part of the app bundle and never deployed — it is imported
// by vite.config.js and served through a localhost-guarded dev middleware only.
//
// A "Bastion agent" is a Claude Code session whose cwd is under bastion-red/.
// Claude Code stores each session at ~/.claude/projects/<cwd-slug>/<id>.jsonl and
// the slug encodes the cwd. We surface only the LIVE ones (transcript appended to
// within LIVE_WINDOW_SEC). Whole transcripts run to tens of MB, so we only read
// the head of each live file for its title/model/cwd and stream-count newlines.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const LIVE_WINDOW_SEC = 180; // appended within 3 minutes = live

function readHead(file, maxBytes = 65536, maxLines = 60) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(maxBytes);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.slice(0, n).toString('utf8').split('\n').slice(0, maxLines);
  } catch {
    return [];
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

function countLines(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(1 << 20);
    let count = 0, read;
    while ((read = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
      for (let i = 0; i < read; i++) if (buf[i] === 10) count++;
    }
    return count;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch {}
  }
}

function engagementLabel(dirName) {
  const tail = dirName.replace('-Users-nca-bastion-red', '').replace(/^-+/, '');
  return tail.replace(/^engagements-/, '') || 'root';
}

function mapLive(file, dirName, mtimeMs, size) {
  let title = null, cwd = null, model = null, firstTs = null;
  for (const line of readHead(file)) {
    if (!line.trim()) continue;
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (!title && e.aiTitle) title = e.aiTitle;
    if (!cwd && e.cwd) cwd = e.cwd;
    if (!firstTs && e.timestamp) firstTs = e.timestamp;
    const mm = e.message || {};
    if (!model && mm.model) model = mm.model;
  }
  if (!cwd || !cwd.includes('bastion-red')) return null;
  const name = file.split('/').pop();
  return {
    session: name.replace('.jsonl', ''),
    sessionShort: name.slice(0, 8),
    engagement: engagementLabel(dirName),
    title: title || null,
    model: model || null,
    startedAt: firstTs || null,
    lastActivityMs: mtimeMs,
    ageSec: Math.round((Date.now() - mtimeMs) / 1000),
    turns: countLines(file),
    sizeBytes: size,
    cwd,
  };
}

export function liveBastionRuns() {
  const base = path.join(os.homedir(), '.claude', 'projects');
  const runs = [];
  let dirs = [];
  try {
    dirs = fs.readdirSync(base).filter((d) => d.includes('bastion-red'));
  } catch {
    dirs = [];
  }
  for (const d of dirs) {
    const dir = path.join(base, d);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const f of files) {
      const fp = path.join(dir, f);
      let st;
      try { st = fs.statSync(fp); } catch { continue; }
      if ((Date.now() - st.mtimeMs) / 1000 > LIVE_WINDOW_SEC) continue; // LIVE only
      const run = mapLive(fp, d, st.mtimeMs, st.size);
      if (run) runs.push(run);
    }
  }
  runs.sort((a, b) => a.ageSec - b.ageSec);
  return { runs, generatedAt: new Date().toISOString() };
}
