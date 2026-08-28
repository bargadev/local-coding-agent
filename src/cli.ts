#!/usr/bin/env node
import 'dotenv/config';

async function main() {
  const args = process.argv.slice(2);
  const prompt = args.join(' ').trim();

  if (!prompt) {
    console.log('Usage: agent "<task>"');
    console.log('Example: agent "explain what a function is in TypeScript"');
    process.exit(0);
  }

  console.log(`Task: ${prompt}`);
  console.log('(agent not yet implemented — Phase 1)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
