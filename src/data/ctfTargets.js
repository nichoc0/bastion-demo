// Sandbox targets — real, public OSS/AI CTFs. Safe, legal practice range: point
// the harness at a CTF instead of a live bounty target. Each links to its source.
export const CTF_TARGETS = [
  { id: 'gandalf',     name: 'Lakera Gandalf',      kind: 'prompt-injection ladder', src: 'gandalf.lakera.ai',  url: 'https://gandalf.lakera.ai' },
  { id: 'hackaprompt', name: 'HackAPrompt',         kind: 'prompt-injection comp.',   src: 'hackaprompt.com',    url: 'https://www.hackaprompt.com' },
  { id: 'tensortrust', name: 'Tensor Trust',        kind: 'attack/defend LLM',        src: 'tensortrust.ai',     url: 'https://tensortrust.ai' },
  { id: 'promptair',   name: 'Prompt Airlines',     kind: 'AI agent CTF (Wiz)',       src: 'promptairlines.com', url: 'https://www.promptairlines.com' },
  { id: 'doublespeak', name: 'Doublespeak',         kind: 'jailbreak CTF',            src: 'doublespeak.chat',   url: 'https://doublespeak.chat' },
  { id: 'dvla',        name: 'Damn Vulnerable LLM Agent', kind: 'tool-abuse / agent', src: 'github · WithSecure', url: 'https://github.com/WithSecureLabs/damn-vulnerable-llm-agent' },
  { id: 'aigoat',      name: 'AI Goat',             kind: 'vulnerable LLM app',       src: 'github · dhammon',   url: 'https://github.com/dhammon/ai-goat' },
  { id: 'pswigger',    name: 'PortSwigger LLM labs', kind: 'web LLM attacks',          src: 'portswigger.net',    url: 'https://portswigger.net/web-security/llm-attacks' },
];
