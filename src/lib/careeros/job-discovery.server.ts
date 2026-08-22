import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseConfig } from "@/lib/auth/config";
import type { CareerOsData } from "./types";
import type {
  DiscoveredJob,
  JobDiscoveryRunKind,
  JobDiscoveryRunStatus,
  JobSearchPreferences,
} from "./job-discovery.types";

export type JobDiscoveryServerEnv = {
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  RESEND_API_KEY?: string;
  JOB_DISCOVERY_FROM_EMAIL?: string;
  PUBLIC_APP_URL?: string;
};

export function readJobDiscoveryServerEnv(): JobDiscoveryServerEnv {
  return {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    JOB_DISCOVERY_FROM_EMAIL: process.env.JOB_DISCOVERY_FROM_EMAIL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  };
}

export function createJobDiscoveryServiceClient(
  env: JobDiscoveryServerEnv = readJobDiscoveryServerEnv(),
): SupabaseClient {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(getSupabaseConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function loadCareerStateForUser(
  client: SupabaseClient,
  userId: string,
): Promise<CareerOsData | null> {
  const { data, error } = await client
    .from("career_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("CareerOS discovery could not read career_state.");
  return (data?.data as CareerOsData | undefined) ?? null;
}

export async function listPreferenceUsers(client: SupabaseClient): Promise<JobSearchPreferences[]> {
  const { data, error } = await client
    .from("job_search_preferences")
    .select(
      "user_id,exact_titles,adjacent_titles,seniority,industries,locations,salary_min,salary_currency,workplace_types,employment_types,include_uk,include_global_uk_hireable,include_relocation_sponsorship,email_alerts_enabled,derived_from_profile_at,manual_overrides,created_at,updated_at",
    );
  if (error) throw new Error("CareerOS discovery could not list search preferences.");
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    exactTitles: row.exact_titles ?? [],
    adjacentTitles: row.adjacent_titles ?? [],
    seniority: row.seniority ?? [],
    industries: row.industries ?? [],
    locations: row.locations ?? [],
    salaryMin: row.salary_min,
    salaryCurrency: row.salary_currency ?? "GBP",
    workplaceTypes: row.workplace_types ?? [],
    employmentTypes: row.employment_types ?? [],
    includeUk: row.include_uk,
    includeGlobalUkHireable: row.include_global_uk_hireable,
    includeRelocationSponsorship: row.include_relocation_sponsorship,
    emailAlertsEnabled: row.email_alerts_enabled,
    derivedFromProfileAt: row.derived_from_profile_at,
    manualOverrides: row.manual_overrides ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })) as JobSearchPreferences[];
}

function jobRow(job: DiscoveredJob, userId: string) {
  return {
    id: job.id,
    user_id: userId,
    dedupe_key: job.dedupeKey,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    description_word_count: job.descriptionWordCount,
    industry: job.industry,
    seniority: job.seniority,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_currency: job.salaryCurrency,
    salary_text: job.salaryText,
    workplace_type: job.workplaceType,
    employment_type: job.employmentType,
    date_posted: job.datePosted,
    closing_date: job.closingDate,
    uk_eligibility: job.ukEligibility,
    visa_sponsorship: job.visaSponsorship,
    match_type: job.matchType,
    source_refs: job.sourceRefs,
    preferred_source_url: job.preferredSourceUrl,
    preferred_apply_url: job.preferredApplyUrl,
    status: job.status,
    status_reason: job.statusReason,
    last_status_check_at: job.lastStatusCheckAt,
    first_seen_at: job.firstSeenAt,
    last_seen_at: job.lastSeenAt,
    archived_at: job.archivedAt,
    saved: job.saved,
    fit_score: job.fitScore,
    fit_verdict: job.fitVerdict,
    fit_strategy: job.fitStrategy,
    fit_scored_at: job.fitScoredAt,
    fit_description_signature: job.fitDescriptionSignature,
  };
}

export function createServiceRefreshRepository(client: SupabaseClient, userId: string) {
  return {
    async listExistingJobs(): Promise<DiscoveredJob[]> {
      const { data, error } = await client
        .from("discovered_jobs")
        .select("*")
        .eq("user_id", userId);
      if (error) throw new Error("CareerOS discovery could not read existing jobs.");
      return (data ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        dedupeKey: row.dedupe_key,
        title: row.title,
        company: row.company,
        location: row.location,
        description: row.description,
        descriptionWordCount: row.description_word_count,
        industry: row.industry,
        seniority: row.seniority,
        salaryMin: row.salary_min,
        salaryMax: row.salary_max,
        salaryCurrency: row.salary_currency,
        salaryText: row.salary_text,
        workplaceType: row.workplace_type,
        employmentType: row.employment_type,
        datePosted: row.date_posted,
        closingDate: row.closing_date,
        ukEligibility: row.uk_eligibility,
        visaSponsorship: row.visa_sponsorship,
        matchType: row.match_type,
        sourceRefs: Array.isArray(row.source_refs) ? row.source_refs : [],
        preferredSourceUrl: row.preferred_source_url,
        preferredApplyUrl: row.preferred_apply_url,
        status: row.status,
        statusReason: row.status_reason,
        lastStatusCheckAt: row.last_status_check_at,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        archivedAt: row.archived_at,
        saved: row.saved,
        fitScore: row.fit_score,
        fitVerdict: row.fit_verdict,
        fitStrategy: row.fit_strategy,
        fitScoredAt: row.fit_scored_at,
        fitDescriptionSignature: row.fit_description_signature,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) as DiscoveredJob[];
    },
    async upsertJobs(ownerUserId: string, jobs: DiscoveredJob[]) {
      if (!jobs.length) return;
      const { error } = await client
        .from("discovered_jobs")
        .upsert(jobs.map((job) => jobRow(job, ownerUserId)), { onConflict: "user_id,dedupe_key" });
      if (error) throw new Error("CareerOS discovery could not save refreshed jobs.");
    },
  };
}

export async function startDiscoveryRun(
  client: SupabaseClient,
  input: { userId: string; runKind: JobDiscoveryRunKind; runDay: string; startedAt: string },
) {
  const { data, error } = await client
    .from("job_discovery_runs")
    .insert({
      user_id: input.userId,
      run_kind: input.runKind,
      run_day: input.runDay,
      started_at: input.startedAt,
      status: "running",
    })
    .select("id,email_sent_at")
    .single();
  if (error || !data) throw error ?? new Error("Could not start discovery run.");
  return { id: data.id as string, emailSentAt: data.email_sent_at as string | null };
}

export async function findScheduledRun(client: SupabaseClient, userId: string, runDay: string) {
  const { data, error } = await client
    .from("job_discovery_runs")
    .select("id,status,email_sent_at")
    .eq("user_id", userId)
    .eq("run_kind", "scheduled")
    .eq("run_day", runDay)
    .maybeSingle();
  if (error) throw new Error("Could not read scheduled discovery run.");
  return data as { id: string; status: JobDiscoveryRunStatus; email_sent_at: string | null } | null;
}

export async function finishDiscoveryRun(
  client: SupabaseClient,
  input: {
    id: string;
    status: JobDiscoveryRunStatus;
    sourceResults: Record<string, unknown>;
    newJobs: number;
    updatedJobs: number;
    archivedJobs: number;
    completedAt: string;
    errorSummary?: string | null;
  },
) {
  const { error } = await client
    .from("job_discovery_runs")
    .update({
      status: input.status,
      source_results: input.sourceResults,
      new_jobs: input.newJobs,
      updated_jobs: input.updatedJobs,
      archived_jobs: input.archivedJobs,
      completed_at: input.completedAt,
      error_summary: input.errorSummary ?? null,
    })
    .eq("id", input.id);
  if (error) throw new Error("Could not complete discovery run.");
}

export async function markDiscoveryEmailSent(client: SupabaseClient, runId: string, sentAt: string) {
  const { error } = await client
    .from("job_discovery_runs")
    .update({ email_sent_at: sentAt })
    .eq("id", runId)
    .is("email_sent_at", null);
  if (error) throw new Error("Could not record discovery email delivery.");
}

export async function getUserEmail(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(userId);
  if (error) return null;
  return data.user?.email ?? null;
}
