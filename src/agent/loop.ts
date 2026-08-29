import type { LLMClient, Message, ProgressCallback, TokenUsage } from '../llm/index.js';
import { emptyUsage, totalTokens } from '../llm/index.js';
import { parseToolCall, executeTool } from '../tools/registry.js';
import { buildSystemPrompt } from './system-prompt.js';
import { C } from '../cli/spinner.js';

const MAX_ITERATIONS = parseInt(process.env.MAX_AGENT_ITERATIONS ?? '30', 10);

export interface AgentResult {
  response: string;
  iterations: number;
  toolCalls: number;
  tokens: number;       // total tokens (input + output) across all iterations
  usage: TokenUsage;    // full breakdown, summed over every iteration
  hitLimit: boolean;    // true = ran out of iterations without converging
}

export async function runAgentLoop(
  task: string,
  llm: LLMClient,
  onProgress?: ProgressCallback,
): Promise<AgentResult> {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(task) },
    { role: 'user', content: task },
  ];

  const NUDGE_BUDGET = 2; // times we push a "you didn't edit anything" reminder before giving up
  let iterations = 0;
  let toolCalls = 0;
  let writes = 0;         // number of write_file calls
  let nudges = 0;
  // Every iteration re-sends the whole message history, so input tokens accumulate
  // hard — this sum is the real cost, not the final message's word count.
  const usage = emptyUsage();

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const soFar = totalTokens(usage);
    const response = await llm.chat(
      messages,
      onProgress ? (t) => onProgress(soFar + t) : undefined,
    );
    if (response.usage) {
      usage.input += response.usage.input;
      usage.output += response.usage.output;
      usage.cacheRead += response.usage.cacheRead;
      usage.cacheCreation += response.usage.cacheCreation;
    }
    const content = response.content;

    // Check every line for a tool call
    const lines = content.split('\n');
    let toolCallFound = false;

    for (const line of lines) {
      const call = parseToolCall(line);
      if (!call) continue;

      toolCallFound = true;
      toolCalls++;
      if (call.tool === 'write_file') writes++;

      const argStr = Object.entries(call.args).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(', ');
      process.stdout.write(`${C.dim}  └ ${call.tool}(${argStr})${C.reset}\n`);
      const result = executeTool(call);
      const resultPreview = result.split('\n')[0].slice(0, 80);
      process.stdout.write(`${C.dim}    ${resultPreview}${result.length > 80 ? '…' : ''}${C.reset}\n`);

      messages.push({ role: 'assistant', content });

      // If a command failed, nudge the agent to fix it
      let toolResultMsg = `Tool result for ${call.tool}:\n${result}`;
      if (call.tool === 'run_command' && result.includes('exit: 1')) {
        toolResultMsg += '\n\nTests or command failed. Analyze the error above, fix the code with write_file, and run the tests again.';
      }

      messages.push({ role: 'user', content: toolResultMsg });
      break; // one tool call per turn
    }

    if (!toolCallFound) {
      // The model tried to finish. If it never actually edited a file, it likely
      // just inspected the code and declared success (common with small models) —
      // push back and give it another shot before accepting the answer.
      if (writes === 0 && nudges < NUDGE_BUDGET) {
        nudges++;
        process.stdout.write(`${C.dim}  ↺ no file edited yet — asking the model to make the change${C.reset}\n`);
        messages.push({ role: 'assistant', content });
        messages.push({
          role: 'user',
          content:
            'You have not modified any file yet — reading code or running tests is not enough. ' +
            'If the task requires changing code, make the edit NOW with write_file, passing the full new file content. ' +
            'Then run the tests. If no code change is genuinely needed, state that explicitly and why.',
        });
        continue;
      }
      // No tool call = final response
      return { response: content, iterations, toolCalls, tokens: totalTokens(usage), usage, hitLimit: false };
    }
  }

  return {
    response: `Agent reached iteration limit (${MAX_ITERATIONS}). Last response may be incomplete.`,
    iterations,
    toolCalls,
    tokens: totalTokens(usage),
    usage,
    hitLimit: true,
  };
}
