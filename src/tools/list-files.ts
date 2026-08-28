import * as fs from 'fs';
import * as path from 'path';
import { workspace } from '../workspace/index.js';

const IGNORED = new Set([
  '.git', 'node_modules', 'dist', 'build', 'coverage',
  '.next', '.turbo', '.cache', '__pycache__', '.sessions',
]);

function walk(dir: string, root: string, lines: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const rel = path.relative(root, path.join(dir, entry.name));
    if (entry.isDirectory()) {
      lines.push(rel + '/');
      walk(path.join(dir, entry.name), root, lines);
    } else {
      lines.push(rel);
    }
  }
}

export function listFiles(relativePath = '.'): string {
  const abs = workspace.resolve(relativePath);
  const lines: string[] = [];
  walk(abs, workspace.root, lines);
  return lines.join('\n') || '(empty)';
}
