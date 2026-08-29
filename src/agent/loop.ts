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

  const NUDGE_BUDGET = 3; // times we push a "you didn't edit anything" reminder before giving up
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

    const call = parseToolCall(content);
    if (call) {
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
      } else if (call.tool === 'run_command' && writes === 0) {
        // Ran a command but hasn't edited anything — the classic "inspect and
        // declare done" trap. Redirect it to actually make the change.
        toolResultMsg += '\n\nNote: you have not edited any file yet. Running a command does not complete a task that asks you to change code. Read the target file if needed, then call write_file with the full new content.';
      }

      messages.push({ role: 'user', content: toolResultMsg });
      continue; // one tool call per turn
    }

    // The model tried to finish. If it never actually edited a file, it likely
    // just inspected the code and declared success (common with small models) —
    // push back with the concrete next step before accepting the answer.
    if (writes === 0 && nudges < NUDGE_BUDGET) {
      nudges++;
      process.stdout.write(`${C.dim}  ↺ no file edited yet — asking the model to make the change${C.reset}\n`);
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content:
          'You have NOT modified any file yet — reading or running tests does not complete the task. ' +
          'Do this now, one tool call at a time: (1) read_file the target file to get its exact current content, ' +
          '(2) write_file the same path with the COMPLETE updated content (the whole file, not a diff). ' +
          'Emit only the tool-call JSON. If no code change is genuinely needed, say so explicitly and why.',
      });
      continue;
    }
    // No tool call = final response
    return { response: content, iterations, toolCalls, tokens: totalTokens(usage), usage, hitLimit: false };
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
