import { listFiles } from './list-files.js';
import { readFile } from './read-file.js';
import { searchFiles } from './search-files.js';
import { writeFile } from './write-file.js';
import { runCommand } from './run-command.js';
import { gitStatus, gitDiff, gitLog } from './git.js';

export interface ToolCall {
  tool: string;
  args: Record<string, string>;
}

type ToolFn = (args: Record<string, string>) => string;

const TOOLS: Record<string, ToolFn> = {
  list_files: (a) => listFiles(a.path),
  read_file: (a) => readFile(a.path),
  search_files: (a) => searchFiles(a.query),
  write_file: (a) => {
    const r = writeFile(a.path, a.content);
    return `${r.created ? 'Created' : 'Updated'} ${r.path} (${r.bytes} bytes)`;
  },
  run_command: (a) => {
    const r = runCommand(a.command);
    return [
      `$ ${r.command}`,
      r.stdout && `stdout:\n${r.stdout}`,
      r.stderr && `stderr:\n${r.stderr}`,
      `exit: ${r.exitCode} (${r.durationMs}ms)`,
    ].filter(Boolean).join('\n');
  },
  git_status: () => gitStatus(),
  git_diff: () => gitDiff(),
  git_log: (a) => gitLog(a.n ? parseInt(a.n) : 5),
};

export function executeTool(call: ToolCall): string {
  const fn = TOOLS[call.tool];
  if (!fn) return `Unknown tool: ${call.tool}`;
  try {
    return fn(call.args);
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// Parse a model response line for a tool call JSON
export function parseToolCall(line: string): ToolCall | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.tool === 'string' && typeof parsed.args === 'object') {
      return parsed as ToolCall;
    }
    return null;
  } catch {
    return null;
  }
}
