# 04 — Build the frontend form + realtime results

## Goal
A single page at `/` with a form for the `LeadInput` fields and an **Analyze** button. On submit, the page enqueues a `qualifyLead` run on Trigger.dev and shows live progress + final result without a page reload.

## Preconditions
- [03-build-qualifier-task.md](03-build-qualifier-task.md) is done — `qualifyLead` task is deployed and runnable.
- `TRIGGER_SECRET_KEY` is set in `.env.local` and in Vercel.
- `@trigger.dev/sdk` and `@trigger.dev/react-hooks` are installed.

## Steps

### 1. Server action — enqueue the run + mint a public access token
- New file: `src/app/actions/qualify.ts` — marked `"use server"`.
- Use `tasks.trigger("qualify-lead", payload)` from `@trigger.dev/sdk` to enqueue.
- Generate a short-lived public access token scoped to that single run (`auth.createPublicToken({ scopes: { read: { runs: [run.id] } }, expirationTime: "1h" })`).
- Return `{ runId, publicAccessToken }` to the client.

### 2. Form component
- New file: `src/app/page.tsx` (or `src/app/_components/lead-form.tsx` imported from `page.tsx`).
- Render inputs for each `LeadInput` field.
- On submit: call the server action, then store the returned `{ runId, publicAccessToken }` in state.

### 3. Realtime results component
- New file: `src/app/_components/qualification-result.tsx` — `"use client"`.
- Use `useRealtimeRun(runId, { accessToken: publicAccessToken })` from `@trigger.dev/react-hooks`.
- Render run status + streamed metadata while it's running.
- Once `run.status === "COMPLETED"`, render `run.output` as a typed `QualificationResult` (recommendation, score, reasoning, etc.).
- Handle `"FAILED"` and `"CANCELED"` with an error UI.

### 4. Styling
- Whatever you set up in [01-bootstrap-project.md](01-bootstrap-project.md). Keep it simple — the value is in the result rendering, not the form chrome.

## Verification
- `npm run dev` + `npx trigger.dev@latest dev` running in two terminals.
- Visit http://localhost:3000, submit a lead, watch the result populate live.
- Submit an obviously bad lead (empty company, generic email) and confirm the rubric's reasoning makes sense.

## Gotchas
- The public access token must be **minted server-side** and passed to the client. Never expose `TRIGGER_SECRET_KEY` to the browser.
- `useRealtimeRun` needs the access token to have `read` scope on the specific run id — don't reuse a token across runs.
- Server actions in Next.js App Router run on the server — `process.env.TRIGGER_SECRET_KEY` is fine there but unavailable in client components.
