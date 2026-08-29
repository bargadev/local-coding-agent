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

// Return the index of the '}' matching the '{' at `start`, respecting string
// literals and escapes; -1 if unbalanced. Lets us pull a JSON object out of a
// larger blob even when it spans multiple lines or contains braces in strings.
function matchBrace(s: string, start: number): number {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Find a tool-call JSON object anywhere in a model response. Robust to the call
// being multi-line (write_file content carries newlines), wrapped in ``` fences,
// or preceded by prose — the line-only parser missed all of those, which is why
// larger write_file calls silently failed and the task "made no edits".
export function parseToolCall(text: string): ToolCall | null {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    const end = matchBrace(text, i);
    if (end === -1) break; // no balanced object from here on
    try {
      const parsed = JSON.parse(text.slice(i, end + 1));
      if (parsed && typeof parsed.tool === 'string' && parsed.args && typeof parsed.args === 'object') {
        return { tool: parsed.tool, args: parsed.args };
      }
    } catch { /* not a valid object here — keep scanning */ }
  }
  return null;
}
