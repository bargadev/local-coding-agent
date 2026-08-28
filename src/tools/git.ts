import { runCommand } from './run-command.js';

export function gitStatus(): string {
  const r = runCommand('git status --short');
  return r.stdout || '(clean)';
}

export function gitDiff(): string {
  const r = runCommand('git diff');
  return r.stdout || '(no changes)';
}

export function gitLog(n = 5): string {
  const r = runCommand(`git log --oneline -${n}`);
  return r.stdout || '(no commits)';
}

export interface GitSnapshot {
  status: string;
  branch: string;
}

export function gitSnapshot(): GitSnapshot {
  const status = runCommand('git status --short').stdout || '(clean)';
  const branch = runCommand('git rev-parse --abbrev-ref HEAD').stdout || 'unknown';
  return { status, branch };
}

export function formatGitSummary(before: GitSnapshot): string {
  const after = gitSnapshot();
  const diff = gitDiff();
  const lines: string[] = [
    `Branch: ${after.branch}`,
    '',
    'Status before:',
    before.status || '(clean)',
    '',
    'Status after:',
    after.status || '(clean)',
  ];
  if (diff && diff !== '(no changes)') {
    lines.push('', 'Diff:', diff.slice(0, 3000) + (diff.length > 3000 ? '\n…(truncated)' : ''));
  }
  return lines.join('\n');
}
