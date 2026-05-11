# 06 — Add Supabase auth + per-user lead history

This playbook captures how authentication and history persistence are wired into the Lead Qualifier. Follow it when:

- standing up a fresh dev environment,
- adding new database schema (write a migration), or
- deploying schema changes to production.

The work itself has already been done once — this is the recipe so the next person (or fresh Claude) can repeat or extend it safely.

---

## What's in place

- **Schema**: `qualifications` table (`id`, `user_id`, `run_id`, `status`, `lead_input`, `result`, `error`, `created_at`) with RLS on. Two policies: `select own` and `insert own`. Updates are performed by the Trigger.dev task using the service-role key (RLS-bypassing). Schema lives in [supabase/migrations/](../supabase/migrations/).
- **Auth**: email + password via `@supabase/ssr`. Pages at `/login` and `/signup`. Email confirmation goes through `/auth/callback`. Sign-out POSTs to `/logout`.
- **Route protection**: [middleware.ts](../middleware.ts) refreshes the session cookie on every request and redirects unauthenticated requests for any non-public path to `/login?redirectTo=…`.
- **Write path**: server action ([src/app/actions/qualify.ts](../src/app/actions/qualify.ts)) inserts a `status='pending'` row, triggers the Trigger.dev task with `{ ...lead, qualificationId, userId }`, then patches `run_id`. The task ([src/trigger/qualify-lead.ts](../src/trigger/qualify-lead.ts)) updates the row to `completed` / `failed` via [src/lib/supabase/admin.ts](../src/lib/supabase/admin.ts).
- **Read path**: `/history` ([src/app/history/page.tsx](../src/app/history/page.tsx)) is a server component that selects all rows; RLS scopes the result to the current user.

---

## Local dev setup (Docker required)

1. Boot the local stack: `npx supabase start`. The CLI prints the API URL, the publishable key, and the secret (service-role) key. `npx supabase status` re-prints them.
2. Apply migrations (idempotent): `npx supabase db reset`.
3. Drop credentials into env files. Two env files; do not mix them up:
   - [.env.local](../.env.local) (Next.js):
     - `NEXT_PUBLIC_SUPABASE_URL` — API URL from `supabase status`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the publishable key
     - `TRIGGER_SECRET_KEY` — dev key from cloud.trigger.dev
   - [.env](../.env) (Trigger.dev local dev):
     - `OPENROUTER_API_KEY`
     - `NEXT_PUBLIC_SUPABASE_URL` (same URL)
     - `SUPABASE_SERVICE_ROLE_KEY` — the secret key from `supabase status`
4. Start the dev stack: `npm run dev` + `npx trigger.dev@latest dev` in two terminals.
5. Open http://127.0.0.1:3000 — you should be redirected to `/login`. Sign up; the confirmation email lands in Mailpit (URL also in `supabase status`).

### Port conflicts

If another local Supabase project is already running on the default ports (54321–54327), bump every port in [supabase/config.toml](../supabase/config.toml) by 1000 (e.g. 55321, 55322 …) before `supabase start`. Each project keeps its own port allotment in config.

---

## Pointing dev at the remote project (alternative to the local stack)

Sometimes you'd rather develop straight against the real Supabase project (e.g. so the Trigger.dev task's writes land where the team can see them). To do that, put the prod values from Supabase Dashboard → Project Settings → API into the *same* env vars listed above instead of the local CLI's keys. The Trigger.dev task's service-role key must match the project the Next.js side is signing users into — otherwise the foreign key on `auth.users(id)` won't find the row.

---

## Adding a new migration

```bash
npx supabase migration new add_<thing>
# Edit the generated SQL file under supabase/migrations/
npx supabase db reset            # replay locally
npx supabase db push             # apply to the linked remote project
```

The linked remote project ref + db password are stored in [.env](../.env) as `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD`. The CLI picks them up automatically — but never commit them.

If you haven't linked yet: `npx supabase link --project-ref <ref>` (prompts for the db password, or set `SUPABASE_DB_PASSWORD` in your shell).

---

## Deployment

1. **Push schema** to prod: `npx supabase db push`.
2. **Deploy the task**: `npx trigger.dev@latest deploy`. The task pulls `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the Trigger.dev project env (see [trigger.config.ts](../trigger.config.ts) `SYNCED_VARS`).
3. **Push the frontend**: `git push origin main`. Set on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `TRIGGER_SECRET_KEY`. **Never** set `SUPABASE_SERVICE_ROLE_KEY` on Vercel — the service-role key is task-only.

The deploy step itself is otherwise unchanged from [05-deploy.md](05-deploy.md).

---

## Gotchas

- **Service-role key never goes to the browser.** It only lives in `.env` (local Trigger.dev dev) and the Trigger.dev project env (prod). If you ever see it in a `NEXT_PUBLIC_*` var, fix it.
- **`createServerClient` in `cookies.setAll` may throw inside a Server Component.** [src/lib/supabase/server.ts](../src/lib/supabase/server.ts) swallows the throw — that's intentional; the middleware handles cookie refresh.
- **`useSearchParams` requires a Suspense boundary.** The login/signup pages wrap `<AuthForm>` in `<Suspense>` for that reason.
- **Local Supabase emails go to Mailpit**, not the user's inbox. Click the confirmation link in Mailpit to finish signup locally.
- **RLS is enforced for selects/inserts but not for the task's writes**, which use the service-role key on purpose. If you ever add `update` or `delete` policies, double-check they don't also block the service-role updater.
