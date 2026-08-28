import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';
import { Spinner } from '../cli/spinner.js';

const SYSTEM_PROMPT = 'You are a helpful software engineering assistant.';

function buildClient(backend: Backend): LLMClient {
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  return new ClaudeCLIClient(backend);
}

export async function respond(prompt: string): Promise<string> {
  const { backend, reason } = await routeTask(prompt);
  const isLocal = backend === 'local';

  const spinner = new Spinner(`${backend} · ${reason}`);
  spinner.start();

  try {
    const llm = buildClient(backend);
    const response = await llm.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
    spinner.stop(response.tokens, isLocal);
    return response.content;
  } catch (err) {
    if (isLocal) {
      spinner.stop(undefined, false);
      process.stderr.write(`[local] failed — falling back to haiku\n`);
      const spinner2 = new Spinner('haiku · fallback');
      spinner2.start();
      const fallback = new ClaudeCLIClient('haiku');
      const response = await fallback.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ]);
      spinner2.stop(response.tokens, false);
      return response.content;
    }
    spinner.stop();
    throw err;
  }
}
