# 01 — Bootstrap project

## Goal
Have a working Next.js + Trigger.dev v3 monorepo in this directory, pushed to GitHub, linked to Vercel and Trigger.dev cloud.

## Preconditions
- Node ≥ 20, npm ≥ 10
- GitHub account + a `gh` CLI logged in (or do the GitHub steps in the browser)
- Trigger.dev cloud account (https://cloud.trigger.dev)
- Vercel account linked to GitHub
- An OpenRouter account with an API key

## Steps

### 1. Initialize Next.js (App Router, TypeScript) at the repo root
- Run the official Next.js initializer in this directory.
- Choose: TypeScript = yes, ESLint = yes, Tailwind = (your call), App Router = yes, `src/` directory = yes, import alias = `@/*`.

### 2. Add Trigger.dev v3 to the same repo
- `npx trigger.dev@latest init` — choose TypeScript, accept the default `src/trigger/` directory.
- Confirm `trigger.config.ts` exists and points at `src/trigger`.

### 3. Install the OpenAI SDK
- `npm i openai`
- (Used as the OpenRouter client — see CLAUDE.md for the pattern.)

### 4. Wire env vars
- Create `.env.local` (Next.js) and `.env` (Trigger.dev local dev). Both gitignored.
- Add `OPENROUTER_API_KEY` to `.env`.
- Add `TRIGGER_SECRET_KEY` to `.env.local` (copy from Trigger.dev dashboard).

### 5. Git + GitHub
- `git init`, sensible `.gitignore` (Next.js + Trigger.dev defaults already cover most of it; ensure `.env*` is excluded).
- Create the GitHub repo and push `main`.

### 6. Vercel
- Import the GitHub repo in Vercel.
- Set the same env vars in the Vercel project settings (Production + Preview).

### 7. Trigger.dev cloud
- `npx trigger.dev@latest login`
- `npx trigger.dev@latest deploy` — pushes the (currently empty) tasks bundle so the project exists in cloud.
- Set `OPENROUTER_API_KEY` in the Trigger.dev project's environment variables.

## Verification
- `npm run dev` boots Next.js at http://localhost:3000.
- `npx trigger.dev@latest dev` connects to the Trigger.dev dashboard with no errors.
- A push to `main` produces a successful Vercel deploy.

## Gotchas
- Don't commit `.env*`. Double-check `git status` before the first push.
- The `TRIGGER_SECRET_KEY` for *production* is different from *dev* — make sure Vercel has the right one for each environment.
