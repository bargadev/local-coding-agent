# What each phase does

## Phase 0 — Scaffold
Creates the project folder, installs TypeScript and Node.js, sets up the folder structure (`src/agent`, `src/llm`, `src/tools` etc), scripts and config files. Nothing runs yet — just the skeleton.

## Phase 1 — Ollama integration
Connects the app to Ollama. Sends a system prompt + user message to the local model and prints the response. First time the agent actually talks to an LLM.

## Phase 2 — CLI
Makes the command usable. You can run `agent "my task"` or just `agent` for an interactive prompt loop. Clean output, nothing fancy.

## Phase 3 — Workspace
The agent learns which folder it's working in (`process.cwd()`). All file operations are locked to that folder — it can't escape to `/etc`, `~/.ssh` or anywhere else on your system.

## Phase 4 — Tool: list_files
Gives the agent a way to see what files exist in the project. Returns a tree of files, skipping `node_modules`, `.git`, `dist` etc.

## Phase 5 — Tool: read_file
Gives the agent a way to read a file's content. Has a size limit — if the file is too large it tells the agent instead of dumping 10k lines into the context.

## Phase 6 — Tool: search_files
Lets the agent search for a word or symbol across all project files (like grep). Returns file path, line number, and a few lines of context around each match.

## Phase 7 — Tool: write_file
Lets the agent create or overwrite a file. Validates the path is inside the workspace, creates parent directories if needed, and records the change in the session.

## Phase 8 — Tool calling
Connects all the tools to the LLM. The model can now decide to call `list_files`, `read_file`, `search_files`, or `write_file` during a conversation. The agent executes the tool and feeds the result back to the model.

## Phase 9 — Agent loop
The core loop: the agent keeps calling the LLM → executing tools → feeding results back until the model says it's done or hits the iteration limit (default: 30). This is what makes it an "agent" instead of a chatbot.

## Phase 10 — System prompt
Writes the instructions that define the agent's behavior: analyze before editing, never invent file contents, make small incremental changes, run tests after edits, never `git push` automatically, etc.

## Phase 11 — Tool: run_command
Lets the agent run shell commands (like `npm test`). Returns stdout, stderr, exit code, and how long it took. Has a timeout so it can't hang forever.

## Phase 12 — Terminal security
A guard layer that checks every command before running it. Blocks dangerous operations: `git push`, `git reset --hard`, `rm -rf /`, `sudo`, access to secrets, etc. If blocked, returns a clear error instead of running.

## Phase 13 — Git tools
Adds `git_status` and `git_diff` tools. The agent can see what changed before and after its work. Shows a summary at the end: files changed, test results, git diff.

## Phase 14 — Automatic test execution
After making changes the agent automatically runs `npm test` (or equivalent), reads the output, and decides whether the task succeeded or needs more work.

## Phase 15 — Auto-correction
If tests fail, the agent doesn't give up. It reads the error, figures out what went wrong, fixes the code, and runs the tests again. Repeats until tests pass or it hits the iteration limit.

## Phase 16 — Context management
Prevents the agent from dumping the entire repo into the model's context. Selects only relevant files based on the task, respects file size limits, and builds context incrementally. Keeps the model focused and fast.

## Phase 17 — Sessions
Saves each agent run to a `.sessions/` folder as a JSON file: the original prompt, all messages, tool calls made, and the final response. Useful for debugging and comparing runs.

## Phase 18 — Benchmark setup
Creates a realistic test project (auth, users, payments, utils) and 10 coding tasks across different categories: code generation, bug fix, refactor, feature, test writing, etc.

## Phase 19 — Metrics
Records for every benchmark task: model used, hardware, time to first token, tokens/sec, total duration, agent iterations, tool calls, commands run, tests passed/failed, task success.

## Phase 20 — Model comparison
Runs the exact same 10 tasks on `qwen2.5-coder:3b`, `qwen2.5-coder:7b`, and `qwen3:8b`. Generates a comparison table with real measured numbers.

## Phase 21 — Performance investigation
After benchmarks are done: investigates quantization (Q4 vs Q8), KV cache reuse, and the impact of context size on speed. Only optimizes what the benchmark shows is a real bottleneck.

## Phase 22 — Docker sandbox
Wraps the agent in Docker so it can't touch anything outside the container. Makes runs reproducible and safe to use on real projects.

## Phase 23 — Future architecture
Design doc for routing: simple tasks go to the local model, complex tasks escalate to a cloud model. Not implemented yet — just the plan.

## Phase 24 — Future optimizations
Backlog for after benchmarks: better models, embeddings, semantic search, context compression, speculative decoding, GPU. One at a time, always with before/after metrics.

## Phase 25 — Success criteria
The agent passes this full end-to-end test: `agent "add email validation to user registration"` → analyzes project → finds relevant files → plans → edits code → creates tests → runs tests → detects errors → fixes → reruns → shows git diff → done.

## Phase 26 — Final report
Generates `benchmark/results/summary.md`: hardware specs, model comparison table, performance numbers, task success rates, and a conclusion on whether CPU-only is viable for real coding tasks.
