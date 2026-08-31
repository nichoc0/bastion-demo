// Toolbox — the arsenal the agent has available, and each tool's health.
// Health-only for now (we add the live tool-use feed as a separate widget
// later). `service` is the stable id a real health-check would key on; swap
// the static `status`/`latencyMs` for a live probe when the backend exists.
import { Microphone, Graph, Database, Eye, Browser, DeviceMobile, Cpu, Code } from '@phosphor-icons/react';

// Tool metadata only. Live status + latency come from /api/health (the Vite
// server-side probes in vite.config.js), keyed by `service`. Never hardcode
// status here — that's how the "6/8 online" lie crept in.
export const TOOLS = [
  { service: 'voice-gateway', label: 'Voice gateway', note: 'telephony agent-vs-agent', icon: Microphone },
  { service: 'falkordb',      label: 'FalkorDB',      note: 'cortex graph',             icon: Graph },
  { service: 'redis',         label: 'Redis',         note: 'vector-set memory',        icon: Database },
  { service: 'camoufox',      label: 'Camoufox',      note: 'web driver',               icon: Browser },
  { service: 'frida',         label: 'frida-server',  note: 'mobile RASP bypass',       icon: DeviceMobile },
  { service: 'ghidra',        label: 'Ghidra MCP',    note: 'binary RE + decompiler',   icon: Code },
  { service: 'ollama',        label: 'Ollama',        note: 'local fallback brain',     icon: Cpu },
  { service: 'wrap',         label: 'wrap()',        note: 'runtime traces',          icon: Eye },
];
