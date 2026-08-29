import { spawn } from 'child_process';
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
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');
    const prompt = userMessages.map((m) => m.content).join('\n\n');

    const args = ['-p', prompt, '--model', this.modelId];
    if (systemMsg) args.push('--system-prompt', systemMsg.content);

    const content = await new Promise<string>((resolve, reject) => {
      const proc = spawn('claude', args, { timeout: 120_000 });
      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      proc.stdout.on('data', (d: Buffer) => chunks.push(d));
      proc.stderr.on('data', (d: Buffer) => errChunks.push(d));

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`claude exited ${code}: ${Buffer.concat(errChunks).toString().trim()}`));
        } else {
          resolve(Buffer.concat(chunks).toString().trim());
        }
      });

      proc.on('error', reject);
    });

    const estimatedTokens = Math.round(content.split(/\s+/).length * 1.3);
    return { content, model: this.modelId, done: true, tokens: estimatedTokens };
  }
}
