import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';

const SYSTEM_PROMPT = 'You are a helpful software engineering assistant.';

function buildClient(backend: Backend): LLMClient {
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  return new ClaudeCLIClient(backend);
}

export async function respond(prompt: string): Promise<string> {
  const { backend, reason } = await routeTask(prompt);

  process.stderr.write(`[${backend}] (${reason})\n`);

  const llm = buildClient(backend);

  try {
    const response = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
    return response.content;
  } catch (err) {
    // Failover: if local fails, try haiku
    if (backend === 'local') {
      process.stderr.write(`[local] failed — falling back to haiku\n`);
      const fallback = new ClaudeCLIClient('haiku');
      const response = await fallback.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]);
      return response.content;
    }
    throw err;
  }
}
