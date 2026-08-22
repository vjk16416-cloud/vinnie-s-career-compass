create table if not exists public.job_search_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  exact_titles text[] not null default '{}',
  adjacent_titles text[] not null default '{}',
  seniority text[] not null default '{}',
  industries text[] not null default '{}',
  locations text[] not null default '{}',
  salary_min integer,
  salary_currency text not null default 'GBP',
  workplace_types text[] not null default '{Remote,Hybrid,On-site}',
  employment_types text[] not null default '{Permanent,Contract,Fixed-term}',
  include_uk boolean not null default true,
  include_global_uk_hireable boolean not null default true,
  include_relocation_sponsorship boolean not null default true,
  email_alerts_enabled boolean not null default true,
  derived_from_profile_at timestamptz,
  manual_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(manual_overrides) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_min >= 0)
);

create table if not exists public.discovered_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  title text not null,
  company text not null,
  location text,
  description text,
  description_word_count integer not null default 0 check (description_word_count >= 0),
  industry text,
  seniority text,
  salary_min integer,
  salary_max integer,
  salary_currency text,
  salary_text text,
  workplace_type text,
  employment_type text,
  date_posted date,
  closing_date date,
  uk_eligibility text not null default 'unknown' check (uk_eligibility in ('confirmed', 'likely', 'unknown', 'excluded')),
  visa_sponsorship text not null default 'unknown' check (visa_sponsorship in ('confirmed', 'possible', 'unknown', 'none')),
  match_type text not null default 'other' check (match_type in ('exact', 'adjacent', 'other')),
  source_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(source_refs) = 'array'),
  preferred_source_url text,
  preferred_apply_url text,
  status text not null default 'uncertain' check (status in ('active', 'closing_soon', 'expired', 'uncertain')),
  status_reason text not null default 'CareerOS has not verified this vacancy yet.',
  last_status_check_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  saved boolean not null default false,
  fit_score integer check (fit_score is null or fit_score between 0 and 100),
  fit_verdict text,
  fit_strategy text,
  fit_scored_at timestamptz,
  fit_description_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  check (salary_min is null or salary_min >= 0),
  check (salary_max is null or salary_max >= 0),
  check (salary_min is null or salary_max is null or salary_max >= salary_min)
);

create table if not exists public.job_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_kind text not null check (run_kind in ('scheduled', 'manual')),
  run_day date not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failed')),
  source_results jsonb not null default '{}'::jsonb check (jsonb_typeof(source_results) = 'object'),
  new_jobs integer not null default 0 check (new_jobs >= 0),
  updated_jobs integer not null default 0 check (updated_jobs >= 0),
  archived_jobs integer not null default 0 check (archived_jobs >= 0),
  email_sent_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now()
);

create unique index if not exists job_discovery_runs_one_scheduled_per_day
  on public.job_discovery_runs (user_id, run_day)
  where run_kind = 'scheduled';

create index if not exists discovered_jobs_user_status_fit_idx
  on public.discovered_jobs (user_id, status, fit_score desc nulls last);
create index if not exists discovered_jobs_user_first_seen_idx
  on public.discovered_jobs (user_id, first_seen_at desc);
create index if not exists discovered_jobs_user_saved_idx
  on public.discovered_jobs (user_id, saved)
  where saved = true;
create index if not exists job_discovery_runs_user_started_idx
  on public.job_discovery_runs (user_id, started_at desc);

create or replace function public.set_job_discovery_updated_at()
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

drop trigger if exists job_search_preferences_set_updated_at on public.job_search_preferences;
create trigger job_search_preferences_set_updated_at
before update on public.job_search_preferences
for each row execute function public.set_job_discovery_updated_at();

drop trigger if exists discovered_jobs_set_updated_at on public.discovered_jobs;
create trigger discovered_jobs_set_updated_at
before update on public.discovered_jobs
for each row execute function public.set_job_discovery_updated_at();

alter table public.job_search_preferences enable row level security;
alter table public.discovered_jobs enable row level security;
alter table public.job_discovery_runs enable row level security;

revoke all on table public.job_search_preferences from anon, authenticated;
revoke all on table public.discovered_jobs from anon, authenticated;
revoke all on table public.job_discovery_runs from anon, authenticated;

grant select, insert, update on table public.job_search_preferences to authenticated;
grant select on table public.discovered_jobs to authenticated;
grant update (saved) on table public.discovered_jobs to authenticated;
grant select on table public.job_discovery_runs to authenticated;

drop policy if exists "job_search_preferences_select_own" on public.job_search_preferences;
drop policy if exists "job_search_preferences_insert_own" on public.job_search_preferences;
drop policy if exists "job_search_preferences_update_own" on public.job_search_preferences;
create policy "job_search_preferences_select_own"
on public.job_search_preferences for select to authenticated
using ((select auth.uid()) = user_id);
create policy "job_search_preferences_insert_own"
on public.job_search_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "job_search_preferences_update_own"
on public.job_search_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "discovered_jobs_select_own" on public.discovered_jobs;
drop policy if exists "discovered_jobs_update_saved_own" on public.discovered_jobs;
create policy "discovered_jobs_select_own"
on public.discovered_jobs for select to authenticated
using ((select auth.uid()) = user_id);
create policy "discovered_jobs_update_saved_own"
on public.discovered_jobs for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "job_discovery_runs_select_own" on public.job_discovery_runs;
create policy "job_discovery_runs_select_own"
on public.job_discovery_runs for select to authenticated
using ((select auth.uid()) = user_id);
