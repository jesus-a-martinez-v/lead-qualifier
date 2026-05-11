create table qualifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  run_id      text,
  status      text not null default 'pending',
  lead_input  jsonb not null,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now()
);

create index qualifications_user_id_created_at_idx
  on qualifications (user_id, created_at desc);

alter table qualifications enable row level security;

create policy "select own" on qualifications
  for select using (auth.uid() = user_id);

create policy "insert own" on qualifications
  for insert with check (auth.uid() = user_id);
