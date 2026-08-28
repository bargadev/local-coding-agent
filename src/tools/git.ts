import { runCommand } from './run-command.js';

export function gitStatus(): string {
  const r = runCommand('git status --short');
  return r.stdout || '(clean)';
}

export function gitDiff(): string {
  const r = runCommand('git diff');
  return r.stdout || '(no changes)';
}
