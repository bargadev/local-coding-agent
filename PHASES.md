# Implementation Phases

> Scope: smart CLI that routes between local (Ollama) and Claude CLI (Haiku/Sonnet/Opus)
> Auth: Claude CLI — no API key needed

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Scaffold — tsconfig, package.json, src/ structure | ✅ done |
| 1 | Ollama integration — LLMClient interface, OllamaLLMClient, tuned Modelfile | ✅ done |
| 2 | ClaudeCLIClient — wraps `claude -p --model X`, auto-install + auth setup | ✅ done |
| 3 | CLI — `agent "task"` with interactive mode, clean output | ✅ done |
| 4 | ModelRouter — classifies task, picks local/haiku/sonnet/opus automatically | ✅ done |
| 5 | Workspace — cwd detection, path traversal protection | ✅ done |
| 6 | Tools: list_files, read_file, search_files | ✅ done |
| 7 | Token display — spinner with elapsed time + token count; shows 0 when local | ⬜ |
| 8 | Tool: write_file (workspace-scoped, validated) | ⬜ |
| 9 | Tool: run_command + CommandGuard (blocks dangerous commands) | ⬜ |
| 10 | System prompt — engineering agent rules | ⬜ |
| 11 | Tool calling — connect tools to LLM, tool registry | ⬜ |
| 12 | Agent loop — iterate until done or MAX_AGENT_ITERATIONS | ⬜ |
| 13 | Git tools — git_status, git_diff | ⬜ |
| 14 | Auto-correction — write → test → fix → test loop | ⬜ |
| 15 | Context manager — select relevant files, respect size limits | ⬜ |
| 16 | Sessions — persist runs to .sessions/*.json | ⬜ |
| 17 | Benchmark — 10 real tasks, measure model chosen, quality, latency | ⬜ |
| 18 | Benchmark: 7b comparison — same 10 tasks with 7b in the routing chain vs without, measure RAM pressure, latency, quality delta | ⬜ |
