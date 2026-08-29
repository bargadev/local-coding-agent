#!/usr/bin/env node
import 'dotenv/config';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { ensureClaudeCLI } from './setup/index.js';
import { respond } from './agent/respond.js';
import type { TokenUsage } from './llm/index.js';
import { sessionStats } from './session/index.js';
import { gitSnapshot, formatGitSummary, gitDiff } from './tools/git.js';

const EXIT_COMMANDS = new Set(['exit', 'quit', 'q', '.exit']);
const STATS_COMMANDS = new Set(['stats', '/stats', 'tokens', '/tokens']);

// 4200 → "4.2k", 326 → "326"
function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function printResponse(content: string, elapsedSec: number, verb: string, tokens: number, usage: TokenUsage, isLocal: boolean): void {
  // Bullet-prefixed response
  const lines = content.split('\n');
  process.stdout.write(`\n${C.bold}●${C.reset} ${lines[0]}\n`);
  if (lines.length > 1) process.stdout.write(lines.slice(1).join('\n') + '\n');

  // Timing line: ✳ Verb for Xs · done HH:MM · ↕ N tokens (in · out)
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const billedIn = usage.input + usage.cacheRead + usage.cacheCreation;
  // Real cost = input (incl. re-sent context) + output. Local runs are free.
  const tokenPart = isLocal
    ? `${C.dim} · ${C.reset}${C.green}free${C.dim} (${fmt(tokens)} tok local)${C.reset}`
    : `${C.dim} · ${C.reset}${C.cyan}↕ ${fmt(tokens)} tokens${C.reset}${C.dim} (${fmt(billedIn)} in · ${fmt(usage.output)} out)${C.reset}`;
  process.stdout.write(
    `\n${C.yellow}✳${C.reset} ${C.dim}${verb} for ${elapsedSec}s · done ${time}${C.reset}${tokenPart}\n`
  );
}

function printStats(): void {
  const s = sessionStats();
  process.stdout.write(
    `\n${C.bold}● Token usage${C.reset} ${C.dim}(${s.sessions} sessions)${C.reset}\n` +
    `  ${C.cyan}Claude billed${C.reset} : ${fmt(s.claudeTokens)} tokens ${C.dim}(${fmt(s.claudeInput)} in · ${fmt(s.claudeOutput)} out)${C.reset}\n` +
    `  ${C.green}Ran local${C.reset}     : ${fmt(s.localTokens)} tokens ${C.dim}(free)${C.reset}\n` +
    `  ${C.dim}Work on local : ${s.savedPct}%${C.reset}\n`
  );
}

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  yellow: '\x1b[93m',
  cyan:   '\x1b[36m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  gray:   '\x1b[90m',
  coral:  '\x1b[38;2;217;119;87m',
};

// Coral pixel-art mascot. 1 = coral pixel, 0 = background; each pixel = 2 cells wide.
const LOGO_BITMAP = [
  '01111110',
  '11011011',
  '11111111',
  '11000011',
];

function logoLine(row: number): string {
  const bits = LOGO_BITMAP[row];
  if (!bits) return ' '.repeat(2 + 16);
  let out = ' '; // left margin
  for (const b of bits) out += b === '1' ? `${C.coral}██${C.reset}` : '  ';
  return out;
}

function pkgVersion(): string {
  try {
    const p = path.join(__dirname, '../package.json');
    return 'v' + JSON.parse(fs.readFileSync(p, 'utf8')).version;
  } catch {
    return 'v0.1.0';
  }
}

function statusLine(tier: string): string {
  const width = process.stdout.columns || 80;
  const label = `${C.coral}●${C.reset} ${C.dim}${tier} · router${C.reset}`;
  // visible length (strip ANSI) to right-align
  const visible = `● ${tier} · router`.length;
  const pad = Math.max(0, width - visible - 1);
  return ' '.repeat(pad) + label;
}

function getHeader(): string {
  const cwd = process.cwd();
  const home = os.homedir();
  const displayDir = cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:3b-agent';

  // Right-hand text block, one entry per logo row.
  const text = [
    `${C.bold}Local Agent${C.reset} ${C.dim}${pkgVersion()}${C.reset}`,
    `${C.dim}${model} with smart routing · Ollama${C.reset}`,
    `${C.dim}${displayDir}${C.reset}`,
    '',
  ];

  const lines: string[] = [];
  for (let i = 0; i < LOGO_BITMAP.length; i++) {
    lines.push(`${logoLine(i)}  ${text[i] ?? ''}`);
  }
  return lines.join('\n');
}

function hr(): string {
  const width = process.stdout.columns || 80;
  return `${C.dim}${'─'.repeat(width)}${C.reset}`;
}

function prompt(): string {
  return `${C.coral}›${C.reset} `;
}

async function runOnce(input: string): Promise<void> {
  let gitBefore = { status: '', branch: '' };
  try { gitBefore = gitSnapshot(); } catch { /* not a git repo */ }

  const { content, elapsedSec, verb, tokens, usage, isLocal } = await respond(input);
  printResponse(content, elapsedSec, verb, tokens, usage, isLocal);

  try {
    const diff = gitDiff();
    if (diff && diff !== '(no changes)') {
      const summary = formatGitSummary(gitBefore);
      process.stdout.write(`${C.dim}── git summary ──${C.reset}\n` + summary + '\n\n');
    }
  } catch { /* not a git repo */ }
}

// Rows reserved at the bottom for the fixed input box: status, top rule,
// prompt, bottom rule, and one blank spacer line.
const BOX_ROWS = 5;

async function runInteractive(): Promise<void> {
  // Fullscreen: clear the whole terminal (incl. scrollback) and home the cursor.
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  const header = '\n' + getHeader() + '\n\n';

  let tier = 'ready';
  let buf = '';
  let busy = false;

  // Confine scrolling to the region above the fixed input box, so terminal output
  // flows there while the box below stays put.
  const setRegion = (): void => {
    const rows = process.stdout.rows || 24;
    process.stdout.write(`\x1b[1;${Math.max(1, rows - BOX_ROWS)}r`);
  };

  // Draw the input box at absolute rows pinned to the bottom of the screen. Every
  // line is positioned and cleared explicitly, so it survives output above and
  // keystrokes. The cursor is left at the end of the prompt line.
  const drawBox = (): void => {
    const rows = process.stdout.rows || 24;
    const width = process.stdout.columns || 80;
    const top = rows - BOX_ROWS + 1; // first fixed row
    const line = (row: number, text: string) =>
      process.stdout.write(`\x1b[${row};1H\x1b[2K${text}`);
    line(top, statusLine(tier));
    line(top + 1, hr());
    line(top + 2, prompt() + buf.slice(0, Math.max(0, width - 3)));
    line(top + 3, hr());
    line(top + 4, ''); // spacer
    process.stdout.write(`\x1b[${top + 2};${buf.length + 3}H`); // cursor → prompt end
  };

  const saveOut = (): void => { process.stdout.write('\x1b7'); }; // remember output position

  const cleanup = (): void => {
    process.stdout.write('\x1b[r');   // reset scroll region
    try { process.stdin.setRawMode?.(false); } catch { /* not a TTY */ }
    process.stdin.pause();
    process.stdout.write('\x1b[?25h\n'); // show cursor
  };

  const submit = (input: string): void => {
    if (!input) return; // box stays; nothing to send

    // Move into the scroll region (after the last output) and drop the sent bar.
    // Leave the cursor here so the spinner and response flow above the pinned box.
    process.stdout.write('\x1b8'); // restore saved output position
    const width = process.stdout.columns || 80;
    const barText = ` › ${input}`;
    const barPad = Math.max(0, width - (input.length + 3));
    process.stdout.write(`\x1b[48;5;236m${C.coral}${barText}${C.reset}\x1b[48;5;236m${' '.repeat(barPad)}\x1b[0m\n`);

    busy = true;
    void (async () => {
      let gitBefore = { status: '', branch: '' };
      try { gitBefore = gitSnapshot(); } catch { /* not a git repo */ }

      try {
        const { content, elapsedSec, verb, tokens, usage, isLocal } = await respond(input);
        tier = isLocal ? 'local' : 'cloud';
        printResponse(content, elapsedSec, verb, tokens, usage, isLocal);

        try {
          const diff = gitDiff();
          if (diff && diff !== '(no changes)') {
            const summary = formatGitSummary(gitBefore);
            process.stdout.write(`${C.dim}── git summary ──${C.reset}\n` + summary + '\n\n');
          }
        } catch { /* not a git repo */ }
      } catch (err) {
        process.stdout.write(`${C.yellow}⚠ Error:${C.reset} ${err instanceof Error ? err.message : err}\n\n`);
      }

      saveOut();   // remember where the next message should go
      busy = false;
      drawBox();
    })();
  };

  setRegion();
  process.stdout.write(header); // flows in the scroll region
  saveOut();                    // save output position after header
  drawBox();

  await new Promise<void>((resolve) => {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const done = () => { cleanup(); resolve(); };

    process.stdout.on('resize', () => { setRegion(); drawBox(); });

    process.stdin.on('data', (chunk: string) => {
      if (chunk === '\x03') { done(); return; }        // Ctrl+C
      if (busy) return;                                // one submission at a time
      if (chunk.charCodeAt(0) === 0x1b) return;        // arrow/nav escape sequences

      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          const input = buf.trim();
          buf = '';
          if (EXIT_COMMANDS.has(input.toLowerCase())) { done(); return; }
          if (STATS_COMMANDS.has(input.toLowerCase())) {
            drawBox();
            process.stdout.write('\x1b8'); // restore output position (above the box)
            printStats();
            saveOut();
            drawBox();
            return;
          }
          drawBox();       // clear the just-submitted text from the prompt line
          submit(input);
          if (busy) return; // stop consuming this chunk while processing
        } else if (ch === '\x7f' || ch === '\b') {     // backspace
          if (buf) { buf = buf.slice(0, -1); drawBox(); }
        } else if (ch >= ' ') {                         // printable
          buf += ch;
          drawBox();
        }
      }
    });
  });
}

async function main(): Promise<void> {
  ensureClaudeCLI();

  const args = process.argv.slice(2);
  const input = args.join(' ').trim();

  if (input) {
    if (STATS_COMMANDS.has(input.toLowerCase())) { printStats(); return; }
    await runOnce(input);
  } else {
    await runInteractive();
  }
}

main().catch((err) => {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
  process.exit(1);
});
