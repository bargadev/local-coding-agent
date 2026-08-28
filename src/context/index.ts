import * as fs from 'fs';
import * as path from 'path';
import { workspace } from '../workspace/index.js';
import { searchFiles } from '../tools/search-files.js';

const MAX_CONTEXT_FILES = parseInt(process.env.MAX_CONTEXT_FILES ?? '30', 10);
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '50000', 10);

const IGNORED = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.turbo', '.cache', '__pycache__', '.sessions',
]);

const PRIORITY_FILES = [
  'package.json', 'tsconfig.json', 'README.md', 'pyproject.toml',
  'Cargo.toml', 'go.mod', 'composer.json', '.env.example',
];

interface ScoredFile {
  path: string;
  score: number;
}

function getAllFiles(dir: string, results: string[] = []): string[] {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const e of entries) {
    if (IGNORED.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) getAllFiles(abs, results);
    else results.push(abs);
  }
  return results;
}

function scoreFile(absPath: string, keywords: string[]): number {
  const rel = workspace.relative(absPath);
  const name = path.basename(absPath);
  let score = 0;

  if (PRIORITY_FILES.includes(name)) score += 10;

  const lowerRel = rel.toLowerCase();
  for (const kw of keywords) {
    if (lowerRel.includes(kw.toLowerCase())) score += 5;
  }

  // Prefer source files over config/lock files
  if (/\.(ts|js|py|go|rs|java|cpp|c)$/.test(name)) score += 2;
  if (/\.(lock|log|map|min\.)/.test(name)) score -= 5;

  return score;
}

export function buildContext(task: string): string {
  const keywords = task
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 10);

  const allFiles = getAllFiles(workspace.root);
  const scored: ScoredFile[] = allFiles
    .map((f) => ({ path: f, score: scoreFile(f, keywords) }))
    .filter((f) => f.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_FILES);

  const parts: string[] = [`Workspace: ${workspace.root}\n`];

  // File tree (always included)
  parts.push('## Project structure\n```');
  parts.push(scored.map((f) => workspace.relative(f.path)).join('\n'));
  parts.push('```\n');

  // Search results for keywords
  if (keywords.length > 0) {
    const searchQuery = keywords.slice(0, 3).join('|');
    try {
      const hits = searchFiles(searchQuery);
      if (!hits.startsWith('No results')) {
        parts.push(`## Search results for "${searchQuery}"\n${hits.slice(0, 2000)}\n`);
      }
    } catch { /* ignore */ }
  }

  return parts.join('\n');
}

export function readContextFiles(filePaths: string[]): string {
  const parts: string[] = [];
  for (const rel of filePaths.slice(0, MAX_CONTEXT_FILES)) {
    try {
      const abs = workspace.resolve(rel);
      const stat = fs.statSync(abs);
      if (stat.size > MAX_FILE_SIZE) {
        parts.push(`## ${rel}\n[File too large — ${stat.size} bytes]\n`);
        continue;
      }
      const content = fs.readFileSync(abs, 'utf8');
      parts.push(`## ${rel}\n\`\`\`\n${content}\n\`\`\`\n`);
    } catch { /* skip inaccessible files */ }
  }
  return parts.join('\n');
}
