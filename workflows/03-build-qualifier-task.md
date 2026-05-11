# 03 — Build the qualifier Trigger.dev task

## Goal
A Trigger.dev task `qualifyLead` that takes a `LeadInput`, calls an OpenRouter model, and returns a typed `QualificationResult`. Progress should stream so the frontend can show it live.

## Preconditions
- [01-bootstrap-project.md](01-bootstrap-project.md) is done.
- [02-define-rubric.md](02-define-rubric.md) is done — `LeadInput` and `QualificationResult` types exist in `src/types/lead.ts`.
- `OPENROUTER_API_KEY` is set in the Trigger.dev dev environment.

## Steps

### 1. Create the OpenRouter client
- New file: `src/lib/openrouter.ts`.
- Export a configured OpenAI client pointed at `https://openrouter.ai/api/v1` (see CLAUDE.md for the snippet).

### 2. Create the task
- New file: `src/trigger/qualify-lead.ts`.
- Use `task({ id: "qualify-lead", run: async (payload: LeadInput, { metadata }) => { ... } })` from `@trigger.dev/sdk`.
- Inside `run`:
  - Call `metadata.set("status", "starting")` (or use `metadata.replace` / `metadata.stream` per the latest Trigger.dev API) so the frontend's `useRealtimeRun` sees progress.
  - Build the prompt using the rubric from [02-define-rubric.md](02-define-rubric.md).
  - Use **structured output** — `response_format: { type: "json_schema", json_schema: { ... } }` — so the response is guaranteed to match `QualificationResult`. Generate the JSON schema from the type (handwritten or via `zod-to-json-schema`).
  - Parse + validate the response. Throw on schema mismatch — Trigger.dev will retry per the task's retry config.
  - Return the validated result.

### 3. Choose a model
- Default to `anthropic/claude-sonnet-4-6` (a strong reasoning model, supports structured output via OpenRouter).
- Make it overridable via the payload (`payload.model`) so it's easy to A/B without redeploying.

### 4. Configure retries
- Set `retry: { maxAttempts: 3 }` on the task — OpenRouter occasionally returns 5xx.

## Verification
- `npx trigger.dev@latest dev` shows the task registered.
- Test from the Trigger.dev dashboard: paste a sample lead JSON, run the task, see a structured `QualificationResult` come back.
- Or run `tools/test-lead.sh` (see [tools/README.md](../tools/README.md)) once that exists.

## Gotchas
- Not every OpenRouter model supports `response_format: json_schema`. Check the model's "Supported Parameters" on the OpenRouter model page. If the chosen model doesn't, fall back to prompt-based JSON instructions + `JSON.parse` with validation.
- `metadata` API in Trigger.dev v3 has evolved — check the current docs for the exact method names before writing the streaming code.
- Don't log the full LLM prompt at info level if the lead contains PII.
