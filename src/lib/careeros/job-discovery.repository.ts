import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DiscoveredJob,
  JobDiscoveryRun,
  JobSearchPreferences,
  JobSourceRef,
} from "./job-discovery.types";

export class JobDiscoveryPersistenceError extends Error {
  constructor(readonly operation: "preferences-read" | "preferences-save" | "jobs-read" | "job-save" | "runs-read") {
    super(`CareerOS job discovery ${operation} failed`);
    this.name = "JobDiscoveryPersistenceError";
  }
}

type RawPreferencesRow = {
  user_id: string;
  exact_titles: string[];
  adjacent_titles: string[];
  seniority: string[];
  industries: string[];
  locations: string[];
  salary_min: number | null;
  salary_currency: string;
  workplace_types: JobSearchPreferences["workplaceTypes"];
  employment_types: JobSearchPreferences["employmentTypes"];
  include_uk: boolean;
  include_global_uk_hireable: boolean;
  include_relocation_sponsorship: boolean;
  email_alerts_enabled: boolean;
  derived_from_profile_at: string | null;
  manual_overrides: Record<string, boolean>;
  created_at: string;
  updated_at: string;
};

type RawDiscoveredJobRow = {
  id: string;
  user_id: string;
  dedupe_key: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  description_word_count: number;
  industry: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_text: string | null;
  workplace_type: DiscoveredJob["workplaceType"];
  employment_type: DiscoveredJob["employmentType"];
  date_posted: string | null;
  closing_date: string | null;
  uk_eligibility: DiscoveredJob["ukEligibility"];
  visa_sponsorship: DiscoveredJob["visaSponsorship"];
  match_type: DiscoveredJob["matchType"];
  source_refs: JobSourceRef[];
  preferred_source_url: string | null;
  preferred_apply_url: string | null;
  status: DiscoveredJob["status"];
  status_reason: string;
  last_status_check_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  archived_at: string | null;
  saved: boolean;
  fit_score: number | null;
  fit_verdict: DiscoveredJob["fitVerdict"];
  fit_strategy: DiscoveredJob["fitStrategy"];
  fit_scored_at: string | null;
  fit_description_signature: string | null;
  created_at: string;
  updated_at: string;
};

type RawRunRow = {
  id: string;
  user_id: string;
  run_kind: JobDiscoveryRun["runKind"];
  run_day: string;
  started_at: string;
  completed_at: string | null;
  status: JobDiscoveryRun["status"];
  source_results: Record<string, unknown>;
  new_jobs: number;
  updated_jobs: number;
  archived_jobs: number;
  email_sent_at: string | null;
  error_summary: string | null;
};

const PREFERENCE_COLUMNS =
  "user_id,exact_titles,adjacent_titles,seniority,industries,locations,salary_min,salary_currency,workplace_types,employment_types,include_uk,include_global_uk_hireable,include_relocation_sponsorship,email_alerts_enabled,derived_from_profile_at,manual_overrides,created_at,updated_at";

const JOB_COLUMNS =
  "id,user_id,dedupe_key,title,company,location,description,description_word_count,industry,seniority,salary_min,salary_max,salary_currency,salary_text,workplace_type,employment_type,date_posted,closing_date,uk_eligibility,visa_sponsorship,match_type,source_refs,preferred_source_url,preferred_apply_url,status,status_reason,last_status_check_at,first_seen_at,last_seen_at,archived_at,saved,fit_score,fit_verdict,fit_strategy,fit_scored_at,fit_description_signature,created_at,updated_at";

const RUN_COLUMNS =
  "id,user_id,run_kind,run_day,started_at,completed_at,status,source_results,new_jobs,updated_jobs,archived_jobs,email_sent_at,error_summary";

function mapPreferences(row: RawPreferencesRow): JobSearchPreferences {
  return {
    userId: row.user_id,
    exactTitles: row.exact_titles,
    adjacentTitles: row.adjacent_titles,
    seniority: row.seniority,
    industries: row.industries,
    locations: row.locations,
    salaryMin: row.salary_min,
    salaryCurrency: row.salary_currency,
    workplaceTypes: row.workplace_types,
    employmentTypes: row.employment_types,
    includeUk: row.include_uk,
    includeGlobalUkHireable: row.include_global_uk_hireable,
    includeRelocationSponsorship: row.include_relocation_sponsorship,
    emailAlertsEnabled: row.email_alerts_enabled,
    derivedFromProfileAt: row.derived_from_profile_at,
    manualOverrides: row.manual_overrides ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function preferencesRow(preferences: JobSearchPreferences, userId: string) {
  return {
    user_id: userId,
    exact_titles: preferences.exactTitles,
    adjacent_titles: preferences.adjacentTitles,
    seniority: preferences.seniority,
    industries: preferences.industries,
    locations: preferences.locations,
    salary_min: preferences.salaryMin,
    salary_currency: preferences.salaryCurrency,
    workplace_types: preferences.workplaceTypes,
    employment_types: preferences.employmentTypes,
    include_uk: preferences.includeUk,
    include_global_uk_hireable: preferences.includeGlobalUkHireable,
    include_relocation_sponsorship: preferences.includeRelocationSponsorship,
    email_alerts_enabled: preferences.emailAlertsEnabled,
    derived_from_profile_at: preferences.derivedFromProfileAt,
    manual_overrides: preferences.manualOverrides,
  };
}

function mapJob(row: RawDiscoveredJobRow): DiscoveredJob {
  return {
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
  };
}

function mapRun(row: RawRunRow): JobDiscoveryRun {
  return {
    id: row.id,
    userId: row.user_id,
    runKind: row.run_kind,
    runDay: row.run_day,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    sourceResults: row.source_results ?? {},
    newJobs: row.new_jobs,
    updatedJobs: row.updated_jobs,
    archivedJobs: row.archived_jobs,
    emailSentAt: row.email_sent_at,
    errorSummary: row.error_summary,
  };
}

export function createJobDiscoveryRepository(client: SupabaseClient, userId: string) {
  return {
    async loadPreferences(): Promise<JobSearchPreferences | null> {
      const { data, error } = await client
        .from("job_search_preferences")
        .select(PREFERENCE_COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new JobDiscoveryPersistenceError("preferences-read");
      return data ? mapPreferences(data as RawPreferencesRow) : null;
    },

    async savePreferences(preferences: JobSearchPreferences): Promise<JobSearchPreferences> {
      const { data, error } = await client
        .from("job_search_preferences")
        .upsert(preferencesRow(preferences, userId), { onConflict: "user_id" })
        .select(PREFERENCE_COLUMNS)
        .single();
      if (error || !data) throw new JobDiscoveryPersistenceError("preferences-save");
      return mapPreferences(data as RawPreferencesRow);
    },

    async listJobs(): Promise<DiscoveredJob[]> {
      const { data, error } = await client
        .from("discovered_jobs")
        .select(JOB_COLUMNS)
        .eq("user_id", userId)
        .order("first_seen_at", { ascending: false });
      if (error) throw new JobDiscoveryPersistenceError("jobs-read");
      return Array.isArray(data) ? data.map((row) => mapJob(row as RawDiscoveredJobRow)) : [];
    },

    async setSaved(jobId: string, saved: boolean): Promise<void> {
      const { error } = await client
        .from("discovered_jobs")
        .update({ saved })
        .eq("user_id", userId)
        .eq("id", jobId)
        .select("id,saved")
        .single();
      if (error) throw new JobDiscoveryPersistenceError("job-save");
    },

    async listRuns(): Promise<JobDiscoveryRun[]> {
      const { data, error } = await client
        .from("job_discovery_runs")
        .select(RUN_COLUMNS)
        .eq("user_id", userId)
        .order("started_at", { ascending: false });
      if (error) throw new JobDiscoveryPersistenceError("runs-read");
      return Array.isArray(data) ? data.map((row) => mapRun(row as RawRunRow)) : [];
    },
  };
}
