import type { LLMClient, LLMResponse, Message, ProgressCallback } from './types.js';
import { emptyUsage, totalTokens } from './types.js';

interface OllamaConfig {
  url: string;
  model: string;
}

interface OllamaChatResponse {
  model: string;
  message?: { role: string; content: string };
  done: boolean;
  eval_count?: number;         // output tokens
  prompt_eval_count?: number;  // input (prompt) tokens
  eval_duration?: number;
  total_duration?: number;
}

export class OllamaLLMClient implements LLMClient {
  private url: string;
  private model: string;

  constructor(config: OllamaConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.model = config.model;
  }

  async chat(messages: Message[], onProgress?: ProgressCallback): Promise<LLMResponse> {
    const res = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const text = res.ok ? 'no response body' : await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let tokens = 0;           // running estimate: one streamed chunk ≈ one token
    let model = this.model;
    let totalDuration: number | undefined;
    const usage = emptyUsage();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep trailing partial line for next read

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChatResponse;
        if (chunk.message?.content) {
          content += chunk.message.content;
          tokens++;
          onProgress?.(tokens);
        }
        if (chunk.done) {
          if (chunk.eval_count) tokens = chunk.eval_count; // authoritative final count
          if (chunk.model) model = chunk.model;
          totalDuration = chunk.total_duration;
          usage.input = chunk.prompt_eval_count ?? 0;
          usage.output = chunk.eval_count ?? tokens;
          onProgress?.(tokens);
        }
      }
    }

    return {
      content,
      model,
      done: true,
      tokens: totalTokens(usage) || tokens,
      usage,
      durationMs: totalDuration ? Math.round(totalDuration / 1e6) : undefined,
    };
  }

  static fromEnv(): OllamaLLMClient {
    return new OllamaLLMClient({
      url: process.env.OLLAMA_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b',
    });
  }
}
