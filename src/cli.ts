#!/usr/bin/env node
import 'dotenv/config';
import * as readline from 'readline';
import { ensureClaudeCLI } from './setup/index.js';
import { respond } from './agent/respond.js';
import { gitSnapshot, formatGitSummary } from './tools/git.js';

const EXIT_COMMANDS = new Set(['exit', 'quit', 'q', '.exit']);

async function runOnce(prompt: string): Promise<void> {
  let gitBefore = { status: '', branch: '' };
  try { gitBefore = gitSnapshot(); } catch { /* not a git repo */ }

  const answer = await respond(prompt);
  console.log('\n' + answer + '\n');

  try {
    const summary = formatGitSummary(gitBefore);
    if (!summary.includes('(no changes)')) {
      console.log('\n── git summary ──\n' + summary + '\n');
    }
  } catch { /* not a git repo */ }
}

async function runInteractive(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((r) => rl.question(q, r));

  console.log('agent — type your task, or "exit" to quit\n');

  while (true) {
    const input = (await ask('> ')).trim();
    if (!input) continue;
    if (EXIT_COMMANDS.has(input.toLowerCase())) break;

    try {
      const answer = await respond(input);
      console.log('\n' + answer + '\n');
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
    }
  }

  rl.close();
}

async function main(): Promise<void> {
  ensureClaudeCLI();

  const args = process.argv.slice(2);
  const prompt = args.join(' ').trim();

  if (prompt) {
    await runOnce(prompt);
  } else {
    await runInteractive();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
