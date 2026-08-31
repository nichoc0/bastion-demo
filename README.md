# Held or Leaked

An operator dashboard for adversarial AI-agent red-teaming. A multi-agent swarm
probes a target AI agent's tool surface, hands off correlated work, and grades
every exchange held vs leaked. Every probe and grade is traced in W&B Weave.

Built for WeaveHacks 4.

## What's here

- **Current Runs** — start a run against a real bug-bounty target (pulled from
  the public bounty-targets registry) and command the swarm live: redirect,
  stop, spawn more, recall and think.
- **Past Runs** — recorded engagements (anonymized). Each opens to an executive
  summary (agents, findings, tools) over the detail widgets:
  - **Swarm** — the agents divide and conquer the discovered endpoints, settling
    on each target, retracing the campaign on a shared playback clock.
  - **Agent chat** — the orchestrator group chat: a hub-and-spoke main channel
    plus collapsible side-threads that spawn when two agents hand off correlated
    work, scrubbing in lockstep with the swarm.
  - **Toolbox** — the arsenal, with live health and real logs per tool.
  - **Graph** — the FalkorDB cortex and the per-run assessment graph.
- **Evals** — the held-or-leaked leaderboard and per-vector evaluation, plus a
  sandbox that points the harness at OSS CTF targets for safe practice.

## Weave instrumentation

`harness/eval.py` runs the real attack-vector suite against a vulnerable agent
and its hardened twin, scores each exchange, and publishes the held-vs-leaked
leaderboard. `harness/seed_transcripts.py` logs the traced conversation
transcripts. Both use `weave.init` + `@weave.op`, so every probe, grade, and
transcript is inspectable in Weave.

```bash
WANDB_API_KEY=... python harness/eval.py
WANDB_API_KEY=... python harness/seed_transcripts.py
```

## Stack

Vite + React + Tailwind, canvas boids for the swarm, Framer Motion. A small Vite
dev-server middleware provides the live tool health, logs, and graph endpoints.

## Run

```bash
npm install
npm run dev      # http://localhost:5180
```
