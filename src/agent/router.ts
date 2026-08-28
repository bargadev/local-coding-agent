export type Backend = 'local' | 'haiku' | 'sonnet' | 'opus';

// Prompts longer than this are never trivial (from llm-router research)
const MAX_TRIVIAL_LENGTH = 150;

// Layer 1: regex heuristics — handles ~70% of cases instantly
function classifyByRegex(prompt: string): Backend | null {
  const p = prompt.trim().toLowerCase();
  const len = p.length;

  // Architecture / design decisions → opus
  if (/\b(architect|architecture|design system|trade.?off|scalab|microservice|monolith|diagram)\b/.test(p)) {
    return 'opus';
  }

  // Short git/deploy coordination → haiku
  if (len < MAX_TRIVIAL_LENGTH && /\b(git push|git pull|deploy|release|publish|commit|merge|sync|rebase)\b/.test(p)) {
    return 'haiku';
  }

  // Very short factual question → local
  if (len < 60 && /\b(what is|what's|o que|explai?n|defin|meaning|significa)\b/.test(p)) {
    return 'local';
  }

  // Multi-file / full feature / tests → sonnet
  if (/\b(creat|add|implement|refactor|migrat|integrat|test|fix|bug|error|fail)\b/.test(p) && len > MAX_TRIVIAL_LENGTH) {
    return 'sonnet';
  }

  return null; // ambiguous → go to layer 2
}

// Layer 2: local LLM classifier via Ollama (free, ~1-2s)
async function classifyByLLM(prompt: string): Promise<Backend> {
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
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:3b-agent',
      prompt: classifyPrompt,
      stream: false,
      options: { num_predict: 5, temperature: 0 },
    }),
  });

  if (!res.ok) throw new Error(`Ollama ${res.status}`);

  const data = (await res.json()) as { response: string };
  const word = data.response.trim().toLowerCase().split(/\s+/)[0];

  if (word === 'local' || word === 'haiku' || word === 'sonnet' || word === 'opus') {
    return word;
  }

  return 'sonnet'; // safe default
}

async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function routeTask(prompt: string): Promise<{ backend: Backend; reason: string }> {
  // Manual override via env
  const override = process.env.AGENT_BACKEND?.toLowerCase();
  if (override && ['local', 'haiku', 'sonnet', 'opus'].includes(override)) {
    return { backend: override as Backend, reason: 'env override' };
  }

  // Layer 1: regex (instant)
  const regexResult = classifyByRegex(prompt);
  if (regexResult) {
    return { backend: regexResult, reason: 'regex heuristic' };
  }

  // Check Ollama availability for layer 2
  const ollamaUp = await isOllamaAvailable();
  if (!ollamaUp) {
    // Ollama offline → fallback to haiku
    return { backend: 'haiku', reason: 'ollama unavailable — fallback' };
  }

  // Layer 2: local LLM classifier
  try {
    const backend = await classifyByLLM(prompt);
    return { backend, reason: 'llm classifier' };
  } catch {
    return { backend: 'sonnet', reason: 'classifier error — fallback' };
  }
}
