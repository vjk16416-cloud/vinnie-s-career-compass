import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthorisedUser } from "@/lib/auth/auth.server";
import { createRequestSupabase } from "@/lib/auth/supabase.server";
import { adzunaAdapter } from "./job-discovery.adzuna";
import { runJobDiscoveryRefresh } from "./job-discovery.orchestrator";
import { remotiveAdapter } from "./job-discovery.remotive";
import { createJobDiscoveryRepository } from "./job-discovery.repository";
import {
  createJobDiscoveryServiceClient,
  createServiceRefreshRepository,
  finishDiscoveryRun,
  loadCareerStateForUser,
  readJobDiscoveryServerEnv,
  startDiscoveryRun,
} from "./job-discovery.server";
import type { JobSearchPreferences } from "./job-discovery.types";
import { deriveJobSearchPreferences, mergePreferenceOverrides } from "./job-search-preferences";
import { createCareerOsData } from "./profile-data";
import type { CareerOsData } from "./types";

const Workplace = z.enum(["Remote", "Hybrid", "On-site", "Unspecified"]);
const Employment = z.enum(["Permanent", "Contract", "Fixed-term", "Unspecified"]);

const PreferencesInput = z.object({
  exactTitles: z.array(z.string().trim().min(1)).max(20),
  adjacentTitles: z.array(z.string().trim().min(1)).max(30),
  seniority: z.array(z.string().trim().min(1)).max(20),
  industries: z.array(z.string().trim().min(1)).max(30),
  locations: z.array(z.string().trim().min(1)).max(30),
  salaryMin: z.number().int().nonnegative().nullable(),
  salaryCurrency: z.string().trim().min(3).max(3),
  workplaceTypes: z.array(Workplace),
  employmentTypes: z.array(Employment),
  includeUk: z.boolean(),
  includeGlobalUkHireable: z.boolean(),
  includeRelocationSponsorship: z.boolean(),
  emailAlertsEnabled: z.boolean(),
  derivedFromProfileAt: z.string().nullable().optional(),
  manualOverrides: z.record(z.string(), z.boolean()).optional(),
});

const SavedInput = z.object({ jobId: z.string().uuid(), saved: z.boolean() });

async function readCareerState(client: ReturnType<typeof createRequestSupabase>, userId: string) {
  const { data, error } = await client
    .from("career_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("CareerOS could not read your career profile for job discovery.");
  return ((data?.data as CareerOsData | undefined) ?? createCareerOsData()) as CareerOsData;
}

function deriveForUser(userId: string, careerState: CareerOsData, now = new Date()) {
  return deriveJobSearchPreferences({
    userId,
    profile: careerState.profile,
    profileItems: careerState.profileItems,
    now,
  });
}

export const getJobBoard = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireAuthorisedUser();
  const client = createRequestSupabase();
  const repository = createJobDiscoveryRepository(client, user.id);
  const careerState = await readCareerState(client, user.id);
  const stored = await repository.loadPreferences();
  const derived = deriveForUser(user.id, careerState);
  const preferences = mergePreferenceOverrides(derived, stored);
  const persisted = stored ? preferences : await repository.savePreferences(preferences);
  const [jobs, runs] = await Promise.all([repository.listJobs(), repository.listRuns()]);

  return {
    preferences: persisted,
    jobs,
    runs,
    lastRefreshedAt: runs[0]?.completedAt ?? null,
  };
});

export const saveJobSearchPreferences = createServerFn({ method: "POST" })
  .validator((data: unknown) => PreferencesInput.parse(data))
  .handler(async ({ data }) => {
    const user = await requireAuthorisedUser();
    const client = createRequestSupabase();
    const repository = createJobDiscoveryRepository(client, user.id);
    const current = await repository.loadPreferences();
    const now = new Date().toISOString();
    const preferences: JobSearchPreferences = {
      userId: user.id,
      exactTitles: data.exactTitles,
      adjacentTitles: data.adjacentTitles,
      seniority: data.seniority,
      industries: data.industries,
      locations: data.locations,
      salaryMin: data.salaryMin,
      salaryCurrency: data.salaryCurrency.toUpperCase(),
      workplaceTypes: data.workplaceTypes,
      employmentTypes: data.employmentTypes,
      includeUk: data.includeUk,
      includeGlobalUkHireable: data.includeGlobalUkHireable,
      includeRelocationSponsorship: data.includeRelocationSponsorship,
      emailAlertsEnabled: data.emailAlertsEnabled,
      derivedFromProfileAt: data.derivedFromProfileAt ?? current?.derivedFromProfileAt ?? null,
      manualOverrides: data.manualOverrides ?? current?.manualOverrides ?? {},
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    return repository.savePreferences(preferences);
  });

export const setJobSaved = createServerFn({ method: "POST" })
  .validator((data: unknown) => SavedInput.parse(data))
  .handler(async ({ data }) => {
    const user = await requireAuthorisedUser();
    const repository = createJobDiscoveryRepository(createRequestSupabase(), user.id);
    await repository.setSaved(data.jobId, data.saved);
    return { ok: true as const };
  });

export const refreshJobs = createServerFn({ method: "POST" }).handler(async () => {
  const user = await requireAuthorisedUser();
  const env = readJobDiscoveryServerEnv();

  try {
    const service = createJobDiscoveryServiceClient(env);
    const careerState = await loadCareerStateForUser(service, user.id);
    if (!careerState) {
      return {
        ok: false as const,
        reason: "CareerOS career state is not available for discovery.",
      };
    }

    const requestRepository = createJobDiscoveryRepository(service, user.id);
    const stored = await requestRepository.loadPreferences();
    const preferences = mergePreferenceOverrides(deriveForUser(user.id, careerState), stored);
    if (!stored) await requestRepository.savePreferences(preferences);

    const refreshRepository = createServiceRefreshRepository(service, user.id);
    const before = await refreshRepository.listExistingJobs();
    const startedAt = new Date().toISOString();
    const runDay = startedAt.slice(0, 10);
    const run = await startDiscoveryRun(service, {
      userId: user.id,
      runKind: "manual",
      runDay,
      startedAt,
    });

    try {
      const result = await runJobDiscoveryRefresh({
        userId: user.id,
        preferences,
        careerState,
        adapters: [remotiveAdapter, adzunaAdapter],
        env,
        repository: refreshRepository,
      });
      const priorKeys = new Set(before.map((job) => job.dedupeKey));
      const newJobs = result.jobs.filter((job) => !priorKeys.has(job.dedupeKey)).length;
      const sourceStates = Object.values(result.sourceResults).map((source) => source.status);
      const status = sourceStates.every((state) => state === "success") ? "success" : "partial";
      await finishDiscoveryRun(service, {
        id: run.id,
        status,
        sourceResults: result.sourceResults,
        newJobs,
        updatedJobs: Math.max(0, result.jobs.length - newJobs),
        archivedJobs: result.jobs.filter((job) => job.status === "expired").length,
        completedAt: new Date().toISOString(),
        errorSummary:
          status === "partial"
            ? "One or more automatic job sources are unavailable or returned an error."
            : null,
      });
      return {
        ok: true as const,
        sourceResults: result.sourceResults,
        jobs: result.jobs,
        refreshedAt: new Date().toISOString(),
      };
    } catch (error) {
      await finishDiscoveryRun(service, {
        id: run.id,
        status: "failed",
        sourceResults: {},
        newJobs: 0,
        updatedJobs: 0,
        archivedJobs: 0,
        completedAt: new Date().toISOString(),
        errorSummary: error instanceof Error ? error.message : "Discovery refresh failed.",
      });
      throw error;
    }
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof Error ? error.message : "Automatic discovery is not configured.",
    };
  }
});
