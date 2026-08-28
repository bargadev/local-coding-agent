import * as path from 'path';
import * as fs from 'fs';

// Directories never exposed to the agent
const BLOCKED_DIRS = [
  '/etc', '/root', '/var', '/sys', '/proc',
  '/private/etc', '/private/var',
];

const SENSITIVE_PATTERNS = [
  /\.ssh/i, /\.gnupg/i, /\.aws/i, /\.env$/,
  /id_rsa/, /id_ed25519/, /credentials/i,
];

export class Workspace {
  readonly root: string;

  constructor(root?: string) {
    this.root = path.resolve(root ?? process.cwd());
  }

  // Resolve a relative path and verify it stays inside the workspace
  resolve(relativePath: string): string {
    const resolved = path.resolve(this.root, relativePath);

    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw new Error(`Path escapes workspace: ${relativePath}`);
    }

    for (const blocked of BLOCKED_DIRS) {
      if (resolved.startsWith(blocked)) {
        throw new Error(`Path points to blocked directory: ${resolved}`);
      }
    }

    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(resolved)) {
        throw new Error(`Path matches sensitive pattern: ${resolved}`);
      }
    }

    return resolved;
  }

  // Return path relative to workspace root for display
  relative(absolutePath: string): string {
    return path.relative(this.root, absolutePath);
  }

  exists(relativePath: string): boolean {
    try {
      return fs.existsSync(this.resolve(relativePath));
    } catch {
      return false;
    }
  }
}

// Singleton — always points to cwd where `agent` was invoked
export const workspace = new Workspace();
