# local-coding-agent

Local coding agent powered by Ollama. No external LLM APIs.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.com/) running locally
- `qwen2.5-coder:3b` pulled: `ollama pull qwen2.5-coder:3b`

## Setup

```bash
cp .env.example .env
npm install
```

## Usage

```bash
# single task
npm run dev -- "add email validation to user registration"

# interactive mode
npm run dev
```

## Models

Configured via `OLLAMA_MODEL` in `.env`:

| Model | Size | Use |
|---|---|---|
| `qwen2.5-coder:3b` | ~2GB | default / fast |
| `qwen2.5-coder:7b` | ~4GB | better quality |
| `qwen3:8b` | ~5GB | best quality |

## Architecture

```
src/
  cli.ts          — entry point, argument parsing
  agent/          — agent loop, system prompt
  llm/            — Ollama client abstraction
  tools/          — filesystem, git, terminal tools
  context/        — context manager
  session/        — session persistence
```

## Phases

Implementation follows 26 incremental phases from scaffold → benchmark → optimization.
