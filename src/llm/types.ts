export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  done: boolean;
}

export interface LLMClient {
  chat(messages: Message[]): Promise<LLMResponse>;
}
