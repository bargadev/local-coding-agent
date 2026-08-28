import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';

const SYSTEM_PROMPT = 'You are a helpful software engineering assistant.';

function buildClient(): LLMClient {
  const backend = (process.env.AGENT_BACKEND ?? 'sonnet').toLowerCase();
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  if (backend === 'haiku' || backend === 'sonnet' || backend === 'opus') {
    return new ClaudeCLIClient(backend);
  }
  console.error(`Unknown AGENT_BACKEND "${backend}". Using sonnet.`);
  return new ClaudeCLIClient('sonnet');
}

export async function respond(prompt: string): Promise<string> {
  const llm = buildClient();
  const backend = process.env.AGENT_BACKEND ?? 'sonnet';
  process.stderr.write(`[${backend}] thinking...\n`);

  const response = await llm.chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  return response.content;
}
