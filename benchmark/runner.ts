#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

interface Task {
  id: string;
  category: string;
  prompt: string;
  successCriteria: string;
}

interface TaskResult {
  id: string;
  category: string;
  model: string;
  backend: string;
  prompt: string;
  successCriteria: string;
  durationMs: number;
  testsPassed: boolean;
  testOutput: string;
  agentOutput: string;
  error?: string;
}

const TASKS_FILE = path.join(__dirname, 'tasks/tasks.json');
const RESULTS_DIR = path.join(__dirname, 'results');
const PROJECT_DIR = path.join(__dirname, 'benchmark-project');

const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:3b-agent';
const backend = process.env.AGENT_BACKEND ?? 'auto';

function runTests(): { passed: boolean; output: string } {
  try {
    const out = execSync('npm test', { cwd: PROJECT_DIR, encoding: 'utf8', timeout: 60_000 });
    return { passed: true, output: out.trim() };
  } catch (err: any) {
    return { passed: false, output: (err.stdout ?? '') + (err.stderr ?? '') };
  }
}

function resetProject(): void {
  // Reset to original state by removing modified files and reinstalling
  execSync('git checkout -- .', { cwd: PROJECT_DIR, stdio: 'ignore' });
}

async function runTask(task: Task): Promise<TaskResult> {
  console.log(`\n[${task.id}] ${task.category}: ${task.prompt.slice(0, 60)}...`);

  const start = Date.now();
  let agentOutput = '';
  let error: string | undefined;

  try {
    // Install deps if needed
    if (!fs.existsSync(path.join(PROJECT_DIR, 'node_modules'))) {
      execSync('npm install', { cwd: PROJECT_DIR, stdio: 'ignore' });
    }

    agentOutput = execSync(
      `npx tsx ${path.join(__dirname, '../src/cli.ts')} "${task.prompt.replace(/"/g, '\\"')}"`,
      { cwd: PROJECT_DIR, encoding: 'utf8', timeout: 300_000, env: { ...process.env, AGENT_BACKEND: backend } }
    );
  } catch (err: any) {
    error = err.message ?? String(err);
    agentOutput = err.stdout ?? '';
  }

  const { passed, output: testOutput } = runTests();
  const durationMs = Date.now() - start;

  console.log(`  ${passed ? '✓' : '✗'} tests ${passed ? 'passed' : 'failed'} (${(durationMs / 1000).toFixed(1)}s)`);

  return {
    id: task.id,
    category: task.category,
    model,
    backend,
    prompt: task.prompt,
    successCriteria: task.successCriteria,
    durationMs,
    testsPassed: passed,
    testOutput: testOutput.slice(0, 500),
    agentOutput: agentOutput.slice(0, 1000),
    error,
  };
}

async function main() {
  const tasks: Task[] = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const results: TaskResult[] = [];

  for (const task of tasks) {
    try {
      resetProject();
    } catch { /* not a git repo or no changes */ }

    const result = await runTask(task);
    results.push(result);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(RESULTS_DIR, `benchmark-${backend}-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));

  const passed = results.filter((r) => r.testsPassed).length;
  const avgTime = (results.reduce((a, r) => a + r.durationMs, 0) / results.length / 1000).toFixed(1);

  console.log('\n── Benchmark Results ──');
  console.log(`Model   : ${model}`);
  console.log(`Backend : ${backend}`);
  console.log(`Success : ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`);
  console.log(`Avg time: ${avgTime}s`);
  console.log(`Saved   : ${outFile}`);
}

main().catch(console.error);
