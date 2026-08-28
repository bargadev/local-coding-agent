#!/usr/bin/env node
import 'dotenv/config';
import { OllamaLLMClient, ClaudeCLIClient } from './llm/index.js';
import { ensureClaudeCLI } from './setup/index.js';

const SYSTEM_PROMPT = 'You are a helpful software engineering assistant.';

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.join(' ').trim();

  if (!prompt) {
    console.log('Usage: agent "<task>"');
    process.exit(0);
  }

  ensureClaudeCLI();

  const backend = process.env.AGENT_BACKEND ?? 'sonnet';
  const llm =
    backend === 'local'
      ? OllamaLLMClient.fromEnv()
      : new ClaudeCLIClient(backend as 'haiku' | 'sonnet' | 'opus');

  process.stdout.write(`[${backend}] thinking...\n`);

  const response = await llm.chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ]);

  console.log('\n' + response.content);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
