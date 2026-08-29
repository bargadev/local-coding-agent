export type Backend = 'local' | 'haiku' | 'sonnet' | 'opus';

export interface Route {
  backend: Backend;
  useTools: boolean; // true = run the agent loop (file/tool access), false = plain chat
  reason: string;
}

// Prompts longer than this are never trivial (from llm-router research)
const MAX_TRIVIAL_LENGTH = 150;

// Layer 1: regex heuristics — handles ~70% of cases instantly
function classifyByRegex(prompt: string): Omit<Route, 'reason'> | null {
  const p = prompt.trim().toLowerCase();
  const len = p.length;

  // Architecture / design decisions → opus (too hard for the local 3b, go straight to cloud)
  if (/\b(architect|architecture|design system|trade.?off|scalab|microservice|monolith|diagram)\b/.test(p)) {
    return { backend: 'opus', useTools: true };
  }

  // Short git/deploy coordination → haiku (no tools needed)
  if (len < MAX_TRIVIAL_LENGTH && /\b(git push|git pull|deploy|release|publish|commit|merge|sync|rebase)\b/.test(p)) {
    return { backend: 'haiku', useTools: false };
  }

  // Very short factual question → local, plain chat (no tools)
  if (len < 60 && /\b(what is|what's|o que|explai?n|defin|meaning|significa)\b/.test(p)) {
    return { backend: 'local', useTools: false };
  }

  // Real coding task → try the local model first with tools; respond() escalates to
  // sonnet if it can't converge. This is where the token savings come from.
  if (/\b(creat|add|implement|refactor|migrat|integrat|test|fix|bug|error|fail)\b/.test(p) && len > MAX_TRIVIAL_LENGTH) {
    return { backend: 'local', useTools: true };
  }

  return null; // ambiguous → go to layer 2
}

// Layer 2: local LLM classifier via Ollama (free, ~1-2s)
async function classifyByLLM(prompt: string): Promise<Omit<Route, 'reason'>> {
  const classifyPrompt = `You are a task router. Classify the following task into exactly one category.

Categories:
- local: trivial questions, quick definitions, single-file lookup
- haiku: simple explanations, boilerplate, small refactors, coordination
- sonnet: real coding tasks, bug fixes, new features, tests, multi-file changes
- opus: system architecture, complex design decisions, ambiguous requirements

Task: "${prompt}"

Reply with exactly one word (local, haiku, sonnet, or opus):`;

  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
      prompt: classifyPrompt,
      stream: false,
      options: { num_predict: 5, temperature: 0 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}`);

  const data = (await res.json()) as { response: string };
  const word = data.response.trim().toLowerCase().split(/\s+/)[0];

  // Coding-class work ("sonnet") is tried on the free local model first, with an
  // escalation to sonnet on failure — that's the whole savings play.
  switch (word) {
    case 'local':  return { backend: 'local',  useTools: false };
    case 'haiku':  return { backend: 'haiku',  useTools: false };
    case 'sonnet': return { backend: 'local',  useTools: true };
    case 'opus':   return { backend: 'opus',   useTools: true };
    default:       return { backend: 'local',  useTools: true }; // safe default: local + escalate
  }
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function routeTask(prompt: string): Promise<Route> {
  // Manual override via env
  const override = process.env.AGENT_BACKEND?.toLowerCase();
  if (override && ['local', 'haiku', 'sonnet', 'opus'].includes(override)) {
    const backend = override as Backend;
    // Cloud coding models and forced-local both get tools; haiku stays plain chat.
    const useTools = backend !== 'haiku';
    return { backend, useTools, reason: 'env override' };
  }

  // Layer 1: regex (instant)
  const regexResult = classifyByRegex(prompt);
  if (regexResult) {
    return { ...regexResult, reason: 'regex heuristic' };
  }

  // Check Ollama availability for layer 2
  const ollamaUp = await isOllamaAvailable();
  if (!ollamaUp) {
    // Ollama offline → can't classify or run local, fall back to haiku
    return { backend: 'haiku', useTools: false, reason: 'ollama unavailable — fallback' };
  }

  // Layer 2: local LLM classifier
  try {
    return { ...(await classifyByLLM(prompt)), reason: 'llm classifier' };
  } catch {
    return { backend: 'sonnet', useTools: true, reason: 'classifier error — fallback' };
  }
}
