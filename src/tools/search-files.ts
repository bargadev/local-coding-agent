import * as fs from 'fs';
import * as path from 'path';
import { workspace } from '../workspace/index.js';

const IGNORED = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.turbo', '.cache', '__pycache__', '.sessions',
]);

const CONTEXT_LINES = 2;
const MAX_RESULTS = 50;

interface Match {
  file: string;
  line: number;
  content: string;
  context: string[];
}

function searchInFile(absPath: string, relPath: string, query: RegExp, results: Match[]): void {
  if (results.length >= MAX_RESULTS) return;

  let content: string;
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > 500_000) return; // skip huge files
    content = fs.readFileSync(absPath, 'utf8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!query.test(lines[i])) continue;
    if (results.length >= MAX_RESULTS) break;

    const start = Math.max(0, i - CONTEXT_LINES);
    const end = Math.min(lines.length - 1, i + CONTEXT_LINES);
    const context = lines.slice(start, end + 1).map(
      (l, idx) => `${start + idx + 1 === i + 1 ? '>' : ' '} ${start + idx + 1}: ${l}`,
    );

    results.push({ file: relPath, line: i + 1, content: lines[i], context });
  }
}

function walkSearch(dir: string, query: RegExp, results: Match[]): void {
  if (results.length >= MAX_RESULTS) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = workspace.relative(abs);

    if (entry.isDirectory()) {
      walkSearch(abs, query, results);
    } else {
      searchInFile(abs, rel, query, results);
    }
  }
}

export function searchFiles(query: string): string {
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const results: Match[] = [];
  walkSearch(workspace.root, regex, results);

  if (results.length === 0) return `No results for: ${query}`;

  return results
    .map((r) => `${r.file}:${r.line}\n${r.context.join('\n')}`)
    .join('\n\n');
}
