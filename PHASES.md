# Implementation Phases

> Scope: smart CLI that routes between local (Ollama) and Claude CLI (Haiku/Sonnet/Opus)
> Auth: Claude CLI — no API key needed

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Scaffold — tsconfig, package.json, src/ structure | ✅ done |
| 1 | Ollama integration — LLMClient interface, OllamaLLMClient, tuned Modelfile | ✅ done |
| 2 | ClaudeCLIClient — wraps `claude -p --model X`, auto-install + auth setup | ✅ done |
| 3 | ModelRouter — classifies task, picks local/haiku/sonnet/opus automatically | ⬜ |
| 4 | CLI — `agent "task"` with interactive mode, clean output | ⬜ |
| 5 | Workspace + Tools: list_files, read_file, search_files | ⬜ |
| 6 | Tool: write_file (workspace-scoped, validated) | ⬜ |
| 7 | Tool: run_command + CommandGuard (blocks dangerous commands) | ⬜ |
| 8 | Tool calling — connect tools to whichever LLM the router picked | ⬜ |
| 9 | Agent loop — iterate until done or MAX_AGENT_ITERATIONS | ⬜ |
| 10 | System prompt — engineering agent rules | ⬜ |
| 11 | Git tools — git_status, git_diff | ⬜ |
| 12 | Auto-correction — write → test → fix → test loop | ⬜ |
| 13 | Context manager — select relevant files, respect size limits | ⬜ |
| 14 | Sessions — persist runs to .sessions/*.json | ⬜ |
| 15 | Benchmark — 10 real tasks, measure model chosen, quality, latency | ⬜ |
