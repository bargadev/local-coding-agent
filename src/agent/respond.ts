import { OllamaLLMClient, ClaudeCLIClient } from '../llm/index.js';
import type { LLMClient, TokenUsage } from '../llm/index.js';
import { emptyUsage } from '../llm/index.js';
import { routeTask } from './router.js';
import type { Backend } from './router.js';
import { Spinner, C } from '../cli/spinner.js';
import { runAgentLoop } from './loop.js';
import { saveSession } from '../session/index.js';
import { gitSnapshot } from '../tools/git.js';

const SYSTEM_CHAT = 'You are a helpful software engineering assistant.';

// Working-tree status, or null when not in a git repo (so we can't use it as a signal).
function repoStatus(): string | null {
  try {
    const snap = gitSnapshot();
    return snap.branch === 'unknown' ? null : snap.status;
  } catch {
    return null;
  }
}

function buildClient(backend: Backend): LLMClient {
  if (backend === 'local') return OllamaLLMClient.fromEnv();
  return new ClaudeCLIClient(backend);
}

export interface AgentResponse {
  content: string;
  elapsedSec: number;
  verb: string;
  tokens: number;      // real total = input + output (+ cache)
  usage: TokenUsage;   // breakdown for the display / accounting
  isLocal: boolean;
}

interface Outcome {
  content: string;
  tokens: number;
  usage: TokenUsage;
  iterations: number;
  toolCalls: number;
  hitLimit: boolean;
}

// Run one backend, either through the agent loop (tools) or as a plain chat.
async function runBackend(
  backend: Backend,
  useTools: boolean,
  prompt: string,
  spinner: Spinner,
): Promise<Outcome> {
  const llm = buildClient(backend);
  if (useTools) {
    const r = await runAgentLoop(prompt, llm, (t) => spinner.setTokens(t));
    return { content: r.response, tokens: r.tokens, usage: r.usage, iterations: r.iterations, toolCalls: r.toolCalls, hitLimit: r.hitLimit };
  }
  const r = await llm.chat(
    [{ role: 'system', content: SYSTEM_CHAT }, { role: 'user', content: prompt }],
    (t) => spinner.setTokens(t),
  );
  return { content: r.content, tokens: r.tokens ?? 0, usage: r.usage ?? emptyUsage(), iterations: 1, toolCalls: 0, hitLimit: false };
}

// Polish the final answer with a second pass through the same backend. Non-fatal:
// if the pass fails, keep the original content so a bad enhance never loses the
// real answer. Returns the enhance call's own usage so accounting stays honest.
async function enhanceResponse(
  llm: LLMClient,
  content: string,
): Promise<{ content: string; usage: TokenUsage; tokens: number }> {
  const spinner = new Spinner('enhancing');
  spinner.start();
  try {
    const enhanced = await llm.chat(
      [{ role: 'system', content: SYSTEM_CHAT }, { role: 'user', content }],
      (t: number) => spinner.setTokens(t),
    );
    spinner.stop();
    return { content: enhanced.content, usage: enhanced.usage ?? emptyUsage(), tokens: enhanced.tokens ?? 0 };
  } catch {
    spinner.stop();
    return { content, usage: emptyUsage(), tokens: 0 };
  }
}

export async function respond(prompt: string): Promise<AgentResponse> {
  const start = Date.now();
  // Start the spinner immediately so it appears the instant Enter is pressed,
  // before the routing decision (which may block on a network call).
  let spinner = new Spinner('routing');
  spinner.start();

  const route = await routeTask(prompt);
  const isLocal = route.backend === 'local';

  const finish = (backend: Backend, wasLocal: boolean, out: Outcome, elapsedSec: number, verb: string): AgentResponse => {
    try {
      saveSession({
        prompt, backend, iterations: out.iterations, toolCalls: [],
        finalResponse: out.content, durationMs: Date.now() - start, tokens: out.tokens, usage: out.usage,
      });
    } catch { /* non-fatal */ }
    return { content: out.content, elapsedSec, verb, tokens: out.tokens, usage: out.usage, isLocal: wasLocal };
  };

  // Local couldn't do it → escalate to sonnet (with tools). Only pay for cloud when
  // the free model actually fails, so successes stay free.
  const escalateToSonnet = async (why: string): Promise<AgentResponse> => {
    spinner.stop();
    process.stdout.write(`${C.yellow}⚠${C.reset} local ${why} — escalating to sonnet
`);
    spinner = new Spinner('sonnet');
    spinner.start();
    const out = await runBackend('sonnet', true, prompt, spinner);
    const { elapsedSec, verb } = spinner.stop();
    return finish('sonnet', false, out, elapsedSec, verb);
  };

  // Snapshot the tree so we can tell whether a local coding run actually edited
  // anything (a small model often claims success in prose while changing nothing).
  const beforeStatus = isLocal && route.useTools ? repoStatus() : null;

  try {
    const out = await runBackend(route.backend, route.useTools, prompt, spinner);
    if (isLocal && route.useTools) {
      const noEdits =
        out.toolCalls === 0 ||
        (beforeStatus !== null && repoStatus() === beforeStatus);
      if (out.hitLimit || noEdits) {
        const why = out.hitLimit ? 'hit the iteration limit' : 'made no edits';
        return await escalateToSonnet(why);
      }
    }
    const { elapsedSec, verb } = spinner.stop();
    const enhanced = await enhanceResponse(buildClient(route.backend), out.content);
    const merged: Outcome = {
      ...out,
      content: enhanced.content,
      tokens: out.tokens + enhanced.tokens,
      usage: {
        input: out.usage.input + enhanced.usage.input,
        output: out.usage.output + enhanced.usage.output,
        cacheRead: out.usage.cacheRead + enhanced.usage.cacheRead,
        cacheCreation: out.usage.cacheCreation + enhanced.usage.cacheCreation,
      },
    };
    return finish(route.backend, isLocal, merged, elapsedSec, verb);
  } catch (err) {
    if (isLocal) {
      return await escalateToSonnet('failed');
    }
    spinner.stop();
    throw err;
  }
}
