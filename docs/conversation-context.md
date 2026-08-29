# Conversation context (multi-turn memory)

Status: **not implemented yet.** Every message is answered from a fresh state —
the agent cannot link a new message to the previous one.

## Why it doesn't work today

- `respond(prompt)` (`src/agent/respond.ts`) calls `runAgentLoop(prompt, ...)`
  with no prior history.
- `runAgentLoop` (`src/agent/loop.ts`) always seeds a brand-new array:
  `messages = [{ system }, { user: task }]`.
- Sessions are persisted to `.sessions/*.json` (`src/session/index.ts`), but they
  are only ever read back as token statistics — never re-fed as context.
- The CLI (`src/cli.ts`, `submit`) calls `respond(input)` in isolation on every
  Enter, so nothing carries between turns.

The internal `messages: Message[]` structure is already multi-turn — the loop
stacks `assistant`/`tool` messages within a single task. What's missing is
**persisting that array across CLI turns** instead of rebuilding it each time.

## How to link the context (minimal design)

1. Keep a live `history: Message[]` in `runInteractive` (or a dedicated
   conversation module).
2. Have `respond` / `runAgentLoop` accept that history as the base instead of
   always constructing `[{ system }, { user }]`.
3. At the end of each turn, append the assistant's final response to `history`
   and reuse it on the next Enter.

## Caveats

- **Routing:** `routeTask(prompt)` picks local vs cloud per message. With a
  history, a short follow-up like "and now?" needs the prior context to route
  correctly.
- **Cost:** re-sending the history grows input tokens every turn (already true
  inside one loop; this makes it true between turns too). Add a window limit or a
  running summary.
- **System prompt:** `buildSystemPrompt(task)` is per-task today. It would need to
  become a stable system message, with the new task added as a user message.

## Scope suggestion

Start with the interactive session only: a simple `ConversationState` in
`runInteractive`, passed into `respond`. The single-shot argv path (`runOnce`)
can stay one-shot.
