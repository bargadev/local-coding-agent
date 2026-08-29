#!/usr/bin/env npx tsx
// Local-only capability benchmark. For each task: reset the project, run the agent
// loop on the local model (no cloud escalation), then judge success honestly as
// "the working tree actually changed AND the tests pass". Zero Claude cost — it
// measures how many tasks the free local model handles on its own, i.e. the real
// token-saving rate. Tasks the local model fails would escalate to sonnet in normal
// use, so correctness is still guaranteed there; this run just measures the split.
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface Task { id: string; category: string; prompt: string; successCriteria: string; }

const TASKS_FILE = path.join(__dirname, 'tasks/tasks.json');
const PROJECT_DIR = path.join(__dirname, 'benchmark-project');
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';

function resetProject(): void {
  execSync('git checkout -- .', { cwd: PROJECT_DIR, stdio: 'ignore' });
  execSync('git clean -fd --exclude=node_modules --exclude=.gitignore', { cwd: PROJECT_DIR, stdio: 'ignore' });
}

function treeChanged(): boolean {
  const out = execSync('git status --short -- . ":(exclude).sessions"', { cwd: PROJECT_DIR, encoding: 'utf8' });
  // Any modified/added source file (ignore the untracked .sessions the agent writes)
  return out.split('\n').some((l) => l.trim() && !l.includes('.sessions') && !l.includes('node_modules') && !l.includes('.gitignore'));
}

function testsPass(): boolean {
  try {
    execSync('npm test', { cwd: PROJECT_DIR, encoding: 'utf8', timeout: 60_000, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const all: Task[] = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  const limit = process.env.BENCH_LIMIT ? parseInt(process.env.BENCH_LIMIT, 10) : all.length;
  const tasks = all.slice(0, limit);

  if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
    execSync('npm install', { cwd: PROJECT_DIR, stdio: 'ignore' });
  }

  // CRITICAL: the agent's file tools resolve paths against the workspace singleton,
  // which captures process.cwd() at import time. chdir into the benchmark project
  // BEFORE importing the loop so edits land there, not in the real repo root.
  process.chdir(PROJECT_DIR);
  const { OllamaLLMClient } = await import('../src/llm/index.js');
  const { runAgentLoop } = await import('../src/agent/loop.js');
  const llm = new OllamaLLMClient({ url: process.env.OLLAMA_URL ?? 'http://localhost:11434', model: MODEL });

  const rows: any[] = [];
  console.log(`Local-only benchmark · model=${MODEL} · ${tasks.length} tasks\n`);

  for (const task of tasks) {
    resetProject();
    const start = Date.now();
    let edited = false, passed = false, toolCalls = 0, writes = 0, tokens = 0, error = '';
    try {
      const r = await runAgentLoop(task.prompt, llm);
      toolCalls = r.toolCalls;
      tokens = r.tokens;
      edited = treeChanged();
      passed = testsPass();
    } catch (e: any) {
      error = e?.message ?? String(e);
    }
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    const ok = edited && passed;
    rows.push({ id: task.id, category: task.category, ok, edited, passed, toolCalls, tokens, elapsed, error });
    console.log(`${ok ? '✓' : '✗'} ${task.id.padEnd(4)} ${task.category.padEnd(20)} edited=${edited ? 'Y' : 'N'} tests=${passed ? 'Y' : 'N'} · ${tokens} tok · ${elapsed}s${error ? ' · ERR ' + error.slice(0, 50) : ''}`);
    resetProject();
  }

  const solved = rows.filter((r) => r.ok).length;
  const editedNoTest = rows.filter((r) => r.edited && !r.passed).length;
  const noEdit = rows.filter((r) => !r.edited).length;
  const totalTok = rows.reduce((a, r) => a + r.tokens, 0);
  const avgTime = (rows.reduce((a, r) => a + parseFloat(r.elapsed), 0) / rows.length).toFixed(1);

  console.log('\n── Summary ──');
  console.log(`Model            : ${MODEL}`);
  console.log(`Solved locally   : ${solved}/${rows.length} (${Math.round((solved / rows.length) * 100)}%)  ← handled free, no cloud`);
  console.log(`Edited but failed: ${editedNoTest}  (would escalate to sonnet)`);
  console.log(`No edit at all   : ${noEdit}  (would escalate to sonnet)`);
  console.log(`Local tokens     : ${totalTok} (all free)`);
  console.log(`Avg time/task    : ${avgTime}s`);

  const outFile = path.join(__dirname, 'results', `local-bench-${MODEL.replace(/[:.]/g, '-')}-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ model: MODEL, rows, solved, total: rows.length }, null, 2));
  console.log(`Saved            : ${outFile}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
