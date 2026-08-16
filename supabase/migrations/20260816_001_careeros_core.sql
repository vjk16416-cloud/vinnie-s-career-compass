create type public.knowledge_status as enum (
  'verified',
  'user_confirmed',
  'imported_cv',
  'imported_linkedin',
  'needs_verification',
  'archived',
  'excluded'
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  location text,
  professional_summary text,
  target_roles text[] not null default '{}',
  target_industries text[] not null default '{}',
  writing_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employment_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer text not null,
  title text not null,
  employment_type text,
  start_date date,
  end_date date,
  is_current boolean not null default false,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employment_role_id uuid,
  category text not null,
  title text not null,
  content text not null,
  star_context text,
  star_action text,
  star_result text,
  metrics jsonb not null default '{}'::jsonb,
  status public.knowledge_status not null default 'needs_verification',
  source_type text not null,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (employment_role_id, user_id)
    references public.employment_roles(id, user_id) on delete cascade
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  knowledge_item_id uuid,
  evidence_type text not null,
  source_reference text,
  notes text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (knowledge_item_id, user_id)
    references public.knowledge_items(id, user_id) on delete cascade
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  role_title text not null,
  job_url text,
  job_description text,
  status text not null default 'interested',
  compatibility_score integer check (compatibility_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid,
  version_number integer not null,
  status text not null default 'draft',
  content jsonb not null,
  evidence_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, application_id, version_number),
  foreign key (application_id, user_id)
    references public.applications(id, user_id) on delete set null (application_id)
);

create table public.knowledge_update_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_version_id uuid,
  knowledge_item_id uuid,
  proposed_change jsonb not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (resume_version_id, user_id)
    references public.resume_versions(id, user_id) on delete cascade,
  foreign key (knowledge_item_id, user_id)
    references public.knowledge_items(id, user_id) on delete set null (knowledge_item_id)
);

create index employment_roles_user_id_idx on public.employment_roles(user_id);
create index knowledge_items_user_id_idx on public.knowledge_items(user_id);
create index knowledge_items_employment_role_id_idx on public.knowledge_items(employment_role_id);
create index evidence_items_user_id_idx on public.evidence_items(user_id);
create index applications_user_id_idx on public.applications(user_id);
create index resume_versions_user_id_idx on public.resume_versions(user_id);
create index resume_versions_application_id_idx on public.resume_versions(application_id);
create index knowledge_update_proposals_user_id_idx on public.knowledge_update_proposals(user_id);
create index knowledge_update_proposals_resume_version_id_idx on public.knowledge_update_proposals(resume_version_id);
