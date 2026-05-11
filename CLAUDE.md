# Lead Qualifier

AI-powered lead qualification. A user fills out a lead form in the browser, clicks **Analyze**, a Trigger.dev task evaluates the lead with an LLM (via OpenRouter), and the result streams back into the UI in realtime.

```
Browser (Next.js form on Vercel)
   │
   │  triggers run + subscribes via Trigger.dev React hooks (realtime)
   ▼
Trigger.dev task ──► OpenRouter (OpenAI-compatible SDK) ──► chosen LLM
   │
   ▼ realtime stream of progress + final qualification result
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

---

## Environment variables

| Variable | Lives in | Purpose |
|----------|----------|---------|
| `OPENROUTER_API_KEY` | Trigger.dev dashboard | LLM provider key, used inside the qualifier task |
| `TRIGGER_SECRET_KEY` | Vercel (server-side only) | Lets the Next.js server action enqueue runs and mint public access tokens |
| `NEXT_PUBLIC_TRIGGER_API_URL` | Vercel (only if self-hosting Trigger.dev) | Custom Trigger.dev API URL; omit when using Trigger.dev cloud |

Never commit `.env*` files. Local development uses `.env.local` (Next.js) and `.env` (Trigger.dev).

---

## Commands

> The project is not scaffolded yet. Run [workflows/01-bootstrap-project.md](workflows/01-bootstrap-project.md) first; afterwards these commands will work.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Next.js dev server (frontend) |
| `npx trigger.dev@latest dev` | Trigger.dev local dev — watches `src/trigger/*.ts`, runs tasks against the dev environment |
| `npx trigger.dev@latest deploy` | Deploys tasks to Trigger.dev cloud |
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
│   └── 05-deploy.md
├── tools/                     ← T: dev helper scripts
│   └── README.md
│
│ ── once bootstrapped: ──
├── src/
│   ├── app/                   ← Next.js App Router (form page, server action, results UI)
│   └── trigger/               ← Trigger.dev tasks (qualifier task lives here)
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
