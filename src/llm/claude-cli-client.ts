import { execSync } from 'child_process';
import type { LLMClient, LLMResponse, Message } from './types.js';

export type ClaudeModel = 'haiku' | 'sonnet' | 'opus';

const MODEL_IDS: Record<ClaudeModel, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-5',
};

export class ClaudeCLIClient implements LLMClient {
  private modelId: string;

  constructor(model: ClaudeModel = 'sonnet') {
    this.modelId = MODEL_IDS[model];
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    // Build a single prompt from messages
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const prompt = userMessages.map((m) => m.content).join('\n\n');

    const args = ['-p', prompt, '--model', this.modelId];
    if (systemMsg) {
      args.push('--system-prompt', systemMsg.content);
    }

    const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    const output = execSync(`claude ${escaped}`, {
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const content = output.trim();
    // Claude CLI doesn't expose token counts — estimate from word count
    const estimatedTokens = Math.round(content.split(/\s+/).length * 1.3);
    return {
      content,
      model: this.modelId,
      done: true,
      tokens: estimatedTokens,
    };
  }
}
