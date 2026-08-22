import { mergeSourceRefs } from "./job-discovery.domain";
import { normaliseRawJob } from "./job-discovery.normalise";
import type {
  DiscoveryEnv,
  JobDiscoveryAdapter,
  JobDiscoveryQuery,
  JobDiscoverySourceResult,
} from "./job-discovery.providers";
import type { DiscoveredJob, JobSearchPreferences } from "./job-discovery.types";
import { runScan } from "./scoring";
import type { CareerOsData, JobRecord } from "./types";

const RELIABLE_DESCRIPTION_WORDS = 120;

export interface JobDiscoveryRefreshRepository {
  listExistingJobs(): Promise<DiscoveredJob[]>;
  upsertJobs(userId: string, jobs: DiscoveredJob[]): Promise<void>;
}

export interface JobDiscoveryRefreshInput {
  userId: string;
  preferences: JobSearchPreferences;
  careerState: CareerOsData;
  adapters: JobDiscoveryAdapter[];
  env: DiscoveryEnv;
  repository: JobDiscoveryRefreshRepository;
  now?: Date;
}

export interface JobDiscoveryRefreshResult {
  jobs: DiscoveredJob[];
  sourceResults: Record<
    string,
    { status: JobDiscoverySourceResult["status"]; count: number; message?: string }
  >;
}

function searchQuery(preferences: JobSearchPreferences): JobDiscoveryQuery {
  return {
    country: "gb",
    page: 1,
    resultsPerPage: 50,
    what: preferences.exactTitles[0] ?? preferences.adjacentTitles[0] ?? "",
    where: preferences.locations[0] ?? "",
    salaryMin: preferences.salaryMin,
    employmentTypes: preferences.employmentTypes,
  };
}

function betterApplyUrl(current: DiscoveredJob, incoming: DiscoveredJob) {
  return incoming.preferredApplyUrl ?? current.preferredApplyUrl;
}

function mergeIncomingJobs(current: DiscoveredJob, incoming: DiscoveredJob): DiscoveredJob {
  return {
    ...current,
    description:
      incoming.descriptionWordCount > current.descriptionWordCount
        ? incoming.description
        : current.description,
    descriptionWordCount: Math.max(current.descriptionWordCount, incoming.descriptionWordCount),
    industry: current.industry ?? incoming.industry,
    seniority: current.seniority ?? incoming.seniority,
    salaryMin: current.salaryMin ?? incoming.salaryMin,
    salaryMax: current.salaryMax ?? incoming.salaryMax,
    salaryCurrency: current.salaryCurrency ?? incoming.salaryCurrency,
    salaryText: current.salaryText ?? incoming.salaryText,
    workplaceType: current.workplaceType ?? incoming.workplaceType,
    employmentType: current.employmentType ?? incoming.employmentType,
    datePosted: current.datePosted ?? incoming.datePosted,
    closingDate: current.closingDate ?? incoming.closingDate,
    ukEligibility:
      current.ukEligibility === "unknown" ? incoming.ukEligibility : current.ukEligibility,
    visaSponsorship:
      current.visaSponsorship === "unknown" ? incoming.visaSponsorship : current.visaSponsorship,
    matchType:
      current.matchType === "other" && incoming.matchType !== "other"
        ? incoming.matchType
        : current.matchType,
    sourceRefs: mergeSourceRefs(current.sourceRefs, incoming.sourceRefs),
    preferredSourceUrl: current.preferredSourceUrl ?? incoming.preferredSourceUrl,
    preferredApplyUrl: betterApplyUrl(current, incoming),
    status:
      current.status === "active" || current.status === "closing_soon"
        ? current.status
        : incoming.status,
    statusReason:
      current.status === "active" || current.status === "closing_soon"
        ? current.statusReason
        : incoming.statusReason,
    lastStatusCheckAt: incoming.lastStatusCheckAt ?? current.lastStatusCheckAt,
    lastSeenAt: incoming.lastSeenAt,
    archivedAt: incoming.status === "expired" ? incoming.archivedAt : null,
    updatedAt: incoming.updatedAt,
  };
}

function mergeExistingJob(existing: DiscoveredJob, incoming: DiscoveredJob): DiscoveredJob {
  const merged = mergeIncomingJobs(existing, incoming);
  return {
    ...merged,
    id: existing.id,
    userId: existing.userId,
    firstSeenAt: existing.firstSeenAt,
    createdAt: existing.createdAt,
    saved: existing.saved,
    sourceRefs: mergeSourceRefs(existing.sourceRefs, incoming.sourceRefs),
    fitScore: existing.fitScore,
    fitVerdict: existing.fitVerdict,
    fitStrategy: existing.fitStrategy,
    fitScoredAt: existing.fitScoredAt,
    fitDescriptionSignature: existing.fitDescriptionSignature,
  };
}

function scoreReliableJob(job: DiscoveredJob, careerState: CareerOsData, now: Date): DiscoveredJob {
  if (!job.description || job.descriptionWordCount < RELIABLE_DESCRIPTION_WORDS) return job;

  const record: JobRecord = {
    id: job.id,
    company: job.company,
    title: job.title,
    location: job.location ?? "",
    url: job.preferredApplyUrl ?? job.preferredSourceUrl ?? undefined,
    description: job.description,
    createdAt: job.firstSeenAt,
    sourceType: "url",
    descriptionWordCount: job.descriptionWordCount,
  };
  const scan = runScan(record, careerState);

  return {
    ...job,
    fitScore: scan.overall,
    fitVerdict: scan.verdict,
    fitStrategy: scan.strategy,
    fitScoredAt: now.toISOString(),
    fitDescriptionSignature: scan.jobDescriptionSignature,
  };
}

function resultSummary(result: JobDiscoverySourceResult) {
  if (result.status === "success") {
    return { status: result.status, count: result.jobs.length };
  }
  return { status: result.status, count: 0, message: result.message };
}

export async function runJobDiscoveryRefresh(
  input: JobDiscoveryRefreshInput,
): Promise<JobDiscoveryRefreshResult> {
  const now = input.now ?? new Date();
  const query = searchQuery(input.preferences);
  const sourceResults: JobDiscoveryRefreshResult["sourceResults"] = {};
  const incomingByKey = new Map<string, DiscoveredJob>();

  for (const adapter of input.adapters) {
    if (!adapter.isConfigured(input.env)) {
      sourceResults[adapter.id] = {
        status: "unavailable",
        count: 0,
        message: `${adapter.label} is not configured.`,
      };
      continue;
    }

    let result: JobDiscoverySourceResult;
    try {
      result = await adapter.search(query, input.env);
    } catch {
      result = {
        status: "error",
        jobs: [],
        message: `${adapter.label} could not be refreshed.`,
      };
    }
    sourceResults[adapter.id] = resultSummary(result);
    if (result.status !== "success") continue;

    for (const raw of result.jobs) {
      const normalised = normaliseRawJob(raw, { ...input.preferences, userId: input.userId }, now);
      const current = incomingByKey.get(normalised.dedupeKey);
      incomingByKey.set(
        normalised.dedupeKey,
        current ? mergeIncomingJobs(current, normalised) : normalised,
      );
    }
  }

  const existing = await input.repository.listExistingJobs();
  const existingByKey = new Map(existing.map((job) => [job.dedupeKey, job]));
  const jobs = [...incomingByKey.values()].map((incoming) => {
    const prior = existingByKey.get(incoming.dedupeKey);
    return scoreReliableJob(
      prior ? mergeExistingJob(prior, incoming) : incoming,
      input.careerState,
      now,
    );
  });

  await input.repository.upsertJobs(input.userId, jobs);
  return { jobs, sourceResults };
}

function sameUtcDay(value: string, now: Date) {
  const date = new Date(value);
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

export function selectDailyShortlist(jobs: DiscoveredJob[], now = new Date(), limit = 10) {
  return jobs
    .filter(
      (job) =>
        job.ukEligibility !== "excluded" &&
        sameUtcDay(job.firstSeenAt, now) &&
        (job.status === "active" || job.status === "closing_soon"),
    )
    .sort((left, right) => {
      const fitDifference = (right.fitScore ?? -1) - (left.fitScore ?? -1);
      if (fitDifference !== 0) return fitDifference;
      return new Date(right.firstSeenAt).getTime() - new Date(left.firstSeenAt).getTime();
    })
    .slice(0, Math.max(0, limit));
}
