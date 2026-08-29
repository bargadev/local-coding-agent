import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { TokenUsage } from '../llm/index.js';
import { emptyUsage } from '../llm/index.js';

const SESSIONS_DIR = path.join(process.cwd(), '.sessions');

export interface ToolCallRecord {
  tool: string;
  args: Record<string, string>;
  result: string;
  timestamp: string;
}

export interface Session {
  id: string;
  createdAt: string;
  prompt: string;
  backend: string;
  iterations: number;
  toolCalls: ToolCallRecord[];
  finalResponse: string;
  durationMs: number;
  tokens: number;        // real total = input + output (+ cache); 0 for local (free)
  usage: TokenUsage;     // full breakdown
}

export interface TokenStats {
  claudeTokens: number;  // real tokens billed to Claude (paid backends)
  localTokens: number;   // tokens run on the free local model (the actual saving)
  claudeInput: number;
  claudeOutput: number;
  savedPct: number;      // share of all work that ran local (0–100)
  sessions: number;
}

function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

function generateId(): string {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `session-${ts}`;
}

export function saveSession(session: Omit<Session, 'id' | 'createdAt'>): string {
  ensureSessionsDir();
  const id = generateId();
  const full: Session = {
    id,
    createdAt: new Date().toISOString(),
    ...session,
  };
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(full, null, 2), 'utf8');
  return filePath;
}

export function listSessions(): Session[] {
  if (!fs.existsSync(SESSIONS_DIR)) return [];
  return fs
    .readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')) as Session);
}

export function getSession(id: string): Session | null {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Session;
}

// Aggregate real token cost across all saved sessions. Claude tokens are what you
// actually paid for; local tokens are what the free model handled — the saving.
export function sessionStats(): TokenStats {
  const stats: TokenStats = {
    claudeTokens: 0, localTokens: 0, claudeInput: 0, claudeOutput: 0, savedPct: 0, sessions: 0,
  };
  for (const s of listSessions()) {
    stats.sessions++;
    const u = s.usage ?? emptyUsage();
    if (s.backend === 'local') {
      stats.localTokens += s.tokens ?? (u.input + u.output);
    } else {
      stats.claudeTokens += s.tokens ?? (u.input + u.output);
      stats.claudeInput += u.input + u.cacheRead + u.cacheCreation;
      stats.claudeOutput += u.output;
    }
  }
  const total = stats.claudeTokens + stats.localTokens;
  stats.savedPct = total > 0 ? Math.round((stats.localTokens / total) * 100) : 0;
  return stats;
}
