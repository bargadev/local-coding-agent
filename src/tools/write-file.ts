import * as fs from 'fs';
import * as path from 'path';
import { workspace } from '../workspace/index.js';

export interface WriteResult {
  path: string;
  created: boolean; // false = overwritten
  bytes: number;
}

export function writeFile(relativePath: string, content: string): WriteResult {
  const abs = workspace.resolve(relativePath);
  const existed = fs.existsSync(abs);

  // Create parent directories if needed
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');

  return {
    path: relativePath,
    created: !existed,
    bytes: Buffer.byteLength(content, 'utf8'),
  };
}
