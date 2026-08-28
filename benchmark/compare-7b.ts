#!/usr/bin/env npx tsx
/**
 * Compare routing: with 7b in chain vs without (3b-agent only)
 *
 * Usage:
 *   npx tsx benchmark/compare-7b.ts
 *
 * This script does NOT run the full agent — it benchmarks the router classification
 * and Ollama inference speed for both models on the same prompts, so you get
 * real numbers before committing to the 7b for the routing chain.
 */
import * as fs from 'fs';
import * as path from 'path';

const TASKS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tasks/tasks.json'), 'utf8'),
) as Array<{ id: string; category: string; prompt: string }>;

interface ModelResult {
  model: string;
  prompt: string;
  tokens: number;
  tps: number;
  durationMs: number;
  responseSlice: string;
}

async function benchModel(model: string, prompt: string): Promise<ModelResult> {
  const start = Date.now();
  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: { num_ctx: 1024, num_predict: 256 } }),
  });
  const data = (await res.json()) as { response: string; eval_count: number; eval_duration: number };
  const durationMs = Date.now() - start;
  const tps = Math.round(data.eval_count / (data.eval_duration / 1e9));
  return {
    model,
    prompt: prompt.slice(0, 60),
    tokens: data.eval_count,
    tps,
    durationMs,
    responseSlice: data.response.slice(0, 100).replace(/\n/g, ' '),
  };
}

async function main() {
  const models = ['qwen2.5-coder:3b-agent', 'qwen2.5-coder:7b'];
  const prompts = TASKS.map((t) => t.prompt);

  console.log('7b vs 3b-agent — Benchmark\n');

  const allResults: ModelResult[] = [];

  for (const model of models) {
    console.log(`\n=== ${model} ===`);
    const modelResults: ModelResult[] = [];

    for (const prompt of prompts) {
      const r = await benchModel(model, prompt);
      modelResults.push(r);
      console.log(`  ${r.tokens.toString().padStart(4)} tokens  ${r.tps.toString().padStart(3)} tok/s  ${(r.durationMs / 1000).toFixed(1)}s  ${prompt.slice(0, 50)}`);
    }

    const avgTps = Math.round(modelResults.reduce((a, r) => a + r.tps, 0) / modelResults.length);
    const avgTime = (modelResults.reduce((a, r) => a + r.durationMs, 0) / modelResults.length / 1000).toFixed(1);
    const avgTokens = Math.round(modelResults.reduce((a, r) => a + r.tokens, 0) / modelResults.length);
    console.log(`  avg: ${avgTokens} tokens  ${avgTps} tok/s  ${avgTime}s`);
    allResults.push(...modelResults);
  }

  // RAM usage
  const ps = await fetch('http://localhost:11434/api/ps');
  const psData = (await ps.json()) as { models: Array<{ name: string; size_vram: number }> };
  console.log('\n── RAM (VRAM) ──');
  psData.models?.forEach((m) => console.log(`  ${m.name}: ${(m.size_vram / 1e9).toFixed(2)} GB`));

  // Save results
  const outFile = path.join(__dirname, `results/compare-7b-${new Date().toISOString().slice(0, 10)}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(allResults, null, 2));
  console.log(`\nSaved: ${outFile}`);
  console.log('\nConclusion: if 7b tok/s < 20 and quality gain is marginal, keep 3b-agent as default.');
}

main().catch(console.error);
