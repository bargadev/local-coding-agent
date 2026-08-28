import { describe, it, expect } from 'vitest';
import { Workspace } from './index.js';

const ws = new Workspace('/tmp/test-workspace');

describe('Workspace', () => {
  it('resolves valid relative path', () => {
    expect(ws.resolve('src/index.ts')).toBe('/tmp/test-workspace/src/index.ts');
  });

  it('resolves dot (root itself)', () => {
    expect(ws.resolve('.')).toBe('/tmp/test-workspace');
  });

  it('blocks path traversal (../)', () => {
    expect(() => ws.resolve('../etc/passwd')).toThrow('escapes workspace');
  });

  it('blocks absolute path outside workspace', () => {
    expect(() => ws.resolve('/etc/passwd')).toThrow();
  });

  it('blocks /etc directly', () => {
    expect(() => ws.resolve('/etc/hosts')).toThrow();
  });

  it('blocks .ssh paths', () => {
    expect(() => ws.resolve('.ssh/id_rsa')).toThrow('sensitive pattern');
  });

  it('blocks .env files', () => {
    expect(() => ws.resolve('secrets/.env')).toThrow('sensitive pattern');
  });

  it('blocks deep traversal', () => {
    expect(() => ws.resolve('src/../../../../../../etc/passwd')).toThrow();
  });
});
