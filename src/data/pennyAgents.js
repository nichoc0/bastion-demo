// Agents used in the Penny run, with spawn order tied to the assessment
// timeline (`at` = index into PENNY_EVENTS) so the agent tree and the graph
// play back on the SAME clock. Roles: orchestrator · recon · attacker ·
// verifier · researcher. The orchestrator is always the root.
export const PENNY_AGENTS = [
  { id: 'orch',         role: 'orchestrator', name: 'Orchestrator',     parent: null,      at: 0,  summary: 'plans, routes, holds the chain' },
  { id: 'recon',        role: 'recon',        name: 'Surface map',      parent: 'orch',    at: 1,  summary: 'pulled the KMP bundle, mapped endpoints' },
  { id: 'res-px',       role: 'researcher',   name: 'PerimeterX',       parent: 'recon',   at: 2,  summary: 'X-PX mint + X-Pipeline gateway (not PX)' },
  { id: 'atk-bola',     role: 'attacker',     name: 'BOLA',             parent: 'orch',    at: 5,  summary: 'getOfferDetails unbound id → cross-object' },
  { id: 'verifier',     role: 'verifier',     name: 'Adjudicator',      parent: 'orch',    at: 6,  summary: 'each finding: real / dup / info / leverage' },
  { id: 'atk-inj',      role: 'attacker',     name: 'Injection',        parent: 'orch',    at: 9,  summary: 'findNeighborhoods leak + forged system turn' },
  { id: 'res-extract',  role: 'researcher',   name: 'Extraction',       parent: 'atk-inj', at: 11, summary: 'decompose-and-reassemble payloads' },
  { id: 'atk-dow',      role: 'attacker',     name: 'Denial-of-wallet', parent: 'orch',    at: 13, summary: 'unbounded generation → cost amplification' },
  { id: 'atk-voice',    role: 'attacker',     name: 'Voice',            parent: 'orch',    at: 16, summary: 'unauthenticated voice path (F2)' },
];

// roles carried by mono tags + structure, not colour. red is the one reserved
// accent (attacker nodes); everything else reads on a neutral scale.
export const ROLE = {
  orchestrator: { tag: 'ROOT',     accent: false },
  recon:        { tag: 'RECON',    accent: false },
  attacker:     { tag: 'ATTACKER', accent: true },
  verifier:     { tag: 'VERIFIER', accent: false },
  researcher:   { tag: 'RESEARCH', accent: false },
};
