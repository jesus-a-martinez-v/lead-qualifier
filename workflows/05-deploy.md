# 05 — Deploy

## Goal
Production lead qualifier reachable at the Vercel URL, backed by `qualifyLead` running in Trigger.dev cloud.

## Preconditions
- Bootstrap done — Vercel project and Trigger.dev cloud project both exist.
- `OPENROUTER_API_KEY` set in **Trigger.dev** (Production environment).
- `TRIGGER_SECRET_KEY` (production key) set in **Vercel** (Production env).

## Steps

### 1. Deploy Trigger.dev tasks
- `npx trigger.dev@latest deploy` — bundles and deploys tasks to the Production environment of your Trigger.dev project.
- Confirm in the Trigger.dev dashboard that `qualify-lead` shows up under tasks for the Production env.

### 2. Push to GitHub `main`
- `git push origin main` — Vercel auto-deploys.
- Watch the build; confirm it succeeds.

### 3. Smoke test in production
- Open the Vercel URL.
- Submit a known-good lead.
- Verify a run appears in the Trigger.dev Production dashboard and the UI shows the result.

### 4. Promote / iterate
- Repeat for any new task changes — `npx trigger.dev@latest deploy` then `git push`.
- Frontend-only changes only need the `git push`.

## Verification
- Production URL works end-to-end.
- Trigger.dev Production env shows successful runs of `qualify-lead`.
- No errors in Vercel function logs or Trigger.dev run logs.

## Gotchas
- The Trigger.dev secret key for Dev vs Production are different — putting the dev key in Vercel Production silently routes prod runs to the dev environment. Double-check.
- `npx trigger.dev@latest deploy` defaults to the current git branch's environment mapping; confirm it's targeting `prod` when intended.
- If a deploy fails after working locally, check Trigger.dev's build logs for missing env vars or unsupported Node APIs.
