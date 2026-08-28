import * as fs from 'fs';
import { workspace } from '../workspace/index.js';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE ?? '50000', 10);

export function readFile(relativePath: string): string {
  const abs = workspace.resolve(relativePath);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    throw new Error(`File not found: ${relativePath}`);
  }

  if (!stat.isFile()) {
    throw new Error(`Not a file: ${relativePath}`);
  }

  if (stat.size > MAX_FILE_SIZE) {
    return `[File too large: ${relativePath} is ${stat.size} bytes (limit ${MAX_FILE_SIZE}). Use search_files to find specific sections.]`;
  }

  return fs.readFileSync(abs, 'utf8');
}
