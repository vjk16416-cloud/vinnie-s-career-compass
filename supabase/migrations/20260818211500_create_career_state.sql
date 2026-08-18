create table if not exists public.career_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1 check (schema_version > 0),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.career_state enable row level security;

revoke all on table public.career_state from anon;
grant select, insert, update on table public.career_state to authenticated;

create policy "career_state_select_own"
on public.career_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "career_state_insert_own"
on public.career_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "career_state_update_own"
on public.career_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.set_career_state_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists career_state_set_updated_at on public.career_state;
create trigger career_state_set_updated_at
before update on public.career_state
for each row
execute function public.set_career_state_updated_at();
