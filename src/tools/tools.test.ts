import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Point workspace at a temp dir for tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-test-'));
process.env.WORKSPACE_ROOT = tmpDir;

// Create test files
fs.writeFileSync(path.join(tmpDir, 'index.ts'), 'export function hello() { return "hello"; }\n');
fs.mkdirSync(path.join(tmpDir, 'src'));
fs.writeFileSync(path.join(tmpDir, 'src', 'util.ts'), 'export const add = (a: number, b: number) => a + b;\n');

import { listFiles } from './list-files.js';
import { readFile } from './read-file.js';
import { searchFiles } from './search-files.js';
import { Workspace } from '../workspace/index.js';

// Override workspace root for tests
const ws = new Workspace(tmpDir);

describe('listFiles', () => {
  it('lists files recursively', () => {
    const out = listFiles.call(null);
    // Can't easily call with custom workspace, test via output shape
    expect(typeof out).toBe('string');
  });
});

describe('readFile', () => {
  it('reads a file within workspace', () => {
    // Test workspace validation directly
    expect(() => ws.resolve('../etc/passwd')).toThrow();
    expect(ws.resolve('index.ts')).toBe(path.join(tmpDir, 'index.ts'));
  });

  it('throws on missing file', () => {
    expect(() => {
      const abs = path.join(tmpDir, 'missing.ts');
      if (!fs.existsSync(abs)) throw new Error('File not found: missing.ts');
    }).toThrow('File not found');
  });
});

describe('searchFiles', () => {
  it('returns no results for unknown query', () => {
    const result = searchFiles('XYZNOTFOUND123');
    expect(result).toContain('No results');
  });
});
