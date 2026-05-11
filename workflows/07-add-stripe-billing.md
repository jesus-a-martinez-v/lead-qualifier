# 07 — Add Stripe billing (Free tier + $29/mo Pro)

This playbook captures how Stripe billing is wired into the Lead Qualifier. Follow it when:

- standing up Stripe in a fresh environment,
- changing the daily free limit or the Pro price,
- debugging a subscription that's out of sync with what the user sees.

The work itself has already been done once — this is the recipe.

---

## What's in place

- **Plans**: Free (2 completed qualifications / day, UTC reset) and Pro ($29 / month, unlimited). Constants live in [src/lib/billing/plans.ts](../src/lib/billing/plans.ts).
- **Schema** ([supabase/migrations/20260511150000_stripe_billing.sql](../supabase/migrations/20260511150000_stripe_billing.sql)):
  - `stripe_customers` — 1:1 mapping `user_id → stripe_customer_id`.
  - `subscriptions` — mirror of Stripe state keyed on the Stripe sub id (`sub_…`): `status`, `price_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, `canceled_at`.
  - Both have RLS on with `select own` policies; **only the service-role webhook handler writes** to them.
- **Stripe SDK** ([src/lib/stripe.ts](../src/lib/stripe.ts)): lazy `stripe()` factory + `STRIPE_PRICE_ID` + `ACTIVE_STATUSES = {"active", "trialing"}`.
- **Pro check** ([src/lib/billing/state.ts](../src/lib/billing/state.ts)): `getBillingState()` joins the two tables; a user is "effectively Pro" iff they have a subscription with `status ∈ ACTIVE_STATUSES` AND `current_period_end > now()`. This naturally retains Pro through a cancel-at-period-end grace period.
- **Gate** ([src/app/actions/qualify.ts](../src/app/actions/qualify.ts)): if `!isPro`, count `qualifications` from today with `status='completed'`; reject with `code: "LIMIT_REACHED"` when ≥ `FREE_DAILY_LIMIT`. Failed runs don't deplete quota; race condition (parallel submits) is accepted.
- **API routes**:
  - `POST /api/stripe/checkout` — creates the Stripe customer if needed, returns a Checkout Session URL.
  - `POST /api/stripe/portal` — returns a Customer Portal URL for cancel / payment-method changes.
  - `POST /api/stripe/webhook` — verifies signature, then upserts `stripe_customers` + `subscriptions`. Handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
- **UI**:
  - `/billing` — pricing cards, upgrade / manage buttons, renewal/cancellation details.
  - `/` — usage chip ("Free · N/2 left today" or "Pro · unlimited"); when the limit is hit the form's Analyze button is disabled and an inline "Upgrade to Pro" link appears.
  - Header: `/billing` link next to History.
- **Middleware** ([src/middleware.ts](../src/middleware.ts)): `/api/stripe/webhook` is in `PUBLIC_PATHS` so Stripe deliveries aren't redirected to `/login`. `/api/stripe/checkout` and `/api/stripe/portal` stay auth-gated.

---

## Stripe dashboard setup (one-time)

1. **Product + price**: Stripe Dashboard → Products → New → "Lead Qualifier Pro" → recurring **$29 USD / month** → copy the `price_…` id into `STRIPE_PRICE_ID` (both env files and Vercel).
2. **Customer Portal**: Settings → Billing → Customer Portal → Activate. Allow "Cancel subscription" and "Update payment method"; leave plan switching off (single plan).
3. **Webhook endpoint (prod)**: Developers → Webhooks → Add endpoint → `https://<vercel-domain>/api/stripe/webhook` → select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

   Copy the signing secret into Vercel as `STRIPE_WEBHOOK_SECRET`.

---

## Local dev setup

Three terminals, plus the local Supabase stack from [06-add-supabase-auth.md](06-add-supabase-auth.md):

```bash
# 1. Next.js
npm run dev

# 2. Trigger.dev
npx trigger.dev@latest dev

# 3. Stripe CLI — forwards prod-shaped webhook events to your local app
stripe login           # one-time
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`stripe listen` prints `whsec_…` on startup — paste it into [.env.local](../.env.local) as `STRIPE_WEBHOOK_SECRET`. This secret is **different** from the production webhook secret; each `stripe listen` session also rotates its own.

Other env vars in `.env.local` (see [.env.example](../.env.example)):

| Var | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` from https://dashboard.stripe.com/test/apikeys |
| `STRIPE_PRICE_ID` | `price_…` for the test-mode $29/mo recurring price |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from `stripe listen` |
| `NEXT_PUBLIC_SITE_URL` | Optional locally — defaults to the request origin |

**End-to-end test:**

1. Sign up. Open `/` — chip shows `Free · 2/2 left today`.
2. Submit one lead. Wait for it to complete (chip updates after refresh).
3. Submit a second. Then submit a third → the form rejects with a "Daily free limit reached" inline upgrade link.
4. Click Upgrade → Stripe Checkout. Use card `4242 4242 4242 4242`, any future expiry / any CVC.
5. After redirect to `/billing?upgraded=1`: `stripe listen` should show `checkout.session.completed` (and a follow-up `customer.subscription.created`). Run `select * from subscriptions, stripe_customers` — both rows populated.
6. Submit a 3rd qualification — succeeds.
7. Hit Manage → Customer Portal → Cancel. Webhook fires `customer.subscription.updated` with `cancel_at_period_end=true`; the row updates; `/billing` shows "Cancels on `<date>`"; Pro features still work.
8. Simulate period-end: `stripe trigger customer.subscription.deleted` → row's `status` becomes `canceled` → user is back on Free.

---

## Deployment

1. Push schema (the migration is already committed): `npx supabase db push`.
2. Set on Vercel: `STRIPE_SECRET_KEY` (live), `STRIPE_WEBHOOK_SECRET` (from the dashboard webhook), `STRIPE_PRICE_ID` (live-mode price id), `NEXT_PUBLIC_SITE_URL`.
3. `git push origin main`.
4. Verify in Stripe Dashboard → Webhooks: the production endpoint should show `200 OK` for the events delivered during a real upgrade.

---

## Common changes

- **Change the daily free limit**: edit `FREE_DAILY_LIMIT` in [src/lib/billing/plans.ts](../src/lib/billing/plans.ts). No migration needed.
- **Change the Pro price**: create a new price in Stripe, swap `STRIPE_PRICE_ID` in Vercel + `.env.local`, and update `PRO_PRICE_USD` in [src/lib/billing/plans.ts](../src/lib/billing/plans.ts) so the UI matches. Existing subscribers stay on their original price until they re-subscribe.
- **Switch to annual**: create a new recurring price (interval = year) in Stripe, update the env var. The webhook handler is interval-agnostic — `current_period_end` simply lands 365 days out.
- **Add a second plan**: extend the helpers to read `price_id` off the subscription row and branch the UI on it. The DB already stores `price_id`.
- **Change which statuses count as "active"**: edit `ACTIVE_STATUSES` in [src/lib/stripe.ts](../src/lib/stripe.ts). Note that adding `past_due` means a user with a failed renewal payment retains Pro during Stripe's retry window.

---

## Gotchas

- **Raw body for webhooks.** Signature verification needs the unparsed body. [src/app/api/stripe/webhook/route.ts](../src/app/api/stripe/webhook/route.ts) uses `await req.text()` — never replace that with `req.json()` or the verification will fail.
- **`current_period_*` moved to subscription items.** With the `2026-04-22.dahlia` API version, Stripe's `Subscription` no longer carries `current_period_start/end` at the top level; they live on `sub.items.data[0]`. The webhook reads them from there.
- **Race condition.** Two parallel free-tier submits can both pass the `< 2` check and proceed. Worst case the user gets 3 in a day. Acceptable; do not add table-level locking.
- **Middleware must let the webhook through.** `/api/stripe/webhook` is in `PUBLIC_PATHS` for that reason. If you change `PUBLIC_PATHS`, keep it in there.
- **Local `whsec_…` ≠ prod.** Each `stripe listen` session prints its own secret; the production webhook endpoint has a separate one in the dashboard. Don't paste one in place of the other.
- **Service-role only writes billing tables.** Both `stripe_customers` and `subscriptions` have `select own` but no insert/update/delete policies for `authenticated`. The webhook uses [src/lib/supabase/admin.ts](../src/lib/supabase/admin.ts) to bypass RLS.
- **Cancel grace period.** Stripe doesn't fire `subscription.deleted` until the actual period end — it fires `subscription.updated` with `cancel_at_period_end=true` immediately. `getBillingState` checks `current_period_end > now()` so the user keeps Pro through the grace window.
- **Webhook idempotency.** Every handler is an UPSERT keyed by Stripe id. Duplicate deliveries are safe; you don't need to dedupe by event id.
