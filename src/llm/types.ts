export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  done: boolean;
  tokens?: number;      // output tokens (undefined = unknown)
  durationMs?: number;  // total time in ms
}

export interface LLMClient {
  chat(messages: Message[]): Promise<LLMResponse>;
}
