-- Stripe billing: per-user customer mapping + mirrored subscription state.
-- Only the service-role webhook handler writes; users read their own rows.

create table public.stripe_customers (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text not null unique,
  created_at           timestamptz not null default now()
);

alter table public.stripe_customers enable row level security;

create policy "select own customer" on public.stripe_customers
  for select to authenticated using (auth.uid() = user_id);

-- No insert/update/delete policies for anon/authenticated: service role only.

create table public.subscriptions (
  id                       text primary key,                  -- Stripe sub id (sub_...)
  user_id                  uuid not null references auth.users(id) on delete cascade,
  status                   text not null,                     -- active, trialing, past_due, canceled, incomplete, ...
  price_id                 text not null,
  current_period_start     timestamptz not null,
  current_period_end       timestamptz not null,
  cancel_at_period_end     boolean not null default false,
  canceled_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx  on public.subscriptions (status);

alter table public.subscriptions enable row level security;

create policy "select own subscriptions" on public.subscriptions
  for select to authenticated using (auth.uid() = user_id);

-- No insert/update/delete policies for anon/authenticated: service role only.
