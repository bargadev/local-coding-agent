import type { LLMClient, Message } from '../llm/index.js';
import { parseToolCall, executeTool } from '../tools/registry.js';
import { buildSystemPrompt } from './system-prompt.js';

const MAX_ITERATIONS = parseInt(process.env.MAX_AGENT_ITERATIONS ?? '30', 10);

export interface AgentResult {
  response: string;
  iterations: number;
  toolCalls: number;
}

export async function runAgentLoop(task: string, llm: LLMClient): Promise<AgentResult> {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: task },
  ];

  let iterations = 0;
  let toolCalls = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await llm.chat(messages);
    const content = response.content;

    // Check every line for a tool call
    const lines = content.split('\n');
    let toolCallFound = false;

    for (const line of lines) {
      const call = parseToolCall(line);
      if (!call) continue;

      toolCallFound = true;
      toolCalls++;

      process.stderr.write(`  → ${call.tool}(${JSON.stringify(call.args)})\n`);
      const result = executeTool(call);
      process.stderr.write(`  ← ${result.slice(0, 120)}${result.length > 120 ? '…' : ''}\n`);

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
      // No tool call = final response
      return { response: content, iterations, toolCalls };
    }
  }

  return {
    response: `Agent reached iteration limit (${MAX_ITERATIONS}). Last response may be incomplete.`,
    iterations,
    toolCalls,
  };
}
