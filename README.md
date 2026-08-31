# Bastion demo

A public, no-auth demo of the Bastion operator console — the CISO / vulnerability-
management dashboard, the live-run start flow, the Cortex knowledge base, and past
assessment runs. Deployed to **demo.trybastion.ai**.

This is a demo build: `VITE_DEMO=1` bypasses the sign-in gate and surfaces the
Cortex tab and Past Runs demo data. In the real product those are gated.

## What's here

- **Dashboard** — the CISO / vuln-management overview (risk posture, open findings
  by severity, MTTR / SLA KPIs, findings by category, assets by risk, compliance
  coverage). All numbers come from an editable data file, `public/demo-data/dashboard.json`.
- **Current Runs** — start a run against a target: configure the LLM endpoint,
  verify domain ownership by DNS TXT record, and launch the adversarial swarm.
- **Past Runs** — recorded assessments, each opening to an executive summary
  (agents, findings mapped to their OWASP class, the tools that produced them).
- **Cortex** — the knowledge base: attack library, classes & standards, engagement
  record, recon & intel. Counts are a snapshot of the live cortex graph, served
  from `public/demo-data/cortex.json`.
- **Posture Report** — the attestation document produced from an engagement.

## Editing the demo data

- Dashboard metrics: `public/demo-data/dashboard.json`
- Cortex counts / tree: `public/demo-data/cortex.json`

Edit the numbers or add rows; the UI reflects them on load. Layout and visuals do
not change.

## Develop

```bash
npm install
VITE_DEMO=1 npm run dev
```

## Deploy

Pushes to this repo auto-deploy to demo.trybastion.ai via Vercel (project
`bastion-demo`, build env `VITE_DEMO=1`).

<!-- ci/cd check 145400Z -->
