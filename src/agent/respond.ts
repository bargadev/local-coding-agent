import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';
import { Spinner, C } from '../cli/spinner.js';
import { runAgentLoop } from './loop.js';
import { saveSession } from '../session/index.js';

// Backends that support the agent loop (tool calling via JSON in text)
const AGENT_BACKENDS: Backend[] = ['sonnet', 'opus'];

function buildClient(backend: Backend): LLMClient {
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  return new ClaudeCLIClient(backend);
}

export interface AgentResponse {
  content: string;
  elapsedSec: number;
  verb: string;
  tokens: number;
  isLocal: boolean;
}

export async function respond(prompt: string): Promise<AgentResponse> {
  // Start the spinner immediately so it appears the instant Enter is pressed,
  // before the routing decision (which may block on a network call).
  const spinner = new Spinner('routing');
  spinner.start();

  const { backend } = await routeTask(prompt);
  const isLocal = backend === 'local';
  const useLoop = AGENT_BACKENDS.includes(backend);

  try {
    const llm = buildClient(backend);
    const start = Date.now();
    let content: string;
    let iterations = 1;
    let tokens = 0;

    if (useLoop) {
      const result = await runAgentLoop(prompt, llm);
      const { elapsedSec, verb } = spinner.stop();
      tokens = Math.round(result.response.split(/\s+/).length * 1.3);
      content = result.response;
      iterations = result.iterations;
      try {
        saveSession({ prompt, backend, iterations, toolCalls: [], finalResponse: content, durationMs: Date.now() - start });
      } catch { /* non-fatal */ }
      return { content, elapsedSec, verb, tokens, isLocal };
    } else {
      const response = await llm.chat([
        { role: 'system', content: 'You are a helpful software engineering assistant.' },
        { role: 'user', content: prompt },
      ]);
      const { elapsedSec, verb } = spinner.stop();
      tokens = response.tokens ?? 0;
      content = response.content;
      try {
        saveSession({ prompt, backend, iterations, toolCalls: [], finalResponse: content, durationMs: Date.now() - start });
      } catch { /* non-fatal */ }
      return { content, elapsedSec, verb, tokens, isLocal };
    }
  } catch (err) {
    if (isLocal) {
      spinner.stop();
      process.stdout.write(`${C.yellow}⚠${C.reset} local failed — falling back to haiku\n`);
      const spinner2 = new Spinner('haiku');
      spinner2.start();
      const fallback = new ClaudeCLIClient('haiku');
      const r = await fallback.chat([
        { role: 'system', content: 'You are a helpful software engineering assistant.' },
        { role: 'user', content: prompt },
      ]);
      const { elapsedSec, verb } = spinner2.stop();
      return { content: r.content, elapsedSec, verb, tokens: r.tokens ?? 0, isLocal: false };
    }
    spinner.stop();
    throw err;
  }
}
