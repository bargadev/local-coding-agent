import { spawn } from 'child_process';
import type { LLMClient, LLMResponse, Message, ProgressCallback, TokenUsage } from './types.js';
import { emptyUsage, totalTokens } from './types.js';

// The claude CLI emits plain text, not token counts, so estimate from word count.
const estimateTokens = (text: string): number =>
  Math.round(text.split(/\s+/).filter(Boolean).length * 1.3);

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

  async chat(messages: Message[], onProgress?: ProgressCallback): Promise<LLMResponse> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');
    const prompt = userMessages.map((m) => m.content).join('\n\n');

    // stream-json + partial messages makes the CLI emit text deltas in realtime,
    // so the live token counter climbs instead of sitting frozen until the end.
    const args = [
      '-p', prompt,
      '--model', this.modelId,
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--verbose',
    ];
    if (systemMsg) args.push('--system-prompt', systemMsg.content);

    return new Promise<LLMResponse>((resolve, reject) => {
      const proc = spawn('claude', args, { timeout: 120_000 });
      const errChunks: Buffer[] = [];
      let buffer = '';
      let text = '';                 // accumulated from streamed deltas
      let finalText: string | null = null;  // authoritative full text from the result event
      let usage: TokenUsage | null = null;   // authoritative input+output from usage

      const handleEvent = (evt: any): void => {
        // Realtime text deltas (from --include-partial-messages)
        if (evt.type === 'stream_event' && evt.event?.type === 'content_block_delta') {
          const delta = evt.event.delta?.text ?? evt.event.delta?.partial_json ?? '';
          if (delta) {
            text += delta;
            onProgress?.(estimateTokens(text));
          }
        }
        // Final result: authoritative full text + real token usage (input + output)
        if (evt.type === 'result') {
          if (typeof evt.result === 'string') finalText = evt.result;
          const u = evt.usage;
          if (u) {
            usage = {
              input: u.input_tokens ?? 0,
              output: u.output_tokens ?? 0,
              cacheRead: u.cache_read_input_tokens ?? 0,
              cacheCreation: u.cache_creation_input_tokens ?? 0,
            };
            onProgress?.(totalTokens(usage)); // jump the live counter to the real total
          }
        }
      };

      proc.stdout.on('data', (d: Buffer) => {
        buffer += d.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep trailing partial line
        for (const line of lines) {
          if (!line.trim()) continue;
          try { handleEvent(JSON.parse(line)); } catch { /* skip non-JSON noise */ }
        }
      });
      proc.stderr.on('data', (d: Buffer) => errChunks.push(d));

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`claude exited ${code}: ${Buffer.concat(errChunks).toString().trim()}`));
          return;
        }
        const content = (finalText ?? text).trim();
        const u = usage ?? { ...emptyUsage(), output: estimateTokens(content) };
        resolve({
          content,
          model: this.modelId,
          done: true,
          tokens: totalTokens(u),
          usage: u,
        });
      });

      proc.on('error', reject);
    });
  }
}
