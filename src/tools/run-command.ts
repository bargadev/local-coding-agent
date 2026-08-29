import { execSync } from 'child_process';
import * as path from 'path';
import { workspace } from '../workspace/index.js';

// Resolve lakonai bin from local node_modules, fallback to global PATH.
const LAKONAI_BIN = path.join(__dirname, '../../node_modules/.bin/lakonai');

const COMMAND_TIMEOUT = parseInt(process.env.COMMAND_TIMEOUT ?? '120000', 10);

// Commands blocked regardless of arguments
const BLOCKED_PATTERNS = [
  /\bgit\s+push\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+.*-f/,
  /\brm\s+-rf\s+\//,
  /\bsudo\b/,
  /\bchmod\s+777\b/,
  /\bcurl\b.*\|\s*bash/,
  /\bwget\b.*\|\s*bash/,
  /\b(dd|mkfs|fdisk)\b/,
  />\s*\/dev\/(sd|nvme|disk)/,
];

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export function guardCommand(command: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Command blocked by security policy: ${command}`);
    }
  }
}

export function runCommand(command: string): CommandResult {
  guardCommand(command);

  const start = Date.now();
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    stdout = execSync(`"${LAKONAI_BIN}" ${command}`, {
      cwd: workspace.root,
      encoding: 'utf8',
      timeout: COMMAND_TIMEOUT,
      maxBuffer: 5 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number; message?: string };
    stdout = e.stdout ?? '';
    stderr = e.stderr ?? e.message ?? '';
    exitCode = e.status ?? 1;
  }

  return {
    command,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
    durationMs: Date.now() - start,
  };
}
