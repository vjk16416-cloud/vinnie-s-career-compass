import { adzunaAdapter } from "./job-discovery.adzuna";
import { sendDailyJobShortlist, type JobDiscoveryEmailResult } from "./job-discovery.email";
import { runJobDiscoveryRefresh } from "./job-discovery.orchestrator";
import {
  createJobDiscoveryServiceClient,
  createServiceRefreshRepository,
  findScheduledRun,
  finishDiscoveryRun,
  getUserEmail,
  listPreferenceUsers,
  loadCareerStateForUser,
  markDiscoveryEmailSent,
  startDiscoveryRun,
  type JobDiscoveryServerEnv,
} from "./job-discovery.server";
import type { DiscoveredJob, JobSearchPreferences } from "./job-discovery.types";
import { checkDirectJobStatus } from "./job-status.server";

export interface ScheduledCoreDependencies {
  listPreferences(): Promise<JobSearchPreferences[]>;
  findExistingRun(
    userId: string,
    runDay: string,
  ): Promise<{ id: string; emailSentAt: string | null } | null>;
  runForUser(preferences: JobSearchPreferences): Promise<{
    runId: string;
    jobs: DiscoveredJob[];
    email: string | null;
    alreadyEmailed: boolean;
  }>;
  sendEmail(input: {
    preferences: JobSearchPreferences;
    jobs: DiscoveredJob[];
    to: string;
    now: Date;
    runAlreadyEmailed: boolean;
  }): Promise<JobDiscoveryEmailResult>;
  markEmailSent?(runId: string, sentAt: string): Promise<void> | void;
}

export async function runScheduledJobDiscoveryCore(now: Date, deps: ScheduledCoreDependencies) {
  const runDay = now.toISOString().slice(0, 10);
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let emailed = 0;

  const preferencesList = await deps.listPreferences();
  for (const preferences of preferencesList) {
    const existing = await deps.findExistingRun(preferences.userId, runDay);
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      const result = await deps.runForUser(preferences);
      completed += 1;
      if (!result.email) continue;
      const emailResult = await deps.sendEmail({
        preferences,
        jobs: result.jobs,
        to: result.email,
        now,
        runAlreadyEmailed: result.alreadyEmailed,
      });
      if (emailResult.status === "sent") {
        emailed += 1;
        await deps.markEmailSent?.(result.runId, emailResult.sentAt);
      }
    } catch {
      failed += 1;
    }
  }

  return { completed, skipped, failed, emailed };
}

async function verifyUncertainJobs(jobs: DiscoveredJob[], now: Date) {
  const checked: DiscoveredJob[] = [];
  for (const job of jobs) {
    const url = job.preferredApplyUrl ?? job.preferredSourceUrl;
    if (job.status !== "uncertain" || !url) {
      checked.push(job);
      continue;
    }
    const status = await checkDirectJobStatus(url);
    checked.push({
      ...job,
      status: status.status,
      statusReason: status.reason,
      lastStatusCheckAt: now.toISOString(),
      archivedAt: status.status === "expired" ? now.toISOString() : job.archivedAt,
      updatedAt: now.toISOString(),
    });
  }
  return checked;
}

export async function runScheduledJobDiscovery(env: JobDiscoveryServerEnv, now = new Date()) {
  const service = createJobDiscoveryServiceClient(env);

  return runScheduledJobDiscoveryCore(now, {
    listPreferences: () => listPreferenceUsers(service),
    findExistingRun: async (userId, runDay) => {
      const run = await findScheduledRun(service, userId, runDay);
      return run ? { id: run.id, emailSentAt: run.email_sent_at } : null;
    },
    runForUser: async (preferences) => {
      const startedAt = now.toISOString();
      const runDay = startedAt.slice(0, 10);
      const run = await startDiscoveryRun(service, {
        userId: preferences.userId,
        runKind: "scheduled",
        runDay,
        startedAt,
      });
      try {
        const careerState = await loadCareerStateForUser(service, preferences.userId);
        if (!careerState)
          throw new Error("CareerOS career state is unavailable for scheduled discovery.");
        const repository = createServiceRefreshRepository(service, preferences.userId);
        const before = await repository.listExistingJobs();
        const result = await runJobDiscoveryRefresh({
          userId: preferences.userId,
          preferences,
          careerState,
          adapters: [adzunaAdapter],
          env,
          repository,
          now,
        });
        const jobs = await verifyUncertainJobs(result.jobs, now);
        await repository.upsertJobs(preferences.userId, jobs);

        const priorKeys = new Set(before.map((job) => job.dedupeKey));
        const newJobs = jobs.filter((job) => !priorKeys.has(job.dedupeKey)).length;
        const sourceStates = Object.values(result.sourceResults).map((source) => source.status);
        const status = sourceStates.every((state) => state === "success") ? "success" : "partial";
        await finishDiscoveryRun(service, {
          id: run.id,
          status,
          sourceResults: result.sourceResults,
          newJobs,
          updatedJobs: Math.max(0, jobs.length - newJobs),
          archivedJobs: jobs.filter((job) => job.status === "expired").length,
          completedAt: now.toISOString(),
          errorSummary:
            status === "partial"
              ? "One or more automatic job sources are unavailable or returned an error."
              : null,
        });
        return {
          runId: run.id,
          jobs,
          email: await getUserEmail(service, preferences.userId),
          alreadyEmailed: Boolean(run.emailSentAt),
        };
      } catch (error) {
        await finishDiscoveryRun(service, {
          id: run.id,
          status: "failed",
          sourceResults: {},
          newJobs: 0,
          updatedJobs: 0,
          archivedJobs: 0,
          completedAt: now.toISOString(),
          errorSummary: error instanceof Error ? error.message : "Scheduled discovery failed.",
        });
        throw error;
      }
    },
    sendEmail: (input) => sendDailyJobShortlist(input, env),
    markEmailSent: (runId, sentAt) => markDiscoveryEmailSent(service, runId, sentAt),
  });
}
