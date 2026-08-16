alter table public.profiles enable row level security;
alter table public.employment_roles enable row level security;
alter table public.knowledge_items enable row level security;
alter table public.evidence_items enable row level security;
alter table public.applications enable row level security;
alter table public.resume_versions enable row level security;
alter table public.knowledge_update_proposals enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "employment_roles_select_own" on public.employment_roles for select to authenticated using ((select auth.uid()) = user_id);
create policy "employment_roles_insert_own" on public.employment_roles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "employment_roles_update_own" on public.employment_roles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "employment_roles_delete_own" on public.employment_roles for delete to authenticated using ((select auth.uid()) = user_id);

create policy "knowledge_items_select_own" on public.knowledge_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "knowledge_items_insert_own" on public.knowledge_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "knowledge_items_update_own" on public.knowledge_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "knowledge_items_delete_own" on public.knowledge_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "evidence_items_select_own" on public.evidence_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "evidence_items_insert_own" on public.evidence_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "evidence_items_update_own" on public.evidence_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "evidence_items_delete_own" on public.evidence_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "applications_select_own" on public.applications for select to authenticated using ((select auth.uid()) = user_id);
create policy "applications_insert_own" on public.applications for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "applications_update_own" on public.applications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "applications_delete_own" on public.applications for delete to authenticated using ((select auth.uid()) = user_id);

create policy "resume_versions_select_own" on public.resume_versions for select to authenticated using ((select auth.uid()) = user_id);
create policy "resume_versions_insert_own" on public.resume_versions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "resume_versions_update_own" on public.resume_versions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "resume_versions_delete_own" on public.resume_versions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "knowledge_update_proposals_select_own" on public.knowledge_update_proposals for select to authenticated using ((select auth.uid()) = user_id);
create policy "knowledge_update_proposals_insert_own" on public.knowledge_update_proposals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "knowledge_update_proposals_update_own" on public.knowledge_update_proposals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "knowledge_update_proposals_delete_own" on public.knowledge_update_proposals for delete to authenticated using ((select auth.uid()) = user_id);
