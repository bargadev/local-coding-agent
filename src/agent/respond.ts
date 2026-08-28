import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';
import { Spinner } from '../cli/spinner.js';
import { runAgentLoop } from './loop.js';

// Backends that support the agent loop (tool calling via JSON in text)
const AGENT_BACKENDS: Backend[] = ['sonnet', 'opus'];

function buildClient(backend: Backend): LLMClient {
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  return new ClaudeCLIClient(backend);
}

export async function respond(prompt: string): Promise<string> {
  const { backend, reason } = await routeTask(prompt);
  const isLocal = backend === 'local';
  const useLoop = AGENT_BACKENDS.includes(backend);

  const spinner = new Spinner(`${backend} · ${reason}`);
  spinner.start();

  try {
    const llm = buildClient(backend);

    let content: string;
    if (useLoop) {
      spinner.stop();
      const result = await runAgentLoop(prompt, llm);
      process.stderr.write(`  [${result.iterations} iterations, ${result.toolCalls} tool calls]\n`);
      content = result.response;
    } else {
      const response = await llm.chat([
        { role: 'system', content: 'You are a helpful software engineering assistant.' },
        { role: 'user', content: prompt },
      ]);
      spinner.stop(response.tokens, isLocal);
      content = response.content;
    }

    return content;
  } catch (err) {
    if (isLocal) {
      spinner.stop();
      process.stderr.write(`[local] failed — falling back to haiku\n`);
      const spinner2 = new Spinner('haiku · fallback');
      spinner2.start();
      const fallback = new ClaudeCLIClient('haiku');
      const r = await fallback.chat([
        { role: 'system', content: 'You are a helpful software engineering assistant.' },
        { role: 'user', content: prompt },
      ]);
      spinner2.stop(r.tokens, false);
      return r.content;
    }
    spinner.stop();
    throw err;
  }
}
