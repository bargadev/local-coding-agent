import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
