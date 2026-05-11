# Lead Qualifier

AI-powered lead qualification. A user fills out a lead form in the browser, clicks **Analyze**, a Trigger.dev task evaluates the lead with an LLM (via OpenRouter), and the result streams back into the UI in realtime.

```
Browser (Next.js form on Vercel) ──Supabase Auth (email+password)──▶ sign-in
   │
   │  authenticated server action inserts a pending qualifications row,
   │  triggers run, subscribes via Trigger.dev React hooks (realtime)
   ▼
Trigger.dev task ──► OpenRouter (OpenAI-compatible SDK) ──► chosen LLM
   │                                  │
   │                                  ▼ writes result back to qualifications row (service-role)
   ▼ realtime stream of progress + final qualification result   ─► /history reads own rows (RLS)
```

---

## WAT framework

This project is organized under the **WAT framework** — a convention for splitting a Claude-Code-driven project into the three things that actually matter:

| Letter | Meaning | Where it lives |
|--------|---------|----------------|
| **W** — Workflows | Markdown playbooks telling Claude Code *how* to do each kind of task in this repo (bootstrap, add a task, deploy, etc.) | [workflows/](workflows/) |
| **A** — Agent | Claude Code itself. The agent reads CLAUDE.md and the workflows, then executes. | *(no folder — it's me)* |
| **T** — Tools | Helper scripts (shell / TS) the agent can run during development — seed data, smoke tests, deploy helpers, etc. | [tools/](tools/) |

### Workflow-first rule

**Before starting any non-trivial task, look in [workflows/](workflows/) for a matching playbook and follow it.**

If no playbook exists for what you're about to do, and the task is non-trivial or likely to recur, write a new playbook in [workflows/](workflows/) after the work is done. The next session — possibly a fresh Claude — will be much faster because of it.

---

## Tech stack

- **Frontend** — Next.js (App Router), TypeScript, deployed to **Vercel** via GitHub (auto-deploy on push to `main`).
- **Backend** — **Trigger.dev v3** TypeScript tasks. Tasks live in [src/trigger/](src/trigger/) (once scaffolded). Local dev with `npx trigger.dev@latest dev`.
- **LLM** — **OpenRouter**, accessed via the **OpenAI SDK** (OpenRouter is OpenAI-compatible — no separate SDK needed). Pattern:
  ```ts
  import OpenAI from "openai";

  const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      "HTTP-Referer": "https://your-site.example",   // optional, recommended
      "X-Title": "Lead Qualifier",                   // optional, recommended
    },
  });

  const res = await openai.chat.completions.create({
    model: "anthropic/claude-sonnet-4-6",            // any OpenRouter model id
    messages: [...],
  });
  ```
  Verify the current base URL and recommended headers at https://openrouter.ai/docs when wiring this up — they occasionally change.
- **Realtime UI** — Trigger.dev React hooks (`useRealtimeRun`) subscribe the browser to a run using a short-lived public access token returned from a server action.
- **Auth + persistence** — **Supabase** (Postgres + GoTrue). Email+password auth via `@supabase/ssr`. Schema lives in [supabase/migrations/](supabase/migrations/) and is managed with the **Supabase CLI** (`npx supabase ...`). The Trigger.dev task uses the service-role key to UPSERT results into `qualifications`; the Next.js server-action and `/history` page read/write through the publishable key, gated by RLS so each user only sees their own rows.

---

## Environment variables

| Variable | Lives in | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Trigger.dev dashboard | LLM provider key, used inside the qualifier task |
| `TRIGGER_SECRET_KEY` | Vercel (server-side only) | Lets the Next.js server action enqueue runs and mint public access tokens |
| `NEXT_PUBLIC_TRIGGER_API_URL` | Vercel (only if self-hosting Trigger.dev) | Custom Trigger.dev API URL; omit when using Trigger.dev cloud |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + `.env` + Vercel + Trigger.dev | Supabase project URL — needed by every Supabase client (browser, server, task) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` + Vercel | Public/anon key for browser + server-action auth. Safe to ship to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` + Trigger.dev dashboard | Service-role key. **Server-only / Trigger.dev-only.** Bypasses RLS so the task can write results back |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | `.env` (local only) | Consumed by `npx supabase link` / `db push` for managing migrations against the remote project |

Never commit `.env*` files. Local development uses `.env.local` (Next.js) and `.env` (Trigger.dev). Migration files in [supabase/migrations/](supabase/migrations/) are committed.

---

## Commands

> The project is not scaffolded yet. Run [workflows/01-bootstrap-project.md](workflows/01-bootstrap-project.md) first; afterwards these commands will work.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server (frontend) |
| `npx trigger.dev@latest dev` | Trigger.dev local dev — watches `src/trigger/*.ts`, runs tasks against the dev environment |
| `npx trigger.dev@latest deploy` | Deploys tasks to Trigger.dev cloud |
| `npx supabase start` / `stop` | Boot or shut down the local Supabase stack (Docker). Run `supabase status` for URLs + keys |
| `npx supabase migration new <name>` | Create a new timestamped SQL migration in `supabase/migrations/` |
| `npx supabase db reset` | Replay every migration against the local stack from scratch (dev only — destroys local data) |
| `npx supabase db push` | Apply pending migrations to the linked remote project |
| `git push origin main` | Triggers a Vercel production deploy of the frontend |

---

## Repository layout

```
lead-qualifier/
├── CLAUDE.md                  ← this file
├── workflows/                 ← W: playbooks for Claude Code
│   ├── README.md
│   ├── 01-bootstrap-project.md
│   ├── 02-define-rubric.md
│   ├── 03-build-qualifier-task.md
│   ├── 04-build-frontend-form.md
│   ├── 05-deploy.md
│   └── 06-add-supabase-auth.md
├── tools/                     ← T: dev helper scripts
│   └── README.md
│
│ ── once bootstrapped: ──
├── src/
│   ├── app/                   ← Next.js App Router
│   │   ├── page.tsx           ← `/` lead form (auth-protected)
│   │   ├── history/page.tsx   ← `/history` past qualifications
│   │   ├── login/page.tsx     ← `/login`
│   │   ├── signup/page.tsx    ← `/signup`
│   │   ├── auth/callback/route.ts  ← email-confirm + PKCE exchange
│   │   ├── logout/route.ts    ← POST → sign out → /login
│   │   └── actions/qualify.ts ← server action: auth-gated, inserts qualifications row, triggers task
│   ├── lib/supabase/          ← `client.ts` (browser), `server.ts` (SSR), `admin.ts` (service-role)
│   └── trigger/               ← Trigger.dev tasks (qualifier writes results back via service-role client)
├── supabase/                  ← Supabase CLI workspace
│   ├── config.toml
│   └── migrations/            ← versioned SQL migrations (`db push`-able)
├── middleware.ts              ← refreshes session cookie + redirects unauthenticated requests
├── trigger.config.ts
├── next.config.ts
├── package.json
└── .env.local / .env          ← gitignored
```

---

## Conventions

- TypeScript everywhere — no `.js` source files.
- No secrets in code or in commits. Read everything from `process.env`.
- Keep the qualification rubric in one place ([workflows/02-define-rubric.md](workflows/02-define-rubric.md) → eventually a typed schema in `src/`) so prompt and validation stay in sync.
- When you add a new capability, add or update the relevant playbook in [workflows/](workflows/).
