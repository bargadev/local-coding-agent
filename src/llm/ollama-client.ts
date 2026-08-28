import type { LLMClient, LLMResponse, Message } from './types.js';

interface OllamaConfig {
  url: string;
  model: string;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

export class OllamaLLMClient implements LLMClient {
  private url: string;
  private model: string;

  constructor(config: OllamaConfig) {
    this.url = config.url.replace(/\/$/, '');
    this.model = config.model;
  }

  async chat(messages: Message[]): Promise<LLMResponse> {
    const res = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as OllamaChatResponse;

    return {
      content: data.message.content,
      model: data.model,
      done: data.done,
    };
  }

  static fromEnv(): OllamaLLMClient {
    return new OllamaLLMClient({
      url: process.env.OLLAMA_URL ?? 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:3b',
    });
  }
}
