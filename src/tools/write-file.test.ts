import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Workspace } from '../workspace/index.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-write-test-'));

// Use workspace directly — don't rely on singleton for these tests
function writeFileIn(ws: Workspace, relativePath: string, content: string) {
  const abs = ws.resolve(relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const existed = fs.existsSync(abs);
  fs.writeFileSync(abs, content, 'utf8');
  return { path: relativePath, created: !existed, bytes: Buffer.byteLength(content, 'utf8') };
}

describe('writeFile', () => {
  const ws = new Workspace(tmpDir);

  it('creates a new file', () => {
    const r = writeFileIn(ws, 'hello.ts', 'export const x = 1;');
    expect(r.created).toBe(true);
    expect(fs.readFileSync(path.join(tmpDir, 'hello.ts'), 'utf8')).toBe('export const x = 1;');
  });

  it('overwrites existing file', () => {
    writeFileIn(ws, 'hello.ts', 'v1');
    const r = writeFileIn(ws, 'hello.ts', 'v2');
    expect(r.created).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, 'hello.ts'), 'utf8')).toBe('v2');
  });

  it('creates parent directories', () => {
    writeFileIn(ws, 'src/deep/nested/file.ts', 'const a = 1;');
    expect(fs.existsSync(path.join(tmpDir, 'src/deep/nested/file.ts'))).toBe(true);
  });

  it('blocks path traversal', () => {
    expect(() => ws.resolve('../escape.ts')).toThrow('escapes workspace');
  });

  it('reports byte size', () => {
    const r = writeFileIn(ws, 'sized.ts', 'hello');
    expect(r.bytes).toBe(5);
  });
});
