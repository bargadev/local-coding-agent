#!/usr/bin/env node
import 'dotenv/config';
import { OllamaLLMClient } from './llm/index.js';

const SYSTEM_PROMPT = 'You are a helpful software engineering assistant.';

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.join(' ').trim();

  if (!prompt) {
    console.log('Usage: agent "<task>"');
    process.exit(0);
  }

  const llm = OllamaLLMClient.fromEnv();

  process.stdout.write('Thinking...\n');

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
