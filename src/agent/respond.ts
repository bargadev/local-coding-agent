import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';
import { Spinner } from '../cli/spinner.js';
import { runAgentLoop } from './loop.js';
import { saveSession } from '../session/index.js';

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

    const start = Date.now();
    let content: string;
    let iterations = 1;
    let toolCallCount = 0;

    if (useLoop) {
      spinner.stop();
      const result = await runAgentLoop(prompt, llm);
      process.stderr.write(`  [${result.iterations} iterations, ${result.toolCalls} tool calls]\n`);
      content = result.response;
      iterations = result.iterations;
      toolCallCount = result.toolCalls;
    } else {
      const response = await llm.chat([
        { role: 'system', content: 'You are a helpful software engineering assistant.' },
        { role: 'user', content: prompt },
      ]);
      spinner.stop(response.tokens, isLocal);
      content = response.content;
    }

    try {
      saveSession({
        prompt,
        backend,
        iterations,
        toolCalls: [],
        finalResponse: content,
        durationMs: Date.now() - start,
      });
    } catch { /* session save failure is non-fatal */ }

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
