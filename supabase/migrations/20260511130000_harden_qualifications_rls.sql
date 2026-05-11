alter table public.qualifications
  add constraint qualifications_status_check
  check (status in ('pending', 'completed', 'failed'));

drop policy if exists "insert own" on public.qualifications;

create policy "insert own pending" on public.qualifications
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and run_id is null
    and result is null
    and error is null
  );

revoke update on table public.qualifications from anon, authenticated;
grant update (run_id, status, error) on table public.qualifications to authenticated;

create policy "update own pending metadata" on public.qualifications
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and status = 'pending'
    and result is null
  )
  with check (
    auth.uid() = user_id
    and result is null
    and (
      status = 'pending'
      or (status = 'failed' and error is not null)
    )
  );
