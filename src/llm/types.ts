export type Role = 'system' | 'user' | 'assistant';

export interface Message {
  role: Role;
  content: string;
}

export interface TokenUsage {
  input: number;         // prompt / context tokens billed (non-cached)
  output: number;        // generated tokens
  cacheRead: number;     // tokens read from prompt cache (cheap, still processed)
  cacheCreation: number; // tokens written to prompt cache
}

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
}

// Total tokens actually processed by the model — the real cost, input + output.
export function totalTokens(u: TokenUsage): number {
  return u.input + u.output + u.cacheRead + u.cacheCreation;
}

export interface LLMResponse {
  content: string;
  model: string;
  done: boolean;
  tokens?: number;      // total billed = input + output + cache (undefined = unknown)
  usage?: TokenUsage;   // full breakdown when the backend reports it
  durationMs?: number;  // total time in ms
}

// Called with the running output-token count as generation streams in.
export type ProgressCallback = (tokens: number) => void;

export interface LLMClient {
  chat(messages: Message[], onProgress?: ProgressCallback): Promise<LLMResponse>;
}
