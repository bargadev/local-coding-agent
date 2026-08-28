# Implementation Phases

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Scaffold — tsconfig, package.json, src/ structure | ✅ done |
| 1 | Ollama integration — LLMClient interface, OllamaLLMClient | ✅ done |
| 2 | CLI — single arg + interactive mode | ⬜ |
| 3 | Workspace — cwd detection, path traversal protection | ⬜ |
| 4 | Tool: list_files | ⬜ |
| 5 | Tool: read_file (with MAX_FILE_SIZE guard) | ⬜ |
| 6 | Tool: search_files (grep with context lines) | ⬜ |
| 7 | Tool: write_file (validated, workspace-scoped) | ⬜ |
| 8 | Tool calling — connect tools to LLM, tool registry | ⬜ |
| 9 | Agent loop — iterate until done or MAX_AGENT_ITERATIONS | ⬜ |
| 10 | System prompt — engineering agent rules | ⬜ |
| 11 | Tool: run_command (with COMMAND_TIMEOUT) | ⬜ |
| 12 | Terminal security — CommandGuard, blocked commands | ⬜ |
| 13 | Git tools — git_status, git_diff | ⬜ |
| 14 | Automatic test execution — run tests after edits | ⬜ |
| 15 | Auto-correction — write → test → fix → test loop | ⬜ |
| 16 | Context management — ContextManager, relevant file selection | ⬜ |
| 17 | Sessions — persist to .sessions/*.json | ⬜ |
| 18 | Benchmark — tasks/, results/, benchmark project | ⬜ |
| 19 | Metrics — tokens/s, TTFT, iterations, tool calls, success | ⬜ |
| 20 | Model comparison — 3b vs 7b vs qwen3:8b | ⬜ |
| 21 | Performance — quantization, KV cache, context size impact | ⬜ |
| 22 | Docker sandbox — Dockerfile, docker-compose | ⬜ |
| 23 | Future architecture — local + cloud model routing | ⬜ |
| 24 | Future optimizations — embeddings, semantic search, GPU | ⬜ |
| 25 | Success criteria — full end-to-end task validation | ⬜ |
| 26 | Final report — benchmark/results/summary.md | ⬜ |
